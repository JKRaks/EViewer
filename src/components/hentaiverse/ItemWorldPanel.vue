<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type {
  HentaiVerseItemWorldPage,
  HentaiVerseFormData,
} from '@/core/hentaiverse/model/hentaiVerse'
const props = defineProps<{ data: HentaiVerseItemWorldPage; loading?: boolean }>()
const emit = defineEmits<{ category: [id: string]; start: [data: HentaiVerseFormData] }>()
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
    <el-radio-group v-if="data.candidates.length" v-model="selected" class="world-equipment">
      <el-radio
        v-for="item in data.candidates"
        :key="item.id"
        :value="item.id"
        :disabled="loading || item.locked"
        >{{ item.name }}</el-radio
      >
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
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  max-width: 100%;
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
