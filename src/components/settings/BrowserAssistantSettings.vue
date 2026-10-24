<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowUpRight, Copy, Download, Monitor, RefreshCw } from '@lucide/vue'
import { t } from '@/i18n'
import ChoiceGroup from '@/components/primitives/ChoiceGroup.vue'
import RadioChoice from '@/components/primitives/RadioChoice.vue'
import ActionButton from '@/components/primitives/ActionButton.vue'
import Notice from '@/components/primitives/Notice.vue'
import TagChip from '@/components/primitives/TagChip.vue'
import { Button } from '@/components/ui/button'
import { notify } from '@/components/primitives/feedback'
import { detectAuthInstallEnvironment, type AuthInstallContext } from '@/lib/authInstallEnvironment'
import windowsIcon from '@/assets/platform-icons/windows.svg?raw'
import appleIcon from '@/assets/platform-icons/apple.svg?raw'
import androidIcon from '@/assets/platform-icons/android.svg?raw'
import linuxIcon from '@/assets/platform-icons/linux.svg?raw'
import { connectionSettings } from '@/core/connector/connectionSettings'
import {
  assistantUrl,
  checkAssistantVersion,
  connectorState,
  detectConnector,
} from '@/core/connector/connectorClient'
import type { AssistantFlavor } from '@/core/connector/connectorProtocol'
import { localSession, refreshLocalAuthState, useAuthState } from '@/core/auth/authState'

const browserNavigator = navigator as Navigator &
  Pick<AuthInstallContext, 'userAgentData' | 'standalone'>
const environment = detectAuthInstallEnvironment({
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
    t(environment.osLabel),
    t(environment.browserLabel),
    ...(environment.standalone ? ['PWA'] : []),
  ].join(' · '),
)
const installationOptions = computed(() =>
  [
    {
      id: 'tampermonkey' as const,
      name: 'Tampermonkey',
      label: t('安装 Tampermonkey'),
      href: environment.tampermonkeyUrl,
      description: t('桌面 Chrome、Edge、Firefox 等；支持扩展的 Android 浏览器。'),
    },
    {
      id: 'userscripts' as const,
      name: 'Safari Userscripts',
      label: t('安装 Userscripts'),
      href: 'https://apps.apple.com/app/userscripts/id1463298887',
      description: t('iPhone、iPad 和 Mac 上的 Safari。'),
    },
  ]
    .map((option) => ({ ...option, recommended: option.id === environment.manager }))
    .sort((a, b) => Number(b.recommended) - Number(a.recommended)),
)
const helperBrowserHint = computed(() =>
  environment.manager === 'userscripts'
    ? t('请在 Safari 普通标签页中安装并使用助手。')
    : environment.os === 'android'
      ? t('请在支持扩展的 Firefox 或 Edge 中安装并使用助手。')
      : t('请在支持扩展的浏览器普通标签页中安装并使用助手。'),
)
const flavor = ref<AssistantFlavor>(
  connectorState.identity?.flavor || environment.manager || 'tampermonkey',
)
const authState = useAuthState()
const section = ref<HTMLElement>()
const route = useRoute()
const checking = ref(false)
const addressVisible = ref(false)
const status = computed(() =>
  t(
    {
      detecting: '正在检测浏览器助手…',
      missing: '未检测到浏览器助手',
      ready: '浏览器助手已连接',
      unsupported: '脚本能力或通信协议不兼容，请更新并检查权限',
      duplicate: '检测到多个助手，请只启用一份后刷新',
    }[connectorState.phase],
  ),
)
const versionStatus = computed(() =>
  t(
    {
      unknown: '连接后检查线上版本',
      checking: '正在检查 main 线上版本…',
      current: '与 main 当前线上版本一致',
      mismatch:
        connectorState.environment === 'production'
          ? '与 main 当前线上版本不一致，请更新或替换脚本'
          : '当前为开发或预览环境，与 main 的版本差异仅作对照',
      unavailable: '本地或预览环境未配置 main 版本来源',
      error:
        connectorState.identity &&
        (!connectorState.identity.scriptVersion ||
          connectorState.identity.scriptVersion !== connectorState.identity.buildVersion)
          ? '无法确认脚本版本，请重新安装对应助手'
          : '暂时无法检查版本，请重试',
    }[connectorState.versionStatus],
  ),
)
const installLabel = computed(() =>
  connectorState.identity?.flavor === flavor.value ? t('更新或重新安装脚本') : t('安装浏览器助手'),
)
watch(
  () => connectorState.identity?.flavor,
  (value) => {
    if (value) flavor.value = value
  },
)

