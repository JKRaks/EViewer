<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type {
  HentaiVerseItemWorldPage,
  HentaiVerseFormData,
  HentaiVerseEquipmentDetail,
} from '@/core/hentaiverse/model/hentaiVerse'
import EquipmentDetail from './EquipmentDetail.vue'
const props = defineProps<{
  data: HentaiVerseItemWorldPage
  loading?: boolean
  details?: Record<string, HentaiVerseEquipmentDetail>
  detailsLoading?: boolean
  detailsError?: string
}>()
const emit = defineEmits<{
  category: [id: string]
  start: [data: HentaiVerseFormData]
  retryDetails: []
}>()
const selected = ref('')
const info = computed(() => props.data.entryInfo[selected.value])
watch(
  () => props.data,
  () => {
    selected.value = ''
  },
)
</script>

<template>
  <section class="item-world-panel">
    <el-tabs :model-value="data.selectedCategory" @tab-change="emit('category', String($event))">
      <el-tab-pane
        v-for="category in data.categories"
        :key="category.value"
        :label="category.label"
        :name="category.value"
      />
    </el-tabs>
    <p>世界种子：{{ data.worldSeeds || '数量未知' }}</p>
    <p v-if="detailsLoading" role="status">正在加载装备属性…</p>
    <div v-else-if="detailsError" role="alert">
      {{ detailsError }}
      <el-button link type="primary" @click="emit('retryDetails')">重试加载属性</el-button>
    </div>
    <el-radio-group v-if="data.candidates.length" v-model="selected" class="world-equipment">
      <article
        v-for="item in data.candidates"
        :key="item.id"
        class="world-candidate"
        :class="{ selected: selected === item.id }"
      >
        <el-radio :value="item.id" :disabled="loading || item.locked">{{ item.name }}</el-radio>
        <EquipmentDetail v-if="details?.[item.id]" :data="details[item.id]!" />
      </article>
    </el-radio-group>
    <el-empty
      v-else
      :description="data.emptyReason || '此分类没有可进入装备界的装备，需先完成灵魂绑定'"
    />
    <dl v-if="info">
      <dt>世界等级</dt>
      <dd>{{ info.level }}</dd>
      <dt>战斗轮数</dt>
      <dd>{{ info.rounds }}</dd>
      <dt>怪物等级</dt>
      <dd>{{ info.monsterLevel }}</dd>
      <dt>难度</dt>
      <dd>{{ info.difficulty }}</dd>
      <dt>入场消耗</dt>
      <dd>{{ info.cost }} 世界种子</dd>
    </dl>
    <p v-if="selected && !info">未能读取源站入场信息，请刷新后重试。</p>
    <el-button
      v-if="data.candidates.length"
      type="primary"
      :disabled="loading || !info?.available || !data.postToken"
      @click="emit('start', { postoken: data.postToken, 'eqids[]': [selected] })"
      >进入装备界</el-button
    >
    <details class="world-rules">
      <summary>装备界规则</summary>
      <p v-for="rule in data.rules" :key="rule">{{ rule }}</p>
    </details>
  </section>
</template>

<style scoped>
.item-world-panel {
  min-width: 0;
}
.world-equipment {
  display: grid;
  gap: 10px;
  width: 100%;
  min-width: 0;
}
.world-candidate {
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
}
.world-candidate.selected {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.world-equipment :deep(.el-radio) {
  height: auto;
  min-height: 32px;
  margin-right: 0;
}
.world-equipment :deep(.el-radio__label) {
  white-space: normal;
  overflow-wrap: anywhere;
}
dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px 18px;
  font-size: 13px;
}
dd {
  margin: 0;
}
.world-rules {
  margin-top: 20px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.8;
}
summary {
  cursor: pointer;
}
</style>
