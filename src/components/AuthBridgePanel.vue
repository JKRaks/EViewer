<script setup lang="ts">
import { useAppLaunchReadiness } from '@/lib/appLaunch'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowUpRight, Copy, Link, RefreshCw } from '@lucide/vue'
import ActionButton from '@/components/primitives/ActionButton.vue'
import { RouterLink } from 'vue-router'
import { ASSISTANT_SETTINGS } from '@/core/connector/connectorProtocol'
import Notice from '@/components/primitives/Notice.vue'
import TextField from '@/components/primitives/TextField.vue'
import { notify } from '@/components/primitives/feedback'
import { claimBridge, requestBridge, type BridgeStatus } from '@/core/auth/authBridge'
import { refreshServerAuthState, useServerAuthState } from '@/core/auth/authState'
import { t } from '@/i18n'
const props = defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ busy: [value: boolean]; pending: [] }>()
const status = ref<BridgeStatus>({ success: true, state: 'idle' })
const starting = ref(false)
const claiming = ref(false)
const checking = ref(false)
const restoring = ref(true)
useAppLaunchReadiness(() => restoring.value, 'account')
const authorizationUrl = ref('')
const error = ref('')
const completed = ref(false)
const authState = useServerAuthState()
const remaining = ref(0)
let timer: ReturnType<typeof setTimeout> | undefined
let controller = new AbortController()
let disposed = false
const waiting = computed(() => ['waiting', 'ready', 'claimed'].includes(status.value.state))
const blocked = computed(() => props.disabled || starting.value || claiming.value)
watch(waiting, (pending) => {
  if (pending) emit('pending')
})

function schedule() {
  clearTimeout(timer)
  if (!disposed && waiting.value && !error.value && document.visibilityState === 'visible')
    timer = setTimeout(() => {
      void checkStatus()
    }, 3000)
}

async function finish(signal: AbortSignal) {
  claiming.value = true
  emit('busy', true)
  try {
    const result = await claimBridge(signal)
    const confirmed = await refreshServerAuthState(signal, result)
    if (!confirmed.credentialReady || confirmed.memberId !== result.memberId)
      throw new Error(t('浏览器未保存登录凭据，请检查 Cookie 权限后重试'))
    // Acknowledge only after the browser proves that both HttpOnly cookies arrived.
    await requestBridge('cancel', signal).catch(() => {
      // Credential storage already succeeded; the short-lived session also expires server-side.
    })
    completed.value = true
    authorizationUrl.value = ''
    status.value = { success: true, state: 'idle' }
    notify.success(t('登录凭据已同步'))
  } finally {
    claiming.value = false
    emit('busy', false)
  }
}

async function checkStatus() {
  if (checking.value || starting.value || claiming.value || props.disabled || disposed) return
  checking.value = true
  error.value = ''
  const signal = controller.signal
  try {
    const result = await requestBridge('status', signal)
    if (signal.aborted || disposed) return
    status.value = result
    remaining.value = Math.max(0, Math.ceil(((status.value.expiresAt || 0) - Date.now()) / 1000))
    if (['ready', 'claimed'].includes(status.value.state)) await finish(signal)
    if (!waiting.value) authorizationUrl.value = ''
  } catch (reason) {
    if (!signal.aborted)
      error.value = reason instanceof Error ? reason.message : t('检查授权状态失败')
  } finally {
    if (!signal.aborted) {
      checking.value = false
      schedule()
    }
  }
}

async function start() {
  controller.abort()
  controller = new AbortController()
  checking.value = false
  clearTimeout(timer)
  starting.value = true
  emit('busy', true)
  error.value = ''
  completed.value = false
  try {
    status.value = await requestBridge('start', controller.signal)
    authorizationUrl.value = status.value.authorizationUrl || ''
    remaining.value = Math.max(0, Math.ceil(((status.value.expiresAt || 0) - Date.now()) / 1000))
  } catch (reason) {
    if (!controller.signal.aborted)
      error.value = reason instanceof Error ? reason.message : t('创建授权失败')
  } finally {
    starting.value = false
    emit('busy', false)
    schedule()
  }
}

async function cancel() {
  controller.abort()
  controller = new AbortController()
  checking.value = false
  clearTimeout(timer)
  error.value = ''
  try {
    status.value = await requestBridge('cancel', controller.signal)
    authorizationUrl.value = ''
  } catch (reason) {
    if (!controller.signal.aborted)
      error.value = reason instanceof Error ? reason.message : t('取消授权失败')
  }
}

