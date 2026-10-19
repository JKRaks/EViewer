<script setup lang="ts">
import { useAppLaunchReadiness } from '@/lib/appLaunch'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowUpRight, Copy, Download, Link, RefreshCw } from '@lucide/vue'
import ActionButton from '@/components/primitives/ActionButton.vue'
import Notice from '@/components/primitives/Notice.vue'
import TextField from '@/components/primitives/TextField.vue'
import { notify } from '@/components/primitives/feedback'
import {
  bridgeUrl,
  claimBridge,
  readBridgeScript,
  requestBridge,
  type BridgeStatus,
} from '@/core/auth/authBridge'
import { refreshAuthState, useAuthState } from '@/core/auth/authState'
import { t } from '@/i18n'

const props = defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ busy: [value: boolean] }>()
const status = ref<BridgeStatus>({ success: true, state: 'idle' })
const starting = ref(false)
const claiming = ref(false)
const checking = ref(false)
const restoring = ref(true)
useAppLaunchReadiness(() => restoring.value, 'account')
const scriptLoading = ref(false)
const scriptText = ref('')
const authorizationUrl = ref('')
const error = ref('')
const completed = ref(false)
const authState = useAuthState()
const remaining = ref(0)
let timer: ReturnType<typeof setTimeout> | undefined
let controller = new AbortController()
let disposed = false
const waiting = computed(() => ['waiting', 'ready', 'claimed'].includes(status.value.state))
const blocked = computed(() => props.disabled || starting.value || claiming.value)

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
    const confirmed = await refreshAuthState(signal, result)
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

async function copyScript() {
  scriptLoading.value = true
  try {
    scriptText.value = await readBridgeScript(controller.signal)
    await copy(scriptText.value)
  } catch (reason) {
    if (!controller.signal.aborted)
      notify.error(reason instanceof Error ? reason.message : t('读取授权脚本失败'))
  } finally {
    scriptLoading.value = false
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
    await refreshAuthState(controller.signal)
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
  <section class="auth-bridge" :aria-label="t('通过原站登录')">
    <h2>{{ t('通过原站登录') }}</h2>
    <p class="bridge-description">
      {{ t('在原站登录并授权，即可同步登录凭据，无需复制 Cookie。') }}
    </p>
    <details class="bridge-help">
      <summary>{{ t('首次使用：安装授权脚本') }}</summary>
      <ol>
        <li>{{ t('桌面及 Android 支持扩展的浏览器：启用 Tampermonkey，再安装脚本。') }}</li>
        <li>
          {{
            t(
              'iPhone、iPad、Mac Safari：安装 Userscripts，下载脚本到指定目录，并允许访问 e-hentai.org。',
            )
          }}
        </li>
        <li>
          {{
            t('PWA 或不支持扩展的浏览器：将授权链接复制到已安装脚本的辅助浏览器，完成后返回这里。')
          }}
        </li>
      </ol>
      <div class="bridge-actions">
        <a href="https://www.tampermonkey.net/" target="_blank" rel="noopener noreferrer"
          >Tampermonkey</a
        >
        <a
          href="https://apps.apple.com/app/userscripts/id1463298887"
          target="_blank"
          rel="noopener noreferrer"
          >Userscripts</a
        >
      </div>
      <div class="bridge-actions">
        <a :href="bridgeUrl('script.user.js')" target="_blank" rel="noopener noreferrer">{{
          t('安装授权脚本')
        }}</a>
        <a :href="bridgeUrl('script.user.js?download=1')" download
          ><Download :size="16" aria-hidden="true" />{{ t('下载脚本文件') }}</a
        >
        <ActionButton :loading="scriptLoading" :icon="Copy" @click="copyScript">{{
          t('复制授权脚本')
        }}</ActionButton>
      </div>
      <TextField
        v-if="scriptText"
        :model-value="scriptText"
        type="textarea"
        :rows="5"
        readonly
        :aria-label="t('授权脚本源码')"
      />
      <p class="bridge-description">
        {{ t('脚本浮层应显示版本 1.0.0；未出现浮层时，请检查脚本启用状态和网站权限。') }}
      </p>
    </details>
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
.auth-bridge h2,
.auth-bridge p {
  margin: 0;
}
.auth-bridge h2 {
  font-size: 18px;
  font-weight: 600;
}
.bridge-description {
  color: var(--el-text-color-secondary);
  font-size: 14px;
  line-height: 1.6;
}
.bridge-help {
  padding: 12px 0;
  border-block: 1px solid var(--el-border-color-lighter);
}
.bridge-help summary {
  cursor: pointer;
  min-height: 44px;
  display: list-item;
  align-content: center;
}
.bridge-help ol {
  padding-left: 22px;
  line-height: 1.8;
  margin-block: 8px 14px;
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
  color: var(--el-color-primary);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.bridge-pairing {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  min-width: 0;
}
.bridge-help > :not(summary) {
  margin-bottom: 12px;
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
