<script setup lang="ts">
defineProps<{ variant?: string }>()
</script>
<template>
  <div
    class="ui-skeleton__item"
    :class="{
      'ui-skeleton__image': variant === 'image',
      'ui-skeleton__circle': variant === 'circle',
    }"
  />
</template>
