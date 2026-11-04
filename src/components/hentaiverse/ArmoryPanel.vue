<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { createReusableTemplate, useMediaQuery } from '@vueuse/core'
import ModalPanel from '@/components/primitives/ModalPanel.vue'
import { t } from '@/i18n'
import { dialogs } from '@/components/primitives/feedback'
import ActionButton from '@/components/primitives/ActionButton.vue'
import CheckField from '@/components/primitives/CheckField.vue'
import SelectField from '@/components/primitives/SelectField.vue'
import TextField from '@/components/primitives/TextField.vue'
import EquipmentDetail from './EquipmentDetail.vue'
import type {
  HentaiVerseEquipmentDetail,
  HentaiVerseFormData,
} from '@/core/hentaiverse/model/hentaiVerse'
import {
  getArmoryCharmSelection,
  type ArmoryAction,
  type HentaiVerseArmoryPage,
} from '@/core/hentaiverse/hentaiVerseArmory'

const props = defineProps<{
  data: HentaiVerseArmoryPage
  loading?: boolean
  details?: Record<string, HentaiVerseEquipmentDetail>
  detailsLoading?: boolean
  detailsError?: string
}>()
const emit = defineEmits<{
  navigate: [query: Record<string, string>]
  submit: [data: HentaiVerseFormData, label: string]
  retryDetails: []
}>()
let active = true
onBeforeUnmount(() => {
  active = false
})
const mobile = useMediaQuery('(max-width: 767px)')
const operationOpen = ref(false)
const [DefineArmoryOperation, ArmoryOperation] = createReusableTemplate()
const selected = ref<string[]>([]),
  search = ref(''),
  page = ref(1)
const values = ref<Record<string, string>>({}),
  checked = ref<Record<string, boolean>>({})
const labels: Record<string, string> = {
  organize: '整理装备',
  modify: '改造装备',
  repair: '修理装备',
  soulbind: '灵魂绑定',
  purchase: '购买装备',
  sell: '出售装备',
  salvage: '分解装备',
}
function navigateChoice(kind: 'tabs' | 'filters', value: string | undefined) {
  const link = props.data[kind].find(
    (item) => item.query[kind === 'tabs' ? 'screen' : 'filter'] === value,
  )
  if (link && !link.active && !props.loading) emit('navigate', link.query)
}

const details = computed(() => ({ ...props.details, ...props.data.inlineDetails }))
const charmSelection = computed(() => getArmoryCharmSelection(props.data, values.value))
const filtered = computed(() =>
  props.data.equipment.filter((e) =>
    `${e.name} ${e.category}`.toLowerCase().includes(search.value.toLowerCase()),
  ),
)
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / 40)))
const visible = computed(() => filtered.value.slice((page.value - 1) * 40, page.value * 40))
const selectedEquipment = computed(() =>
  props.data.equipment.filter((e) => selected.value.includes(e.id)),
)
const credits = computed(() => selectedEquipment.value.reduce((sum, e) => sum + e.credits, 0))
const materials = computed(() => {
  const result = new Map<string, { name: string; count: number; owned: number }>()
  for (const equipment of selectedEquipment.value)
    for (const material of equipment.materials) {
      if (
        props.data.screen === 'repair' &&
        !checked.value.replace_charms &&
        Number(material.id) >= 61900 &&
        Number(material.id) <= 64999
      )
        continue
      const entry = result.get(material.id)
      if (entry) entry.count += material.count
      else result.set(material.id, { ...material })
    }
  return [...result.values()]
})
const missingMaterials = computed(
  () =>
    ['repair', 'soulbind'].includes(props.data.screen) &&
    materials.value.some((m) => m.count > m.owned),
)
const canSubmit = computed(
  () =>
    selected.value.length > 0 &&
    !props.loading &&
    !missingMaterials.value &&
    (props.data.screen !== 'purchase' || credits.value <= props.data.balance),
)

watch(
  () => props.data,
  (data) => {
    selected.value = []
    operationOpen.value = false
    page.value = 1
    search.value = ''
    values.value = {}
    checked.value = {}
    for (const control of data.controls) {
      values.value[control.name] = control.value
      checked.value[control.name] = control.checked
    }
  },
  { immediate: true },
)
watch([mobile, () => selected.value.length], ([isMobile, count]) => {
  if (!isMobile || !count) operationOpen.value = false
})
watch(search, () => {
  page.value = 1
})

