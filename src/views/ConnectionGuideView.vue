<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { t } from '@/i18n'
import ActionButton from '@/components/primitives/ActionButton.vue'
import ChoiceGroup from '@/components/primitives/ChoiceGroup.vue'
import RadioChoice from '@/components/primitives/RadioChoice.vue'
import BrowserAssistantSettings from '@/components/settings/BrowserAssistantSettings.vue'
import { connectionSettings, type RequestMode } from '@/core/connector/connectionSettings'
import {
  completeConnectionOnboarding,
  connectionOnboarding,
} from '@/core/connector/connectionOnboarding'
import { connectorState } from '@/core/connector/connectorClient'
import { ASSISTANT_SETTINGS } from '@/core/connector/connectorProtocol'
import { allowAppLaunchInteraction } from '@/lib/appLaunch'

const route = useRoute()
const router = useRouter()
const revisiting = connectionOnboarding.status === 'completed'
const selectedMode = ref<RequestMode>(revisiting ? connectionSettings.mode : 'local')
const submitted = ref(false)
const heading = ref<HTMLElement>()
const canContinue = computed(
  () => !submitted.value && (selectedMode.value === 'server' || connectorState.phase === 'ready'),
)

async function confirm() {
  if (!canContinue.value) return
  submitted.value = true
  if (!completeConnectionOnboarding(selectedMode.value, connectorState.phase === 'ready')) {
    submitted.value = false
    return
  }
  // Automatic onboarding never changes the URL, including its query and hash.
  if (route.name === 'connection-guide') await router.replace(ASSISTANT_SETTINGS)
}

onMounted(async () => {
  // User input must never become a launch-readiness dependency.
  allowAppLaunchInteraction()
  await nextTick()
  heading.value?.focus({ preventScroll: true })
})
</script>

<template>
  <section class="connection-guide" aria-labelledby="connection-guide-title">
    <header>
      <div class="guide-wordmark" aria-label="EViewer">EViewer<span>.</span></div>
      <h1 id="connection-guide-title" ref="heading" tabindex="-1">{{ t('先选择连接方式') }}</h1>
      <p>
        {{ t('EViewer 为 E-Hentai、ExHentai 和 HentaiVerse 提供浏览与阅读界面，内容来自源站。') }}
      </p>
    </header>

    <ChoiceGroup v-model="selectedMode" class="guide-choices" :aria-label="t('连接方式')">
      <div class="guide-option" :class="{ 'is-selected': selectedMode === 'local' }">
        <RadioChoice value="local">{{ t('浏览器助手（本机代理）') }} · {{ t('推荐') }}</RadioChoice>
        <p>{{ t('安装助手后，由当前浏览器连接源站，使用同一浏览器的源站登录状态。') }}</p>
      </div>
      <div class="guide-option" :class="{ 'is-selected': selectedMode === 'server' }">
        <RadioChoice value="server">{{ t('服务代理') }}</RadioChoice>
        <p>{{ t('通过本站服务连接源站，无需安装助手。登录相关功能需另行配置认证。') }}</p>
      </div>
    </ChoiceGroup>
    <p class="guide-scope">{{ t('此选择同时用于画廊和 HentaiVerse，可随时在设置中更改。') }}</p>

    <BrowserAssistantSettings v-if="selectedMode === 'local'" installation-only />

    <footer>
      <p
        v-if="selectedMode === 'local' && connectorState.phase !== 'ready'"
        id="guide-next-step"
        role="status"
      >
        {{ t('安装并连接助手后即可继续。安装期间可以离开此页，返回后刷新或重新检测。') }}
      </p>
      <div class="guide-actions">
        <ActionButton variant="default" :disabled="!canContinue" @click="confirm">{{
          t('确认并继续')
        }}</ActionButton>
        <ActionButton v-if="revisiting" @click="router.replace(ASSISTANT_SETTINGS)">{{
          t('返回设置')
        }}</ActionButton>
      </div>
    </footer>
  </section>
</template>

<style scoped>
.connection-guide {
  width: min(100%, 760px);
  margin: 0 auto;
  padding: 24px 8px 40px;
  color: var(--foreground);
}
.guide-wordmark {
  font:
    italic 29px/1 Georgia,
    serif;
  letter-spacing: -1.5px;
  margin-bottom: 32px;
}
.guide-wordmark span {
  color: var(--accent);
}
h1 {
  margin: 0 0 12px;
  font-size: 24px;
  line-height: 1.4;
}
p {
  font-size: 14px;
  line-height: 1.7;
  color: var(--muted-foreground);
  overflow-wrap: anywhere;
}
.guide-choices {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin: 28px 0 12px;
}
.guide-option {
  padding: 12px 16px;
  border-left: 2px solid var(--border-soft);
}
.guide-option.is-selected {
  background: var(--accent-soft);
  border-left-color: var(--accent);
}
.guide-option :deep(.ui-radio) {
  min-height: 44px;
  width: 100%;
}
.guide-option p {
  margin: 6px 0;
}
.guide-scope {
  margin-bottom: 0;
}
footer {
  padding-top: 20px;
}
.guide-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
}
.guide-actions :deep(button) {
  min-height: 44px;
}
@media (max-width: 560px) {
  .connection-guide {
    padding: 12px 0 28px;
  }
  .guide-choices {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
  .guide-actions > * {
    flex: 1 1 auto;
  }
}
</style>
