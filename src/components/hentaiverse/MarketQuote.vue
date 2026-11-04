<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { t, getDisplayLocale } from '@/i18n'
import SelectField from '@/components/primitives/SelectField.vue'
import MarketTrend from './MarketTrend.vue'
import type { HentaiVerseBazaarPage } from '@/core/hentaiverse/hentaiVerseBazaar'
import { readHentaiVerseMarketQuote } from '@/core/hentaiverse/hentaiVerseMarketQuote'

const props = defineProps<{ data: HentaiVerseBazaarPage; loading?: boolean }>()
const quote = computed(() => readHentaiVerseMarketQuote(props.data))
const periodKey = ref('Day')
const periodLabels: Record<string, string> = { Day: '日', Week: '周', Month: '月', Year: '年' }
watch(
  () => props.data,
  () => {
    periodKey.value =
      quote.value.periods.find((period) => period.period === 'Day')?.period ||
      quote.value.periods[0]?.period ||
      ''
  },
  { immediate: true },
)
const selectedPeriod = computed(() =>
  quote.value.periods.find((period) => period.period === periodKey.value),
)
const format = (value: number | undefined) =>
  value === undefined ? '—' : value.toLocaleString(getDisplayLocale(), { maximumFractionDigits: 3 })
const receivedAt = computed(() =>
  props.data.receivedAt
    ? new Date(props.data.receivedAt).toLocaleTimeString(getDisplayLocale(), {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '',
)
</script>

<template>
  <section class="market-quote" :aria-label="t('市场行情')" :aria-busy="loading">
    <header class="quote-heading">
      <h3>{{ t('市场行情') }}</h3>
      <small
        >{{
          data.batchSize > 0
            ? `${t('每批')} ${data.batchSize.toLocaleString()} ${t('件')}`
            : t('每批件数暂不可用')
        }}
        · {{ t('价格单位') }} C/{{ t('批') }}</small
      >
    </header>
    <div class="quote-freshness" role="status">
      <span v-if="loading">{{ t('行情更新中，当前显示上次读取结果') }}</span>
      <span v-else-if="receivedAt">{{ t('最近读取') }} {{ receivedAt }}</span>
      <span>{{ t('源站时间按原始记录显示') }}</span>
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
    <MarketTrend :trades="quote.trades" :loading="loading" />
    <p v-if="quote.unavailable.length" class="quote-note" role="status">
      {{ t('部分行情数据无法可靠解析，请查看原始表格') }}：{{
        quote.unavailable.map((name) => t(name)).join('、')
      }}
    </p>
    <section v-if="selectedPeriod" class="quote-periods" :aria-label="t('周期统计')">
      <header class="quote-heading">
        <h4>{{ t('周期统计') }}</h4>
        <SelectField v-model="periodKey" :aria-label="t('统计周期')">
          <option v-for="period in quote.periods" :key="period.period" :value="period.period">
            {{ t(periodLabels[period.period] || period.period) }}
          </option>
        </SelectField>
      </header>
      <dl class="period-values">
        <div>
          <dt>{{ t('最低价') }}</dt>
          <dd>{{ format(selectedPeriod.low) }} C/{{ t('批') }}</dd>
        </div>
        <div>
          <dt>{{ t('均价') }}</dt>
          <dd>{{ format(selectedPeriod.average) }} C/{{ t('批') }}</dd>
        </div>
        <div>
          <dt>{{ t('最高价') }}</dt>
          <dd>{{ format(selectedPeriod.high) }} C/{{ t('批') }}</dd>
        </div>
        <div>
          <dt>{{ t('成交数量') }}</dt>
          <dd>{{ format(selectedPeriod.sold) }} {{ t('件') }}</dd>
        </div>
        <div>
          <dt>{{ t('成交额') }}</dt>
          <dd>{{ format(selectedPeriod.volume) }} C</dd>
        </div>
      </dl>
      <p class="quote-note">{{ t('周期统计来自源站汇总，与上方近期成交记录的覆盖范围不同。') }}</p>
    </section>
    <details v-if="quote.depth.length" class="quote-depth">
      <summary>{{ t('盘口与挂单加权均价') }}</summary>
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
            <template v-for="book in quote.depth" :key="book.side">
              <tr v-for="average in book.averages" :key="average.range">
                <td>{{ t(book.side === 'buy' ? '买单' : '卖单') }}</td>
                <td>
                  {{ t('前') }} {{ average.range }} {{ t('档')
                  }}<small v-if="average.levels < average.range">
                    ({{ t('实际') }} {{ average.levels }})</small
                  >
                </td>
                <td>{{ format(average.batches) }}</td>
                <td>{{ format(average.price) }}</td>
                <td>{{ data.batchSize > 0 ? format(average.price / data.batchSize) : '—' }}</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </details>
  </section>
</template>

<style scoped>
.market-quote {
  display: grid;
  gap: 18px;
  min-width: 0;
  font-variant-numeric: tabular-nums;
  padding-block: 16px;
  border-block: 1px solid var(--border-soft);
}
h3,
h4,
p,
dl {
  margin: 0;
}
h3 {
  font-size: 16px;
}
h4 {
  font-size: 14px;
  font-weight: 600;
}
.quote-heading,
.quote-freshness {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
}
.quote-heading :deep(select) {
  width: auto;
  min-width: 90px;
}
small,
dt,
.quote-note,
.quote-freshness {
  color: var(--muted-foreground);
  font-size: 12px;
  line-height: 1.6;
}
.quote-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.quote-summary > div {
  padding: 12px;
  background: var(--muted);
  border-radius: 6px;
}
dd {
  margin: 4px 0 0;
  font-size: 17px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.quote-periods {
  display: grid;
  gap: 12px;
  border-top: 1px solid var(--border-soft);
  padding-top: 16px;
}
.period-values {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(125px, 1fr));
  gap: 12px 16px;
}
.period-values dd {
  font-size: 13px;
}
.quote-depth {
  border-top: 1px solid var(--border-soft);
}
.quote-depth summary {
  min-height: 44px;
  padding-block: 12px;
  font-size: 13px;
  cursor: pointer;
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
  padding: 8px;
  text-align: right;
  white-space: nowrap;
  border-bottom: 1px solid var(--border-soft);
}
th:first-child,
td:first-child {
  text-align: left;
}
th {
  font-weight: 500;
  color: var(--muted-foreground);
}
@media (max-width: 767px) {
  .quote-summary > div {
    padding: 9px;
  }
  dd {
    font-size: 14px;
  }
  .period-values {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
