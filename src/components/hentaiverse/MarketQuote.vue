<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { t } from '@/i18n'
import type { HentaiVerseBazaarPage } from '@/core/hentaiverse/hentaiVerseBazaar'
import { readHentaiVerseMarketQuote } from '@/core/hentaiverse/hentaiVerseMarketQuote'
const props = defineProps<{ data: HentaiVerseBazaarPage }>()
const quote = computed(() => readHentaiVerseMarketQuote(props.data))
const selectedIndex = ref(0)
watch(
  quote,
  (value) => {
    selectedIndex.value = Math.max(0, value.trades.length - 1)
  },
  { immediate: true },
)
const selectedTrade = computed(() => quote.value.trades[selectedIndex.value])

const format = (value: number | undefined) =>
  value === undefined ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 3 })
const periods: Record<string, string> = { Day: '日', Week: '周', Month: '月', Year: '年' }
const chart = computed(() => {
  const trades = quote.value.trades
  if (trades.length < 2) return undefined
  const first = trades[0]!.timestamp
  const duration = trades.at(-1)!.timestamp - first
  const prices = trades.map((trade) => trade.price)
  const low = Math.min(...prices)
  const high = Math.max(...prices)
  const maxQuantity = Math.max(...trades.map((trade) => trade.quantity))
  const points = trades.map((trade) => ({
    ...trade,
    x: 44 + (duration ? (trade.timestamp - first) / duration : 0.5) * 612,
    y: high === low ? 90 : 24 + ((high - trade.price) / (high - low)) * 120,
    height: (trade.quantity / maxQuantity) * 40,
  }))
  return { points, line: points.map((point) => `${point.x},${point.y}`).join(' '), low, high }
})
function selectNearestTrade(event: MouseEvent) {
  const points = chart.value?.points
  const surface = event.currentTarget as SVGSVGElement
  const bounds = surface.getBoundingClientRect()
  if (!points?.length || !bounds.width) return
  const x = ((event.clientX - bounds.left) / bounds.width) * 680
  selectedIndex.value = points.reduce(
    (nearest, point, index) =>
      Math.abs(point.x - x) < Math.abs(points[nearest]!.x - x) ? index : nearest,
    0,
  )
}
</script>
<template>
  <section
    v-if="quote.depth.length || quote.trades.length || quote.periods.length"
    class="market-quote"
    :aria-label="t('市场行情')"
  >
    <div class="quote-heading">
      <h3>{{ t('市场行情') }}</h3>
      <small
        >{{ t('每批') }} {{ data.batchSize.toLocaleString() }} {{ t('件') }} ·
        {{ t('价格单位') }} C/{{ t('批') }}</small
      >
    </div>
    <dl class="quote-summary">
      <div>
        <dt>{{ t('最高买价') }}</dt>
        <dd>{{ format(quote.bid) }} C</dd>
      </div>
      <div>
        <dt>{{ t('最低卖价') }}</dt>
        <dd>{{ format(quote.ask) }} C</dd>
      </div>
      <div>
        <dt>{{ t('价差') }}</dt>
        <dd>{{ format(quote.spread) }} C</dd>
      </div>
    </dl>
    <div v-if="chart" class="quote-chart">
      <div class="quote-heading">
        <h4>{{ t('最近成交') }}</h4>
        <small>{{ t('源站时间') }} · {{ t('成交量') }} ({{ t('件') }})</small>
      </div>
      <div class="quote-scale">
        <span>{{ format(chart.low) }}–{{ format(chart.high) }} C/{{ t('批') }}</span>
      </div>
      <svg
        viewBox="0 0 680 212"
        preserveAspectRatio="none"
        role="img"
        :aria-label="t('成交价格与数量')"
        @click="selectNearestTrade"
      >
        <line x1="44" y1="24" x2="656" y2="24" class="quote-grid" />
        <line x1="44" y1="144" x2="656" y2="144" class="quote-grid" />
        <polyline :points="chart.line" class="quote-line" />
        <line
          v-if="chart.points[selectedIndex]"
          :x1="chart.points[selectedIndex]!.x"
          :x2="chart.points[selectedIndex]!.x"
          y1="16"
          y2="202"
          class="quote-selection"
        />
        <g v-for="(point, index) in chart.points" :key="index">
          <rect
            :x="point.x - 3"
            :y="202 - point.height"
            width="6"
            :height="point.height"
            class="quote-volume"
          >
            <title>{{ point.time }} · {{ format(point.quantity) }} {{ t('件') }}</title>
          </rect>
          <circle
            :cx="point.x"
            :cy="point.y"
            :r="selectedIndex === index ? 5 : 3"
            class="quote-point"
            :class="{ 'quote-point-selected': selectedIndex === index }"
          >
            <title>
              {{ point.time }} · {{ format(point.price) }} C/{{ t('批') }} ·
              {{ format(point.quantity) }} {{ t('件') }}
            </title>
          </circle>
        </g>
      </svg>
      <div class="quote-time-range">
        <time>{{ chart.points[0]!.time }}</time
        ><time>{{ chart.points.at(-1)!.time }}</time>
      </div>
      <label class="quote-trade-selector">
        <span>{{ t('最近成交') }} {{ selectedIndex + 1 }}/{{ quote.trades.length }}</span>
        <input
          v-model.number="selectedIndex"
          type="range"
          min="0"
          :max="quote.trades.length - 1"
          step="1"
          :aria-label="t('最近成交')"
          :aria-valuetext="
            selectedTrade
              ? `${selectedTrade.time} · ${format(selectedTrade.price)} C/${t('批')} · ${format(selectedTrade.quantity)} ${t('件')}`
              : undefined
          "
        />
      </label>
      <div v-if="selectedTrade" class="quote-selected-trade" aria-live="polite" aria-atomic="true">
        <time>{{ selectedTrade.time }} · {{ t('源站时间') }}</time>
        <strong>{{ format(selectedTrade.price) }} C/{{ t('批') }}</strong>
        <span>{{ t('成交量') }} {{ format(selectedTrade.quantity) }} {{ t('件') }}</span>
      </div>
      <small>{{ t('折线为成交价格，柱形为成交数量；完整记录见原始表格') }}</small>
    </div>
    <div v-else-if="quote.trades.length" class="quote-note">
      {{ t('成交记录不足以绘制折线，请查看原始表格') }}
    </div>
    <div v-if="quote.periods.length" class="quote-periods">
      <h4>{{ t('源站周期均价') }}</h4>
      <div class="quote-period-values">
        <span v-for="period in quote.periods" :key="period.period"
          >{{ t(periods[period.period] || period.period) }}
          <strong>{{ format(period.average) }} C/{{ t('批') }}</strong></span
        >
      </div>
    </div>
    <details v-if="quote.depth.length" class="quote-depth">
      <summary>{{ t('挂单加权均价') }}</summary>
      <p class="quote-note">{{ t('按前1/5/10档挂单批数加权，非历史成交均价') }}</p>
      <div class="quote-depth-scroll">
        <table>
          <thead>
            <tr>
              <th>{{ t('方向') }}</th>
              <th>{{ t('档位范围') }}</th>
              <th>{{ t('批数') }}</th>
              <th>C/{{ t('批') }}</th>
              <th>C/{{ t('件') }}</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="book in quote.depth" :key="book.side"
              ><tr v-for="average in book.averages" :key="average.range">
                <td>{{ t(book.side === 'buy' ? '买单' : '卖单') }}</td>
                <td>
                  {{ t('前') }} {{ average.range }} {{ t('档')
                  }}<small v-if="average.levels < average.range">
                    ({{ t('实际') }} {{ average.levels }})</small
                  >
                </td>
                <td>{{ format(average.batches) }}</td>
                <td>{{ format(average.price) }}</td>
                <td>{{ format(average.price / data.batchSize) }}</td>
              </tr></template
            >
          </tbody>
        </table>
      </div>
    </details>
  </section>
