<script setup lang="ts">
defineProps<{ size?: number | string; color?: string }>()
</script>
<template>
  <span
    class="ui-icon"
    :style="{ fontSize: size ? `${size}px` : undefined, color }"
    aria-hidden="true"
    ><slot
  /></span>
</template>
