<script setup lang="ts">
import { t } from '@/i18n'

import ModalPanel from '@/components/primitives/ModalPanel.vue'
import { createReusableTemplate, useMediaQuery } from '@vueuse/core'
import ActionButton from '@/components/primitives/ActionButton.vue'
import ChoiceGroup from '@/components/primitives/ChoiceGroup.vue'
import RadioChoice from '@/components/primitives/RadioChoice.vue'
import TagChip from '@/components/primitives/TagChip.vue'
import EmptyState from '@/components/primitives/EmptyState.vue'
import { computed, ref, watch } from 'vue'
import { ArrowLeft, Sword, Shield, HardHat, Shirt, Hand, Columns2, Footprints } from '@lucide/vue'
import { getEquipmentDurability } from '@/core/hentaiverse/hentaiVerseEquipment'
import type { HentaiVerseEquipmentPage } from '@/core/hentaiverse/model/hentaiVerse'
import type { HentaiVerseEquipmentDetail } from '@/core/hentaiverse/model/hentaiVerse'
import EquipmentDetail from './EquipmentDetail.vue'

const props = defineProps<{
  data: HentaiVerseEquipmentPage
  loading?: boolean
  details?: Record<string, HentaiVerseEquipmentDetail>
  detailsLoading?: boolean
  detailsError?: string
}>()
const emit = defineEmits<{
  set: [id: string, postToken: string]
  overview: []
  slot: [id: string]
  equip: [slotId: string, equipmentId: string, postToken: string]
  unequip: [slotId: string, postToken: string]
  retryDetails: []
}>()

const candidateId = ref('')
const inspectedSlotId = ref('')
const detailOpen = ref(false)
const mobile = useMediaQuery('(max-width: 767px)')
const [DefineSlotDetails, SlotDetails] = createReusableTemplate()
const inspectedSlot = computed(
  () => props.data.slots.find((slot) => slot.id === inspectedSlotId.value) || props.data.slots[0],
)
const slotIcons: Record<string, typeof Sword> = {
  '1': Sword,
  '2': Shield,
  '9': Shield,
  '13': HardHat,
  '11': Shirt,
  '14': Hand,
  '12': Columns2,
  '15': Footprints,
}
const slotDurability = computed(() =>
  Object.fromEntries(
    props.data.slots.map((slot) => [
      slot.id,
      getEquipmentDurability(props.details?.[slot.equipmentId]),
    ]),
  ),
)
const activeSlot = computed(() =>
  props.data.slots.find((slot) => slot.id === props.data.selectedSlot),
)
const activeSlotLabel = computed(
  () =>
    activeSlot.value?.label ||
    (
      {
        '1': t('主武器'),
        '2': t('副武器'),
        '9': t('副武器'),
        '13': t('头部'),
        '11': t('身体'),
        '14': t('手部'),
        '12': t('腿部'),
        '15': t('脚部'),
      } as Record<string, string>
    )[props.data.selectedSlot] ||
    t('部位 {p0}', { p0: props.data.selectedSlot }),
)

watch(
  () => props.data,
  (data) => {
    candidateId.value = data.candidates.find((candidate) => candidate.equipped)?.id || ''
    detailOpen.value = false
    if (!data.slots.some((slot) => slot.id === inspectedSlotId.value))
      inspectedSlotId.value = data.slots[0]?.id || ''
  },
  { immediate: true },
)
watch(mobile, () => {
  detailOpen.value = false
})
function inspectSlot(id: string) {
  inspectedSlotId.value = id
  if (mobile.value) detailOpen.value = true
}
function openCandidates() {
  if (!inspectedSlot.value) return
  detailOpen.value = false
  emit('slot', inspectedSlot.value.id)
}
</script>

