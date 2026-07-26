<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowLeft } from '@element-plus/icons-vue'
import type { HentaiVerseEquipmentPage } from '@/core/hentaiverse/model/hentaiVerse'

const props = defineProps<{ data: HentaiVerseEquipmentPage; loading?: boolean }>()
const emit = defineEmits<{
  set: [id: string, postToken: string]
  overview: []
  slot: [id: string]
  equip: [slotId: string, equipmentId: string, postToken: string]
  unequip: [slotId: string, postToken: string]
}>()

const candidateId = ref('')
const activeSlot = computed(() => props.data.slots.find((slot) => slot.id === props.data.selectedSlot))
const activeSlotLabel = computed(() => activeSlot.value?.label || ({
  '1': '主手',
  '9': '副手',
  '13': '头部',
  '11': '身体',
  '14': '手部',
  '12': '腿部',
  '15': '脚部',
} as Record<string, string>)[props.data.selectedSlot] || `部位 ${props.data.selectedSlot}`)

watch(() => props.data.selectedSlot, () => {
  candidateId.value = ''
})
</script>

<template>
  <section class="equipment-panel">
    <div v-if="data.sets.length" class="equipment-sets" aria-label="装备套装">
      <button
        v-for="set in data.sets"
        :key="set.id"
        type="button"
        :class="{ active: set.active }"
        :disabled="loading"
        @click="emit('set', set.id, data.postToken)"
      >
        {{ set.label }}
      </button>
    </div>

    <div v-if="data.slots.length" class="equipment-slots">
      <button
        v-for="slot in data.slots"
        :key="slot.id"
        type="button"
        :class="{ active: slot.active || slot.id === data.selectedSlot }"
        :disabled="loading || slot.disabled"
        @click="emit('slot', slot.id)"
      >
        <span>{{ slot.label }}</span>
        <strong>{{ slot.equipmentName || (slot.disabled ? '当前主手不可用' : '未装备') }}</strong>
      </button>
    </div>

    <div v-if="data.selectedSlot" class="equipment-picker">
      <header>
        <div>
          <span>当前部位</span>
          <h3>{{ activeSlotLabel }}</h3>
        </div>
        <div class="equipment-picker-actions">
          <el-button :icon="ArrowLeft" :disabled="loading" @click="emit('overview')">返回装备总览</el-button>
          <el-button
            v-if="activeSlot?.equipmentId"
            type="danger"
            plain
            :disabled="loading || !data.postToken"
            @click="emit('unequip', data.selectedSlot, data.postToken)"
          >
            卸下
          </el-button>
        </div>
      </header>

      <el-radio-group v-if="data.candidates.length" v-model="candidateId" class="equipment-list">
        <el-radio
          v-for="candidate in data.candidates"
          :key="candidate.id"
          :value="candidate.id"
          :disabled="candidate.locked || loading"
        >
          <span class="candidate-name">{{ candidate.name }}</span>
          <small v-if="candidate.description">{{ candidate.description }}</small>
          <el-tag v-if="candidate.equipped" size="small" type="info">已装备</el-tag>
        </el-radio>
      </el-radio-group>
      <el-empty v-else description="该部位没有可用装备" :image-size="70" />

      <el-button
        v-if="data.candidates.length"
        type="primary"
        :loading="loading"
        :disabled="!candidateId || !data.postToken"
        @click="emit('equip', data.selectedSlot, candidateId, data.postToken)"
      >
        装备所选物品
      </el-button>
    </div>

    <el-empty v-else-if="!data.slots.length" description="未能从源站解析装备部位" />
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
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.equipment-sets button,
.equipment-slots button {
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  color: var(--el-text-color-regular);
  background: var(--el-bg-color);
  cursor: pointer;
}

.equipment-sets button {
  min-height: 36px;
  padding: 0 14px;
}

.equipment-sets button.active,
.equipment-slots button.active {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.equipment-slots {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.equipment-slots button {
  min-height: 78px;
  padding: 12px;
  text-align: left;
}

.equipment-slots span,
.equipment-picker header span {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.equipment-slots strong {
  display: block;
  margin-top: 7px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.equipment-picker {
  display: grid;
  gap: 16px;
  padding-top: 20px;
  border-top: 1px solid var(--el-border-color-lighter);
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

.equipment-picker-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.equipment-list {
  display: grid;
  gap: 0;
  border-top: 1px solid var(--el-border-color-lighter);
}

.equipment-list :deep(.el-radio) {
  width: 100%;
  height: auto;
  min-height: 48px;
  margin: 0;
  padding: 8px 2px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.equipment-list :deep(.el-radio__label) {
  display: flex;
  align-items: center;
  min-width: 0;
  width: 100%;
  gap: 8px;
}

.candidate-name {
  flex: 0 1 auto;
  font-weight: 600;
}

.equipment-list small {
  flex: 1;
  overflow: hidden;
  color: var(--el-text-color-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 767px) {
  .equipment-slots {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .equipment-list :deep(.el-radio__label) {
    align-items: flex-start;
    flex-direction: column;
    gap: 3px;
  }

  .equipment-list small {
    width: 100%;
  }

  .equipment-picker header {
    align-items: stretch;
    flex-direction: column;
  }

  .equipment-picker-actions :deep(.el-button) {
    flex: 1 1 140px;
  }
}
</style>
