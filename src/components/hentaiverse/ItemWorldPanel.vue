<script setup lang="ts">
import { t } from '@/i18n'

import SectionTabs from '@/components/primitives/SectionTabs'
import SectionTab from '@/components/primitives/SectionTab.vue'
import ActionButton from '@/components/primitives/ActionButton.vue'
import ChoiceGroup from '@/components/primitives/ChoiceGroup.vue'
import RadioChoice from '@/components/primitives/RadioChoice.vue'
import EmptyState from '@/components/primitives/EmptyState.vue'
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
    <SectionTabs
      :model-value="data.selectedCategory"
      @tab-change="emit('category', String($event))"
    >
      <SectionTab
        v-for="category in data.categories"
        :key="category.value"
        :label="t(category.label)"
        :name="category.value"
      />
    </SectionTabs>
    <p>{{ t('世界种子：{p0}', { p0: data.worldSeeds || t('数量未知') }) }}</p>
    <p v-if="detailsLoading" role="status">{{ t('正在加载装备属性…') }}</p>
    <div v-else-if="detailsError" role="alert">
      {{ t(detailsError) }}
      <ActionButton variant="link" @click="emit('retryDetails')">{{
        t('重试加载属性')
      }}</ActionButton>
    </div>
    <ChoiceGroup v-if="data.candidates.length" v-model="selected" class="world-equipment">
      <article
        v-for="item in data.candidates"
        :key="item.id"
        class="world-candidate"
        :class="{ selected: selected === item.id }"
      >
        <RadioChoice :value="item.id" :disabled="loading || item.locked">{{
          t(item.name)
        }}</RadioChoice>
        <EquipmentDetail v-if="details?.[item.id]" :data="details[item.id]!" />
      </article>
    </ChoiceGroup>
    <EmptyState
      v-else
      :description="data.emptyReason || t('此分类没有可进入装备界的装备，需先完成灵魂绑定')"
    />
    <dl v-if="info">
      <dt>{{ t('世界等级') }}</dt>
      <dd>{{ t(info.level) }}</dd>
      <dt>{{ t('战斗轮数') }}</dt>
      <dd>{{ t(info.rounds) }}</dd>
      <dt>{{ t('怪物等级') }}</dt>
      <dd>{{ t(info.monsterLevel) }}</dd>
      <dt>{{ t('难度') }}</dt>
      <dd>{{ t(info.difficulty) }}</dd>
      <dt>{{ t('入场消耗') }}</dt>
      <dd>{{ t('{p0} 世界种子', { p0: info.cost }) }}</dd>
    </dl>
    <p v-if="selected && !info">{{ t('未能读取源站入场信息，请刷新后重试。') }}</p>
    <ActionButton
      v-if="data.candidates.length"
      variant="default"
      :disabled="loading || !info?.available || !data.postToken"
      @click="emit('start', { postoken: data.postToken, 'eqids[]': [selected] })"
      >{{ t('进入装备界') }}</ActionButton
    >
    <details class="world-rules">
      <summary>{{ t('装备界规则') }}</summary>
      <p v-for="rule in data.rules" :key="rule">{{ t(rule) }}</p>
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
  border: 1px solid var(--border);
  border-radius: 6px;
}
.world-candidate.selected {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.world-equipment :deep(.ui-radio) {
  height: auto;
  min-height: 32px;
  margin-right: 0;
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
  color: var(--muted-foreground);
  line-height: 1.8;
}
summary {
  cursor: pointer;
}
</style>
