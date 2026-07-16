<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { Close, Download, Loading, Share } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import 'element-plus/es/components/message/style/css'
import type { bookInfoOutput } from '@/core/model/book/bookInfoOutput'
import {
  generateBookShareCard,
  type GeneratedShareCard,
  type ShareQrSource,
} from '@/core/share/bookShareCard'

const props = defineProps<{
  modelValue: boolean
  book: bookInfoOutput
  coverElement?: HTMLImageElement | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const qrSource = ref<ShareQrSource>('site')
const generating = ref(false)
const generationError = ref('')
const generated = ref<GeneratedShareCard | null>(null)
const previewUrl = ref('')
const generatedCache = new Map<string, GeneratedShareCard>()
let generationId = 0
let lockedMainElement: HTMLElement | null = null
let previousMainOverflowY = ''

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      setBackgroundScrollLocked(true)
      window.addEventListener('keydown', handleKeydown)
      window.addEventListener('pagehide', handlePageHide)
      void renderPreview()
    } else {
      setBackgroundScrollLocked(false)
      window.removeEventListener('keydown', handleKeydown)
      window.removeEventListener('pagehide', handlePageHide)
      generationId++
      generated.value = null
      releasePreviewUrl()
    }
  },
)

watch(qrSource, () => {
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
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('pagehide', handlePageHide)
  clearGeneratedCache()
})

async function renderPreview() {
  const source = qrSource.value
  const bookId = props.book.bookId
  if (!bookId) {
    generationError.value = '画册信息尚未加载完成'
    return
  }

  const currentGeneration = ++generationId
  const cacheKey = `${bookId}\u0000${source}`
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
    console.error('生成分享卡失败:', error)
    generationError.value = error instanceof Error ? error.message : '分享卡生成失败'
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

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

function handlePageHide() {
  setBackgroundScrollLocked(false)
}

function setBackgroundScrollLocked(locked: boolean) {
  if (locked) {
    if (lockedMainElement) return
    lockedMainElement = document.querySelector<HTMLElement>('.layout-main')
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
    ElMessage.info('当前浏览器不支持系统分享，可下载图片后分享')
    return
  }

  const file = new File([result.blob], result.filename, { type: 'image/png' })
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: props.book.bookName,
        text: '来自 EViewer 的画册分享',
      })
    } else {
      await navigator.share({
        title: props.book.bookName,
        text: '来自 EViewer 的画册分享',
        url: result.targetUrl,
      })
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    console.error('调起系统分享失败:', error)
    ElMessage.error('调起系统分享失败')
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="share-overlay">
      <div
        v-if="modelValue"
        class="share-mask"
        role="dialog"
        aria-modal="true"
        aria-label="画册分享预览"
        @click.self="close"
      >
        <el-button
          class="share-close"
          circle
          :icon="Close"
          aria-label="关闭分享预览"
          @click="close"
        />

        <div class="share-floating-content" @click.stop>
          <div class="share-preview-stage" aria-live="polite">
            <el-icon v-if="generating" class="share-loading" :size="36"><Loading /></el-icon>
            <div v-else-if="generationError" class="share-error">
              <span>{{ generationError }}</span>
              <el-button type="primary" @click="renderPreview">重新生成</el-button>
            </div>
            <img
              v-else-if="previewUrl"
              :src="previewUrl"
              class="share-preview"
              alt="EViewer 画册分享卡预览"
            />
          </div>

          <div class="share-controls">
            <el-radio-group
              v-model="qrSource"
              class="share-source-selector"
              aria-label="二维码链接来源"
            >
              <el-radio value="site">本站</el-radio>
              <el-radio value="source">源站</el-radio>
            </el-radio-group>
            <div class="share-action-row">
              <el-tooltip content="下载分享图" placement="top">
                <el-button
                  class="share-action-button"
                  circle
                  :icon="Download"
                  :disabled="!generated || generating"
                  aria-label="下载分享图"
                  @click="downloadImage"
                />
              </el-tooltip>
              <el-tooltip content="系统分享" placement="top">
                <el-button
                  class="share-action-button"
                  circle
                  :icon="Share"
                  :disabled="!generated || generating"
                  aria-label="系统分享"
                  @click="shareImage"
                />
              </el-tooltip>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.share-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: grid;
  place-items: center;
  padding: max(56px, env(safe-area-inset-top)) 24px max(28px, env(safe-area-inset-bottom));
  overflow: auto;
  background: var(--el-overlay-color-lighter);
}

.share-close {
  position: fixed;
  top: max(18px, env(safe-area-inset-top));
  right: max(18px, env(safe-area-inset-right));
  z-index: 2;
  width: 44px;
  height: 44px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
  background: rgba(32, 49, 75, 0.72);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(8px);
}

.share-close:hover,
.share-close:focus-visible {
  border-color: rgba(255, 255, 255, 0.7);
  color: #fff;
  background: rgba(64, 158, 255, 0.9);
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
  max-height: calc(100dvh - 190px);
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
}

.share-source-selector {
  display: flex;
  width: 100%;
  gap: 12px;
}

.share-source-selector :deep(.el-radio) {
  display: flex;
  min-width: 0;
  height: 44px;
  flex: 1;
  justify-content: center;
  margin: 0;
  padding: 0 16px;
  border: 1px solid rgba(255, 255, 255, 0.26);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.08);
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    box-shadow 0.18s ease;
}

.share-source-selector :deep(.el-radio:hover) {
  border-color: rgba(255, 255, 255, 0.52);
  background: rgba(255, 255, 255, 0.13);
}

.share-source-selector :deep(.el-radio.is-checked) {
  border-color: var(--el-color-primary);
  background: rgba(64, 158, 255, 0.18);
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.16);
}

.share-source-selector :deep(.el-radio__inner) {
  width: 18px;
  height: 18px;
}

.share-source-selector :deep(.el-radio__inner::after) {
  width: 6px;
  height: 6px;
}

.share-source-selector :deep(.el-radio__label) {
  padding-left: 8px;
  color: inherit;
  font-size: 15px;
  font-weight: 600;
}

.share-source-selector :deep(.el-radio__input.is-checked .el-radio__inner) {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary);
}

.share-source-selector :deep(.el-radio__input.is-checked + .el-radio__label) {
  color: #fff;
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
  border-color: var(--el-color-primary);
  color: #fff;
  background: var(--el-color-primary);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
}

.share-action-button:hover,
.share-action-button:focus-visible {
  border-color: var(--el-color-primary-dark-2);
  color: #fff;
  background: var(--el-color-primary-dark-2);
}

.share-overlay-enter-active,
.share-overlay-leave-active {
  transition: opacity 0.2s ease;
}

.share-overlay-enter-active .share-floating-content,
.share-overlay-leave-active .share-floating-content {
  transition: transform 0.2s ease;
}

.share-overlay-enter-from,
.share-overlay-leave-to {
  opacity: 0;
}

.share-overlay-enter-from .share-floating-content,
.share-overlay-leave-to .share-floating-content {
  transform: translateY(12px);
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
    gap: 16px;
  }

  .share-preview-stage {
    min-height: 180px;
  }

  .share-preview {
    max-height: calc(100dvh - 210px);
  }

  .share-controls {
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

@media (prefers-reduced-motion: reduce) {
  .share-overlay-enter-active,
  .share-overlay-leave-active,
  .share-overlay-enter-active .share-floating-content,
  .share-overlay-leave-active .share-floating-content {
    transition: none;
  }
}
</style>
