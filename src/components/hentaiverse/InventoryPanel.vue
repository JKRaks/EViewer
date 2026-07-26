<script setup lang="ts">
import { ref, watch } from 'vue'
import type { HentaiVerseInventoryPage } from '@/core/hentaiverse/model/hentaiVerse'

const props = defineProps<{ data: HentaiVerseInventoryPage; loading?: boolean }>()
const emit = defineEmits<{ assign: [slotId: string, itemId: string] }>()
const selectedItemId = ref('')

watch(() => props.data.items, (items) => {
  selectedItemId.value = items.find((item) => item.selected)?.id || ''
}, { immediate: true })
</script>

<template>
  <section class="inventory-panel">
    <div v-if="data.items.length" class="inventory-layout">
      <div class="inventory-items">
        <header><h3>物品</h3><span>{{ data.items.length }} 种</span></header>
        <el-radio-group v-model="selectedItemId">
          <el-radio v-for="item in data.items" :key="item.id" :value="item.id" :disabled="loading">
            <span>{{ item.name }}</span>
            <small v-if="item.description">{{ item.description }}</small>
            <strong>{{ item.quantity }}</strong>
          </el-radio>
        </el-radio-group>
      </div>

      <div class="inventory-slots">
        <header><h3>战斗槽位</h3><span>选择物品后点击槽位</span></header>
        <div v-if="data.slots.length" class="inventory-slot-grid">
          <button
            v-for="slot in data.slots"
            :key="slot.id"
            type="button"
            :disabled="loading || !selectedItemId"
            @click="emit('assign', slot.id, selectedItemId)"
          >
            <span>{{ slot.label }}</span>
            <strong>{{ slot.itemName || '空槽位' }}</strong>
          </button>
        </div>
        <el-empty v-else description="没有可配置的物品槽位" :image-size="70" />
      </div>
    </div>
    <el-empty v-else description="未能从源站解析物品列表" />
  </section>
</template>

<style scoped>
.inventory-layout {
  display: grid;
  grid-template-columns: minmax(280px, 1.2fr) minmax(240px, 0.8fr);
  gap: 28px;
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

.inventory-items :deep(.el-radio-group) {
  display: block;
}

.inventory-items :deep(.el-radio) {
  display: flex;
  width: 100%;
  height: auto;
  min-height: 46px;
  margin: 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.inventory-items :deep(.el-radio__label) {
  display: grid;
  grid-template-columns: minmax(100px, auto) minmax(0, 1fr) auto;
  align-items: center;
  width: 100%;
  gap: 8px;
}

.inventory-items small {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inventory-slot-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.inventory-slot-grid button {
  min-height: 60px;
  padding: 9px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  text-align: left;
  background: var(--el-bg-color);
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
