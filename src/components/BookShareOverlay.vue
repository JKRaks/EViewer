<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
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
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const qrSource = ref<ShareQrSource>('site')
const generating = ref(false)
const generationError = ref('')
const generated = ref<GeneratedShareCard | null>(null)
const previewUrl = ref('')
const generatedCache = new Map<ShareQrSource, GeneratedShareCard>()
let generationId = 0
let previousBodyOverflow = ''

const supportsSystemShare = computed(() => typeof navigator !== 'undefined' && !!navigator.share)
const qrOptions = [
  { label: '本站', value: 'site' },
  { label: '源站', value: 'source' },
]

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      previousBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeydown)
      void renderPreview()
    } else {
      document.body.style.overflow = previousBodyOverflow
      window.removeEventListener('keydown', handleKeydown)
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
  () => clearGeneratedCache(),
)

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow
  window.removeEventListener('keydown', handleKeydown)
  clearGeneratedCache()
})

async function renderPreview() {
  const source = qrSource.value
  const currentGeneration = ++generationId
  const cached = generatedCache.get(source)
  if (cached) {
    setGenerated(cached)
    generationError.value = ''
    generating.value = false
    return
  }

  generating.value = true
  generationError.value = ''
  try {
    const result = await generateBookShareCard(props.book, source)
    if (currentGeneration !== generationId || !props.modelValue) return
    generatedCache.set(source, result)
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
  generatedCache.clear()
  generated.value = null
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
            <el-segmented
              v-model="qrSource"
              :options="qrOptions"
              class="share-source-selector"
              aria-label="二维码链接来源"
            />
            <el-tooltip content="下载分享图" placement="top">
              <el-button
                class="share-control-button"
                circle
                :icon="Download"
                :disabled="!generated || generating"
                aria-label="下载分享图"
                @click="downloadImage"
              />
            </el-tooltip>
            <el-button
              v-if="supportsSystemShare"
              class="share-system-button"
              type="primary"
              round
              :icon="Share"
              :disabled="!generated || generating"
              @click="shareImage"
            >
              系统分享
            </el-button>
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
  background: rgba(7, 17, 18, 0.84);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
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
  background: rgba(12, 31, 32, 0.68);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(8px);
}

.share-close:hover,
.share-close:focus-visible {
  border-color: rgba(255, 255, 255, 0.7);
  color: #fff;
  background: rgba(20, 69, 68, 0.9);
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
  min-height: 44px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.share-source-selector {
  --el-segmented-bg-color: rgba(245, 250, 249, 0.16);
  --el-segmented-item-selected-bg-color: #f5faf9;
  --el-segmented-item-selected-color: #176d69;
  --el-segmented-item-hover-bg-color: rgba(245, 250, 249, 0.24);
  padding: 4px;
  color: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.22);
  backdrop-filter: blur(8px);
}

.share-control-button,
.share-system-button {
  height: 44px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
}

.share-control-button {
  width: 44px;
  border-color: rgba(255, 255, 255, 0.25);
  color: #fff;
  background: rgba(245, 250, 249, 0.14);
  backdrop-filter: blur(8px);
}

.share-control-button:hover,
.share-control-button:focus-visible {
  border-color: rgba(255, 255, 255, 0.65);
  color: #fff;
  background: rgba(245, 250, 249, 0.24);
}

.share-system-button {
  padding-inline: 18px;
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