async function toggle(id: string, value: boolean) {
  const source = props.data
  if (!active || props.loading) return
  const equipment = source.equipment.find((e) => e.id === id)
  if (value && equipment?.protected && ['sell', 'salvage'].includes(props.data.screen)) {
    try {
      await dialogs.confirm(`${t('所选装备包含受保护物品。')}\n${equipment.name}`, t('确认选择'), {
        confirmButtonText: t('选择'),
        cancelButtonText: t('取消'),
      })
    } catch {
      return
    }
    if (!active || props.loading || source !== props.data) return
  }
  selected.value =
    props.data.screen === 'modify'
      ? value
        ? [id]
        : []
      : value
        ? [...selected.value, id]
        : selected.value.filter((item) => item !== id)
}

async function submit(action?: ArmoryAction) {
  const source = props.data
  if (
    !active ||
    props.loading ||
    (action?.charm ? !charmSelection.value?.allowed || !!action.blockedReason : action?.disabled) ||
    (!source.modify && !canSubmit.value)
  )
    return
  const label = action?.label || labels[props.data.screen] || props.data.screen
  if (props.data.screen === 'modify' && !props.data.modify) {
    emit('navigate', {
      s: 'Bazaar',
      ss: 'am',
      screen: 'modify',
      filter: props.data.filters.find((f) => f.active)?.query.filter || 'new',
      'eqids[]': selected.value[0]!,
    })
    return
  }
  const payload: HentaiVerseFormData = { ...props.data.hidden, ...(action?.hidden || {}) }
  if (action?.value === 'rename') {
    try {
      payload.eqname = (
        await dialogs.prompt(t('输入装备名称，留空可恢复默认名称。'), t('重命名装备'), {
          inputPattern: /^.{0,50}$/,
          inputErrorMessage: t('名称最多 50 个字符'),
          confirmButtonText: t('下一步'),
          cancelButtonText: t('取消'),
        })
      ).value
    } catch {
      return
    }
    if (!active || props.loading || source !== props.data) return
  }
  if (!props.data.modify) payload['eqids[]'] = selected.value
  for (const control of props.data.controls) {
    if (control.disabled) continue
    if (control.type === 'checkbox') {
      if (checked.value[control.name]) payload[control.name] = control.value || 'on'
      else delete payload[control.name]
    } else payload[control.name] = values.value[control.name] || ''
  }
  if (action?.name) payload[action.name] = action.value
  const summary = [
    t(label),
    t('已选 {p0} 件', { p0: props.data.modify ? 1 : selected.value.length }),
    ...selectedEquipment.value.map((e) => e.name),
  ]
  if (props.data.modify)
    summary.push(details.value[props.data.selectedId]?.name || props.data.selectedId)
  if (credits.value && (props.data.screen !== 'salvage' || checked.value.sell_salvage))
    summary.push(t('点数：{p0}', { p0: credits.value.toLocaleString() }))
  summary.push(...materials.value.map((m) => `${m.name} × ${m.count} (${t('持有')} ${m.owned})`))
  if (props.data.screen === 'soulbind' || action?.value === 'soulbind')
    summary.push(t('绑定后将永久不可交易，且无法分解。'))
  if (props.data.screen === 'salvage')
    summary.push(t('分解将使装备变为残骸，恢复装备需要额外材料。'))
  if (action?.value === 'upgrade')
    summary.push(
      ...props.data.sections
        .filter((section) => section.title === 'Upgrades' || section.title === '升级')
        .flatMap((section) => section.lines),
    )
  if (action?.value === 'rename') summary.push(String(payload.eqname || t('默认名称')))
  if (action?.value === 'unequip') summary.push(t('将从所有人格的所有装备套装中强制卸下此装备。'))
  if (action?.charm && charmSelection.value) {
    const charm = charmSelection.value
    summary.push(`${t('护符槽位')} ${charm.slot}: ${charm.charmName} / ${charm.pouchName}`)
    summary.push(`${t('护符点数')}: ${charm.usedCp} / ${charm.maxCp}`)
    summary.push(...charm.requirements.map((material) => `${material.name} × ${material.count}`))
    if (charm.destroysCharm) summary.push(t('当前护符将被销毁。'))
    if (charm.destroysPouch) summary.push(t('当前护符袋将被销毁。'))
  }
  if (selectedEquipment.value.some((e) => e.protected)) summary.push(t('所选装备包含受保护物品。'))
  for (const control of props.data.controls)
    summary.push(
      `${t(control.label)}: ${control.type === 'checkbox' ? t(checked.value[control.name] ? '启用' : '清除') : t(control.options.find((o) => o.value === values.value[control.name])?.label || values.value[control.name] || '')}`,
    )
  summary.push(...(action?.confirmation || []).map((line) => t(line)))
  try {
    await dialogs.confirm(summary.join('\n'), t('确认装备操作'), {
      confirmButtonText: t(label),
      cancelButtonText: t('取消'),
    })
  } catch {
    return
  }
  if (!active || props.loading || source !== props.data) return
  emit('submit', payload, label)
}
</script>

