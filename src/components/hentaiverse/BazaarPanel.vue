<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { notify, dialogs } from '@/components/primitives/feedback'
import NumberField from '@/components/primitives/NumberField.vue'
import TextField from '@/components/primitives/TextField.vue'
import SelectField from '@/components/primitives/SelectField.vue'
import ChoiceGroup from '@/components/primitives/ChoiceGroup.vue'
import CheckField from '@/components/primitives/CheckField.vue'
import RadioChoice from '@/components/primitives/RadioChoice.vue'
import { t } from '@/i18n'
import { createReusableTemplate, useMediaQuery } from '@vueuse/core'
import ModalPanel from '@/components/primitives/ModalPanel.vue'
import ActionButton from '@/components/primitives/ActionButton.vue'
import EmptyState from '@/components/primitives/EmptyState.vue'
import MarketQuote from './MarketQuote.vue'
import { readHentaiVerseMarketQuote } from '@/core/hentaiverse/hentaiVerseMarketQuote'
import {
  buildHentaiVerseMarketOrder,
  buildHentaiVerseMarketTransfer,
  buildHentaiVerseShopTransaction,
  hentaiVerseMarketPriceStep,
  type HentaiVerseBazaarItem,
  type HentaiVerseBazaarPage,
  type HentaiVerseMarketOrder,
} from '@/core/hentaiverse/hentaiVerseBazaar'
import type { HentaiVerseFormData } from '@/core/hentaiverse/model/hentaiVerse'

const props = defineProps<{ data: HentaiVerseBazaarPage; loading?: boolean }>()
const emit = defineEmits<{
  navigate: [query: Record<string, string>]
  submit: [data: HentaiVerseFormData, label: string]
}>()
const mobile = useMediaQuery('(max-width: 767px)')
const hasMarketQuote = computed(() => {
  const quote = readHentaiVerseMarketQuote(props.data)
  return !!(quote.depth.length || quote.trades.length || quote.periods.length)
})
const detailOpen = ref(false)
const [DefineItemDetails, ItemDetails] = createReusableTemplate()
const [DefineItemAction, ItemAction] = createReusableTemplate()
const selected = ref<HentaiVerseBazaarItem>()
const count = ref(1)
const transferAmount = ref(1)
const fundsOpen = ref(false)
const recordsOpen = ref(false)
const orderSide = ref<'buy' | 'sell'>('buy')
const transferTouched = ref(false)
const mainNavigation = computed(() =>
  props.data.navigation.filter(
    (link) => !['marketlog', 'tradelog'].some((key) => link.query.screen?.includes(key)),
  ),
)
const recordNavigation = computed(() =>
  props.data.navigation.filter((link) => !mainNavigation.value.includes(link)),
)
const visibleOrders = computed(() =>
  props.data.orders.filter((order) => order.side === orderSide.value),
)
const reward = ref('')
const drafts = reactive<Record<string, { count: number; price: number }>>({})
const query = ref('')
const activeCategory = computed(() =>
  String(
    Math.max(
      0,
      props.data.filters.findIndex((link) => link.active),
    ),
  ),
)
const mode = ref<'shop_pane' | 'item_pane'>('shop_pane')
const confirming = ref(false)
let disposed = false
onBeforeUnmount(() => {
  disposed = true
})
watch(
  () => props.data,
  (data) => {
    selected.value = undefined
    detailOpen.value = false
    reward.value = ''
    count.value = 1
    transferTouched.value = false
    orderSide.value = data.orders[0]?.side || 'buy'
    if (recordNavigation.value.some((link) => link.active)) recordsOpen.value = true
    for (const order of data.orders)
      drafts[order.side] = { count: order.count || 1, price: order.price || 10 }
  },
  { immediate: true },
)
const items = computed(() =>
  props.data.items.filter(
    (item) =>
      (props.data.kind !== 'itemShop' || item.mode === mode.value) &&
      item.name.toLowerCase().includes(query.value.toLowerCase()),
  ),
)
watch(mobile, (isMobile) => {
  if (!isMobile) detailOpen.value = false
})
watch(items, (visibleItems) => {
  if (selected.value && !visibleItems.includes(selected.value)) {
    selected.value = undefined
    detailOpen.value = false
    count.value = 1
    reward.value = ''
  }
})

