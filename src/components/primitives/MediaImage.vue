<script setup lang="ts">
import { t } from '@/i18n'

import { ref, watch, type ImgHTMLAttributes } from 'vue'
import { ImageOff } from '@lucide/vue'
import ModalPanel from './ModalPanel.vue'
import { Plus, Minus, RotateCcw } from '@lucide/vue'
import ActionButton from './ActionButton.vue'
defineOptions({ inheritAttrs: false })
const props = withDefaults(
  defineProps<{
    src?: string
    fit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
    lazy?: boolean
    alt?: string
    previewSrcList?: string[]
    zoomRate?: number
    minScale?: number
    maxScale?: number
    crossorigin?: '' | 'anonymous' | 'use-credentials'
    referrerpolicy?: ImgHTMLAttributes['referrerpolicy']
  }>(),
  { alt: '', fit: 'contain', zoomRate: 1.2, minScale: 0.2, maxScale: 7 },
)
const emit = defineEmits<{ load: [event: Event]; error: [event: Event] }>()
const failed = ref(false)
const loaded = ref(false)
const previewOpen = ref(false)
const scale = ref(1)
const baseWidth = ref(500)
const canvas = ref<HTMLElement>()
let pan: { x: number; y: number; left: number; top: number } | undefined
watch(
  () => props.src,
  () => {
    failed.value = false
    loaded.value = false
    previewOpen.value = false
  },
)
function preview() {
  if (props.previewSrcList?.length && !failed.value) {
    scale.value = 1
    previewOpen.value = true
  }
}
function fitPreview(event: Event) {
  const image = event.target as HTMLImageElement
  baseWidth.value = Math.min(
    window.innerWidth - 80,
    880,
    (window.innerHeight * 0.64 * image.naturalWidth) / image.naturalHeight,
  )
}
function startPan(event: PointerEvent) {
  if (!canvas.value || scale.value <= 1 || event.pointerType !== 'mouse') return
  pan = {
    x: event.clientX,
    y: event.clientY,
    left: canvas.value.scrollLeft,
    top: canvas.value.scrollTop,
  }
  canvas.value.setPointerCapture(event.pointerId)
}
function movePan(event: PointerEvent) {
  if (!pan || !canvas.value) return
  canvas.value.scrollLeft = pan.left - (event.clientX - pan.x)
  canvas.value.scrollTop = pan.top - (event.clientY - pan.y)
}
function imageLoaded(event: Event) {
  loaded.value = true
  emit('load', event)
}
function imageFailed(event: Event) {
  failed.value = true
  emit('error', event)
}
</script>
<template>
  <div
    v-bind="$attrs"
    class="ui-image"
    :role="previewSrcList?.length ? 'button' : undefined"
    :tabindex="previewSrcList?.length ? 0 : undefined"
    :aria-label="previewSrcList?.length ? t('放大查看封面') : undefined"
    @click="preview"
    @keydown.enter.self.prevent="preview"
    @keydown.space.self.prevent="preview"
  >
    <img
      v-if="src && !failed"
      :key="src"
      class="ui-image__inner"
      :src="src"
      :crossorigin="crossorigin"
      :referrerpolicy="referrerpolicy"
      :alt="alt"
      :loading="lazy ? 'lazy' : 'eager'"
      decoding="async"
      :style="{ objectFit: fit }"
      @load="imageLoaded"
      @error="imageFailed"
    />
    <div v-else class="ui-image__error">
      <slot name="error"><ImageOff :size="24" :aria-label="t('图片暂不可用')" /></slot>
    </div>
    <span v-if="!loaded && !failed && $slots.placeholder" class="ui-image__placeholder"
      ><slot name="placeholder"
    /></span>
  </div>
  <ModalPanel
    v-if="previewOpen"
    v-model="previewOpen"
    :title="t('查看封面')"
    width="min(960px, calc(100vw - 24px))"
    ><div
      ref="canvas"
      class="image-preview-canvas"
      @pointerdown="startPan"
      @pointermove="movePan"
      @pointerup="pan = undefined"
      @pointercancel="pan = undefined"
    >
      <img
        :src="previewSrcList?.[0]"
        :alt="alt"
        draggable="false"
        :style="{ width: `${baseWidth * scale}px` }"
        @load="fitPreview"
      />
    </div>
    <template #footer
      ><ActionButton
        :icon="Minus"
        :disabled="scale <= minScale"
        :aria-label="t('缩小封面')"
        @click="scale = Math.max(minScale, scale / zoomRate)" /><span class="image-preview-scale"
        >{{ Math.round(scale * 100) }}%</span
      ><ActionButton
        :icon="Plus"
        :disabled="scale >= maxScale"
        :aria-label="t('放大封面')"
        @click="scale = Math.min(maxScale, scale * zoomRate)" /><ActionButton
        :icon="RotateCcw"
        :aria-label="t('重置封面缩放')"
        @click="scale = 1" /></template
  ></ModalPanel>
</template>
<style scoped>
.image-preview-canvas {
  width: 100%;
  height: 66dvh;
  overflow: auto;
  cursor: grab;
}
.image-preview-canvas img {
  display: block;
  max-width: none;
  height: auto;
  margin: auto;
}
.image-preview-scale {
  align-self: center;
  font-size: 12px;
  color: var(--muted-foreground);
}
</style>
