<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useElementSize } from '@vueuse/core'
import { t, getDisplayLocale } from '@/i18n'
import type { HentaiVerseMarketQuote } from '@/core/hentaiverse/hentaiVerseMarketQuote'

const props = defineProps<{ trades: HentaiVerseMarketQuote['trades']; loading?: boolean }>()
const surface = ref<HTMLElement>()
const { width } = useElementSize(surface)
const selectedIndex = ref(0)
const selected = computed(() => props.trades[selectedIndex.value])
const format = (value: number) =>
  value.toLocaleString(getDisplayLocale(), { maximumFractionDigits: 3 })
watch(
  () => props.trades,
  (trades) => {
    selectedIndex.value = Math.max(0, trades.length - 1)
  },
  { immediate: true },
)

const chart = computed(() => {
  const trades = props.trades
  if (!trades.length) return undefined
  const prices = trades.map((trade) => trade.price)
  const low = Math.min(...prices),
    high = Math.max(...prices)
  const padding = Math.max((high - low) * 0.12, high * 0.005, 1)
  const min = Math.max(0, low - padding),
    max = high + padding
  const maxQuantity = Math.max(...trades.map((trade) => trade.quantity))
  const size = width.value || 640
  const priceTicks = [max, (max + min) / 2, min]
  const left = Math.max(52, ...priceTicks.map((value) => format(value).length * 7 + 12))
  const right = size - 12,
    span = Math.max(1, right - left)
  const first = trades[0]!,
    last = trades.at(-1)!
  const duration = last.timestamp - first.timestamp
  const points = trades.map((trade) => ({
    ...trade,
    x: left + (duration ? (trade.timestamp - first.timestamp) / duration : 0.5) * span,
    y: 34 + ((max - trade.price) / (max - min)) * 116,
    height: maxQuantity ? (trade.quantity / maxQuantity) * 44 : 0,
  }))
  const connect =
    trades.length > 1 && new Set(trades.map((trade) => trade.timestamp)).size === trades.length
  const tickCount = size < 440 ? 2 : 4
  const timeTicks = Array.from({ length: duration ? tickCount : 1 }, (_, index) => {
    const fraction = duration ? index / (tickCount - 1) : 0.5
    const time = new Date(first.timestamp + duration * fraction).toISOString()
    return {
      x: left + fraction * span,
      label: duration >= 86400000 ? time.slice(5, 10) : time.slice(11, 16),
    }
  })
  return {
    size,
    left,
    right,
    points,
    priceTicks,
    connect,
    maxQuantity,
    timeTicks,
    line: points.map((point) => `${point.x},${point.y}`).join(' '),
  }
})

function selectTrade(event: MouseEvent | PointerEvent) {
  if (
    props.loading ||
    !chart.value ||
    (event.type === 'pointermove' && 'pointerType' in event && event.pointerType !== 'mouse')
  )
    return
  const bounds = (event.currentTarget as SVGSVGElement).getBoundingClientRect()
  const x = ((event.clientX - bounds.left) / bounds.width) * chart.value.size
  selectedIndex.value = chart.value.points.reduce(
    (nearest, point, index, points) =>
      Math.abs(point.x - x) < Math.abs(points[nearest]!.x - x) ? index : nearest,
    0,
  )
}
</script>

