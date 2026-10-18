<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ kind?: string }>()
const paths: Record<string, string> = {
  character: 'M6 1h4v4H6zM4 6h8v5h-2v4H7v-4H4z',
  equipment: 'M10 1h4v4h-2v2h-2v2H8v2H6v2H4v2H1v-3h2v-2h2V8h2V6h2V4h1z',
  abilities: 'M7 0h2v5h3v2h4v2h-4v2H9v5H7v-5H4V9H0V7h4V5h3z',
  training: 'M1 3h3v10H1zm3 3h8v4H4zm8-3h3v10h-3z',
  inventory: 'M5 1h6v3h3v10H2V4h3zm1 2v2h4V3zM4 7v2h8V7z',
  settings: 'M2 2h12v3H2zm0 5h12v3H2zm0 5h12v3H2z',
  arena: 'M2 1h4v3h4V1h4v13H2zm4 6v7h4V7z',
  ringOfBlood: 'M5 1h6v2h3v10h-3v2H5v-2H2V3h3zm1 3v8h4V4z',
  grindfest: 'M7 1h2v4h4v2h2v2h-2v2H9v4H7v-4H3V9H1V7h2V5h4z',
  itemWorld: 'M2 2h12v12H2zm2 2v8h8V4zM6 6h4v4H6z',
}
const path = computed(() => paths[props.kind || ''] || 'M5 1h6v3h3v7h-3v3H5v-3H2V4h3zm1 4v5h4V5z')
</script>
<template>
  <svg
    class="pixel-icon"
    viewBox="0 0 16 16"
    fill="currentColor"
    shape-rendering="crispEdges"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="path" />
  </svg>
</template>
<style scoped>
.pixel-icon {
  width: 18px;
  height: 18px;
  flex: none;
  image-rendering: pixelated;
}
</style>
