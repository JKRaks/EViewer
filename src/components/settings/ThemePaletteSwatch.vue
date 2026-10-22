<script setup lang="ts">
import type { ThemePreset, ThemeScheme, ThemeColorRole } from '@/core/theme/themePalette'
import { t } from '@/i18n'

defineProps<{ preset: ThemePreset; scheme: ThemeScheme; selected: boolean }>()
const stripeRoles: ThemeColorRole[] = ['background', 'surface', 'accent', 'muted', 'text', 'border']
</script>

<template>
  <span class="theme-swatch-slot" aria-hidden="true">
    <span class="theme-swatch" :class="{ 'is-selected': selected, 'is-dark': scheme === 'dark' }">
      <span
        v-for="half in ['light', 'dark'] as const"
        :key="half"
        class="theme-swatch-half"
        :class="`theme-swatch-half--${half}`"
      >
        <span
          v-for="role in stripeRoles"
          :key="role"
          :style="{ backgroundColor: preset[half][role] }"
        />
      </span>
      <span
        class="theme-swatch-mark theme-swatch-mark--day"
        :style="{ color: preset.light.text, background: preset.light.surface }"
        >{{ t('日') }}</span
      >
      <span
        class="theme-swatch-mark theme-swatch-mark--night"
        :style="{ color: preset.dark.text, background: preset.dark.surface }"
        >{{ t('夜') }}</span
      >
    </span>
  </span>
</template>

<style scoped>
.theme-swatch-slot {
  display: grid;
  place-items: center;
  width: 100%;
  height: 116px;
}
.theme-swatch {
  --cut-left: 90%;
  --cut-right: 30%;
  position: relative;
  display: block;
  width: 96px;
  height: 96px;
  overflow: hidden;
  border-radius: 7px;
  box-shadow: 0 0 0 1px var(--border);
  transition:
    transform 180ms var(--ease),
    box-shadow 180ms var(--ease);
}
.theme-swatch.is-dark {
  --cut-left: 70%;
  --cut-right: 10%;
}
.theme-swatch.is-selected {
  transform: scale(1.06);
  box-shadow:
    0 0 0 3px var(--background),
    0 0 0 4px var(--accent);
}
.theme-swatch-half {
  position: absolute;
  inset: 0;
  display: flex;
  transition: clip-path 210ms var(--ease);
}
.theme-swatch-half > span {
  flex: 1;
  min-width: 0;
}
.theme-swatch-half--light {
  clip-path: polygon(0 0, 100% 0, 100% var(--cut-right), 0 var(--cut-left));
}
.theme-swatch-half--dark {
  clip-path: polygon(0 var(--cut-left), 100% var(--cut-right), 100% 100%, 0 100%);
}
.theme-swatch-mark {
  position: absolute;
  display: grid;
  place-items: center;
  width: 21px;
  height: 21px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 500;
}
.theme-swatch-mark--day {
  top: 6px;
  left: 6px;
}
.theme-swatch-mark--night {
  bottom: 6px;
  right: 6px;
}
</style>
