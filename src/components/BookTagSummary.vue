<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import TagChip from '@/components/primitives/TagChip.vue'
import type { tagCollection } from '@/core/model/book/tag'
import { getTagDisplayInfo } from '@/core/common/tagTranslations'
import { fitGallerySummaryTags, getGallerySummaryTags } from '@/core/books/galleryTagSummary'

const props = defineProps<{ tags: tagCollection[] }>()
const element = ref<HTMLElement>()
const measurement = ref<HTMLElement>()
const fittedWidths = ref<number[]>()
const orderedTags = computed(() => getGallerySummaryTags(props.tags))
const candidates = computed(() =>
  orderedTags.value.slice(0, 3).map((entry) => ({
    key: entry.key,
    text: getTagDisplayInfo(entry.collection, entry.tag).text,
  })),
)
const visibleTags = computed(() => candidates.value.slice(0, fittedWidths.value?.length ?? 3))
const hiddenCount = computed(() => orderedTags.value.length - visibleTags.value.length)
let observer: ResizeObserver | undefined

function measureTags() {
  if (!element.value || !measurement.value || element.value.clientWidth <= 0) return
  const naturalWidths = Array.from(
    measurement.value.querySelectorAll<HTMLElement>('[data-tag-probe]'),
  ).map((tag) => tag.getBoundingClientRect().width)
  const counterWidth =
    measurement.value.querySelector<HTMLElement>('.tag-more')?.getBoundingClientRect().width ?? 0
  const widths = fitGallerySummaryTags(
    naturalWidths,
    element.value.clientWidth,
    orderedTags.value.length,
    counterWidth,
  )
  if (
    widths.length !== fittedWidths.value?.length ||
    widths.some((width, index) => width !== fittedWidths.value?.[index])
  ) {
    fittedWidths.value = widths
  }
}

function observeMeasurements() {
  observer?.disconnect()
  if (!element.value || !measurement.value || !observer) return
  observer.observe(element.value)
  // Intrinsic probes also resize when a font or an asynchronous translation arrives.
  for (const tag of measurement.value.children) observer.observe(tag)
  measureTags()
}

onMounted(() => {
  observer = new ResizeObserver(measureTags)
  observeMeasurements()
})
watch([candidates, () => orderedTags.value.length], observeMeasurements, { flush: 'post' })
onUnmounted(() => observer?.disconnect())
</script>

<template>
  <div v-show="orderedTags.length" ref="element" class="book-tags">
    <TagChip
      v-for="(tag, index) in visibleTags"
      :key="tag.key"
      tone="info"
      class="tag-item"
      :title="tag.text"
      :style="fittedWidths ? { width: `${fittedWidths[index]}px` } : undefined"
    >
      <span class="tag-text">{{ tag.text }}</span>
    </TagChip>
    <TagChip v-if="hiddenCount > 0" tone="info" class="tag-item tag-more"
      >+{{ hiddenCount }}</TagChip
    >
    <span ref="measurement" class="tag-measurement" aria-hidden="true">
      <TagChip
        v-for="tag in candidates"
        :key="tag.key"
        data-tag-probe
        tone="info"
        class="tag-item tag-probe"
        ><span class="tag-text">{{ tag.text }}</span></TagChip
      >
      <TagChip tone="info" class="tag-item tag-more tag-probe">+{{ orderedTags.length }}</TagChip>
    </span>
  </div>
</template>

<style scoped>
.book-tags {
  position: relative;
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
}
.tag-item {
  flex: none;
  min-width: 0;
  max-width: 110px;
  padding: 2px 5px;
  font-size: 11px;
  line-height: 1.5;
}
.tag-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tag-more {
  max-width: 100%;
  font-variant-numeric: tabular-nums;
}
.tag-measurement {
  position: absolute;
  inset: 0 auto auto 0;
  display: flex;
  width: max-content;
  visibility: hidden;
  pointer-events: none;
}
.tag-probe {
  max-width: none;
}
</style>
