<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { notify, dialogs } from '@/components/primitives/feedback'
import NumberField from '@/components/primitives/NumberField.vue'
import TextField from '@/components/primitives/TextField.vue'
import SelectField from '@/components/primitives/SelectField.vue'
import ChoiceGroup from '@/components/primitives/ChoiceGroup.vue'
import RadioChoice from '@/components/primitives/RadioChoice.vue'
import { t } from '@/i18n'
import ActionButton from '@/components/primitives/ActionButton.vue'
import EmptyState from '@/components/primitives/EmptyState.vue'
import {
  buildHentaiVerseMarketOrder,
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
const selected = ref<HentaiVerseBazaarItem>()
const count = ref(1)
const transferAmount = ref(1)
const reward = ref('')
const drafts = reactive<Record<string, { count: number; price: number }>>({})
const query = ref('')
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
    reward.value = ''
    count.value = 1
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
  const amount = transferAmount.value
  const limit = transfer.name === 'account_deposit' ? props.data.credits : props.data.marketBalance
  if (!Number.isInteger(amount) || amount < 1 || amount > Math.min(999999999, limit)) {
    notify.error(t('金额无效或余额不足'))
    return
  }
  void confirmSubmit(
    { ...props.data.hidden, account_amount: String(amount), [transfer.name]: transfer.value },
    t(transfer.label),
    `${t(transfer.label)}：${amount.toLocaleString()} C`,
  )
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
}
</script>

