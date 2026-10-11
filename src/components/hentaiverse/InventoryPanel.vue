<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { HentaiVerseInventoryPage } from '@/core/hentaiverse/model/hentaiVerse'

const props = defineProps<{ data: HentaiVerseInventoryPage; loading?: boolean }>()
const emit = defineEmits<{ assign: [slotId: string, itemId: string] }>()
const selectedItemId = ref('')
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
    <div v-if="data.items.length" class="inventory-layout">
      <div class="inventory-items">
        <header>
          <h3>物品</h3>
          <span>{{ data.items.length }} 种</span>
        </header>
        <div class="inventory-categories" aria-label="物品分类">
          <button type="button" :aria-pressed="activeCategory === ''" @click="activeCategory = ''">
            全部 {{ data.items.length }}
          </button>
          <button
            v-for="category in categories"
            :key="category"
            type="button"
            :aria-pressed="activeCategory === category"
            @click="activeCategory = category"
          >
            {{ category }} {{ data.items.filter((item) => item.category === category).length }}
          </button>
        </div>
        <el-radio-group v-model="selectedItemId" aria-label="选择物品">
          <el-radio
            v-for="item in visibleItems"
            :key="item.id"
            :value="item.id"
            :disabled="loading"
          >
            <span class="item-heading"
              ><span class="item-name">{{ item.name }}</span
              ><strong class="item-quantity">× {{ item.quantity }}</strong></span
            >
            <span class="item-category"
              >{{ item.category }} · {{ item.canAssign ? '可装配' : '说明物品' }}</span
            >
            <small v-if="item.description">{{ item.description }}</small>
          </el-radio>
        </el-radio-group>
        <p v-if="selectedItem" class="inventory-selection" role="status">
          已选择 {{ selectedItem.name }}：{{
            selectedItem.canAssign
              ? '点击对应类别的战斗槽位即可装配。'
              : '此类物品无法装配到战斗槽位。'
          }}
        </p>
      </div>

      <div class="inventory-slots">
        <header>
          <h3>战斗槽位</h3>
          <span>选择物品后点击槽位</span>
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
                  ? `此槽位仅能装配${slot.category}`
                  : slot.itemName
              "
              @click="emit('assign', slot.id, selectedItemId)"
            >
              <span>{{ slot.label }} · {{ slot.category }}</span>
              <strong>{{ slot.itemName || '空槽位' }}</strong>
            </button>
            <el-button
              v-if="slot.itemId"
              size="small"
              type="danger"
              text
              :disabled="loading"
              @click="emit('assign', slot.id, '0')"
              >清空槽位</el-button
            >
          </div>
        </div>
        <el-empty v-else description="没有可配置的物品槽位" :image-size="70" />
      </div>
    </div>
    <el-empty v-else description="未能从源站解析物品列表" />
  </section>
</template>

<style scoped>
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
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.inventory-layout h3 {
  margin: 0;
  font-size: 16px;
  letter-spacing: 0;
}

.inventory-layout header span {
  color: var(--el-text-color-secondary);
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
  border: 1px solid var(--el-border-color);
  border-radius: 20px;
  font: inherit;
  font-size: 12px;
  color: var(--el-text-color-regular);
  background: var(--el-bg-color);
  cursor: pointer;
}
.inventory-categories button[aria-pressed='true'] {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.inventory-items :deep(.el-radio-group) {
  display: grid;
  gap: 10px;
  width: 100%;
}
.inventory-items :deep(.el-radio) {
  display: flex;
  align-items: flex-start;
  width: 100%;
  box-sizing: border-box;
  height: auto;
  margin: 0;
  padding: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-bg-color);
}
.inventory-items :deep(.el-radio.is-checked) {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.inventory-items :deep(.el-radio__input) {
  margin-top: 3px;
}
.inventory-items :deep(.el-radio__label) {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 6px;
  white-space: normal;
}
.item-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.item-name {
  color: var(--el-text-color-primary);
  font-weight: 600;
  overflow-wrap: anywhere;
}
.item-quantity {
  flex-shrink: 0;
  color: var(--el-color-primary);
  font-variant-numeric: tabular-nums;
}
.item-category {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}
.inventory-items small {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.inventory-selection {
  padding: 12px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
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
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  color: var(--el-text-color-primary);
  opacity: 1;
  text-align: left;
  background: var(--el-bg-color);
}

.inventory-slot.equipped > button:first-child {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
}

.inventory-slot-grid button:not(:disabled) {
  cursor: pointer;
}

.inventory-slot-grid span,
.inventory-slot-grid strong {
  display: block;
}

.inventory-slot-grid span {
  color: var(--el-text-color-secondary);
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
