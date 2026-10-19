<script setup lang="ts">
import { t } from '@/i18n'
import { X, Minus } from '@lucide/vue'

defineProps<{
  label: string
  title?: string
  excluded?: boolean
  removable?: boolean
}>()
const emit = defineEmits<{ remove: [] }>()
</script>

<template>
  <span class="search-condition" :class="{ 'is-excluded': excluded }" :title="title || label">
    <Minus v-if="excluded" :size="11" aria-hidden="true" />
    <span class="condition-label">{{ label }}</span>
    <button
      v-if="removable"
      type="button"
      :aria-label="t('移除条件：{p0}', { p0: title || label })"
      @click.stop="emit('remove')"
    >
      <X :size="12" aria-hidden="true" />
    </button>
  </span>
</template>

<style scoped>
.search-condition {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 100%;
  min-height: 28px;
  padding: 1px 7px;
  border: 1px solid var(--border-soft);
  border-radius: 5px;
  color: var(--text);
  background: var(--muted-soft);
  font-size: 12px;
  line-height: 1.5;
}
.condition-label {
  min-width: 0;
  overflow-wrap: anywhere;
}
.is-excluded > svg {
  color: var(--danger);
}
.search-condition button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  color: var(--muted-foreground);
  background: transparent;
}
.search-condition button::after {
  content: '';
  position: absolute;
  inset: -10px;
}
.search-condition button:hover,
.search-condition button:focus-visible {
  color: var(--foreground);
  background: var(--muted);
}
</style>
