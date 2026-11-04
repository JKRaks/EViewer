<script setup lang="ts">
import { t } from '@/i18n'

import PixelIcon from './PixelIcon.vue'
import SelectField from '@/components/primitives/SelectField.vue'
import ActionButton from '@/components/primitives/ActionButton.vue'
import EmptyState from '@/components/primitives/EmptyState.vue'
import ModalPanel from '@/components/primitives/ModalPanel.vue'
import { createReusableTemplate, useMediaQuery } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import type {
  HentaiVerseAbility,
  HentaiVerseAbilityActionName,
  HentaiVerseAbilityPage,
  HentaiVerseAbilitySlot,
} from '@/core/hentaiverse/model/hentaiVerse'

const props = defineProps<{ data: HentaiVerseAbilityPage; loading?: boolean }>()
const emit = defineEmits<{
  tree: [id: string]
  action: [name: HentaiVerseAbilityActionName | 'reset_all', value: string]
  equip: [slotId: string, abilityId: string]
}>()

const selectedAbilityId = ref('')
const mobile = useMediaQuery('(max-width: 767px)')
const slotPickerOpen = ref(false)
const [DefineAbilitySlots, AbilitySlots] = createReusableTemplate()
const expandedSlotGroups = ref<string[]>([])
const selectedAbility = computed(() =>
  props.data.abilities.find((ability) => ability.id === selectedAbilityId.value),
)
const slotGroups = computed(() =>
  Array.from(new Set(props.data.slots.map((slot) => slot.group)), (group) => ({
    label: group,
    slots: props.data.slots.filter((slot) => slot.group === group),
  })),
)

watch(
  () => props.data.selectedTree,
  () => {
    const preferred = props.data.abilities[0]?.group || slotGroups.value[0]?.label
    expandedSlotGroups.value = preferred ? [preferred] : []
  },
  { immediate: true },
)

watch(selectedAbility, (ability) => {
  if (ability && !expandedSlotGroups.value.includes(ability.group)) {
    expandedSlotGroups.value = [...expandedSlotGroups.value, ability.group]
  }
})

function toggleSlotGroup(group: string) {
  expandedSlotGroups.value = expandedSlotGroups.value.includes(group)
    ? expandedSlotGroups.value.filter((value) => value !== group)
    : [...expandedSlotGroups.value, group]
}

function canEquip(slot: HentaiVerseAbilitySlot) {
  return Boolean(selectedAbility.value && selectedAbility.value.group === slot.group)
}

watch(
  () => props.data.selectedTree,
  () => {
    selectedAbilityId.value = ''
    slotPickerOpen.value = false
  },
)

function isAcquired(ability: HentaiVerseAbility) {
  return (ability.level ?? 0) > 0 || (ability.level === null && ability.action === 'reset_ability')
}

function selectAbility(ability: HentaiVerseAbility) {
  if (!isAcquired(ability) || props.loading) return
  selectedAbilityId.value = selectedAbilityId.value === ability.id ? '' : ability.id
  if (mobile.value && selectedAbilityId.value) slotPickerOpen.value = true
}

function getEquipLabel(ability: HentaiVerseAbility) {
  const slots = props.data.slots
    .filter(
      (slot) =>
        !slot.locked &&
        (slot.abilityId === ability.id || (!slot.abilityId && slot.abilityName === ability.name)),
    )
    .map((slot) => slot.label.replace(/^槽位\s*/, ''))
  return slots.length ? t('已装配在 {p0} 位', { p0: slots.join('、') }) : t('选择装配')
}

function isSlotEquipped(slot: HentaiVerseAbilitySlot) {
  return !slot.locked && Boolean(slot.abilityId || slot.abilityName)
}
</script>

