<script setup lang="ts">
import { t, getDisplayLocale } from '@/i18n'

import CheckField from '@/components/primitives/CheckField.vue'
import MediaImage from '@/components/primitives/MediaImage.vue'
import IconFrame from '@/components/primitives/IconFrame.vue'
import TagChip from '@/components/primitives/TagChip.vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { bookItem } from '@/core/model/book/bookOutput'
import { getTagDisplayInfo } from '@/core/common/tagTranslations'
import {
  Image as Picture,
  Star,
  Star as StarFilled,
  Clock,
  TrendingUp as TrendCharts,
} from '@lucide/vue'
import CategoryTag from './CategoryTag.vue'

interface Props {
  book: bookItem
  selectable?: boolean
  selected?: boolean
  favoritedAt?: Date
  favoriteCategoryName?: string
  rank?: number
  score?: number
}

const props = withDefaults(defineProps<Props>(), {
  selectable: false,
  selected: false,
  favoriteCategoryName: '',
})
const emit = defineEmits<{
  'update:selected': [value: boolean]
}>()
const router = useRouter()
const itemElement = ref<HTMLElement>()
const coverRatio = ref(props.book.thumbnailAspectRatio || 3 / 4)
let sizeObserver: ResizeObserver | undefined
onMounted(() => {
  sizeObserver = new ResizeObserver(() => {
    const element = itemElement.value
    if (element?.parentElement?.classList.contains('gallery-masonry')) {
      const gap = window.innerWidth < 768 ? 22 : 26
      element.style.gridRowEnd = `span ${Math.ceil((element.getBoundingClientRect().height + gap) / 4)}`
    }
  })
  if (itemElement.value) sizeObserver.observe(itemElement.value)
})
onUnmounted(() => sizeObserver?.disconnect())
function coverLoaded(event: Event) {
  const image = event.target as HTMLImageElement
  if (image.naturalWidth && image.naturalHeight)
    coverRatio.value = image.naturalWidth / image.naturalHeight
}

// 格式化图片数量
const imageCountText = computed(() => {
  return t('{p0} 张', { p0: props.book.imgCount || 0 })
})

const displayTags = computed(() => {
  const officialTags = props.book.tags.flatMap((collection) =>
    collection.items
      .filter((tag) => tag.official)
      .map((tag) => ({
        key: `${collection.collection}:${tag.name}`,
        text: getTagDisplayInfo(collection.collection, tag).text,
      })),
  )
  const currentFallbackTags = props.book.tags.flatMap((collection) => {
    const selectedTag = collection.items.find((tag) => tag.official) ?? collection.items[0]
    return selectedTag
      ? [
          {
            key: `${collection.collection}:${selectedTag.name}`,
            text: getTagDisplayInfo(collection.collection, selectedTag).text,
          },
        ]
      : []
  })
  const seen = new Set<string>()
  const candidates =
    officialTags.length >= 3 ? officialTags : [...officialTags, ...currentFallbackTags]

  return candidates.filter((tag) => {
    if (!tag.text || seen.has(tag.key)) {
      return false
    }
    seen.add(tag.key)
    return true
  })
})

const visibleTags = computed(() => {
  return displayTags.value.slice(0, 3)
})

const hiddenTagCount = computed(() => {
  return Math.max(displayTags.value.length - visibleTags.value.length, 0)
})

const scoreText = computed(() => {
  return props.score === undefined ? '' : props.score.toLocaleString(getDisplayLocale())
})