</template>
<style scoped>
.market-quote {
  display: grid;
  gap: 12px;
  min-width: 0;
  font-variant-numeric: tabular-nums;
}
h3,
h4,
p {
  margin: 0;
}
h3 {
  font-size: 15px;
}
h4 {
  font-size: 13px;
  font-weight: 600;
}
small,
dt,
.quote-note {
  color: var(--muted-foreground);
  font-size: 12px;
}
.quote-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 12px;
}
.quote-summary {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.quote-summary > div {
  padding: 9px 10px;
  background: var(--muted);
  border-radius: 6px;
}
dd {
  margin: 3px 0 0;
  font-size: 16px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.quote-chart svg {
  display: block;
  width: 100%;
  height: 200px;
  overflow: hidden;
  cursor: crosshair;
  touch-action: pan-y;
}
.quote-scale,
.quote-time-range {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: var(--muted-foreground);
  font-size: 12px;
  overflow-wrap: anywhere;
}
.quote-time-range time:last-child {
  text-align: right;
}
.quote-trade-selector {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  font-size: 12px;
  min-height: 44px;
}
.quote-trade-selector input {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  accent-color: var(--primary);
  cursor: pointer;
}
.quote-selected-trade {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 14px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--muted);
  font-size: 13px;
  overflow-wrap: anywhere;
}
.quote-selected-trade time {
  flex-basis: 100%;
  color: var(--muted-foreground);
  font-size: 12px;
}
.quote-selection {
  stroke: var(--primary);
  stroke-dasharray: 4;
  opacity: 0.6;
}
.quote-point-selected {
  stroke: var(--background);
  stroke-width: 2;
}
.quote-grid {
  stroke: var(--border-soft);
  stroke-dasharray: 4;
}
.quote-line {
  stroke: var(--primary);
  stroke-width: 2;
  fill: none;
}
.quote-point {
  fill: var(--primary);
}
.quote-volume {
  fill: var(--primary);
  opacity: 0.35;
}
.quote-periods {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 16px;
}
.quote-period-values {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  font-size: 13px;
}
.quote-depth summary {
  min-height: 44px;
  padding-block: 12px;
  box-sizing: border-box;
  font-size: 13px;
  cursor: pointer;
}
.quote-depth[open] summary {
  margin-bottom: 8px;
}
.quote-depth-scroll {
  overflow-x: auto;
}
table {
  border-collapse: collapse;
  width: 100%;
  font-size: 12px;
}
th,
td {
  padding: 6px 8px;
  text-align: right;
  white-space: nowrap;
  border-bottom: 1px solid var(--border-soft);
}
th:first-child,
td:first-child {
  text-align: left;
}
th {
  color: var(--muted-foreground);
  font-weight: 500;
}
@media (max-width: 767px) {
  dd {
    font-size: 14px;
  }
  .quote-summary > div {
    padding: 8px;
  }
}
</style>