<template>
  <DefineArmoryOperation>
    <div v-if="data.modify || selected.length" class="armory-operation">
      <div class="armory-controls">
        <template v-for="control in data.controls" :key="control.name">
          <CheckField
            v-if="control.type === 'checkbox'"
            v-model="checked[control.name]"
            :disabled="loading || control.disabled"
            >{{ t(control.label) }}</CheckField
          >
          <label v-else
            >{{ t(control.label)
            }}<select
              v-if="control.options.length"
              v-model="values[control.name]"
              :disabled="loading || control.disabled"
            >
              <option
                v-for="option in control.options"
                :key="option.value"
                :value="option.value"
                :disabled="option.disabled"
                :title="t(option.help || '')"
              >
                {{ t(option.label) }}
              </option></select
            ><input
              v-else
              v-model="values[control.name]"
              :type="control.type === 'number' ? 'number' : 'text'"
              :disabled="loading || control.disabled"
          /></label>
        </template>
      </div>
      <p v-if="data.actions.some((action) => action.charm)" role="status">
        <template v-if="charmSelection"
          >{{ t('护符点数') }}: {{ charmSelection.usedCp }} / {{ charmSelection.maxCp }}
          <span v-if="charmSelection.reason">{{ t(charmSelection.reason) }}</span></template
        >
        <template v-else>{{ t('源站未提供完整护符改造数据，暂不能提交此操作。') }}</template>
      </p>
      <div v-if="selected.length" class="armory-summary" aria-live="polite">
        <strong>{{ t('已选 {p0} 件', { p0: selected.length }) }}</strong>
        <p v-if="credits && (data.screen !== 'salvage' || checked.sell_salvage)">
          {{ t('点数：{p0}', { p0: credits.toLocaleString() }) }}
        </p>
        <p
          v-for="material in materials"
          :key="material.name"
          :class="{
            shortage:
              ['repair', 'soulbind'].includes(data.screen) && material.count > material.owned,
          }"
        >
          {{ t(material.name) }} × {{ material.count }} ({{ t('持有') }} {{ material.owned }})
        </p>
      </div>
      <div v-if="data.modify" class="armory-actions">
        <div v-for="(action, index) in data.actions" :key="index">
          <ActionButton
            :disabled="
              loading ||
              (action.charm ? !charmSelection?.allowed || !!action.blockedReason : action.disabled)
            "
            :title="t(action.help)"
            @click="submit(action)"
            >{{ t(action.label) }}</ActionButton
          ><small v-if="action.help">{{ t(action.help) }}</small>
        </div>
      </div>
      <ActionButton
        v-else-if="!mobile"
        variant="default"
        :disabled="!canSubmit"
        :loading="loading"
        @click="submit()"
        >{{ t(labels[data.screen] || data.screen) }}</ActionButton
      >
    </div>
  </DefineArmoryOperation>
  <ModalPanel
    v-if="mobile && !data.modify"
    v-model="operationOpen"
    :title="t(labels[data.screen])"
    content-class="hv-theme hv-dialog"
    sheet
  >
    <ArmoryOperation />
    <template #footer>
      <ActionButton
        class="armory-submit"
        variant="default"
        :disabled="!canSubmit"
        :loading="loading"
        @click="submit()"
      >
        {{ t(labels[data.screen] || data.screen) }}
      </ActionButton>
    </template>
  </ModalPanel>
  <section class="armory-panel">
    <div class="armory-mobile-navigation">
      <label>
        <span>{{ t('操作') }}</span>
        <SelectField
          :model-value="data.screen"
          :disabled="loading"
          :aria-label="t('装备库操作')"
          @change="navigateChoice('tabs', $event)"
        >
          <option v-for="tab in data.tabs" :key="tab.query.screen" :value="tab.query.screen">
            {{ t(tab.label) }}
          </option>
        </SelectField>
      </label>
      <label v-if="data.filters.length">
        <span>{{ t('装备分类') }}</span>
        <SelectField
          :model-value="data.filters.find((filter) => filter.active)?.query.filter"
          :disabled="loading"
          :aria-label="t('装备分类')"
          @change="navigateChoice('filters', $event)"
        >
          <option
            v-for="filter in data.filters"
            :key="filter.query.filter"
            :value="filter.query.filter"
          >
            {{ t(filter.label) }}
          </option>
        </SelectField>
      </label>
    </div>
    <nav class="armory-tabs armory-navigation" :aria-label="t('装备库')">
      <ActionButton
        v-for="tab in data.tabs"
        :key="tab.query.screen"
        :variant="tab.active ? 'default' : 'outline'"
        :disabled="loading"
        :aria-current="tab.active ? 'page' : undefined"
        @click="emit('navigate', tab.query)"
        >{{ t(tab.label) }}</ActionButton
      >
    </nav>
    <nav class="armory-tabs armory-filters armory-navigation" :aria-label="t('装备分类')">
      <ActionButton
        v-for="filter in data.filters"
        :key="filter.query.filter"
        size="sm"
        :variant="filter.active ? 'secondary' : 'ghost'"
        :disabled="loading"
        :aria-current="filter.active ? 'page' : undefined"
        @click="emit('navigate', filter.query)"
        >{{ t(filter.label) }}</ActionButton
      >
    </nav>
    <p v-if="['purchase', 'sell', 'salvage'].includes(data.screen)">
      {{ t('当前点数') }}: {{ data.balance.toLocaleString() }}
    </p>
    <details v-if="data.descriptions.length" class="armory-help">
      <summary>{{ t('操作说明') }}</summary>
      <p v-for="line in data.descriptions" :key="line">{{ t(line) }}</p>
    </details>
    <p v-if="detailsLoading" role="status">{{ t('正在加载装备属性…') }}</p>
    <p v-if="detailsError" role="alert">
      {{ t(detailsError) }}
      <ActionButton variant="link" @click="emit('retryDetails')">{{
        t('重试加载属性')
      }}</ActionButton>
    </p>
    <template v-if="!data.modify">
      <div class="armory-toolbar">
        <TextField
          v-model="search"
          type="search"
          :placeholder="t('搜索装备')"
          :aria-label="t('搜索装备')"
        />
        <span>{{ t('已选 {p0} 件', { p0: selected.length }) }}</span>
        <ActionButton
          v-if="data.screen !== 'modify'"
          size="sm"
          :disabled="loading"
          @click="
            selected = filtered
              .filter(
                (e) => !e.disabled && !(['sell', 'salvage'].includes(data.screen) && e.protected),
              )
              .map((e) => e.id)
          "
          >{{ t('选择筛选结果') }}</ActionButton
        >
        <ActionButton size="sm" :disabled="loading || !selected.length" @click="selected = []">{{
          t('清空选择')
        }}</ActionButton>
      </div>
      <div v-if="mobile && selected.length" class="armory-selection-bar" role="status">
        <strong>{{ t('已选 {p0} 件', { p0: selected.length }) }}</strong>
        <ActionButton variant="default" @click="operationOpen = true">{{
          t('查看操作')
        }}</ActionButton>
      </div>
      <div class="armory-list">
        <article
          v-for="equipment in visible"
          :key="equipment.id"
          :class="{ selected: selected.includes(equipment.id) }"
        >
          <div class="equipment-row">
            <CheckField
              :model-value="selected.includes(equipment.id)"
              :disabled="loading || equipment.disabled"
              @update:model-value="toggle(equipment.id, $event)"
              ><strong>{{ t(equipment.name) }}</strong></CheckField
            >
          </div>
          <div class="equipment-meta">
            <span v-if="equipment.category && !details[equipment.id]">{{
              t(equipment.category)
            }}</span>
            <span v-if="equipment.status">{{ t(equipment.status) }}</span>
          </div>
          <EquipmentDetail
            v-if="details[equipment.id]"
            class="equipment-properties"
            :data="details[equipment.id]!"
          />
        </article>
        <p v-if="!filtered.length" class="empty">{{ t('没有符合条件的装备') }}</p>
      </div>
      <div v-if="pageCount > 1" class="armory-toolbar">
        <ActionButton size="sm" :disabled="page <= 1" @click="page--">{{
          t('上一页')
        }}</ActionButton
        ><span>{{ page }} / {{ pageCount }}</span
        ><ActionButton size="sm" :disabled="page >= pageCount" @click="page++">{{
          t('下一页')
        }}</ActionButton>
      </div>
    </template>
    <EquipmentDetail v-else-if="details[data.selectedId]" :data="details[data.selectedId]!" />
    <nav v-if="data.modify && data.modificationLinks.length" class="armory-tabs">
      <ActionButton
        v-for="(link, index) in data.modificationLinks"
        :key="index"
        :disabled="loading"
        @click="emit('navigate', link.query)"
        >{{ t(link.label) }}</ActionButton
      >
    </nav>
    <div v-if="data.sections.length" class="armory-sections">
      <section v-for="(section, index) in data.sections" :key="index">
        <h4>{{ t(section.title) }}</h4>
        <p v-for="(line, i) in section.lines" :key="i">{{ t(line) }}</p>
      </section>
    </div>
    <ArmoryOperation v-if="!mobile || data.modify" />
  </section>
