<script setup lang="ts">
import { t } from '@/i18n'

import PixelIcon from './PixelIcon.vue'
import ChoiceGroup from '@/components/primitives/ChoiceGroup.vue'
import RadioChoice from '@/components/primitives/RadioChoice.vue'
import ActionButton from '@/components/primitives/ActionButton.vue'
import EmptyState from '@/components/primitives/EmptyState.vue'
import ModalPanel from '@/components/primitives/ModalPanel.vue'
import { createReusableTemplate, useMediaQuery } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import type { HentaiVerseInventoryPage } from '@/core/hentaiverse/model/hentaiVerse'

const props = defineProps<{ data: HentaiVerseInventoryPage; loading?: boolean }>()
const emit = defineEmits<{ assign: [slotId: string, itemId: string] }>()
const selectedItemId = ref('')
const mobile = useMediaQuery('(max-width: 767px)')
const slotsOpen = ref(false)
const [DefineInventorySlots, InventorySlots] = createReusableTemplate()
const activeCategory = ref('')
const categories = computed(() =>
  Array.from(new Set(props.data.items.map((item) => item.category))),
)
const visibleItems = computed(() =>
  props.data.items.filter(
    (item) => !activeCategory.value || item.category === activeCategory.value,
  ),
)
const selectedItem = computed(() =>
  props.data.items.find((item) => item.id === selectedItemId.value),
)
function selectItem(id: string | number | boolean | undefined) {
  selectedItemId.value = id === undefined ? '' : String(id)
  if (mobile.value && selectedItem.value?.canAssign) slotsOpen.value = true
}

watch(
  () => props.data.items,
  (items) => {
    if (!items.some((item) => item.category === activeCategory.value)) activeCategory.value = ''
    selectedItemId.value = items.find((item) => item.selected)?.id || ''
  },
  { immediate: true },
)
</script>

<template>
  <section class="inventory-panel">
    <ActionButton
      v-if="mobile && data.slots.length && data.items.length"
      class="inventory-slot-trigger"
      @click="slotsOpen = true"
      >{{ t('配置战斗物品栏') }}</ActionButton
    >
    <div v-if="data.items.length" class="inventory-layout">
      <div class="inventory-items">
        <header>
          <h3>{{ t('物品') }}</h3>
          <span>{{ t('{p0} 种', { p0: data.items.length }) }}</span>
        </header>
        <div class="inventory-categories" :aria-label="t('物品分类')">
          <button type="button" :aria-pressed="activeCategory === ''" @click="activeCategory = ''">
            {{ t('全部 {p0}', { p0: data.items.length }) }}
          </button>
          <button
            v-for="category in categories"
            :key="category"
            type="button"
            :aria-pressed="activeCategory === category"
            @click="activeCategory = category"
          >
            {{ t(category) }}
            {{ t(data.items.filter((item) => item.category === category).length) }}
          </button>
        </div>
        <ChoiceGroup
          :model-value="selectedItemId"
          :aria-label="t('选择物品')"
          @update:model-value="selectItem"
        >
          <RadioChoice
            v-for="item in visibleItems"
            :key="item.id"
            :value="item.id"
            :disabled="loading"
          >
            <span class="item-heading"
              ><PixelIcon kind="inventory" /><span class="item-name">{{ t(item.name) }}</span
              ><strong class="item-quantity">× {{ t(item.quantity) }}</strong></span
            >
            <span class="item-category"
              >{{ t(item.category) }} · {{ t(item.canAssign ? t('可装配') : t('说明物品')) }}</span
            >
            <small v-if="item.description">{{ t(item.description) }}</small>
          </RadioChoice>
        </ChoiceGroup>
        <p v-if="selectedItem" class="inventory-selection" role="status">
          {{
            t('已选择 {p0}：{p1}', {
              p0: t(selectedItem.name),
              p1: selectedItem.canAssign
                ? t('点击对应类别的战斗槽位即可装配。')
                : t('此类物品无法装配到战斗槽位。'),
            })
          }}
        </p>
      </div>

      <DefineInventorySlots>
        <div class="inventory-slots">
          <header>
            <h3>{{ t('战斗槽位') }}</h3>
            <span>{{ selectedItem ? t(selectedItem.name) : t('选择物品后点击槽位') }}</span>
          </header>
          <div v-if="data.slots.length" class="inventory-slot-grid">
            <div
              v-for="slot in data.slots"
              :key="slot.id"
              class="inventory-slot"
              :class="{ equipped: slot.itemId }"
            >
              <button
                type="button"
                :disabled="
                  loading || !selectedItem?.canAssign || selectedItem.category !== slot.category
                "
                :title="
                  selectedItem && selectedItem.category !== slot.category
                    ? t('此槽位仅能装配{p0}', { p0: slot.category })
                    : slot.itemName
                "
                @click="emit('assign', slot.id, selectedItemId)"
              >
                <span>{{ t(slot.label) }} · {{ t(slot.category) }}</span>
                <strong>{{ t(slot.itemName || t('空槽位')) }}</strong>
              </button>
              <ActionButton
                v-if="slot.itemId"
                size="sm"
                variant="ghost"
                :disabled="loading"
                @click="emit('assign', slot.id, '0')"
                >{{ t('清空槽位') }}</ActionButton
              >
            </div>
          </div>
          <EmptyState v-else :description="t('没有可配置的物品槽位')" :image-size="70" />
        </div>
      </DefineInventorySlots>
      <InventorySlots v-if="!mobile" />
      <ModalPanel
        v-else
        v-model="slotsOpen"
        :title="t('配置战斗物品栏')"
        content-class="hv-theme hv-dialog"
        sheet
        ><InventorySlots
      /></ModalPanel>
    </div>
    <EmptyState v-else :description="t('当前世界暂无物品')" />
  </section>
