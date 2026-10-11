<script setup lang="ts">
import type { HentaiVerseStatGroup } from '@/core/hentaiverse/model/hentaiVerse'
defineProps<{ groups: HentaiVerseStatGroup[] }>()
</script>

<template>
  <section class="stat-groups" aria-label="角色详细属性">
    <details v-for="group in groups" :key="group.title" open>
      <summary>{{ group.title }}</summary>
      <dl>
        <template v-for="metric in group.metrics" :key="metric.label">
          <dt>{{ metric.label }}</dt>
          <dd>{{ metric.value }}</dd>
        </template>
      </dl>
    </details>
  </section>
</template>

<style scoped>
.stat-groups {
  columns: 240px;
  column-gap: 16px;
  margin-top: 24px;
}
details {
  break-inside: avoid;
  margin-bottom: 16px;
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
}
summary {
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
}

details[open] summary {
  margin-bottom: 12px;
}
dl {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, auto);
  gap: 8px;
  margin: 0;
  font-size: 13px;
}
dt {
  color: var(--el-text-color-secondary);
  overflow-wrap: anywhere;
}
dd {
  margin: 0;
  text-align: right;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}
</style>
