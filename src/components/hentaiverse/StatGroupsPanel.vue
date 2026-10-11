<script setup lang="ts">
import type { HentaiVerseStatGroup } from '@/core/hentaiverse/model/hentaiVerse'
defineProps<{ groups: HentaiVerseStatGroup[] }>()
</script>

<template>
  <section class="stat-groups" aria-label="角色详细属性">
    <article v-for="group in groups" :key="group.title">
      <h3>{{ group.title }}</h3>
      <dl>
        <template v-for="metric in group.metrics" :key="metric.label">
          <dt>{{ metric.label }}</dt>
          <dd>{{ metric.value }}</dd>
        </template>
      </dl>
    </article>
  </section>
</template>

<style scoped>
.stat-groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
  gap: 16px;
  margin-top: 24px;
}
article {
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
}
h3 {
  margin: 0 0 12px;
  font-size: 14px;
}
dl {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
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
  font-variant-numeric: tabular-nums;
}
</style>
