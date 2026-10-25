<script setup lang="ts">
import { t } from '@/i18n'
import { useRouter } from 'vue-router'
import Notice from './primitives/Notice.vue'
import ActionButton from './primitives/ActionButton.vue'

defineProps<{ paragraphs: string[]; loading?: boolean }>()
defineEmits<{ continue: [] }>()

const router = useRouter()
function goBack() {
  if (window.history.state?.back) router.back()
  else void router.push('/')
}
</script>

<template>
  <Notice tone="warning" :title="t('源站内容警告')" class="gallery-content-warning">
    <p>{{ t('源站已将此画册标记为可能令人不适的内容，请确认是否继续。') }}</p>
    <p v-for="(paragraph, index) in paragraphs" :key="index" class="source-warning">
      {{ paragraph }}
    </p>
    <div class="warning-actions">
      <ActionButton variant="link" @click="goBack">{{ t('返回上一页') }}</ActionButton>
      <ActionButton :loading="loading" @click="$emit('continue')">{{
        t('了解警告，继续查看')
      }}</ActionButton>
    </div>
  </Notice>
</template>

<style scoped>
.gallery-content-warning {
  max-width: 760px;
  margin: 24px auto;
}
.gallery-content-warning p {
  margin: 8px 0;
  overflow-wrap: anywhere;
}
.source-warning {
  font-size: 13px;
  color: var(--muted-foreground);
}
.warning-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
}
</style>