// Builders are pure; expose their existing validation without submitting or notifying.
function transactionError(build: () => HentaiVerseFormData): string {
  try {
    build()
    return ''
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}
const shopError = computed(() =>
  selected.value && props.data.kind === 'itemShop'
    ? transactionError(() =>
        buildHentaiVerseShopTransaction(props.data, selected.value!, count.value),
      )
    : '',
)
const orderErrors = computed(() =>
  Object.fromEntries(
    props.data.orders.map((order) => [
      order.side,
      transactionError(() =>
        buildHentaiVerseMarketOrder(
          props.data,
          order,
          drafts[order.side]!.count,
          drafts[order.side]!.price,
        ),
      ),
    ]),
  ),
)
const transferErrors = computed(() =>
  Object.fromEntries(
    props.data.transfers.map((transfer) => [
      transfer.name,
      transactionError(() =>
        buildHentaiVerseMarketTransfer(props.data, transfer, transferAmount.value),
      ),
    ]),
  ),
)
const selectedKind = computed(() => {
  const id = Number(selected.value?.id || 0)
  return id >= 30000 && id < 40000
    ? 'trophy'
    : id >= 20000 && id < 30000
      ? 'artifact'
      : id >= 70000 && id < 80000
        ? 'collectible'
        : 'info'
})
const shrineParagraphs = computed(
  () => props.data.shrineInfo.find((info) => info.kind === selectedKind.value)?.paragraphs || [],
)
const maximum = computed(() =>
  selected.value
    ? Math.min(
        99999,
        selected.value.stock,
        selected.value.mode === 'shop_pane' && selected.value.price > 0
          ? Math.floor(props.data.credits / selected.value.price)
          : 99999,
      )
    : 1,
)
const availableReward = computed(
  () =>
    selectedKind.value !== 'trophy' ||
    props.data.rewards.some((entry) => `${entry.type}:${entry.slot}` === reward.value),
)
const rewardGroup: Record<string, string> = {
  armor_cloth: '布甲',
  armor_light: '轻甲',
  armor_heavy: '重甲',
}

async function confirmSubmit(data: HentaiVerseFormData, label: string, detail: string) {
  if (props.loading || confirming.value) return
  const page = props.data
  confirming.value = true
  try {
    await dialogs.confirm(detail, t('确认操作'), {
      confirmButtonText: t('确认'),
      cancelButtonText: t('取消'),
      type: 'warning',
    })
    if (!disposed && props.data === page && !props.loading) emit('submit', data, label)
  } catch (error) {
    if (error !== 'cancel' && error !== 'close')
      notify.error(error instanceof Error ? error.message : String(error))
  } finally {
    confirming.value = false
  }
}

function submitShop() {
  const item = selected.value
  if (!item) return
  try {
    const data = buildHentaiVerseShopTransaction(props.data, item, count.value)
    const label = item.mode === 'shop_pane' ? t('购买物品') : t('出售物品')
    void confirmSubmit(
      data,
      label,
      `${label}：${item.name} × ${count.value.toLocaleString()}；${t('总额')} ${(count.value * item.price).toLocaleString()} C`,
    )
  } catch (error) {
    notify.error(error instanceof Error ? t(error.message) : String(error))
  }
}

function selectMarketCategory(value: string | undefined) {
  if (value === undefined || props.loading) return
  const link = props.data.filters[Number(value)]
  if (link && !link.active) emit('navigate', link.query)
}

function updateTransferAmount() {
  transferAmount.value = Number(transferAmount.value) || 0
  transferTouched.value = true
}

function updateOrderDraft(side: 'buy' | 'sell', field: 'count' | 'price') {
  const draft = drafts[side]
  if (!draft) return
  draft[field] = Number(draft[field]) || 0
}

function submitOrder(order: HentaiVerseMarketOrder) {
  const draft = drafts[order.side]
  if (!draft) return
  try {
    const data = buildHentaiVerseMarketOrder(props.data, order, draft.count, draft.price)
    const label = order.side === 'buy' ? t('提交买单') : t('提交卖单')
    void confirmSubmit(
      data,
      label,
      `${label}：${props.data.itemName} × ${(draft.count * props.data.batchSize).toLocaleString()}；${t('批数')} ${draft.count.toLocaleString()} × ${draft.price.toLocaleString()} C；${t('总额')} ${(draft.count * draft.price).toLocaleString()} C`,
    )
  } catch (error) {
    notify.error(error instanceof Error ? t(error.message) : String(error))
  }
}

function submitTransfer(transfer: HentaiVerseBazaarPage['transfers'][number]) {
  try {
    const data = buildHentaiVerseMarketTransfer(props.data, transfer, transferAmount.value)
    void confirmSubmit(
      data,
      t(transfer.label),
      `${t(transfer.label)}：${transferAmount.value.toLocaleString()} C`,
    )
  } catch (error) {
    notify.error(error instanceof Error ? t(error.message) : String(error))
  }
}

function submitShrine() {
  const item = selected.value
  if (!item || !availableReward.value || item.stock < item.required || item.required < 1) return
  const option =
    selectedKind.value === 'trophy'
      ? props.data.rewards.find((entry) => `${entry.type}:${entry.slot}` === reward.value)
      : undefined
  const label = t('提交祭品')
  void confirmSubmit(
    {
      ...props.data.hidden,
      select_item: item.id,
      select_reward_type: option?.type || '',
      select_reward_slot: option?.slot || '',
    },
    label,
    `${label}：${item.name} × ${item.required.toLocaleString()}；${t('奖励')}：${option ? `${t(rewardGroup[option.type] || '')} ${t(option.label)}` : t('随机奖励')}`,
  )
}

function selectItem(item: HentaiVerseBazaarPage['items'][number]) {
  selected.value = item
  count.value = 1
  reward.value = ''
  detailOpen.value = true
}
</script>

<template>
  <DefineItemDetails>
    <div class="bazaar-detail">
      <h3 v-if="selected && !mobile">{{ t(selected.name) }}</h3>
      <template v-if="data.kind === 'itemShop' && selected">
        <p v-if="selected.description">{{ t(selected.description) }}</p>
        <p>
          {{ t('单价') }} {{ selected.price.toLocaleString() }} C · {{ t('库存') }}
          {{ selected.stock.toLocaleString() }}
        </p>
        <label class="bazaar-quantity"
          >{{ t('数量') }}
          <NumberField
            v-model="count"
            @change="count = Number(count) || 0"
            :min="1"
            :max="Math.max(1, maximum)"
            :disabled="loading"
            :aria-label="t('数量')"
          />
        </label>
        <p>
          {{ t('总额') }} <strong>{{ (count * selected.price).toLocaleString() }} C</strong>
        </p>
        <p v-if="shopError" class="bazaar-validation" role="status">{{ t(shopError) }}</p>
      </template>
      <template v-else-if="data.kind === 'shrine'">
        <p v-for="paragraph in shrineParagraphs" :key="paragraph">{{ t(paragraph) }}</p>
        <template v-if="selected">
          <p>
            {{ t('消耗祭品') }} {{ selected.required.toLocaleString() }} · {{ t('库存') }}
            {{ selected.stock.toLocaleString() }}
          </p>
          <SelectField
            v-if="selectedKind === 'trophy'"
            v-model="reward"
            :placeholder="t('选择奖励类型')"
            :aria-label="t('选择奖励类型')"
            :disabled="loading"
          >
            <option
              v-for="entry in data.rewards"
              :key="`${entry.type}:${entry.slot}`"
              :value="`${entry.type}:${entry.slot}`"
              :label="`${t(rewardGroup[entry.type] || '')} ${t(entry.label)}`.trim()"
            />
          </SelectField>
          <p v-else>{{ t('奖励') }}：{{ t('随机奖励') }}</p>
        </template>
      </template>
      <p v-else>{{ t('选择物品查看详情') }}</p>
    </div>
  </DefineItemDetails>
  <DefineItemAction>
    <ActionButton
      v-if="selected"
      class="bazaar-item-action"
      variant="default"
      :loading="loading"
      :disabled="
        confirming ||
        (data.kind === 'itemShop'
          ? !!shopError
          : !availableReward || selected.stock < selected.required || selected.required < 1)
      "
      @click="data.kind === 'itemShop' ? submitShop() : submitShrine()"
      >{{
        data.kind === 'shrine'
          ? t('提交祭品')
          : selected.mode === 'shop_pane'
            ? t('购买物品')
            : t('出售物品')
      }}</ActionButton
    >
  </DefineItemAction>
  <ModalPanel
    v-if="mobile"
    v-model="detailOpen"
    :title="selected?.name || t('物品详情')"
    content-class="hv-theme hv-dialog"
    sheet
  >
    <ItemDetails />
    <template #footer><ItemAction /></template>
  </ModalPanel>
  <section class="bazaar-panel" :aria-busy="loading">
    <nav v-if="data.navigation.length" class="bazaar-nav" :aria-label="t('市场页面')">
      <ActionButton
        v-for="link in mainNavigation"
        :key="link.label"
        :variant="link.active ? 'default' : 'outline'"
        :disabled="loading"
        @click="emit('navigate', link.query)"
        >{{ t(link.label) }}</ActionButton
      >
    </nav>
    <details
      v-if="recordNavigation.length"
      class="bazaar-records"
      :open="recordsOpen"
      @toggle="recordsOpen = ($event.target as HTMLDetailsElement).open"
    >
      <summary>{{ t('市场记录') }}</summary>
      <nav class="bazaar-nav">
        <ActionButton
          v-for="link in recordNavigation"
          :key="link.label"
          size="sm"
          :variant="link.active ? 'default' : 'outline'"
          :disabled="loading"
          @click="emit('navigate', link.query)"
          >{{ t(link.label) }}</ActionButton
        >
      </nav>
    </details>
    <SelectField
      v-if="mobile && data.kind === 'market' && data.filters.length"
      :model-value="activeCategory"
      :disabled="loading"
      :aria-label="t('物品分类')"
      class="bazaar-category-select"
      @change="selectMarketCategory"
    >
      <option v-for="(link, index) in data.filters" :key="index" :value="String(index)">
        {{ t(link.label) }}
      </option>
    </SelectField>
    <nav v-else-if="data.filters.length" class="bazaar-nav" :aria-label="t('物品分类')">
      <ActionButton
        v-for="link in data.filters"
        :key="link.label"
        size="sm"
        :variant="link.active ? 'default' : 'ghost'"
        :disabled="loading"
        @click="emit('navigate', link.query)"
        >{{ t(link.label) }}</ActionButton
      >
    </nav>
    <div v-if="data.kind !== 'shrine'" class="bazaar-balances">
      <span
        >{{ t('信用点') }} <strong>{{ data.credits.toLocaleString() }} C</strong></span
      >
      <span v-if="data.kind === 'market'"
        >{{ t('市场余额') }} <strong>{{ data.marketBalance.toLocaleString() }} C</strong></span
      >
      <ActionButton
        v-if="data.kind === 'market' && data.transfers.length"
        size="sm"
        variant="outline"
        :aria-expanded="fundsOpen"
        @click="fundsOpen = !fundsOpen"
        >{{ t('资金管理') }}</ActionButton
      >
    </div>
    <nav
      v-if="data.stockFilters.length"
      class="bazaar-nav bazaar-stock-checks"
      :aria-label="t('库存筛选')"
    >
      <CheckField
        v-for="link in data.stockFilters"
        :key="link.label"
        :model-value="link.active"
        :disabled="loading"
        :aria-label="t(link.label)"
        @change="emit('navigate', link.query)"
        >{{ t(link.label) }}</CheckField
      >
    </nav>
    <div
      v-if="data.kind === 'market' && data.transfers.length && fundsOpen"
      class="bazaar-transfer"
    >
      <NumberField
        v-model="transferAmount"
        @change="updateTransferAmount"
        :min="1"
        :max="999999999"
        :disabled="loading"
        :aria-label="t('转移金额')"
      />
      <ActionButton
        v-for="transfer in data.transfers"
        :key="transfer.name"
        :disabled="loading || confirming || !!transferErrors[transfer.name]"
        @click="submitTransfer(transfer)"
        >{{ t(transfer.label) }}</ActionButton
      >
      <p
        v-for="transfer in data.transfers.filter(
          (entry) => transferTouched && transferErrors[entry.name],
        )"
        :key="`${transfer.name}-error`"
        class="bazaar-validation"
        role="status"
      >
        {{ t(transfer.label) }}：{{ t(transferErrors[transfer.name]) }}
      </p>
    </div>

    <template v-if="data.kind === 'itemShop' || data.kind === 'shrine'">
      <div class="bazaar-tools">
        <ChoiceGroup v-if="data.kind === 'itemShop'" v-model="mode" :disabled="loading">
          <RadioChoice value="shop_pane">{{ t('购买') }}</RadioChoice
          ><RadioChoice value="item_pane">{{ t('出售') }}</RadioChoice>
        </ChoiceGroup>
        <TextField
          v-model="query"
          clearable
          :placeholder="t('筛选物品')"
          :aria-label="t('筛选物品')"
        />
      </div>
      <div class="bazaar-item-layout">
        <div class="bazaar-items">
          <button
            v-for="item in items"
            :key="`${item.mode}-${item.id}`"
            type="button"
            :class="{ selected: selected === item }"
            :disabled="loading"
            @click="selectItem(item)"
          >
            <span>{{ t(item.name) }}</span
            ><small
              >{{ t('库存') }} {{ item.stock.toLocaleString()
              }}<template v-if="data.kind === 'itemShop'">
                · {{ item.price.toLocaleString() }} C</template
              ></small
            >
          </button>
          <EmptyState v-if="!items.length" :description="t(data.emptyReason || '没有匹配的物品')" />
        </div>
        <div v-if="!mobile" class="bazaar-desktop-detail">
          <ItemDetails />
          <ItemAction />
        </div>
      </div>
    </template>

    <template v-if="data.kind === 'market'">
      <h3 v-if="data.itemName">{{ t(data.itemName) }}</h3>
      <p v-if="data.itemInfo">{{ t(data.itemInfo) }}</p>
      <p v-if="data.tables.some((table) => table.title === '物品列表')" class="bazaar-unit-note">
        {{ t('列表买卖报价单位：C/件') }}
      </p>
      <div v-if="data.itemName || data.orders.length" class="market-workspace">
        <MarketQuote v-if="data.itemName" :data="data" :loading="loading" />
        <section v-if="data.orders.length" class="market-order-window hv-window">
          <h3 class="hv-window-title">{{ t('创建订单') }}</h3>
          <ChoiceGroup
            v-if="data.orders.length > 1"
            v-model="orderSide"
            :disabled="loading"
            class="bazaar-order-switch"
          >
            <RadioChoice value="buy">{{ t('购买') }}</RadioChoice
            ><RadioChoice value="sell">{{ t('出售') }}</RadioChoice>
          </ChoiceGroup>
          <div v-if="data.orders.length" class="bazaar-orders">
            <article v-for="order in visibleOrders" :key="order.side">
              <h3>{{ order.side === 'buy' ? t('提交买单') : t('提交卖单') }}</h3>
              <label
                >{{ t('批数') }} × {{ data.batchSize || '—'
                }}<NumberField
                  v-model="drafts[order.side]!.count"
                  @change="updateOrderDraft(order.side, 'count')"
                  :min="1"
                  :max="order.maxCount"
                  :disabled="loading"
              /></label>
              <label
                >{{ t('每批价格') }} (C)<NumberField
                  v-model="drafts[order.side]!.price"
                  @change="updateOrderDraft(order.side, 'price')"
                  :min="10"
                  :max="100000000"
                  :step="hentaiVerseMarketPriceStep(drafts[order.side]!.price)"
                  :disabled="loading"
              /></label>
              <p>
                {{ t('总额') }}
                {{ (drafts[order.side]!.count * drafts[order.side]!.price).toLocaleString() }} C
              </p>
              <p v-if="orderErrors[order.side]" class="bazaar-validation" role="status">
                {{ t(orderErrors[order.side]) }}
              </p>
              <ActionButton
                variant="default"
                :loading="loading"
                :disabled="confirming || !!orderErrors[order.side]"
                @click="submitOrder(order)"
                >{{ order.side === 'buy' ? t('提交买单') : t('提交卖单') }}</ActionButton
              >
            </article>
          </div>
        </section>
      </div>
      <EmptyState v-if="data.emptyReason" :description="t(data.emptyReason)" />
      <details
        v-for="(table, index) in data.tables"
        :key="index"
        class="bazaar-table-block"
        :class="{ 'bazaar-market-list': table.title === '物品列表' }"
        :open="!data.itemName || !hasMarketQuote"
      >
        <summary>{{ t(table.title) }} · {{ t('原始表格') }}</summary>
        <div
          class="bazaar-table-scroll"
          :class="{
            'bazaar-table-entries':
              table.headers.length > 0 &&
              table.rows.every((row) => row.cells.length === table.headers.length) &&
              !['市场卖单', '市场买单', '价格历史'].includes(table.title),
          }"
        >
          <table>
            <thead v-if="table.headers.length">
              <tr>
                <th v-for="(header, i) in table.headers" :key="i">{{ t(header) }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in table.rows" :key="i">
                <td v-for="(cell, j) in row.cells" :key="j" :data-label="t(table.headers[j] || '')">
                  <button
                    v-if="j === 0 && row.query"
                    class="bazaar-link"
                    :disabled="loading"
                    @click="emit('navigate', row.query)"
                  >
                    {{ t(cell) }}</button
                  ><template v-else>{{ t(cell) }}</template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
      <nav v-if="data.links.length" class="bazaar-nav">
        <ActionButton
          v-for="(link, i) in data.links"
          :key="i"
          size="sm"
          :disabled="loading"
          @click="emit('navigate', link.query)"
          >{{ t(link.label) }}</ActionButton
        >
      </nav>
    </template>
  </section>
</template>

<style scoped>
.bazaar-unit-note {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 12px;
}
.bazaar-validation {
  color: var(--muted-foreground);
  font-size: 13px;
  margin: 0;
  overflow-wrap: anywhere;
}
.bazaar-panel {
  display: grid;
  gap: 12px;
  min-width: 0;
}
.bazaar-nav,
.bazaar-balances,
.bazaar-transfer,
.bazaar-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  align-items: center;
}
.bazaar-category-select {
  width: 100%;
}
.bazaar-stock-checks {
  gap: 4px 12px;
}
.bazaar-stock-checks :deep(.ui-checkbox) {
  min-height: 44px;
  font-size: 12px;
  gap: 6px;
}
.bazaar-stock-checks :deep(button[role='checkbox']) {
  min-height: 16px;
  height: 16px;
  width: 16px;
}
.bazaar-market-list tbody tr {
  border-bottom: 1px solid var(--border);
}
.bazaar-market-list td:first-child {
  font-weight: 500;
}
.bazaar-market-list .bazaar-link {
  color: var(--foreground);
}
.bazaar-tools :deep(.ui-input) {
  width: min(100%, 300px);
}
.bazaar-item-layout {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(240px, 1fr);
  gap: 20px;
}
.bazaar-items {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 4px;
  max-height: 620px;
  overflow: auto;
}
.bazaar-items > button {
  min-width: 0;
  overflow-wrap: anywhere;
  text-align: left;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--foreground);
  background: var(--muted);
  cursor: pointer;
}
.bazaar-items > button.selected {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.bazaar-items > button > span {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.bazaar-records summary {
  cursor: pointer;
  color: var(--muted-foreground);
  font-size: 13px;
}
.bazaar-records[open] summary {
  margin-bottom: 8px;
}
.bazaar-balances {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.bazaar-transfer {
  padding: 10px;
  border: 1px solid var(--border-soft);
  border-radius: 6px;
}
.bazaar-items small {
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--muted-foreground);
}
.bazaar-desktop-detail {
  display: grid;
  align-content: start;
  gap: 16px;
  min-width: 0;
}
.bazaar-quantity {
  display: grid;
  gap: 6px;
}
.bazaar-item-action {
  justify-self: start;
}
.bazaar-detail {
  display: grid;
  align-content: start;
  justify-items: start;
  gap: 12px;
  min-width: 0;
}
.bazaar-detail p {
  margin: 0;
  overflow-wrap: anywhere;
}
.bazaar-detail :deep(.ui-select) {
  width: 100%;
  max-width: 320px;
}
.bazaar-orders {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.bazaar-orders article {
  display: grid;
  justify-items: start;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--border-soft);
  border-radius: 6px;
}
.bazaar-orders label {
  display: grid;
  gap: 6px;
}
h3 {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
}
.bazaar-table-block {
  display: grid;
  gap: 8px;
  min-width: 0;
}
.bazaar-table-block > summary {
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}
.bazaar-table-block[open] > summary {
  margin-bottom: 8px;
}
.bazaar-table-scroll {
  overflow: auto;
}
table {
  font-variant-numeric: tabular-nums;
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
th,
td {
  text-align: left;
  padding: 7px 10px;
  border-bottom: 1px solid var(--border-soft);
  white-space: nowrap;
}
.bazaar-table-scroll:not(.bazaar-table-entries) :is(th, td):not(:first-child) {
  text-align: right;
}
th {
  color: var(--muted-foreground);
  font-weight: 500;
}
.bazaar-link {
  color: var(--accent);
  cursor: pointer;
  padding: 0;
  background: none;
  border: 0;
  font: inherit;
  text-align: left;
}
@media (max-width: 767px) {
  .bazaar-item-layout,
  .bazaar-orders {
    grid-template-columns: 1fr;
  }
  .bazaar-items {
    max-height: none;
    overflow: visible;
  }
  .bazaar-panel :deep(input:not([type='radio'])),
  .bazaar-panel :deep(select) {
    font-size: 16px;
  }
  .bazaar-panel :deep(button),
  .bazaar-panel :deep(input:not([type='radio'])),
  .bazaar-panel :deep(select),
  .bazaar-panel :deep(.ui-radio) {
    min-height: 44px;
  }
  .bazaar-orders article {
    padding: 16px 0;
    border: 0;
    border-top: 1px solid var(--border-soft);
    border-radius: 0;
  }
  .bazaar-orders label,
  .bazaar-orders :deep(.ui-input-number) {
    width: 100%;
  }
  .bazaar-table-entries {
    overflow: visible;
  }
  .bazaar-table-entries table,
  .bazaar-table-entries tbody {
    display: block;
  }
  .bazaar-table-entries thead {
    display: none;
  }
  .bazaar-table-entries tr {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--border-soft);
  }
  .bazaar-market-list .bazaar-table-entries tr {
    padding: 8px 0;
    border-bottom-color: var(--border);
  }
  .bazaar-market-list .bazaar-table-entries td:not(:first-child) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 3px;
    font-size: 12px;
  }
  .bazaar-market-list .bazaar-table-entries td:first-child {
    min-height: 44px;
    align-items: center;
  }
  .bazaar-market-list .bazaar-table-entries .bazaar-link {
    min-height: 44px;
  }
  .bazaar-table-entries td {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    padding: 0;
    border: 0;
    white-space: normal;
    overflow-wrap: anywhere;
    min-width: 0;
  }
  .bazaar-table-entries td:first-child {
    grid-column: 1 / -1;
  }
  .bazaar-table-entries td::before {
    content: attr(data-label);
    color: var(--muted-foreground);
  }
  .bazaar-table-entries .bazaar-link {
    width: 100%;
  }
  .bazaar-table-entries td:has(.bazaar-link)::before {
    display: none;
  }
  .bazaar-detail :deep(input),
  .bazaar-detail :deep(select) {
    font-size: 16px;
    min-height: 44px;
  }
  .bazaar-detail .bazaar-quantity,
  .bazaar-detail :deep(.ui-input-number),
  .bazaar-detail :deep(.ui-select) {
    width: 100%;
    max-width: none;
  }
  .bazaar-item-action {
    min-height: 44px;
    width: 100%;
  }
  .bazaar-transfer {
    gap: 8px;
  }
  .bazaar-nav {
    gap: 6px;
  }
}
</style>