</template>

<style scoped>
.inventory-slot-trigger {
  margin-bottom: 16px;
}
.inventory-slot {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.inventory-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
  gap: 24px;
  align-items: start;
}

.inventory-items header,
.inventory-slots header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-soft);
}

.inventory-items h3,
.inventory-slots h3 {
  margin: 0;
  font-size: 16px;
  letter-spacing: 0;
}

.inventory-items header span,
.inventory-slots header span {
  color: var(--muted-foreground);
  font-size: 12px;
}

.inventory-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 14px 0;
}
.inventory-categories button {
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 20px;
  font: inherit;
  font-size: 12px;
  color: var(--text);
  background: var(--surface);
  cursor: pointer;
}
.inventory-categories button[aria-pressed='true'] {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}
.inventory-items :deep(.ui-radio-group) {
  display: grid;
  gap: 10px;
  width: 100%;
}
.inventory-items :deep(.ui-radio) {
  display: flex;
  align-items: flex-start;
  width: 100%;
  box-sizing: border-box;
  height: auto;
  margin: 0;
  padding: 14px;
  border: 1px solid var(--border-soft);
  border-radius: 10px;
  background: var(--surface);
}
.inventory-items :deep(.ui-radio.is-checked) {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.item-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.item-name {
  color: var(--foreground);
  font-weight: 600;
  overflow-wrap: anywhere;
}
.item-quantity {
  flex-shrink: 0;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}
.item-category {
  color: var(--muted-foreground);
  font-size: 11px;
}
.inventory-items small {
  color: var(--muted-foreground);
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.inventory-selection {
  padding: 12px;
  border-radius: 8px;
  background: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}

.inventory-slot-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.inventory-slot > button:first-child {
  min-height: 60px;
  padding: 9px;
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--foreground);
  opacity: 1;
  text-align: left;
  background: var(--surface);
}

.inventory-slot.equipped > button:first-child {
  border-color: var(--accent-ring);
  background: var(--accent-soft);
}

.inventory-slot-grid button:not(:disabled) {
  cursor: pointer;
}

.inventory-slot-grid span,
.inventory-slot-grid strong {
  display: block;
}

.inventory-slot-grid span {
  color: var(--muted-foreground);
  font-size: 11px;
}

.inventory-slot-grid strong {
  margin-top: 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 767px) {
  .inventory-layout {
    grid-template-columns: 1fr;
  }
}
</style>
