<script setup lang="ts">
import { RouterLink } from 'vue-router'
import Notice from '@/components/primitives/Notice.vue'
import { t } from '@/i18n'
import { connectorState } from '@/core/connector/connectorClient'
import { connectionSettings } from '@/core/connector/connectionSettings'
import { ASSISTANT_SETTINGS } from '@/core/connector/connectorProtocol'
</script>

<template>
  <div
    v-if="
      connectorState.versionStatus === 'mismatch' &&
      connectorState.environment === 'production' &&
      connectorState.identity
    "
    class="assistant-notice"
  >
    <Notice
      :key="connectorState.expectedVersion"
      closable
      tone="warning"
      :title="t('浏览器助手版本与 main 线上版本不一致')"
    >
      <p>
        {{
          t('已安装 {p0}，线上 {p1}。请更新或替换脚本后刷新。', {
            p0: connectorState.identity.scriptVersion,
            p1: connectorState.expectedVersion,
          })
        }}
      </p>
      <RouterLink :to="ASSISTANT_SETTINGS">{{ t('前往设置安装或更新浏览器助手') }}</RouterLink>
    </Notice>
  </div>
  <div
    v-else-if="
      connectionSettings.mode === 'local' && !['ready', 'detecting'].includes(connectorState.phase)
    "
    class="assistant-notice"
  >
    <Notice tone="warning" :title="t('本机代理不可用，请检查脚本或切换请求方式')">
      <RouterLink :to="ASSISTANT_SETTINGS">{{ t('前往设置安装或更新浏览器助手') }}</RouterLink>
    </Notice>
  </div>
</template>

<style scoped>
.assistant-notice {
  max-width: 960px;
  margin: 12px auto;
  padding: 0 20px;
}
a {
  color: var(--primary);
  text-decoration: underline;
}
@media (max-width: 560px) {
  .assistant-notice {
    padding: 0 68px 0 14px;
  }
}
</style>