<template>
  <section class="ability-panel">
    <div class="ability-summary">
      <SelectField
        v-if="data.trees.length"
        :model-value="data.selectedTree"
        class="ability-trees"
        :aria-label="t('技能分类')"
        :disabled="loading"
        @change="emit('tree', String($event))"
      >
        <option v-for="tree in data.trees" :key="tree.id" :label="t(tree.label)" :value="tree.id" />
      </SelectField>
      <span v-if="data.abilityPoints"
        >{{ t('可用能力点') }}<strong>{{ t(data.abilityPoints) }}</strong></span
      >
      <span v-if="data.masteryPoints"
        >{{ t('精通点') }}<strong>{{ t(data.masteryPoints) }}</strong></span
      >
    </div>

    <ActionButton
      v-if="mobile && data.slots.length"
      class="ability-slot-trigger"
      @click="slotPickerOpen = true"
    >
      {{ selectedAbility ? t('装配 {p0}', { p0: t(selectedAbility.name) }) : t('查看能力槽') }}
    </ActionButton>
    <div v-if="data.abilities.length" class="ability-list">
      <article
        v-for="ability in data.abilities"
        :key="ability.id"
        :class="{ selected: selectedAbilityId === ability.id, selectable: isAcquired(ability) }"
        @click="selectAbility(ability)"
      >
        <div class="ability-main">
          <div>
            <span class="ability-category">{{ t(ability.group) }}</span>
            <h3 class="pixel-title"><PixelIcon kind="abilities" />{{ t(ability.name) }}</h3>
            <p v-if="ability.description">{{ t(ability.description) }}</p>
          </div>
          <span class="ability-level"
            >{{ t(ability.level === null ? t('等级未知') : t('等级 {p0}', { p0: ability.level }))
            }}<template v-if="ability.maxLevel"> / {{ t(ability.maxLevel) }}</template></span
          >
        </div>
        <div class="ability-meta">
          <div class="ability-selection">
            <button
              v-if="isAcquired(ability)"
              type="button"
              class="ability-select"
              :aria-pressed="selectedAbilityId === ability.id"
              :aria-label="t(`${ability.name}，${getEquipLabel(ability)}`)"
              :disabled="loading"
              @click.stop="selectAbility(ability)"
            >
              {{ t(getEquipLabel(ability)) }}
            </button>
            <span v-if="ability.cost">{{ t(ability.cost) }}</span>
          </div>
          <div class="ability-actions">
            <ActionButton
              v-if="ability.action"
              size="sm"
              :variant="ability.action === 'reset_ability' ? 'destructive' : 'default'"
              :plain="ability.action === 'reset_ability'"
              :disabled="ability.disabled"
              :loading="loading"
              @click.stop="emit('action', ability.action, ability.id)"
            >
              {{
                t(
                  ability.actionLabel ||
                    (ability.action === 'reset_ability' ? t('重置') : t('解锁')),
                )
              }}
            </ActionButton>
            <ActionButton
              v-if="ability.action !== 'reset_ability' && ability.resetCost !== undefined"
              size="sm"
              variant="destructive"
              :loading="loading"
              @click.stop="emit('action', 'reset_ability', ability.id)"
              >{{ t('重置') }}</ActionButton
            >
          </div>
        </div>
        <details
          v-if="ability.currentEffect || ability.nextEffect"
          class="ability-effects"
          @click.stop
        >
          <summary>{{ t('查看当前与下一阶效果 · {p0}', { p0: t(ability.group) }) }}</summary>
          <p v-if="ability.currentEffect">
            <b>{{ t('当前阶：') }}</b
            >{{ t(ability.currentEffect) }}
          </p>
          <p v-if="ability.nextEffect">
            <b>{{ t('下一阶：') }}</b
            >{{ t(ability.nextEffect) }}
          </p>
        </details>
      </article>
    </div>
    <EmptyState v-else :description="t('未能从源站解析当前能力树')" />

    <DefineAbilitySlots>
      <div v-if="data.slots.length" class="ability-slots">
        <header>
          <div>
            <span v-if="!mobile">{{ t('能力槽') }}</span>
            <p
              :title="
                selectedAbility
                  ? t('选择槽位装备 {p0}', { p0: t(selectedAbility.name) })
                  : t('先选择一个已解锁能力，再选择目标槽位')
              "
            >
              {{
                t(
                  selectedAbility
                    ? t('选择槽位装备 {p0}', { p0: t(selectedAbility.name) })
                    : t('先选择一个已解锁能力，再选择目标槽位'),
                )
              }}
            </p>
          </div>
        </header>
        <details
          v-for="group in slotGroups"
          :key="group.label"
          class="slot-group"
          :open="expandedSlotGroups.includes(group.label)"
        >
          <summary @click.prevent="toggleSlotGroup(group.label)">
            {{ t(group.label) }}
            <small>{{
              t('{p0} / {p1} 已装配', {
                p0: group.slots.filter(isSlotEquipped).length,
                p1: group.slots.length,
              })
            }}</small>
          </summary>
          <div class="slot-grid">
            <div v-for="slot in group.slots" :key="slot.id" class="slot-entry">
              <button
                type="button"
                :class="{ locked: slot.locked, equipped: isSlotEquipped(slot) }"
                :disabled="
                  loading ||
                  (slot.locked
                    ? !slot.action ||
                      (slot.unlockCost !== undefined &&
                        slot.unlockCost > Number(data.masteryPoints.replace(/,/g, '')))
                    : !canEquip(slot))
                "
                :title="
                  slot.locked
                    ? t('解锁需要 {p0} 精通点', { p0: slot.unlockCost ?? t('未知数量的') })
                    : !canEquip(slot) && selectedAbility
                      ? t('能力类型与槽位不匹配')
                      : t(slot.abilityName)
                "
                @click="
                  slot.locked && slot.action
                    ? emit('action', slot.action, slot.id)
                    : emit('equip', slot.id, selectedAbilityId)
                "
              >
                <span class="slot-heading">
                  <span class="slot-label" :title="t(slot.label)">{{ t(slot.label) }}</span>
                  <span class="slot-state">{{
                    t(slot.locked ? t('未解锁') : isSlotEquipped(slot) ? t('✓ 已装配') : t('空闲'))
                  }}</span>
                </span>
                <strong :title="t(slot.abilityName)">{{
                  t(
                    slot.locked
                      ? t('点击解锁')
                      : slot.abilityName || (isSlotEquipped(slot) ? t('已装配能力') : t('空槽位')),
                  )
                }}</strong>
                <small v-if="slot.locked && slot.unlockCost !== undefined">{{
                  t('{p0} 精通点', { p0: slot.unlockCost })
                }}</small>
              </button>
              <ActionButton
                v-if="isSlotEquipped(slot)"
                size="sm"
                variant="ghost"
                :disabled="loading"
                @click="emit('equip', slot.id, '0')"
                >{{ t('卸下能力') }}</ActionButton
              >
            </div>
          </div>
        </details>
      </div>
    </DefineAbilitySlots>
    <AbilitySlots v-if="!mobile" />
    <ModalPanel
      v-else
      v-model="slotPickerOpen"
      :title="t('能力槽')"
      content-class="hv-theme hv-dialog"
      sheet
    >
      <AbilitySlots />
    </ModalPanel>

    <div v-if="data.canResetAll" class="ability-footer">
      <ActionButton
        variant="destructive"
        :loading="loading"
        @click="emit('action', 'reset_all', '1')"
        >{{ t('重置全部能力')
        }}<template v-if="data.resetCost !== undefined"
          >（{{
            t(data.resetCost ? t('{p0} 灵魂碎片', { p0: data.resetCost }) : t('本次免费'))
          }}）</template
        >
      </ActionButton>
    </div>
  </section>
