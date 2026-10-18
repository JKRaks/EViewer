<script setup lang="ts">
import type { Component } from 'vue'
defineProps<{ icon?: Component; size?: number }>()
</script>
<template>
  <span class="ui-avatar" :style="{ width: `${size || 40}px`, height: `${size || 40}px` }"
    ><component :is="icon" v-if="icon" :size="18" aria-hidden="true" /><slot
  /></span>
</template>