async function check() {
  checking.value = true
  try {
    await detectConnector()
    await checkAssistantVersion(true)
  } finally {
    checking.value = false
  }
}
function changeMode(value: unknown) {
  if (value !== 'server' && value !== 'local') return
  if (value === 'local' && connectorState.phase !== 'ready') {
    notify.warning(t('请先安装助手并检测连接'))
    return
  }
  connectionSettings.mode = value
}
async function copyAddress() {
  try {
    await navigator.clipboard.writeText(assistantUrl(flavor.value))
    notify.success(t('已复制'))
  } catch {
    addressVisible.value = true
  }
}
async function scrollToEntry() {
  if (route.hash !== '#browser-assistant') return
  await nextTick()
  section.value?.scrollIntoView({ block: 'start' })
}
watch(() => route.hash, scrollToEntry)
onMounted(scrollToEntry)
</script>

<template>
  <section
    id="browser-assistant"
    ref="section"
    class="assistant-settings"
    :aria-label="t('浏览器助手')"
  >
    <h2>{{ t('浏览器助手') }} <TagChip class="assistant-beta">Beta</TagChip></h2>
    <div class="assistant-row">
      <div>
        <strong>{{ t('画廊请求方式') }}</strong>
        <p>{{ t('本机模式通过脚本从当前浏览器访问 E-Hentai。') }}</p>
      </div>
      <ChoiceGroup
        :model-value="connectionSettings.mode"
        :aria-label="t('画廊请求方式')"
        @update:model-value="changeMode"
      >
        <RadioChoice value="server">{{ t('服务代理') }}</RadioChoice>
        <RadioChoice
          value="local"
          :disabled="connectorState.phase !== 'ready' && connectionSettings.mode !== 'local'"
          >{{ t('本机助手') }} <TagChip class="assistant-beta">Beta</TagChip></RadioChoice
        >
      </ChoiceGroup>
    </div>
    <p>{{ t('本机失败后不会自动切回服务代理。HentaiVerse 仍使用服务代理及其登录凭据。') }}</p>
    <div class="assistant-row">
      <div aria-live="polite">
        <strong>{{ status }}</strong>
        <p v-if="connectorState.identity">
          {{ connectorState.identity.manager || flavor }}
          {{ connectorState.identity.managerVersion }} · {{ t('脚本版本') }}
          {{ connectorState.identity.scriptVersion || t('未知') }}
        </p>
        <p>
          {{ versionStatus
          }}<template v-if="connectorState.expectedVersion">
            · {{ t('线上版本') }} {{ connectorState.expectedVersion }}</template
          >
        </p>
      </div>
      <ActionButton :icon="RefreshCw" :loading="checking" @click="check">{{
        t('重新检测')
      }}</ActionButton>
    </div>
    <Notice
      v-if="
        connectorState.versionStatus === 'mismatch' && connectorState.environment === 'production'
      "
      tone="warning"
      :title="t('请将脚本替换为 main 当前线上版本')"
      :description="t('安装后刷新 EViewer，再检测版本。版本较新或来自实验环境时也需要核对。')"
    />

    <details class="assistant-install">
      <summary>
        {{ t('安装与更新') }}
        <small>{{ flavor === 'userscripts' ? 'Safari Userscripts' : 'Tampermonkey' }}</small>
      </summary>
      <p class="assistant-environment">
        <span
          v-if="platformIcons[environment.os]"
          class="platform-icon"
          aria-hidden="true"
          v-html="platformIcons[environment.os]"
        ></span>
        <Monitor v-else :size="16" aria-hidden="true" />
        {{ t('当前环境：{p0}', { p0: environmentLabel }) }}
      </p>
      <p v-if="environment.helperRequired">{{ helperBrowserHint }}</p>
      <p>{{ t('一份助手，同时支持本机请求和源站登录授权。') }}</p>
      <ol class="assistant-steps">
        <li>
          <strong>{{ t('选择脚本管理器') }}</strong>
          <ChoiceGroup v-model="flavor" class="assistant-managers" :aria-label="t('脚本管理器')">
            <div
              v-for="option in installationOptions"
              :key="option.id"
              class="assistant-manager"
              :class="{ 'is-selected': flavor === option.id }"
            >
              <div class="assistant-manager-title">
                <RadioChoice :value="option.id">{{ option.name }}</RadioChoice>
                <small v-if="option.recommended">{{ t('适合当前设备') }}</small>
              </div>
              <p>{{ option.description }}</p>
              <Button
                as="a"
                variant="outline"
                :href="option.href"
                target="_blank"
                rel="noopener noreferrer"
                @click="flavor = option.id"
              >
                {{ option.label }}<ArrowUpRight :size="16" aria-hidden="true" />
              </Button>
            </div>
          </ChoiceGroup>
          <p v-if="flavor === 'userscripts'">
            {{ t('打开 Userscripts App 选择脚本目录，再在 Safari 设置中启用扩展。') }}
          </p>
          <p v-else>{{ t('已安装可跳过；按扩展提示开启“允许用户脚本”或开发者模式。') }}</p>
        </li>
        <li>
          <strong>{{ t('安装 EViewer 助手') }}</strong>
          <div class="assistant-actions">
            <Button as="a" :href="assistantUrl(flavor)" target="_blank" rel="noopener noreferrer">
              {{ installLabel }}<ArrowUpRight :size="16" aria-hidden="true" />
            </Button>
          </div>
          <p v-if="flavor === 'userscripts'">
            {{ t('打开脚本后，在 Safari 扩展菜单选择 Userscripts，确认安装或更新。') }}
          </p>
          <p v-else>{{ t('在 Tampermonkey 安装页确认安装或更新。') }}</p>
          <p v-if="['development', 'preview'].includes(connectorState.environment)">
            {{ t('当前安装的是开发或预览版；正式版请前往正式站点安装。') }}
          </p>
          <p>{{ t('只保留一份助手，停用旧版登录脚本和实验连接器。') }}</p>
        </li>
        <li>
          <strong>{{ t('返回并检测') }}</strong>
          <p>
            {{
              t(
                '允许扩展访问本站和 E-Hentai，刷新本页后点击“重新检测”；连接成功即可选择“本机助手”。',
              )
            }}
          </p>
        </li>
      </ol>
      <details class="assistant-help">
        <summary>{{ t('没有出现安装提示？') }}</summary>
        <p v-if="flavor === 'userscripts'">
          {{
            t(
              '将下载的 .user.js 文件存入 Userscripts App 选定的目录，再打开扩展菜单刷新列表。保留 .user.js 后缀，不要存成网页或 .txt。',
            )
          }}
        </p>
        <p v-else>
          {{
            t(
              '先检查扩展已启用及网站权限，也可复制地址，在 Tampermonkey 的“实用工具”中从 URL 安装。',
            )
          }}
        </p>
        <div class="assistant-actions">
          <Button as="a" variant="outline" :href="assistantUrl(flavor, true)">
            <Download :size="16" aria-hidden="true" />{{ t('下载脚本文件') }}
          </Button>
          <ActionButton :icon="Copy" @click="copyAddress">{{ t('复制脚本地址') }}</ActionButton>
        </div>
        <input
          v-if="addressVisible"
          class="assistant-address"
          readonly
          :value="assistantUrl(flavor)"
          :aria-label="t('脚本地址，可选择复制')"
          @focus="($event.target as HTMLInputElement).select()"
        />
      </details>
      <details class="assistant-help">
        <summary>{{ t('脚本用途与权限') }}</summary>
        <p>{{ t('助手通过当前浏览器访问 E-Hentai，仅处理你在本站发起的请求。') }}</p>
        <p>{{ t('本机模式使用源站会话；仅在你确认服务代理的源站登录授权时，同步登录凭据。') }}</p>
        <p>{{ t('安装与权限需手动确认。脚本管理器负责自动更新，EViewer 启动时检查线上版本。') }}</p>
      </details>
    </details>
    <div v-if="connectionSettings.mode === 'local'" class="assistant-session">
      <h3>{{ t('本机源站登录') }}</h3>
      <p>
        {{
          t(
            '在同一浏览器登录 E-Hentai，再检测登录状态。本机请求使用源站会话，不向服务代理同步 Cookie。',
          )
        }}
      </p>
      <div class="assistant-actions">
        <Button
          as="a"
          variant="outline"
          href="https://e-hentai.org/bounce_login.php?b=d&amp;bt=1-1"
          target="_blank"
          rel="noopener noreferrer"
          >{{ t('先登录原站') }}</Button
        >
        <ActionButton
          :loading="localSession.checking"
          :disabled="connectorState.phase !== 'ready'"
          @click="refreshLocalAuthState(true)"
          >{{ t('检测源站登录') }}</ActionButton
        >
      </div>
      <p v-if="authState.loggedIn" role="status">{{ t('本机源站会话已验证') }}</p>
      <Notice v-if="localSession.error" tone="warning" :title="localSession.error" />
    </div>
  </section>
