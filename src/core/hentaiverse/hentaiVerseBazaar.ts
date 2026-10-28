import type { HentaiVerseFormData, HentaiVersePageTarget } from './model/hentaiVerse'
import {
  translateHentaiVerseDescription,
  translateHentaiVerseText,
} from './hentaiVerseTranslations'

export interface HentaiVerseBazaarLink {
  label: string
  query: Record<string, string>
  active: boolean
}

export interface HentaiVerseBazaarItem {
  id: string
  name: string
  stock: number
  price: number
  description: string
  mode: 'item_pane' | 'shop_pane' | 'shrine'
  required: number
}

export interface HentaiVerseBazaarTable {
  title: string
  headers: string[]
  rawHeaders?: string[]
  rows: {
    cells: string[]
    rawCells?: string[]
    primaryCells?: string[]
    query?: Record<string, string>
  }[]
}

export interface HentaiVerseMarketOrder {
  side: 'buy' | 'sell'
  hidden: Record<string, string>
  countName: string
  priceName: string
  actionName: string
  actionValue: string
  count: number
  price: number
  maxCount: number
}

export interface HentaiVerseBazaarPage {
  kind: 'itemShop' | 'market' | 'shrine'
  navigation: HentaiVerseBazaarLink[]
  filters: HentaiVerseBazaarLink[]
  stockFilters: HentaiVerseBazaarLink[]
  links: HentaiVerseBazaarLink[]
  items: HentaiVerseBazaarItem[]
  hidden: Record<string, string>
  credits: number
  marketBalance: number
  tables: HentaiVerseBazaarTable[]
  notices: string[]
  emptyReason: string
  itemName: string
  itemInfo: string
  batchSize: number
  playerStock: number
  orders: HentaiVerseMarketOrder[]
  transfers: { name: string; value: string; label: string }[]
  rewards: { type: string; slot: string; label: string }[]
  shrineInfo: { kind: 'info' | 'artifact' | 'trophy' | 'collectible'; paragraphs: string[] }[]
}

function text(node: Element | null | undefined): string {
  return (node?.textContent || '').replace(/\s+/g, ' ').trim()
}

function numeric(value: string | null | undefined): number {
  return Number((value || '').replace(/[^\d.-]/g, '')) || 0
}

function hiddenFields(form: Element | null): Record<string, string> {
  return Object.fromEntries(
    [...(form?.querySelectorAll<HTMLInputElement>('input[type="hidden"][name]') || [])].map(
      (input) => [input.name, input.value],
    ),
  )
}

/** Restrict source links to this feature; never expose arbitrary script navigation. */
function queryFromUrl(value: string): Record<string, string> | undefined {
  try {
    const url = new URL(value, 'https://hentaiverse.org/')
    if (
      url.origin !== 'https://hentaiverse.org' ||
      !['/', '/isekai/'].includes(url.pathname) ||
      url.searchParams.get('s') !== 'Bazaar'
    )
      return
    if (!['is', 'mk', 'ss'].includes(url.searchParams.get('ss') || '')) return
    const allowed = new Set([
      's',
      'ss',
      'filter',
      'screen',
      'itemid',
      'tradelog',
      'playerstock',
      'marketstock',
    ])
    // Dropping a detail/pagination key would silently navigate to another page.
    if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) return
    return Object.fromEntries(url.searchParams)
  } catch {
    return
  }
}

function readLinks(root: Element | null, selector = 'a[href]'): HentaiVerseBazaarLink[] {
  return [...(root?.querySelectorAll<HTMLAnchorElement>(selector) || [])].flatMap((anchor) => {
    const query = queryFromUrl(anchor.getAttribute('href') || '')
    return query
      ? [
          {
            label: translateHentaiVerseText(text(anchor)),
            query,
            active: !!anchor.querySelector('.cfbs, .market_cur'),
          },
        ]
      : []
  })
}

