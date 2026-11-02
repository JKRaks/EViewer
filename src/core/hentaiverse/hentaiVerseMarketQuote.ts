import type { HentaiVerseBazaarPage, HentaiVerseBazaarTable } from './hentaiVerseBazaar'

export interface HentaiVerseMarketDepth {
  side: 'buy' | 'sell'
  levels: { batches: number; price: number }[]
  averages: { range: number; levels: number; batches: number; price: number }[]
}
export interface HentaiVerseMarketQuote {
  depth: HentaiVerseMarketDepth[]
  trades: { time: string; timestamp: number; quantity: number; price: number }[]
  periods: {
    period: string
    sold: number
    low: number
    average: number
    high: number
    volume: number
  }[]
  bid?: number
  ask?: number
  spread?: number
}

/** Only the observed source schemas are accepted; unknown layouts retain their raw table. */
function schema(table: HentaiVerseBazaarTable, headers: string[]): boolean {
  return JSON.stringify(table.rawHeaders) === JSON.stringify(headers)
}
function number(value: string | undefined): number | undefined {
  const normalized = (value || '').replace(/,/g, '').replace(/\s*C$/, '').trim()
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return
  const result = Number(normalized)
  return Number.isFinite(result) ? result : undefined
}
function sourceTimestamp(value: string): number | undefined {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/)
  if (!match) return
  const [, year, month, day, hour, minute] = match.map(Number)
  // UTC here supplies a neutral plotting coordinate; source time is never timezone-converted.
  const result = Date.UTC(year!, month! - 1, day!, hour!, minute!)
  const date = new Date(result)
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month! - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute
  )
    return
  return result
}

export function readHentaiVerseMarketQuote(page: HentaiVerseBazaarPage): HentaiVerseMarketQuote {
  const result: HentaiVerseMarketQuote = { depth: [], trades: [], periods: [] }
  for (const table of page.tables) {
    if (
      ['市场买单', '市场卖单'].includes(table.title) &&
      schema(table, ['Count', 'Price', 'Total'])
    ) {
      const levels = table.rows.flatMap((row) => {
        const batches = number(row.primaryCells?.[0])
        const price = number(row.rawCells?.[1])
        const total = number(row.rawCells?.[2])
        return batches && price !== undefined && total !== undefined && batches * price === total
          ? [{ batches, price }]
          : []
      })
      // Partial order books can misrepresent best price and depth; preserve their table instead.
      if (!levels.length || levels.length !== table.rows.length) continue
      const side = table.title === '市场买单' ? 'buy' : 'sell'
      levels.sort((a, b) => (side === 'buy' ? b.price - a.price : a.price - b.price))
      result.depth.push({
        side,
        levels,
        averages: [1, 5, 10].map((range) => {
          const selected = levels.slice(0, range)
          const batches = selected.reduce((sum, level) => sum + level.batches, 0)
          return {
            range,
            levels: selected.length,
            batches,
            price: selected.reduce((sum, level) => sum + level.batches * level.price, 0) / batches,
          }
        }),
      })
    }
    if (table.title === '最近交易' && schema(table, ['', 'Seller', 'Buyer', 'Sold', 'Price'])) {
      const trades = table.rows.flatMap((row) => {
        const time = row.rawCells?.[0] || ''
        const timestamp = sourceTimestamp(time)
        const quantity = number(row.rawCells?.[3])
        const price = number(row.rawCells?.[4])
        return timestamp !== undefined && quantity && price !== undefined
          ? [{ time, timestamp, quantity, price }]
          : []
      })
      if (trades.length === table.rows.length)
        result.trades = trades.sort((a, b) => a.timestamp - b.timestamp)
    }
    if (table.title === '价格历史' && schema(table, ['', 'Sold', 'Low', 'Avg', 'High', 'Vol'])) {
      result.periods = table.rows.flatMap((row) => {
        const cells = row.rawCells || []
        const [sold, low, average, high, volume] = cells.slice(1).map(number)
        return ['Day', 'Week', 'Month', 'Year'].includes(cells[0] || '') &&
          sold !== undefined &&
          low !== undefined &&
          average !== undefined &&
          high !== undefined &&
          volume !== undefined
          ? [{ period: cells[0]!, sold, low, average, high, volume }]
          : []
      })
    }
  }
  result.bid = result.depth.find((entry) => entry.side === 'buy')?.levels[0]?.price
  result.ask = result.depth.find((entry) => entry.side === 'sell')?.levels[0]?.price
  if (result.bid !== undefined && result.ask !== undefined) result.spread = result.ask - result.bid
  return result
}