<template>
  <section class="equipment-panel">
    <div v-if="data.sets.length" class="equipment-sets" :aria-label="t('装备套装')">
      <button
        v-for="set in data.sets"
        :key="set.id"
        type="button"
        :class="{ active: set.active }"
        :disabled="loading || set.active"
        :aria-pressed="set.active"
        @click="emit('set', set.id, data.postToken)"
      >
        {{ t(set.label) }}
      </button>
    </div>

    <p v-if="detailsLoading" class="equipment-detail-status" role="status">
      {{ t('正在加载装备属性…') }}
    </p>
    <div v-else-if="detailsError" class="equipment-detail-status" role="alert">
      {{ t(detailsError) }}
      <ActionButton variant="link" @click="emit('retryDetails')">{{
        t('重试加载属性')
      }}</ActionButton>
    </div>

    <DefineSlotDetails>
      <section v-if="inspectedSlot" class="hv-window equipment-inspection">
        <h3 class="hv-window-title">{{ t('装备详情') }} · {{ t(inspectedSlot.label) }}</h3>
        <div class="hv-window-body">
          <h3>{{ t(inspectedSlot.equipmentName || '未装备') }}</h3>
          <EquipmentDetail
            v-if="details?.[inspectedSlot.equipmentId]"
            :data="details[inspectedSlot.equipmentId]!"
            expanded
          />
          <p v-else>
            {{ t(detailsLoading ? '正在加载装备属性…' : inspectedSlot.description || '未装备') }}
          </p>
        </div>
        <div class="hv-window-footer">
          <ActionButton
            variant="default"
            :disabled="loading || inspectedSlot.disabled"
            @click="openCandidates"
            >{{ t('更换装备') }}</ActionButton
          >
        </div>
      </section>
    </DefineSlotDetails>
    <div v-if="data.slots.length && !data.selectedSlot" class="equipment-overview-layout">
      <section class="hv-window">
        <h3 class="hv-window-title">{{ t('已穿戴装备') }}</h3>
        <div class="equipment-slots hv-window-body">
          <article
            v-for="slot in data.slots"
            :key="slot.id"
            class="equipment-slot"
            :class="{ active: slot.id === inspectedSlot?.id }"
          >
            <button
              type="button"
              :disabled="loading || slot.disabled"
              :aria-pressed="slot.id === inspectedSlot?.id"
              @click="inspectSlot(slot.id)"
            >
              <span class="equipment-slot-label"
                ><component :is="slotIcons[slot.id] || Shield" :size="18" aria-hidden="true" />{{
                  t(slot.label)
                }}</span
              >
              <strong>{{
                t(slot.equipmentName || (slot.disabled ? t('当前主武器不可用') : t('未装备')))
              }}</strong>
              <span
                v-if="slotDurability[slot.id] !== undefined"
                class="equipment-durability"
                :class="{ low: slotDurability[slot.id]! < 50 }"
                >{{ t('耐久') }} {{ slotDurability[slot.id] }}%<span
                  class="hv-meter"
                  aria-hidden="true"
                  ><span :style="{ width: `${slotDurability[slot.id]}%` }" /></span
              ></span>
            </button>
          </article>
        </div>
      </section>
      <SlotDetails v-if="!mobile" />
    </div>

    <ModalPanel v-model="detailOpen" :title="t('装备详情')" content-class="hv-theme hv-dialog" sheet
      ><SlotDetails
    /></ModalPanel>

    <div v-if="data.selectedSlot" class="equipment-picker">
      <header>
        <div>
          <span>{{ t('当前部位') }}</span>
          <h3>{{ t(activeSlotLabel) }}</h3>
        </div>
        <div class="equipment-picker-actions">
          <ActionButton :icon="ArrowLeft" :disabled="loading" @click="emit('overview')">{{
            t('返回装备总览')
          }}</ActionButton>
          <ActionButton
            v-if="data.canUnequip"
            variant="destructive"
            :disabled="loading || !data.postToken"
            @click="emit('unequip', data.selectedSlot, data.postToken)"
            >{{ t('卸下') }}</ActionButton
          >
        </div>
      </header>

      <ChoiceGroup v-if="data.candidates.length" v-model="candidateId" class="equipment-list">
        <article
          v-for="candidate in data.candidates"
          :key="candidate.id"
          class="equipment-candidate"
          :class="{ selected: candidateId === candidate.id }"
        >
          <RadioChoice :value="candidate.id" :disabled="candidate.locked || loading">
            <span class="candidate-name"
              ><component
                :is="slotIcons[data.selectedSlot] || Shield"
                :size="18"
                aria-hidden="true"
              />{{ t(candidate.name) }}</span
            >
            <TagChip v-if="candidate.equipped" size="small" tone="info">{{ t('已装备') }}</TagChip>
          </RadioChoice>
          <EquipmentDetail v-if="details?.[candidate.id]" :data="details[candidate.id]!" />
          <small v-else-if="candidate.description">{{ t(candidate.description) }}</small>
        </article>
      </ChoiceGroup>
      <EmptyState v-else :description="t('该部位没有可用装备')" :image-size="70" />

      <ActionButton
        v-if="data.candidates.length"
        variant="default"
        :loading="loading"
        :disabled="!candidateId || !data.postToken"
        @click="emit('equip', data.selectedSlot, candidateId, data.postToken)"
        >{{ t('装备所选物品') }}</ActionButton
      >
    </div>

    <EmptyState v-else-if="!data.slots.length" :description="t('未能从源站解析装备部位')" />
  </section>
</template>

<style scoped>
.equipment-panel {
  display: grid;
  gap: 24px;
}

.equipment-sets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-soft);
}

.equipment-sets button,
.equipment-slot,
.equipment-candidate {
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  background: var(--surface);
}

.equipment-sets button {
  min-height: 36px;
  padding: 0 14px;
  cursor: pointer;
}

.equipment-sets button.active,
.equipment-slot.active,
.equipment-candidate.selected {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}

.equipment-slots {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.equipment-slot {
  min-width: 0;
  padding: 12px;
}

.equipment-slot button {
  display: block;
  width: 100%;
  min-height: 78px;
  padding: 0;
  border: 0;
  color: inherit;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.equipment-slots span,
.equipment-picker header span {
  display: block;
  color: var(--muted-foreground);
  font-size: 12px;
}

.equipment-slots strong {
  display: block;
  margin-top: 7px;
  overflow-wrap: anywhere;
}

.equipment-picker {
  display: grid;
  gap: 16px;
  padding-top: 20px;
  border-top: 1px solid var(--border-soft);
}

.equipment-picker header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.equipment-picker h3 {
  margin: 3px 0 0;
  font-size: 18px;
  letter-spacing: 0;
}

.equipment-picker-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.equipment-picker-actions :deep(.ui-button + .ui-button) {
  margin-left: 0;
}

.equipment-list {
  display: grid;
  gap: 10px;
  width: 100%;
  min-width: 0;
}

.equipment-candidate {
  min-width: 0;
  padding: 12px;
}

.equipment-detail-status {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 13px;
}

.equipment-list :deep(.ui-radio) {
  width: 100%;
  height: auto;
  min-height: 32px;
  margin: 0;
  padding: 4px 0;
}

.candidate-name {
  min-width: 0;
  flex: 0 1 auto;
  font-weight: 600;
  white-space: normal;
  overflow-wrap: anywhere;
}

.equipment-list small {
  color: var(--muted-foreground);
  overflow-wrap: anywhere;
}

@media (max-width: 767px) {
  .equipment-slots {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .equipment-list small {
    width: 100%;
  }

  .equipment-picker header {
    align-items: stretch;
    flex-direction: column;
  }

  .equipment-picker-actions :deep(.ui-button) {
    flex: 1 1 140px;
  }
}
</style>