</template>

<style scoped>
.assistant-settings {
  padding: 24px 0;
  border-bottom: 1px solid var(--border-soft);
  scroll-margin-top: 20px;
}
h2 {
  margin: 0 0 14px;
  font-size: 15px;
  color: var(--muted-foreground);
}
h3 {
  margin: 20px 0 12px;
  font-size: 15px;
}
.assistant-beta {
  margin-left: 6px;
  padding: 1px 6px;
  font-size: 11px;
  font-weight: 500;
  vertical-align: middle;
}
p,
li {
  font-size: 13px;
  line-height: 1.7;
  color: var(--muted-foreground);
  overflow-wrap: anywhere;
}
p {
  margin: 6px 0 12px;
}
strong {
  font-size: 14px;
}
.assistant-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
}
.assistant-row > div {
  min-width: 0;
}
.assistant-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
}
.assistant-actions :deep(a),
.assistant-actions :deep(button) {
  min-height: 44px;
}
.assistant-install {
  margin-top: 14px;
  padding-top: 8px;
  border-top: 1px solid var(--border-soft);
}
summary {
  cursor: pointer;
  font-size: 14px;
  min-height: 44px;
  align-content: center;
}
.assistant-install > summary small {
  margin-left: 8px;
  font-size: 12px;
  color: var(--muted-foreground);
}
.assistant-environment {
  display: flex;
  align-items: center;
  gap: 8px;
}
.platform-icon {
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
.assistant-steps {
  margin: 20px 0;
  padding-left: 22px;
  list-style: decimal;
}
.assistant-steps > li + li {
  margin-top: 20px;
}
.assistant-steps strong,
.assistant-steps > li::marker {
  color: var(--foreground);
  font-weight: 600;
}
.assistant-managers {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 12px 0;
}
.assistant-manager {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  padding: 12px;
  border-left: 2px solid var(--border-soft);
}
.assistant-manager.is-selected {
  background: var(--accent-soft);
  border-left-color: var(--accent);
}
.assistant-manager-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0 8px;
}
.assistant-manager-title small {
  color: var(--accent);
  font-size: 12px;
}
.assistant-manager :deep(.ui-radio) {
  min-height: 44px;
}
.assistant-manager a {
  margin-top: auto;
  min-height: 44px;
  height: auto;
  max-width: 100%;
  white-space: normal;
}
.assistant-help {
  border-top: 1px solid var(--border-soft);
}
.assistant-help + .assistant-help {
  margin-top: 4px;
}
.assistant-address {
  width: 100%;
  padding: 8px;
  font-size: 16px;
  background: var(--background);
  color: var(--foreground);
  border: 1px solid var(--border);
}
@media (max-width: 560px) {
  .assistant-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }
  .assistant-managers {
    grid-template-columns: minmax(0, 1fr);
  }
  .assistant-manager a,
  .assistant-actions > * {
    flex: 1 1 auto;
    justify-content: center;
  }
  .assistant-manager a {
    width: 100%;
  }
}
</style>
