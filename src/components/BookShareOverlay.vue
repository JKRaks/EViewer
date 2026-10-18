<script setup lang="ts">
import { t, locale } from '@/i18n'

import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle } from 'reka-ui'
import ActionButton from '@/components/primitives/ActionButton.vue'
import IconFrame from '@/components/primitives/IconFrame.vue'
import ChoiceGroup from '@/components/primitives/ChoiceGroup.vue'
import RadioChoice from '@/components/primitives/RadioChoice.vue'
import Hint from '@/components/primitives/Hint.vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  X as Close,
  Copy as CopyDocument,
  Download,
  LoaderCircle as Loading,
  Share2 as Share,
} from '@lucide/vue'
import { notify } from '@/components/primitives/feedback'
import type { bookInfoOutput } from '@/core/model/book/bookInfoOutput'
import {
  generateBookShareCard,
  type GeneratedShareCard,
  type ShareQrSource,
} from '@/core/share/bookShareCard'
import { getBookShareUrl } from '@/core/share/bookShareLinks'
import { getLayoutScrollElement, layoutScrollModeChange } from '@/composables/layoutScroll'
import { useShareSettings } from '@/core/share/shareSettings'

const props = defineProps<{
  modelValue: boolean
  book: bookInfoOutput
  coverElement?: HTMLImageElement | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const shareSettings = useShareSettings()
const qrSource = ref<ShareQrSource>(shareSettings.preferredLinkType)
const shareLink = computed(() =>
  props.book.bookId ? getBookShareUrl(props.book, qrSource.value) : '',
)
const generating = ref(false)
const generationError = ref('')
const generated = ref<GeneratedShareCard | null>(null)
const previewUrl = ref('')
const generatedCache = new Map<string, GeneratedShareCard>()
let generationId = 0
let lockedMainElement: HTMLElement | null = null
let previousMainOverflowY = ''
let returnFocus: HTMLElement | null = null

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setBackgroundScrollLocked(true)
      window.addEventListener('pagehide', handlePageHide)
      window.addEventListener(layoutScrollModeChange, handleScrollModeChange)
      if (qrSource.value === shareSettings.preferredLinkType) {
        void renderPreview()
      } else {
        qrSource.value = shareSettings.preferredLinkType
      }
    } else {
      setBackgroundScrollLocked(false)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener(layoutScrollModeChange, handleScrollModeChange)
      generationId++
      generated.value = null
      releasePreviewUrl()
    }
  },
)

watch([qrSource, locale], () => {
  if (props.modelValue) void renderPreview()
})

watch(
  () => props.book.bookId,
  () => {
    clearGeneratedCache()
    if (props.modelValue) void renderPreview()
  },
)

onBeforeUnmount(() => {
  setBackgroundScrollLocked(false)
  window.removeEventListener('pagehide', handlePageHide)
  window.removeEventListener(layoutScrollModeChange, handleScrollModeChange)
  clearGeneratedCache()
})

async function renderPreview() {
  const source = qrSource.value
  const bookId = props.book.bookId
  if (!bookId) {
    generationError.value = t('画册信息尚未加载完成')
    return
  }

  const currentGeneration = ++generationId
  const cacheKey = `${bookId}\u0000${source}\u0000${locale.value}`
  const cached = generatedCache.get(cacheKey)
  if (cached) {
    setGenerated(cached)
    generationError.value = ''
    generating.value = false
    return
  }

  generating.value = true
  generationError.value = ''
  try {
    const result = await generateBookShareCard(props.book, source, props.coverElement)
    if (currentGeneration !== generationId || !props.modelValue || props.book.bookId !== bookId) {
      return
    }
    generatedCache.set(cacheKey, result)
    setGenerated(result)
  } catch (error) {
    if (currentGeneration !== generationId) return
    console.error(t('生成分享卡失败:'), error)
    generationError.value = error instanceof Error ? error.message : t('分享卡生成失败')
  } finally {
    if (currentGeneration === generationId) generating.value = false
  }
}

function setGenerated(result: GeneratedShareCard) {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  generated.value = result
  previewUrl.value = URL.createObjectURL(result.blob)
}

function clearGeneratedCache() {
  generationId++
  generatedCache.clear()
  generated.value = null
  generating.value = false
  releasePreviewUrl()
}

function releasePreviewUrl() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
}

function close() {
  emit('update:modelValue', false)
}

function restoreFocus(event: Event) {
  if (returnFocus?.isConnected) {
    event.preventDefault()
    returnFocus.focus({ preventScroll: true })
  }
}

