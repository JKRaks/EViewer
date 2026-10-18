<script setup lang="ts">
import type { Component } from 'vue'
import { LoaderCircle } from '@lucide/vue'
import { Button } from '@/components/ui/button'
withDefaults(
  defineProps<{
    variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive'
    size?: 'default' | 'sm' | 'lg' | 'icon'
    icon?: Component
    loading?: boolean
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
  }>(),
  { variant: 'outline', size: 'default', type: 'button' },
)
</script>
<template>
  <Button
    class="ui-button"
    :class="{ 'ui-button--icon': size === 'icon' }"
    :variant="variant"
    :size="size"
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
  >
    <LoaderCircle v-if="loading" class="is-loading" :size="16" aria-hidden="true" />
    <component :is="icon" v-else-if="icon" :size="16" aria-hidden="true" />
    <slot />
  </Button>
</template>
