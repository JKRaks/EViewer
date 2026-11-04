<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { t } from '@/i18n'
import ActionButton from '@/components/primitives/ActionButton.vue'
import ToggleField from '@/components/primitives/ToggleField.vue'
import Notice from '@/components/primitives/Notice.vue'
import { notify } from '@/components/primitives/feedback'
import {
  translationCapture,
  loadTranslationCandidates,
  exportTranslationCandidates,
  clearTranslationCandidates,
  reviewTranslationCandidates,
} from '@/core/hentaiverse/hentaiVerseTranslationCapture'
import {
  translateHentaiVerseText,
  translateHentaiVerseDescription,
  translateHentaiVerseBattleLog,
} from '@/core/hentaiverse/hentaiVerseTranslations'

const busy = ref(false)
onMounted(() => void loadTranslationCandidates())

async function manageCandidates(action: 'export' | 'review' | 'clear') {
  if (busy.value) return
  busy.value = true
  try {
    if (action === 'export') {
      const report = await exportTranslationCandidates()
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
      )
      const link = document.createElement('a')
      link.href = url
      link.download = `eviewer-hv-translations-${Date.now()}.json`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } else if (action === 'review') {
      const translators = {
        label: translateHentaiVerseText,
        description: translateHentaiVerseDescription,
        battleLog: translateHentaiVerseBattleLog,
      }
      await reviewTranslationCandidates((domain, source) => translators[domain](source))
      notify.success(t('已按当前翻译规则重新检查'))
    } else {
      await clearTranslationCandidates()
      notify.success(t('翻译候选已清空'))
    }
  } catch {
    notify.error(t('翻译候选操作失败，请重试'))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section id="hv-translations" class="translation-settings settings-section">
    <h2>{{ t('HentaiVerse 翻译收集') }}</h2>
    <div class="capture-setting">
      <div>
        <strong>{{ t('收集未翻译文本') }}</strong>
        <p>{{ t('在本地收集漏译内容，统一导出') }}</p>
      </div>
      <ToggleField v-model="translationCapture.enabled" :aria-label="t('收集未翻译文本')" />
    </div>
    <p class="capture-status" role="status">
      {{
        t('待补译 {p0} 条，其中部分翻译 {p1} 条；已覆盖 {p2} 条。', {
          p0: translationCapture.count,
          p1: translationCapture.partial,
          p2: translationCapture.resolved,
        })
      }}
    </p>
    <p>
      {{ t('收集开关独立于缓存设置。') }}
      {{ t('按句式去重，最多保留 1000 条候选及每条 3 个脱敏样例。导出后可用于补齐翻译规则。') }}
    </p>
    <Notice
      v-if="translationCapture.memoryOnly"
      tone="warning"
      :title="t('本地存储不可用，本轮仅保存在内存中，请及时导出。')"
    />
    <div class="capture-actions">
      <ActionButton
        :disabled="busy || !(translationCapture.count + translationCapture.resolved)"
        @click="manageCandidates('export')"
        >{{ t('导出翻译候选') }}</ActionButton
      >
      <ActionButton
        :disabled="busy || !(translationCapture.count + translationCapture.resolved)"
        @click="manageCandidates('review')"
        >{{ t('重新检查覆盖情况') }}</ActionButton
      >
      <ActionButton
        :disabled="busy || !(translationCapture.count + translationCapture.resolved)"
        @click="manageCandidates('clear')"
        >{{ t('清空收集记录') }}</ActionButton
      >
    </div>
  </section>
</template>

<style scoped>
.translation-settings {
  padding: 24px 0;
  border-bottom: 1px solid var(--border-soft);
  scroll-margin-top: 20px;
}
h2 {
  margin: 0 0 14px;
  font-size: 15px;
  color: var(--muted-foreground);
}
.capture-setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}
.capture-setting strong {
  font-size: 14px;
  font-weight: 500;
}
p {
  margin: 8px 0;
  color: var(--muted-foreground);
  font-size: 13px;
  line-height: 1.7;
}
.capture-status {
  margin-top: 18px;
  color: var(--foreground);
}
.capture-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 14px;
}
.capture-actions :deep(.ui-button) {
  min-height: 44px;
}
</style>