const favoritedTimeText = computed(() => {
  if (!props.favoritedAt) return ''
  return props.favoritedAt.toLocaleString(getDisplayLocale(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
})

const handleClick = () => {
  router.push({
    name: 'bookinfo',
    query: { bookId: props.book.bookId },
  })
}

const handleSelectionChange = (value: boolean | string | number) => {
  emit('update:selected', Boolean(value))
}
</script>

<template>
  <article
    ref="itemElement"
    class="book-item"
    :class="{ 'is-selected': selected }"
    role="link"
    tabindex="0"
    :aria-label="t('查看《{p0}》', { p0: book.bookTitle })"
    @click="handleClick"
    @keydown.enter.self.prevent="handleClick"
    @keydown.space.self.prevent="handleClick"
  >
    <CheckField
      v-if="selectable"
      class="book-selection"
      :model-value="selected"
      :aria-label="t('选择画册')"
      @click.stop
      @change="handleSelectionChange"
    />
    <!-- 左侧封面图片 -->
    <div class="book-cover" :style="{ aspectRatio: coverRatio }">
      <span v-if="rank" class="book-rank">#{{ rank }}</span>
      <MediaImage
        :src="book.thumbnailUrl"
        :alt="book.bookTitle"
        fit="contain"
        class="cover-image"
        lazy
        @load="coverLoaded"
      />
    </div>

    <!-- 右侧信息 -->
    <div class="book-info">
      <!-- 标题 -->
      <div class="book-title" :title="t(book.bookTitle)">
        {{ book.bookTitle }}
      </div>

      <!-- 元数据 -->
      <div class="book-meta">
        <div class="meta-item">
          <IconFrame :size="14">
            <Picture />
          </IconFrame>
          <span>{{ t(imageCountText) }}</span>
        </div>

        <CategoryTag v-if="book.category" :category="book.category" />

        <div v-if="book.rate" class="meta-item">
          <IconFrame :size="14">
            <Star />
          </IconFrame>
          <span>{{ book.rate?.toFixed(1) }}</span>
        </div>

        <div v-if="score !== undefined" class="meta-item ranking-score">
          <IconFrame :size="14">
            <TrendCharts />
          </IconFrame>
          <span>{{ t(scoreText) }}</span>
        </div>
      </div>

      <!-- 标签 -->
      <div class="book-tags" v-if="visibleTags.length > 0">
        <TagChip
          v-for="tag in visibleTags"
          :key="tag.key"
          size="small"
          tone="info"
          class="tag-item"
          effect="plain"
        >
          <span class="tag-text">
            {{ tag.text }}
          </span>
        </TagChip>
        <TagChip
          v-if="hiddenTagCount > 0"
          size="small"
          tone="info"
          class="tag-item tag-more"
          effect="plain"
        >
          <span class="tag-text">+{{ hiddenTagCount }}</span>
        </TagChip>
      </div>

      <!-- 上传时间 -->
      <div v-if="book.publishDate || favoritedTimeText" class="book-time-row">
        <div class="book-time" v-if="book.publishDate">
          <IconFrame :size="12">
            <Clock />
          </IconFrame>
          <span>{{ book.publishDate.toLocaleDateString(getDisplayLocale()) }}</span>
        </div>
        <div
          v-if="favoritedTimeText"
          class="book-time favorite-time"
          :title="t(favoriteCategoryName)"
        >
          <IconFrame :size="12">
            <StarFilled />
          </IconFrame>
          <span>{{ t(favoritedTimeText) }}</span>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.book-item {
  align-self: start;
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;
  cursor: pointer;
  padding: 0 0 16px;
  border-bottom: 1px solid var(--border-soft);
  outline-offset: 5px;
}
.book-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  background: var(--muted-soft);
  overflow: hidden;
  border-radius: 3px 7px 7px 3px;
  box-shadow: 2px 4px 10px #152d3b0b;
  transition:
    transform var(--motion-fast) var(--ease),
    box-shadow var(--motion-fast);
}
.book-cover::after {
  content: '';
  position: absolute;
  inset: 0;
  box-shadow:
    inset 2px 0 3px #fff3,
    inset 5px 0 6px #00000006;
  pointer-events: none;
}
.book-item:hover .book-cover {
  transform: translateY(-2px);
  box-shadow: 2px 8px 16px #152d3b15;
}
.book-item.is-selected .book-cover {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.cover-image {
  width: 100%;
  height: 100%;
}
.book-selection {
  position: absolute;
  top: 5px;
  left: 8px;
  z-index: 3;
  background: var(--glass);
  border-radius: 4px;
  padding: 0 7px;
}
.book-rank {
  position: absolute;
  z-index: 2;
  right: 8px;
  top: 8px;
  color: var(--accent);
  background: var(--glass);
  border: 1px solid var(--glass-edge);
  border-radius: 4px;
  padding: 3px 6px;
  font-size: 11px;
  backdrop-filter: blur(8px);
}
.book-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding-top: 13px;
}
.book-title {
  color: var(--foreground);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 42px;
}
.book-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px 10px;
}
.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--muted-foreground);
  font-size: 11px;
}
.ranking-score {
  color: var(--accent);
}
.book-tags {
  display: flex;
  flex-wrap: nowrap;
  min-width: 0;
  overflow: hidden;
  gap: 5px;
}
.tag-item {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 110px;
}
.tag-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
  font-size: 10px;
}
.tag-more {
  flex-shrink: 0;
}
.book-time-row {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 12px;
}
.book-time {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--muted-foreground);
  font-size: 10px;
}
.favorite-time {
  color: var(--accent);
}
@media (max-width: 767px) {
  .book-info {
    gap: 7px;
    padding-top: 10px;
  }
  .book-title {
    font-size: 13px;
    min-height: 39px;
  }
  .book-meta {
    gap: 5px 8px;
  }
  .meta-item {
    font-size: 10px;
  }
  .tag-item {
    padding: 3px 5px;
  }
}
</style>