</template>

<style scoped>
.ability-panel {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(250px, 1fr);
  align-items: start;
  min-width: 0;
  gap: 24px;
}

.ability-summary {
  grid-column: 1 / -1;
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.ability-trees {
  min-width: 0;
  max-width: 100%;
  flex: 1;
}

.ability-summary > span {
  flex: 0 0 auto;
  color: var(--muted-foreground);
}

.ability-summary strong {
  color: var(--accent);
}

.ability-slots {
  min-width: 0;
  padding: 16px 0 20px;
  border-top: 1px solid var(--border-soft);
  border-bottom: 1px solid var(--border-soft);
}

.ability-slots header span {
  font-weight: 700;
}

.ability-slots header p {
  margin: 4px 0 12px;
  overflow: hidden;
  color: var(--muted-foreground);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
  gap: 8px;
}

.slot-entry > button:first-child {
  appearance: none;
  min-width: 0;
  min-height: 62px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  text-align: left;
  color: var(--foreground);
  background: var(--surface);
  opacity: 1;
}

.slot-entry {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.slot-group {
  margin-top: 10px;
  padding: 12px;
  border: 1px solid var(--border-soft);
  border-radius: 10px;
}
.slot-group summary {
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
}
.slot-group summary small {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 400;
  color: var(--muted-foreground);
}
.slot-group[open] summary {
  margin-bottom: 12px;
}
.ability-effects {
  margin-top: 10px;
  color: var(--muted-foreground);
  font-size: 12px;
  line-height: 1.7;
}
.ability-effects summary {
  cursor: pointer;
}
.ability-effects p {
  overflow-wrap: anywhere;
}

.slot-grid button.equipped {
  border-color: var(--accent);
  background: var(--accent-soft);
  box-shadow: inset 3px 0 0 var(--accent);
}

.slot-grid button:not(:disabled) {
  cursor: pointer;
}

.slot-grid button.locked {
  border-style: dashed;
  color: var(--muted-foreground);
}

.slot-grid span,
.slot-grid strong {
  display: block;
}

.slot-grid span {
  color: var(--muted-foreground);
  font-size: 11px;
}

.slot-grid .slot-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.slot-grid .slot-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slot-grid .slot-state {
  flex: 0 0 auto;
  padding: 0 5px;
  border-radius: 3px;
  background: var(--muted);
  font-size: 10px;
  line-height: 18px;
  white-space: nowrap;
}

.slot-grid button.equipped .slot-state {
  color: var(--accent-foreground);
  background: var(--accent);
}

.slot-grid button.equipped strong {
  color: var(--accent);
  font-weight: 700;
}

.slot-grid strong {
  margin-top: 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ability-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr));
  gap: 14px;
  align-items: start;
}

