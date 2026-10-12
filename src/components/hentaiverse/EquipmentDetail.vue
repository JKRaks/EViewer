<script setup lang="ts">
import { computed } from 'vue'
import type { HentaiVerseEquipmentDetail } from '@/core/hentaiverse/model/hentaiVerse'
const props = defineProps<{ data: HentaiVerseEquipmentDetail }>()
const highlights = computed(
  () => props.data.groups.find((group) => group.title === '装备属性')?.metrics.slice(0, 3) || [],
)
</script>

<template>
  <section class="equipment-detail" :aria-label="`${data.name}的属性`">
    <p class="equipment-summary">{{ data.summary }}</p>
    <p v-if="highlights.length" class="equipment-highlights">
      <span v-for="metric in highlights" :key="metric.label"
        >{{ metric.label }} {{ metric.value }}</span
      >
    </p>
    <p v-for="effect in data.effects" :key="effect" class="equipment-effect">{{ effect }}</p>
    <details>
      <summary>完整属性</summary>
      <div class="equipment-status">
        <p v-for="status in data.status" :key="status">{{ status }}</p>
      </div>
      <section v-for="group in data.groups" :key="group.title" class="equipment-stat-group">
        <h4>{{ group.title }}</h4>
        <dl>
          <template v-for="metric in group.metrics" :key="metric.label">
            <dt>{{ metric.label }}</dt>
            <dd>
              {{ metric.value }}
              <small v-if="metric.base">基础值 {{ metric.base }}</small>
            </dd>
          </template>
        </dl>
      </section>
    </details>
  </section>
</template>

<style scoped>
.equipment-detail {
  min-width: 0;
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
  color: var(--el-text-color-secondary);
}
p {
  margin: 4px 0;
}
.equipment-effect {
  color: var(--el-text-color-primary);
}
.equipment-highlights {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
}
details {
  margin-top: 8px;
}
summary {
  width: fit-content;
  padding: 4px 0;
  cursor: pointer;
  color: var(--el-color-primary);
}
.equipment-status {
  margin: 8px 0;
}
h4 {
  margin: 12px 0 6px;
  font-size: 12px;
  color: var(--el-text-color-primary);
}
dl {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, auto);
  gap: 6px 12px;
  margin: 0;
}
dd {
  margin: 0;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
small {
  display: block;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
