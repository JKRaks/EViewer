<script setup lang="ts">
import { RefreshCw, Settings2 } from '@lucide/vue'
import { RouterLink } from 'vue-router'
import ActionButton from '@/components/primitives/ActionButton.vue'
import { Button } from '@/components/ui/button'
import { ASSISTANT_SETTINGS } from '@/core/connector/connectorProtocol'
import { t } from '@/i18n'

defineProps<{ ipRestricted: boolean }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="error-actions">
    <ActionButton size="sm" :icon="RefreshCw" @click="$emit('retry')">
      {{ t('重新加载') }}
    </ActionButton>
    <Button v-if="ipRestricted" as-child class="ui-button" variant="outline" size="sm">
      <RouterLink :to="ASSISTANT_SETTINGS">
        <Settings2 :size="16" aria-hidden="true" />{{ t('选择代理') }}
      </RouterLink>
    </Button>
  </div>
</template>

<style scoped>
.error-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.error-actions > .ui-button {
  min-height: 44px;
  margin: 0;
}
</style>