function handlePageHide() {
  setBackgroundScrollLocked(false)
}

function handleScrollModeChange() {
  setBackgroundScrollLocked(false)
  if (props.modelValue) setBackgroundScrollLocked(true)
}

function setBackgroundScrollLocked(locked: boolean) {
  if (locked) {
    if (lockedMainElement) return
    lockedMainElement = getLayoutScrollElement()
    if (!lockedMainElement) return
    previousMainOverflowY = lockedMainElement.style.overflowY
    lockedMainElement.style.overflowY = 'hidden'
    return
  }

  if (lockedMainElement) {
    lockedMainElement.style.overflowY = previousMainOverflowY
  }
  lockedMainElement = null
  previousMainOverflowY = ''
}

function downloadImage() {
  if (!generated.value) return
  const link = document.createElement('a')
  link.href = previewUrl.value
  link.download = generated.value.filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

async function shareImage() {
  const result = generated.value
  if (!result || !navigator.share) {
    notify.info(t('当前浏览器不支持系统分享，可下载图片后分享'))
    return
  }

  const file = new File([result.blob], result.filename, { type: 'image/png' })
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: props.book.bookName,
        text: t('来自 EViewer 的画册分享'),
      })
    } else {
      await navigator.share({
        title: props.book.bookName,
        text: t('来自 EViewer 的画册分享'),
        url: result.targetUrl,
      })
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    console.error(t('调起系统分享失败:'), error)
    notify.error(t('调起系统分享失败'))
  }
}

async function copyLink() {
  if (!shareLink.value) return
  try {
    await navigator.clipboard.writeText(shareLink.value)
    notify.success(t('分享链接已复制'))
  } catch {
    notify.error(t('复制链接失败'))
  }
}

async function shareLinkWithSystem() {
  if (!shareLink.value) return
  if (!navigator.share) {
    notify.info(t('当前浏览器不支持系统分享，请复制链接'))
    return
  }
  try {
    await navigator.share({ title: props.book.bookName, url: shareLink.value })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    notify.error(t('调起系统分享失败'))
  }
}
</script>

<template>
  <DialogRoot :open="modelValue" @update:open="!$event && close()"
    ><DialogPortal
      ><DialogOverlay class="share-mask" /><DialogContent
        class="share-dialog"
        :aria-describedby="undefined"
        @close-auto-focus="restoreFocus"
        ><DialogTitle class="sr-only">{{ t('画册分享预览') }}</DialogTitle>
        <ActionButton
          class="share-close"
          size="icon"
          :icon="Close"
          :aria-label="t('关闭分享预览')"
          @click="close"
        />

        <div class="share-floating-content" @click.stop>
          <div class="share-preview-stage" aria-live="polite">
            <IconFrame v-if="generating" class="share-loading" :size="36"><Loading /></IconFrame>
            <div v-else-if="generationError" class="share-error">
              <span>{{ t(generationError) }}</span>
              <ActionButton variant="default" @click="renderPreview">{{
                t('重新生成')
              }}</ActionButton>
            </div>
            <img
              v-else-if="previewUrl"
              :src="previewUrl"
              class="share-preview"
              :alt="t('EViewer 画册分享卡预览')"
            />
          </div>

          <div class="share-controls">
            <div class="share-source-control">
              <span class="share-source-label">{{ t('链接类型') }}</span>
              <ChoiceGroup
                v-model="qrSource"
                class="share-source-selector"
                :aria-label="t('链接类型')"
              >
                <RadioChoice value="site">{{ t('本站') }}</RadioChoice>
                <RadioChoice value="source">{{ t('源站') }}</RadioChoice>
              </ChoiceGroup>
            </div>
            <div class="share-action-row">
              <Hint :content="t('下载分享图')" placement="top">
                <ActionButton
                  class="share-action-button"
                  size="icon"
                  :icon="Download"
                  :disabled="!generated || generating"
                  :aria-label="t('下载分享图')"
                  @click="downloadImage"
                />
              </Hint>
              <Hint :content="t('系统分享')" placement="top">
                <ActionButton
                  class="share-action-button"
                  size="icon"
                  :icon="Share"
                  :disabled="!generated || generating"
                  :aria-label="t('系统分享')"
                  @click="shareImage"
                />
              </Hint>
            </div>
          </div>

          <div class="share-link-box">
            <span class="share-link-title">{{ t('分享链接') }}</span>
            <div class="share-link-row">
              <span class="share-link-value" :title="t(shareLink)">{{ shareLink }}</span>
              <Hint :content="t('复制链接')" placement="top">
                <ActionButton
                  :icon="CopyDocument"
                  :aria-label="t('复制分享链接')"
                  :disabled="!shareLink"
                  @click="copyLink"
                />
              </Hint>
              <Hint :content="t('系统分享链接')" placement="top">
                <ActionButton
                  :icon="Share"
                  :aria-label="t('系统分享链接')"
                  :disabled="!shareLink"
                  @click="shareLinkWithSystem"
                />
              </Hint>
            </div>
          </div>
        </div> </DialogContent></DialogPortal
  ></DialogRoot>