</template>

<style scoped>
.armory-panel {
  display: grid;
  gap: 16px;
  min-width: 0;
}
.armory-mobile-navigation {
  display: none;
}
.armory-tabs,
.armory-toolbar,
.armory-controls,
.armory-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.armory-panel p,
.armory-operation p {
  margin: 0;
  white-space: pre-line;
  overflow-wrap: anywhere;
}
.armory-help {
  color: var(--muted-foreground);
  font-size: 13px;
}
.armory-help p {
  margin-top: 10px;
}
.armory-list {
  display: grid;
  gap: 8px;
}
.armory-list article {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px;
  min-width: 0;
}
.armory-list article.selected {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.equipment-row {
  min-width: 0;
}
.equipment-row :deep(.ui-checkbox) {
  width: 100%;
  align-items: flex-start;
}
.equipment-row :deep([data-slot='checkbox']) {
  flex-shrink: 0;
  margin-top: 3px;
}
.equipment-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  padding-left: 24px;
  color: var(--muted-foreground);
  font-size: 13px;
  overflow-wrap: anywhere;
}
.equipment-properties {
  margin-top: 4px;
  padding-left: 24px;
}
.armory-filters {
  border-bottom: 1px solid var(--border);
  padding-bottom: 10px;
}
.armory-operation {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
}
.armory-selection-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  position: sticky;
  top: env(safe-area-inset-top, 0px);
  z-index: 5;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
}
.armory-submit {
  width: 100%;
  min-height: 44px;
}
.armory-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  align-items: baseline;
}
.armory-operation > .ui-button {
  justify-self: start;
}
.equipment-row strong {
  overflow-wrap: anywhere;
}
.armory-panel small,
.armory-operation small {
  display: block;
  color: var(--muted-foreground);
  margin-top: 5px;
}
.armory-panel summary {
  cursor: pointer;
  margin: 6px 0;
}
.armory-panel input,
.armory-panel select,
.armory-operation input,
.armory-operation select {
  min-width: 0;
  max-width: 100%;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  color: var(--text);
  padding: 8px;
}
.armory-controls label {
  display: flex;
  align-items: center;
  gap: 8px;
}
.armory-sections {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}
.armory-sections section {
  border-top: 1px solid var(--border);
  padding-top: 10px;
}
.armory-sections h4 {
  margin: 0 0 8px;
}
.shortage {
  color: var(--destructive);
}
.empty {
  padding: 20px;
  color: var(--muted-foreground);
  text-align: center;
}
@media (max-width: 767px) {
  .armory-panel input,
  .armory-panel select {
    font-size: 16px;
  }
  .armory-panel {
    gap: 12px;
    padding-bottom: calc(80px + env(safe-area-inset-bottom));
  }
  .armory-selection-bar {
    margin-right: calc(var(--fab-size) + var(--fab-inset));
    flex-wrap: wrap;
  }
  .armory-navigation {
    display: none;
  }
  .armory-mobile-navigation {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 10px;
  }
  .armory-mobile-navigation label {
    display: grid;
    min-width: 0;
    gap: 6px;
    font-size: 13px;
    color: var(--muted-foreground);
  }
  .armory-panel :deep(.ui-button),
  .armory-panel :deep(.ui-checkbox),
  .armory-panel :deep(input),
  .armory-panel :deep(select),
  .armory-panel :deep([data-slot='select-trigger']) {
    min-height: 44px;
  }
  .armory-panel :deep(input),
  .armory-panel :deep(select),
  .armory-operation input,
  .armory-operation select {
    font-size: 16px;
    min-height: 44px;
  }
  .armory-panel summary {
    min-height: 44px;
    margin: 0;
    align-content: center;
  }
  .armory-toolbar > .ui-input {
    flex-basis: 100%;
  }
  .armory-toolbar > .ui-button {
    flex: 1 1 auto;
  }
  .armory-controls {
    align-items: stretch;
  }
  .armory-controls > label {
    flex: 1 1 100%;
    min-width: 0;
    justify-content: space-between;
  }
  .armory-controls select,
  .armory-controls input {
    flex: 1;
  }
  .armory-operation > .ui-button {
    width: 100%;
  }
  .armory-actions > div {
    flex: 1 1 140px;
  }
}
</style>