function readTable(table: Element, title: string): HentaiVerseBazaarTable {
  const sourceRows = [
    ...table.querySelectorAll(
      ':scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr, :scope > tr',
    ),
  ]
  const headingRows = sourceRows.filter((row) => row.parentElement?.tagName === 'THEAD')
  const firstRow = sourceRows[0]
  const headerRow =
    headingRows.at(-1) ||
    (firstRow?.children.length && [...firstRow.children].every((cell) => cell.tagName === 'TH')
      ? firstRow
      : undefined)
  const rawHeaders = [...(headerRow?.querySelectorAll(':scope > th, :scope > td') || [])].map(text)
  const marketSchemas: Record<string, string[]> = {
    物品列表: ['', 'Your Stock', 'Market Bid', 'Market Ask', 'Market Stock'],
    市场买单: ['Count', 'Price', 'Total'],
    市场卖单: ['Count', 'Price', 'Total'],
    价格历史: ['', 'Sold', 'Low', 'Avg', 'High', 'Vol'],
    最近交易: ['', 'Seller', 'Buyer', 'Sold', 'Price'],
  }
  const marketSchema = JSON.stringify(rawHeaders) === JSON.stringify(marketSchemas[title])
  const marketHeaders: Record<string, string> = {
    Sold: '成交数量',
    Low: '最低价',
    Avg: '均价',
    High: '最高价',
    Vol: '成交额',
    Count: '数量',
  }
  const firstHeader: Record<string, string> = {
    物品列表: '物品',
    最近交易: '时间',
    价格历史: '周期',
  }
  const headers = rawHeaders.map((header, index) =>
    marketSchema
      ? marketHeaders[header] ||
        (!index && !header ? firstHeader[title] || '' : translateHentaiVerseText(header))
      : translateHentaiVerseText(header),
  )
  const rows = sourceRows.flatMap((row) => {
    if (headingRows.includes(row) || row === headerRow) return []
    const nodes = [...row.querySelectorAll(':scope > td')]
    const rawCells = nodes.map(text)
    const primaryCells = nodes.map((node) =>
      [...node.childNodes]
        .filter((child) => child.nodeType === 3)
        .map((child) => child.textContent || '')
        .join('')
        .trim(),
    )
    const cells = rawCells.map((cell, index) =>
      marketSchema && title === '最近交易' && (index === 1 || index === 2)
        ? cell
        : translateHentaiVerseText(cell),
    )
    if (!cells.length) return []
    const location = row
      .getAttribute('onclick')
      ?.match(/document\.location\s*=\s*['"]([^'"]+)['"]/)?.[1]
    return [{ cells, rawCells, primaryCells, query: location ? queryFromUrl(location) : undefined }]
  })
  return { title, headers, rawHeaders, rows }
}