async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    notify.success(t('已复制'))
  } catch {
    notify.warning(t('无法自动复制，请在文本框中选择并复制'))
  }
}

function resume() {
  if (document.visibilityState === 'visible' && !error.value) void checkStatus()
  else clearTimeout(timer)
}

onMounted(async () => {
  document.addEventListener('visibilitychange', resume)
  window.addEventListener('pageshow', resume)
  try {
    await refreshServerAuthState(controller.signal)
  } catch {
    /* Manual import remains available. */
  }
  try {
    if (!disposed) await checkStatus()
  } finally {
    restoring.value = false
  }
})
watch(
  () => props.disabled,
  (disabled) => {
    if (!disabled) void checkStatus()
  },
)
watch(
  () => authState.loggedIn,
  (loggedIn) => {
    if (!loggedIn) completed.value = false
  },
)
onBeforeUnmount(() => {
  disposed = true
  controller.abort()
  clearTimeout(timer)
  document.removeEventListener('visibilitychange', resume)
  window.removeEventListener('pageshow', resume)
  emit('busy', false)
})
</script>

<template>
  <section class="auth-bridge" :aria-label="t('源站登录')">
    <p class="bridge-description">
      {{ t('在原站登录并授权，即可同步登录凭据，无需复制 Cookie。') }}
    </p>
    <RouterLink :to="ASSISTANT_SETTINGS" class="bridge-settings-link">{{
      t('前往设置安装或更新浏览器助手')
    }}</RouterLink>
    <div class="bridge-actions">
      <a
        href="https://e-hentai.org/bounce_login.php?b=d&amp;bt=1-1"
        target="_blank"
        rel="noopener noreferrer"
        ><ArrowUpRight :size="16" aria-hidden="true" />{{ t('先登录原站') }}</a
      >
      <ActionButton
        variant="default"
        :icon="Link"
        :loading="starting"
        :disabled="blocked || status.available === false"
        @click="start"
      >
        {{ waiting ? t('重新开始授权') : t('开始原站授权') }}
      </ActionButton>
    </div>
    <div v-if="waiting" class="bridge-pairing">
      <p role="status">
        {{
          claiming ? t('正在保存登录凭据…') : t('等待原站授权，约剩余 {p0} 秒', { p0: remaining })
        }}
      </p>
      <template v-if="authorizationUrl">
        <div class="bridge-actions">
          <a :href="authorizationUrl" target="_blank" rel="noopener noreferrer">{{
            t('前往原站确认授权')
          }}</a>
          <ActionButton :icon="Copy" :disabled="blocked" @click="copy(authorizationUrl)">{{
            t('复制授权链接')
          }}</ActionButton>
        </div>
        <TextField :model-value="authorizationUrl" readonly :aria-label="t('短期授权链接')" />
      </template>
      <p class="bridge-description">
        {{ t('请在原站浮层点击授权，然后返回本页。授权链接五分钟内有效。') }}
      </p>
      <div class="bridge-actions">
        <ActionButton
          :icon="RefreshCw"
          :loading="checking"
          :disabled="blocked"
          @click="checkStatus"
          >{{ t('检查授权结果') }}</ActionButton
        >
        <ActionButton :disabled="blocked" @click="cancel">{{ t('取消授权') }}</ActionButton>
      </div>
    </div>
    <Notice
      v-if="completed"
      tone="success"
      :title="t('登录凭据已同步')"
      :description="t('已获取并保存两项登录凭据。源站访问状态单独判断。')"
    />
    <Notice v-if="status.state === 'expired'" tone="info" :title="t('授权已过期，请重新开始')" />
    <Notice
      v-if="status.available === false"
      tone="info"
      :title="t('原站授权暂未配置，请使用手动输入')"
    />
    <Notice v-if="error" tone="error" :title="error" />
  </section>
</template>

<style scoped>
.auth-bridge {
  display: grid;
  gap: 14px;
  min-width: 0;
}
.auth-bridge p {
  margin: 0;
}
.bridge-description {
  color: var(--muted-foreground);
  font-size: 14px;
  line-height: 1.6;
}
.bridge-settings-link {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.bridge-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.bridge-actions a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.bridge-pairing {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  min-width: 0;
}
@media (max-width: 767px) {
  .bridge-actions > * {
    flex: 1 1 auto;
    justify-content: center;
  }
  .bridge-actions :deep(button) {
    min-height: 44px;
  }
  .auth-bridge :deep(input),
  .auth-bridge :deep(textarea) {
    font-size: 16px;
  }
}
</style>
