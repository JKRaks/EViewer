<script setup lang="ts">
import { useAppLaunchReadiness } from '@/lib/appLaunch'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowUpRight, Copy, Download, Link, Monitor, RefreshCw } from '@lucide/vue'
import ActionButton from '@/components/primitives/ActionButton.vue'
import { Button } from '@/components/ui/button'
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
import { detectAuthInstallEnvironment, type AuthInstallContext } from '@/lib/authInstallEnvironment'
import windowsIcon from '@/assets/platform-icons/windows.svg?raw'
import appleIcon from '@/assets/platform-icons/apple.svg?raw'
import androidIcon from '@/assets/platform-icons/android.svg?raw'
import linuxIcon from '@/assets/platform-icons/linux.svg?raw'

const browserNavigator = navigator as Navigator &
  Pick<AuthInstallContext, 'userAgentData' | 'standalone'>
const installEnvironment = detectAuthInstallEnvironment({
  userAgent: browserNavigator.userAgent,
  platform: browserNavigator.platform,
  maxTouchPoints: browserNavigator.maxTouchPoints,
  userAgentData: browserNavigator.userAgentData,
  standalone:
    window.matchMedia('(display-mode: standalone)').matches || browserNavigator.standalone,
})
const platformIcons = {
  windows: windowsIcon,
  macos: appleIcon,
  ios: appleIcon,
  ipados: appleIcon,
  android: androidIcon,
  linux: linuxIcon,
  unknown: undefined,
}
const environmentLabel = computed(() =>
  [
    t(installEnvironment.osLabel),
    t(installEnvironment.browserLabel),
    ...(installEnvironment.standalone ? ['PWA'] : []),
  ].join(' · '),
)
const installationOptions = computed(() =>
  [
    {
      id: 'tampermonkey',
      label: t('安装 Tampermonkey'),
      href: installEnvironment.tampermonkeyUrl,
      icons:
        installEnvironment.manager === 'tampermonkey'
          ? [{ svg: platformIcons[installEnvironment.os], label: installEnvironment.osLabel }]
          : [
              { svg: windowsIcon, label: 'Windows' },
              { svg: androidIcon, label: 'Android' },
              { svg: appleIcon, label: 'macOS' },
              { svg: linuxIcon, label: 'Linux' },
            ],
      description:
        installEnvironment.os === 'android'
          ? t('在支持扩展的 Android 浏览器中安装 Tampermonkey，再安装下方授权脚本。')
          : t(
              '在 Chrome、Edge、Firefox 等支持扩展的桌面浏览器中安装 Tampermonkey，再安装下方授权脚本。',
            ),
    },
    {
      id: 'userscripts',
      label: t('安装 Userscripts'),
      href: 'https://apps.apple.com/app/userscripts/id1463298887',
      icons: [{ svg: appleIcon, label: 'iOS / iPadOS / macOS' }],
      description: t(
        '适用于 iPhone、iPad 和 Mac Safari。安装后启用扩展，将授权脚本加入 Userscripts，并允许访问 e-hentai.org。',
      ),
    },
  ]
    .map((option) => ({ ...option, recommended: option.id === installEnvironment.manager }))
    .sort((a, b) => Number(b.recommended) - Number(a.recommended)),
)
const helperBrowserHint = computed(() =>
  installEnvironment.manager === 'userscripts'
    ? t('请在 Safari 中完成安装和授权，再返回本页。')
    : installEnvironment.os === 'android'
      ? t('请在支持扩展的 Firefox 或 Edge 中完成安装和授权，再返回本页。')
      : t('请在支持扩展的浏览器中完成安装和授权，再返回本页。'),
)

const props = defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ busy: [value: boolean]; pending: [] }>()
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
  <section class="auth-bridge" :aria-label="t('源站登录')">
    <p class="bridge-description">
      {{ t('在原站登录并授权，即可同步登录凭据，无需复制 Cookie。') }}
    </p>
    <details class="bridge-help">
      <summary>
        {{ t('首次使用：安装授权脚本') }}
        <small v-if="installEnvironment.manager">{{
          installEnvironment.manager === 'userscripts' ? 'Userscripts' : 'Tampermonkey'
        }}</small>
      </summary>
      <p class="bridge-environment">
        <span
          v-if="platformIcons[installEnvironment.os]"
          class="platform-icon"
          aria-hidden="true"
          v-html="platformIcons[installEnvironment.os]"
        ></span>
        <Monitor v-else :size="16" aria-hidden="true" />
        {{ t('当前环境：{p0}', { p0: environmentLabel }) }}
      </p>
      <p v-if="installEnvironment.helperRequired" class="bridge-helper-hint">
        {{ helperBrowserHint }}
      </p>
      <div class="bridge-installations">
        <div
          v-for="option in installationOptions"
          :key="option.id"
          class="bridge-installation"
          :class="{ 'is-recommended': option.recommended }"
        >
          <div class="bridge-installation-actions">
            <Button
              as="a"
              class="ui-button bridge-install-button"
              :variant="option.recommended ? 'default' : 'outline'"
              :href="option.href"
              target="_blank"
              rel="noopener noreferrer"
              :aria-describedby="`bridge-install-${option.id}`"
            >
              <span class="platform-icons" aria-hidden="true">
                <span
                  v-for="icon in option.icons"
                  :key="icon.label"
                  class="platform-icon"
                  v-html="icon.svg"
                ></span>
              </span>
              {{ option.label }}
            </Button>
            <span v-if="option.recommended" class="bridge-install-recommendation">{{
              t('适合当前设备')
            }}</span>
          </div>
          <p :id="`bridge-install-${option.id}`" class="bridge-description">
            {{ option.description }}
          </p>
        </div>
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
.auth-bridge p {
  margin: 0;
}
.bridge-description {
  color: var(--muted-foreground);
  font-size: 14px;
  line-height: 1.6;
}
.bridge-help {
  padding: 12px 0;
  border-block: 1px solid var(--border-soft);
}
.bridge-help summary {
  cursor: pointer;
  min-height: 44px;
  display: list-item;
  align-content: center;
}
.bridge-help summary small {
  margin-left: 8px;
  color: var(--muted-foreground);
  font-size: 12px;
}
.bridge-environment,
.bridge-installation-actions,
.platform-icons {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.bridge-environment {
  padding-top: 8px;
  color: var(--muted-foreground);
  font-size: 12px;
  overflow-wrap: anywhere;
}
.platform-icon {
  display: inline-block;
  flex: none;
  width: 16px;
  height: 16px;
}
.platform-icon :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
  fill: currentColor;
}
.platform-icons {
  flex-wrap: nowrap;
  gap: 6px;
}
.bridge-helper-hint {
  color: var(--text);
  font-size: 13px;
  line-height: 1.6;
}
.bridge-installations {
  display: grid;
  gap: 12px;
}
.bridge-installation {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-left: 2px solid var(--border-soft);
}
.bridge-installation.is-recommended {
  background: var(--accent-soft);
  border-left-color: var(--accent);
}
.bridge-install-recommendation {
  color: var(--accent);
  font-size: 12px;
}
.bridge-install-button {
  min-height: 44px;
  height: auto;
  max-width: 100%;
  white-space: normal;
  text-align: center;
  color: var(--foreground);
  text-decoration: none;
}
.bridge-install-button[data-variant='default'] {
  color: var(--accent-foreground);
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