<template>
  <section class="bazaar-panel" :aria-busy="loading">
    <nav v-if="data.navigation.length" class="bazaar-nav" :aria-label="t('市场页面')">
      <ActionButton
        v-for="link in data.navigation"
        :key="link.label"
        :variant="link.active ? 'secondary' : 'outline'"
        :disabled="loading"
        @click="emit('navigate', link.query)"
        >{{ t(link.label) }}</ActionButton
      >
    </nav>
    <nav v-if="data.filters.length" class="bazaar-nav" :aria-label="t('物品分类')">
      <ActionButton
        v-for="link in data.filters"
        :key="link.label"
        size="sm"
        :variant="link.active ? 'secondary' : 'ghost'"
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
    </div>
    <nav v-if="data.stockFilters.length" class="bazaar-nav" :aria-label="t('库存筛选')">
      <ActionButton
        v-for="link in data.stockFilters"
        :key="link.label"
        size="sm"
        :variant="link.active ? 'secondary' : 'outline'"
        :disabled="loading"
        @click="emit('navigate', link.query)"
        >{{ t(link.label) }}</ActionButton
      >
    </nav>
    <div v-if="data.kind === 'market' && data.transfers.length" class="bazaar-transfer">
      <NumberField
        v-model="transferAmount"
        @change="transferAmount = Number(transferAmount) || 1"
        :min="1"
        :max="999999999"
        :disabled="loading"
        :aria-label="t('转移金额')"
      />
      <ActionButton
        v-for="transfer in data.transfers"
        :key="transfer.name"
        :disabled="loading || confirming"
        @click="submitTransfer(transfer)"
        >{{ t(transfer.label) }}</ActionButton
      >
    </div>

    <template v-if="data.kind === 'itemShop' || data.kind === 'shrine'">
      <div class="bazaar-tools">
        <ChoiceGroup
          v-if="data.kind === 'itemShop'"
          v-model="mode"
          :disabled="loading"
          @change="selected = undefined"
        >
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
        <div class="bazaar-detail">
          <h3 v-if="selected">{{ t(selected.name) }}</h3>
          <template v-if="data.kind === 'itemShop' && selected">
            <p v-if="selected.description">{{ t(selected.description) }}</p>
            <p>{{ t('单价') }} {{ selected.price.toLocaleString() }} C</p>
            <NumberField
              v-model="count"
              @change="count = Number(count) || 1"
              :min="1"
              :max="Math.max(1, maximum)"
              :disabled="loading"
              :aria-label="t('数量')"
            />
            <p>
              {{ t('总额') }} <strong>{{ (count * selected.price).toLocaleString() }} C</strong>
            </p>
            <ActionButton
              :loading="loading"
              :disabled="confirming || maximum < 1"
              @click="submitShop"
              >{{ selected.mode === 'shop_pane' ? t('购买物品') : t('出售物品') }}</ActionButton
            >
          </template>
          <template v-else-if="data.kind === 'shrine'">
            <p v-for="paragraph in shrineParagraphs" :key="paragraph">{{ t(paragraph) }}</p>
            <template v-if="selected">
              <p>
                {{ t('消耗祭品') }} {{ selected.required.toLocaleString() }} /
                {{ selected.stock.toLocaleString() }}
              </p>
              <SelectField
                v-if="selectedKind === 'trophy'"
                v-model="reward"
                :placeholder="t('选择奖励类型')"
                :disabled="loading"
              >
                <option
                  v-for="entry in data.rewards"
                  :key="`${entry.type}:${entry.slot}`"
                  :value="`${entry.type}:${entry.slot}`"
                  :label="`${t(rewardGroup[entry.type] || '')} ${t(entry.label)}`.trim()"
                />
              </SelectField>
              <p v-else>{{ t('随机奖励') }}</p>
              <ActionButton
                :loading="loading"
                :disabled="
                  confirming ||
                  !availableReward ||
                  selected.stock < selected.required ||
                  selected.required < 1
                "
                @click="submitShrine"
                >{{ t('提交祭品') }}</ActionButton
              >
            </template>
          </template>
          <p v-else>{{ t('选择物品查看详情') }}</p>
        </div>
      </div>
    </template>

    <template v-if="data.kind === 'market'">
      <h3 v-if="data.itemName">{{ t(data.itemName) }}</h3>
      <p v-if="data.itemInfo">{{ t(data.itemInfo) }}</p>
      <div v-if="data.orders.length" class="bazaar-orders">
        <article v-for="order in data.orders" :key="order.side">
          <h3>{{ order.side === 'buy' ? t('提交买单') : t('提交卖单') }}</h3>
          <label
            >{{ t('批数') }} × {{ data.batchSize
            }}<NumberField
              v-model="drafts[order.side]!.count"
              @change="drafts[order.side]!.count = Number(drafts[order.side]!.count) || 1"
              :min="1"
              :max="order.maxCount"
              :disabled="loading"
          /></label>
          <label
            >{{ t('每批价格') }} (C)<NumberField
              v-model="drafts[order.side]!.price"
              @change="drafts[order.side]!.price = Number(drafts[order.side]!.price) || 10"
              :min="10"
              :max="100000000"
              :step="hentaiVerseMarketPriceStep(drafts[order.side]!.price)"
              :disabled="loading"
          /></label>
          <p>
            {{ t('总额') }}
            {{ (drafts[order.side]!.count * drafts[order.side]!.price).toLocaleString() }} C
          </p>
          <ActionButton :loading="loading" :disabled="confirming" @click="submitOrder(order)">{{
            order.side === 'buy' ? t('提交买单') : t('提交卖单')
          }}</ActionButton>
        </article>
      </div>
      <EmptyState v-if="data.emptyReason" :description="t(data.emptyReason)" />
      <div v-for="(table, index) in data.tables" :key="index" class="bazaar-table-block">
        <h3>{{ t(table.title) }}</h3>
        <div class="bazaar-table-scroll">
          <table>
            <thead v-if="table.headers.length">
              <tr>
                <th v-for="(header, i) in table.headers" :key="i">{{ t(header) }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in table.rows" :key="i">
                <td v-for="(cell, j) in row.cells" :key="j">
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
      </div>
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
.bazaar-panel {
  display: grid;
  gap: 16px;
  min-width: 0;
}
.bazaar-nav,
.bazaar-balances,
.bazaar-transfer,
.bazaar-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
}
.bazaar-tools :deep(.TextField) {
  width: min(100%, 300px);
}
.bazaar-item-layout {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(240px, 1fr);
  gap: 20px;
}
.bazaar-items {
  display: grid;
  align-content: start;
  gap: 4px;
  max-height: 620px;
  overflow: auto;
}
.bazaar-items > button {
  text-align: left;
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-light);
  cursor: pointer;
}
.bazaar-items > button.selected {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.bazaar-items small {
  color: var(--el-text-color-secondary);
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
.bazaar-detail :deep(.SelectField) {
  width: 100%;
  max-width: 320px;
}
.bazaar-orders {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}
.bazaar-orders article {
  display: grid;
  justify-items: start;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--el-border-color-light);
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
.bazaar-table-scroll {
  overflow: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
th,
td {
  text-align: left;
  padding: 9px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  white-space: nowrap;
}
th {
  color: var(--el-text-color-secondary);
  font-weight: 500;
}
.bazaar-link {
  color: var(--el-color-primary);
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
    max-height: 340px;
  }
  .bazaar-panel :deep(input) {
    font-size: 16px;
  }
  .bazaar-transfer {
    gap: 8px;
  }
  .bazaar-nav {
    gap: 6px;
  }
}
</style>