.ability-list article {
  min-width: 0;
  padding: 18px;
  border: 1px solid var(--border-soft);
  border-radius: 12px;
  transition:
    border-color 0.15s,
    background-color 0.15s,
    box-shadow 0.15s;
}

.ability-list article.selectable {
  border-color: var(--accent-ring);
  background: var(--muted);
  cursor: pointer;
}

.ability-list article.selectable:hover,
.ability-list article.selectable:focus-within {
  border-color: var(--accent);
}

.ability-list article.selected {
  border-color: var(--accent);
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 1px var(--accent);
}

.ability-main,
.ability-meta {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.ability-main h3 {
  margin: 0;
  font-size: 16px;
  letter-spacing: 0;
}

.ability-main > div {
  min-width: 0;
  overflow-wrap: anywhere;
}

.ability-main p {
  margin: 5px 0 0;
  color: var(--muted-foreground);
  line-height: 1.5;
}

.ability-level {
  flex: 0 0 auto;
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.ability-meta {
  align-items: center;
  min-height: 26px;
  flex-wrap: wrap;
  padding-top: 14px;
  border-top: 1px solid var(--border-soft);
  margin-top: 14px;
  color: var(--muted-foreground);
  font-size: 12px;
}

.ability-category {
  display: block;
  margin-bottom: 5px;
  color: var(--muted-foreground);
  font-size: 12px;
}

.ability-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.ability-actions .ui-button + .ui-button {
  margin-left: 0;
}

.ability-selection {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.ability-select {
  min-height: 34px;
  min-width: 5em;
  padding: 6px 8px;
  border: 1px solid var(--accent-ring);
  border-radius: 3px;
  color: var(--accent);
  background: var(--accent-soft);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.ability-select[aria-pressed='true'] {
  color: var(--accent-foreground);
  background: var(--accent);
}

.ability-actions :deep(.ui-button),
.slot-entry > .ui-button {
  min-height: 34px;
}

.ability-select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.ability-select:disabled {
  cursor: wait;
}

.ability-footer {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 767px) {
  .ability-panel {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
  .ability-slot-trigger {
    justify-self: start;
    max-width: 100%;
    white-space: normal;
  }
  .ability-summary {
    align-items: stretch;
    flex-direction: column-reverse;
    gap: 8px;
  }

  .slot-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
