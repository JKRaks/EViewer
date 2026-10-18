<script setup lang="ts">
import { t } from '@/i18n'
</script>
<template>
  <header class="site-header">
    <RouterLink to="/" class="site-wordmark" :aria-label="t('EViewer 首页')"
      >EViewer<span>.</span></RouterLink
    >
  </header>
</template>
<style scoped>
.site-header {
  display: flex;
  align-items: center;
  gap: 40px;
  max-width: 1400px;
  margin: 0 auto 14px;
  padding: 6px 2px 12px;
  border-bottom: 1px solid var(--border-soft);
}
.site-wordmark {
  font:
    italic 29px/1 Georgia,
    serif;
  letter-spacing: -1.5px;
  color: var(--foreground);
  white-space: nowrap;
}
.site-wordmark span {
  color: var(--accent);
}
@media (max-width: 767px) {
  .site-header {
    gap: 18px;
    margin-bottom: 10px;
    padding: 2px 0 10px;
  }
  .site-wordmark {
    font-size: 25px;
  }
}
</style>