</template>

<style scoped>
.share-dialog {
  position: fixed;
  z-index: 4001;
  inset: 0;
  display: grid;
  place-items: center;
  overflow-y: auto;
  padding: 60px 20px 28px;
  outline: none;
}
.share-mask {
  position: fixed;
  inset: 0;
  z-index: 4000;
  display: grid;
  place-items: center;
  padding: max(56px, env(safe-area-inset-top)) 24px max(28px, env(safe-area-inset-bottom));
  overflow: auto;
  background: var(--overlay);
}

.share-close {
  position: fixed;
  top: max(18px, env(safe-area-inset-top));
  right: max(18px, env(safe-area-inset-right));
  z-index: 2;
  width: 44px;
  height: 44px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: var(--foreground);
  background: var(--glass);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.share-close:hover,
.share-close:focus-visible {
  border-color: var(--accent-ring);
  color: var(--accent);
  background: var(--accent-soft);
}

.share-floating-content {
  display: flex;
  width: min(1100px, calc(100vw - 48px));
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.share-preview-stage {
  display: grid;
  width: 100%;
  min-height: min(50vh, 360px);
  place-items: center;
}

.share-preview {
  display: block;
  width: 100%;
  max-height: calc(100dvh - 350px);
  object-fit: contain;
  filter: drop-shadow(0 24px 44px rgba(0, 0, 0, 0.34));
}

.share-loading {
  color: #fff;
  animation: share-rotate 1s linear infinite;
}

.share-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  color: #fff;
  text-align: center;
}

.share-controls {
  display: flex;
  width: min(320px, 100%);
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--glass-edge);
  border-radius: 12px;
  color: var(--foreground);
  background: var(--glass);
  backdrop-filter: blur(10px);
}

.share-link-box {
  position: relative;
  isolation: isolate;
  width: min(560px, 100%);
  min-width: 0;
  padding: 10px 12px;
  border: 0;
  border-radius: 8px;
  color: var(--foreground);
  background: var(--glass);
  backdrop-filter: blur(10px);
}

.share-link-title {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
}

.share-link-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.share-link-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  user-select: all;
}

.share-link-row :deep(.ui-button + .ui-button) {
  margin-left: 0;
}

.share-source-control {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.share-source-label {
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
}

.share-source-selector {
  display: flex;
  gap: 24px;
}

.share-source-selector :deep(.ui-radio) {
  display: flex;
  height: 32px;
  margin: 0;
  color: var(--foreground);
}

.share-action-row {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
}

.share-action-button {
  width: 46px;
  height: 46px;
  border-color: var(--accent);
  color: var(--accent-foreground);
  background: var(--accent);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
}

.share-action-button:hover,
.share-action-button:focus-visible {
  border-color: var(--accent-strong);
  color: var(--accent-foreground);
  background: var(--accent-strong);
}

.share-dialog[data-state='open'] {
  animation: share-reveal var(--motion-panel) var(--ease);
}
.share-dialog[data-state='closed'] {
  animation: share-reveal var(--motion-panel) var(--ease) reverse;
}
.share-mask[data-state='open'] {
  animation: share-fade var(--motion-panel) var(--ease);
}
.share-mask[data-state='closed'] {
  animation: share-fade var(--motion-panel) var(--ease) reverse;
}
@keyframes share-reveal {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes share-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes share-rotate {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 600px) {
  .share-mask {
    padding: max(64px, env(safe-area-inset-top)) 12px max(20px, env(safe-area-inset-bottom));
  }

  .share-floating-content {
    width: calc(100vw - 24px);
    gap: 18px;
  }

  .share-preview-stage {
    min-height: 180px;
  }

  .share-preview {
    max-height: calc(100dvh - 330px);
  }

  .share-controls {
    width: 100%;
    gap: 14px;
    padding-inline: 48px;
  }

  .share-link-box {
    width: 100%;
  }

  .share-action-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .share-action-button {
    justify-self: center;
  }

  .share-action-button + .share-action-button {
    margin-left: 0;
  }
}
</style>