function parseItemShop(document: Document, page: HentaiVerseBazaarPage) {
  if (!document.querySelector('#itshop_outer') || !document.querySelector('#shopform'))
    throw new Error('无法识别物品商店页面')
  page.hidden = hiddenFields(document.querySelector('#shopform'))
  page.credits = numeric(text(document.querySelector('#networth')))
  for (const mode of ['item_pane', 'shop_pane'] as const) {
    document.querySelectorAll(`#${mode} [onclick]`).forEach((node) => {
      const args = node
        .getAttribute('onclick')
        ?.match(
          /itemshop\.set_item\(\s*['"](?:item_pane|shop_pane)['"]\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/,
        )
      if (!args) return
      const popup = node
        .getAttribute('onmouseover')
        ?.match(/show_itemr_box\([\s\S]*?,'(?:[^'\\]|\\.)*','((?:[^'\\]|\\.)*)','/)
      page.items.push({
        id: args[1]!,
        name: translateHentaiVerseText(text(node)),
        stock: Number(args[2]),
        price: Number(args[3]),
        description: popup?.[1] ? translateHentaiVerseDescription(popup[1]) : '',
        mode,
        required: 1,
      })
    })
  }
}

function parseMarket(document: Document, page: HentaiVerseBazaarPage) {
  const root = document.querySelector('#market_outer')
  if (!root?.querySelector('#market_right')) throw new Error('无法识别市场页面')
  page.navigation = readLinks(document.querySelector('#market_left'), ':scope > a[href]')
  page.hidden = hiddenFields(document.querySelector('#market_xfer form'))
  const balances = [...root.querySelectorAll('#market_xfer .credit_balance')]
  page.credits = numeric(text(balances[0]?.lastElementChild))
  page.marketBalance = numeric(text(balances[1]?.lastElementChild))
  page.transfers = [
    ...root.querySelectorAll<HTMLInputElement>('#market_xfer input[type="submit"][name]'),
  ].map((input) => ({
    name: input.name,
    value: input.value,
    label: input.name === 'account_deposit' ? '存入市场' : '从市场取回',
  }))
  page.itemName = translateHentaiVerseText(
    text(root.querySelector('#market_itemheader > div:nth-child(2)')),
  )
  page.itemInfo = translateHentaiVerseDescription(text(root.querySelector('#market_iteminfo')))
  const script = [...document.scripts]
    .filter((entry) => !entry.src)
    .map((entry) => entry.textContent)
    .join('\n')
  page.batchSize = Number(script.match(/\bvar\s+batch_size\s*=\s*(\d+)\s*;/)?.[1]) || 1
  page.playerStock = Number(script.match(/\bvar\s+player_stock\s*=\s*(\d+)\s*;/)?.[1]) || 0
  for (const side of ['buy', 'sell'] as const) {
    const count = root.querySelector<HTMLInputElement>(`#${side}order_batchcount`)
    const price = root.querySelector<HTMLInputElement>(`#${side}order_batchprice`)
    const action = root.querySelector<HTMLInputElement>(`#${side}order_update`)
    if (!count?.form || !price || !action) continue
    page.orders.push({
      side,
      hidden: hiddenFields(count.form),
      countName: count.name,
      priceName: price.name,
      actionName: action.name,
      actionValue: action.value,
      count: numeric(count.value),
      price: numeric(price.value),
      maxCount: numeric(count.max) || 99999999,
    })
  }
  const groups = [
    ['#market_itemlist table', '物品列表'],
    ['#market_itemsell .market_itemorders table', '市场卖单'],
    ['#market_itembuy .market_itemorders table', '市场买单'],
    ['#market_price', '价格历史'],
    ['#market_recent', '最近交易'],
    ['#market_accountlog table', '资金日志'],
    ['#market_tradelog table', '交易日志'],
  ]
  for (const [selector, title] of groups) {
    root.querySelectorAll(selector!).forEach((table) => page.tables.push(readTable(table, title!)))
  }
  const detailLinks = [
    ...readLinks(
      root.querySelector('#market_itempage'),
      'a[href]:not(table a):not(#market_itemheader a)',
    ),
    ...readLinks(root).filter((link) => link.query.tradelog?.startsWith('item-')),
  ].filter((link) => !link.label.match(/^[◀▶]$/))
  page.links = [
    ...new Map(
      detailLinks.map((link) => [
        JSON.stringify(Object.entries(link.query).sort()),
        link.query.tradelog?.startsWith('item-') ? { ...link, label: '查看完整交易记录' } : link,
      ]),
    ).values(),
  ]
  const empty = root.querySelector(
    '#market_itemlist > p, #market_accountlog > p, #market_tradelog > p',
  )
  page.emptyReason = translateHentaiVerseText(text(empty))
}

function parseShrine(document: Document, page: HentaiVerseBazaarPage) {
  if (!document.querySelector('#shrine_outer') || !document.querySelector('#shopform'))
    throw new Error('无法识别神殿页面')
  page.hidden = hiddenFields(document.querySelector('#shopform'))
  document.querySelectorAll('#inv_item [onclick]').forEach((node) => {
    const args = node
      .getAttribute('onclick')
      ?.match(/snowflake\.set_shrine_item\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
    if (!args) return
    page.items.push({
      id: args[1]!,
      name: translateHentaiVerseText(text(node)),
      stock: Number(args[2]),
      required: Number(args[3]),
      price: 0,
      description: '',
      mode: 'shrine',
    })
  })
  document.querySelectorAll<HTMLInputElement>('#accept_equip input[onclick]').forEach((input) => {
    const args = input
      .getAttribute('onclick')
      ?.match(/submit_shrine_reward\(['"]([a-z_12]+)['"],['"](\d*)['"]\)/)
    if (!args) return
    page.rewards.push({
      type: args[1]!,
      slot: args[2]!,
      label: translateHentaiVerseText(input.value),
    })
  })
  for (const kind of ['info', 'artifact', 'trophy', 'collectible'] as const) {
    const root = document.querySelector(`#shrine_${kind}`)
    page.shrineInfo.push({
      kind,
      paragraphs: [...(root?.querySelectorAll('p, li') || [])]
        .map((node) => translateHentaiVerseDescription(text(node)))
        .filter(Boolean),
    })
  }
  if (!page.items.length) page.emptyReason = '当前没有可提交的祭品'
}

/** Parse only observed DOM/form protocols. No source JavaScript is executed. */
export function parseHentaiVerseBazaar(
  document: Document,
  target: HentaiVersePageTarget,
): HentaiVerseBazaarPage {
  if (target.s !== 'Bazaar' || !['is', 'mk', 'ss'].includes(target.ss || ''))
    throw new Error('无效的集市页面')
  const page: HentaiVerseBazaarPage = {
    kind: target.ss === 'is' ? 'itemShop' : target.ss === 'mk' ? 'market' : 'shrine',
    navigation: [],
    filters: readLinks(document.querySelector('#filterbar')),
    stockFilters: [],
    links: [],
    items: [],
    hidden: {},
    credits: 0,
    marketBalance: 0,
    tables: [],
    notices: [...document.querySelectorAll('#messagebox')].map(text).filter(Boolean),
    emptyReason: '',
    itemName: '',
    itemInfo: '',
    batchSize: 1,
    playerStock: 0,
    orders: [],
    transfers: [],
    rewards: [],
    shrineInfo: [],
  }
  if (page.kind === 'itemShop') parseItemShop(document, page)
  else if (page.kind === 'market') parseMarket(document, page)
  else parseShrine(document, page)
  const current = Object.fromEntries(
    Object.entries(target).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )
  page.stockFilters = [
    ...document.querySelectorAll<HTMLInputElement>(
      '#form_market_itemfilter input[type="checkbox"][name]',
    ),
  ].map((input) => {
    const query = { ...current }
    if (input.checked) delete query[input.name]
    else query[input.name] = input.value
    return {
      label: input.name === 'playerstock' ? '仅显示可出售库存' : '仅显示可购买库存',
      active: input.checked,
      query,
    }
  })
  return page
}

/** Source market uses 1/2/5 steps at each order of magnitude. */
export function hentaiVerseMarketPriceStep(price: number): number {
  let scaled = price
  let step = 1
  while (scaled >= 1000) {
    step *= 10
    scaled /= 10
  }
  return step * (scaled >= 500 ? 5 : scaled >= 200 ? 2 : 1)
}

export function buildHentaiVerseShopTransaction(
  page: HentaiVerseBazaarPage,
  item: HentaiVerseBazaarItem,
  count: number,
): HentaiVerseFormData {
  if (
    page.kind !== 'itemShop' ||
    item.mode === 'shrine' ||
    !page.items.includes(item) ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > Math.min(99999, item.stock)
  )
    throw new Error('物品数量无效')
  if (item.mode === 'shop_pane' && count * item.price > page.credits) throw new Error('信用点不足')
  return {
    ...page.hidden,
    select_mode: item.mode,
    select_item: item.id,
    select_count: String(count),
  }
}

export function buildHentaiVerseMarketOrder(
  page: HentaiVerseBazaarPage,
  order: HentaiVerseMarketOrder,
  count: number,
  price: number,
): HentaiVerseFormData {
  if (
    !page.orders.includes(order) ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > order.maxCount ||
    !Number.isInteger(price) ||
    price < 10 ||
    price > 100000000 ||
    price % hentaiVerseMarketPriceStep(price)
  )
    throw new Error('订单数量或价格无效')
  if (order.side === 'buy' && count * price > page.marketBalance) throw new Error('市场余额不足')
  if (order.side === 'sell' && count * page.batchSize > page.playerStock)
    throw new Error('可出售库存不足')
  return {
    ...order.hidden,
    [order.countName]: String(count),
    [order.priceName]: String(price),
    [order.actionName]: order.actionValue,
  }
}

/** Validate the observed market account form without sending a request. */
export function buildHentaiVerseMarketTransfer(
  page: HentaiVerseBazaarPage,
  transfer: HentaiVerseBazaarPage['transfers'][number],
  amount: number,
): HentaiVerseFormData {
  const limit = transfer.name === 'account_deposit' ? page.credits : page.marketBalance
  if (
    page.kind !== 'market' ||
    !page.transfers.includes(transfer) ||
    !Number.isInteger(amount) ||
    amount < 1 ||
    amount > Math.min(999999999, limit)
  )
    throw new Error('金额无效或余额不足')
  return { ...page.hidden, account_amount: String(amount), [transfer.name]: transfer.value }
}