<template>
  <section ref="surface" class="market-trend" :aria-label="t('最近成交走势')">
    <header>
      <h4>{{ t('最近成交走势') }}</h4>
      <span>{{ t('{p0} 笔记录', { p0: trades.length }) }} · {{ t('源站时间') }}</span>
    </header>
    <p v-if="!trades.length" class="trend-empty">{{ t('暂无可绘制的成交记录，请查看原始表格') }}</p>
    <template v-else-if="chart">
      <svg
        :viewBox="`0 0 ${chart.size} 278`"
        role="img"
        :aria-label="t('成交价格与数量')"
        @pointermove="selectTrade"
        @click="selectTrade"
      >
        <text x="0" y="14" class="axis-label">{{ t('成交价格') }} (C/{{ t('批') }})</text>
        <g v-for="(value, index) in chart.priceTicks" :key="index">
          <line
            :x1="chart.left"
            :x2="chart.right"
            :y1="34 + index * 58"
            :y2="34 + index * 58"
            class="grid-line"
          />
          <text :x="chart.left - 8" :y="38 + index * 58" text-anchor="end">
            {{ format(value) }}
          </text>
        </g>
        <polyline v-if="chart.connect" :points="chart.line" class="price-line" />
        <line
          v-if="chart.points[selectedIndex]"
          :x1="chart.points[selectedIndex]!.x"
          :x2="chart.points[selectedIndex]!.x"
          y1="27"
          y2="246"
          class="selection-line"
        />
        <text x="0" y="191" class="axis-label">{{ t('成交数量') }} ({{ t('件') }})</text>
        <text :x="chart.left - 8" y="208" text-anchor="end">{{ format(chart.maxQuantity) }}</text>
        <text :x="chart.left - 8" y="248" text-anchor="end">0</text>
        <line :x1="chart.left" :x2="chart.right" y1="246" y2="246" class="grid-line" />
        <g v-for="(point, index) in chart.points" :key="index">
          <rect
            :x="point.x - 3"
            :y="246 - point.height"
            width="6"
            :height="point.height"
            class="volume-bar"
          />
          <circle
            :cx="point.x"
            :cy="point.y"
            :r="selectedIndex === index ? 5 : 3"
            class="trade-point"
            :class="{ selected: selectedIndex === index }"
          >
            <title>
              {{ point.time }} · {{ format(point.price) }} C/{{ t('批') }} ·
              {{ format(point.quantity) }} {{ t('件') }}
            </title>
          </circle>
        </g>
        <text
          v-for="(tick, position) in chart.timeTicks"
          :key="position"
          :x="tick.x"
          y="270"
          :text-anchor="
            chart.timeTicks.length === 1
              ? 'middle'
              : position === 0
                ? 'start'
                : position === chart.timeTicks.length - 1
                  ? 'end'
                  : 'middle'
          "
        >
          {{ tick.label }}
        </text>
      </svg>
      <p class="trend-range">{{ trades[0]!.time }} — {{ trades.at(-1)!.time }}</p>
      <p v-if="!chart.connect" class="trend-note">
        {{
          t(
            trades.length === 1
              ? '仅有一笔记录，显示成交点'
              : '部分记录时间相同，显示成交点并保留逐笔记录',
          )
        }}
      </p>
      <label class="trade-selector">
        <span>{{ t('选择成交记录') }} {{ selectedIndex + 1 }}/{{ trades.length }}</span>
        <input
          v-model.number="selectedIndex"
          type="range"
          min="0"
          :max="trades.length - 1"
          step="1"
          :disabled="loading || trades.length === 1"
          :aria-label="t('选择成交记录')"
          :aria-valuetext="
            selected
              ? `${selected.time} · ${format(selected.price)} C/${t('批')} · ${format(selected.quantity)} ${t('件')}`
              : undefined
          "
        />
      </label>
      <div v-if="selected" class="selected-trade" aria-live="polite" aria-atomic="true">
        <time>{{ selected.time }}</time>
        <strong>{{ format(selected.price) }} C/{{ t('批') }}</strong>
        <span>{{ t('成交数量') }} {{ format(selected.quantity) }} {{ t('件') }}</span>
      </div>
      <p class="trend-note">
        {{ t('仅展示源站返回的近期记录；柱形表示成交数量，完整明细见原始表格。') }}
      </p>
    </template>
  </section>
</template>

<style scoped>
.market-trend {
  min-width: 0;
}
header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}
h4,
p {
  margin: 0;
}
h4 {
  font-size: 14px;
  font-weight: 600;
}
header span,
.trend-range,
.trend-note,
.trend-empty {
  color: var(--muted-foreground);
  font-size: 12px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.trend-empty {
  padding-block: 20px;
}
svg {
  display: block;
  width: 100%;
  height: 278px;
  touch-action: pan-y;
}
svg text {
  font: 12px var(--font-body, sans-serif);
  fill: var(--muted-foreground);
}
.grid-line {
  stroke: var(--border-soft);
  stroke-width: 1;
}
.price-line {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
}
.trade-point,
.volume-bar {
  fill: var(--accent);
}
.volume-bar {
  opacity: 0.3;
}
.trade-point.selected {
  stroke: var(--surface);
  stroke-width: 2;
}
.selection-line {
  stroke: var(--accent);
  stroke-width: 1;
  opacity: 0.45;
  stroke-dasharray: 3 3;
}
.trade-selector {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  font-size: 12px;
}
.trade-selector input {
  min-width: 0;
  min-height: 44px;
  flex: 1;
  accent-color: var(--accent);
}
.selected-trade {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  align-items: baseline;
  padding: 10px 12px;
  margin-bottom: 8px;
  background: var(--muted);
  border-radius: 6px;
  font-size: 13px;
}
.selected-trade time {
  color: var(--muted-foreground);
  font-size: 12px;
}
.selected-trade strong {
  color: var(--foreground);
}
@media (max-width: 767px) {
  .selected-trade time {
    flex-basis: 100%;
  }
  .trade-selector {
    flex-wrap: wrap;
    gap: 0 12px;
  }
}
</style>
