<script setup lang="ts">
import { computed, onDeactivated, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Search } from '@lucide/vue'
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverPortal,
  PopoverContent,
  PopoverClose,
  PopoverArrow,
} from 'reka-ui'
import TagChip from '@/components/primitives/TagChip.vue'
import { createGalleryTagSearchRoute } from '@/core/books/gallerySearchState'
import { getTagDisplayInfo } from '@/core/common/tagTranslations'
import type { tagItem } from '@/core/model/book/tag'
import { t } from '@/i18n'

const props = defineProps<{ namespace: string; tag: tagItem }>()
const open = ref(false)
const display = computed(() => getTagDisplayInfo(props.namespace, props.tag))
const searchRoute = computed(() =>
  createGalleryTagSearchRoute(props.namespace, props.tag, display.value.text),
)

// 详情页会被 KeepAlive 缓存，离开时一并关闭挂在 body 下的弹层。
onDeactivated(() => (open.value = false))
</script>

<template>
  <PopoverRoot v-model:open="open" :modal="false">
    <PopoverTrigger as-child>
      <button type="button" class="gallery-tag-trigger">
        <TagChip
          class="gallery-tag-chip"
          :class="{ 'is-unofficial': !tag.official }"
          :tone="tag.official ? 'primary' : 'info'"
        >
          <span class="gallery-tag-label">{{ display.text }}</span>
        </TagChip>
      </button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        as-child
        side="top"
        align="start"
        :side-offset="8"
        :collision-padding="12"
      >
        <div class="gallery-tag-popover" :aria-label="display.text">
          <span class="gallery-tag-identity"
            ><span class="gallery-tag-namespace">{{ namespace }}:</span>{{ tag.name }}</span
          >
          <PopoverClose as-child>
            <RouterLink
              :to="searchRoute"
              class="gallery-tag-search"
              :aria-label="t('搜索此标签')"
              :title="t('搜索此标签')"
            >
              <Search :size="16" aria-hidden="true" />
            </RouterLink>
          </PopoverClose>
          <PopoverArrow :width="10" :height="5" class="gallery-tag-arrow" />
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style scoped>
.gallery-tag-trigger {
  display: inline-flex;
  min-width: 0;
  max-width: min(320px, 100%);
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  text-align: start;
}
.gallery-tag-chip {
  max-width: 100%;
  border: 1px solid transparent;
}
.gallery-tag-chip :deep(.ui-tag__content) {
  display: block;
  min-width: 0;
  max-width: 100%;
}
.gallery-tag-label {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gallery-tag-chip.is-unofficial {
  border-style: dashed;
  border-color: var(--border);
  color: var(--muted-foreground);
}
.gallery-tag-trigger:hover .gallery-tag-chip,
.gallery-tag-trigger[data-state='open'] .gallery-tag-chip {
  border-color: var(--accent-ring);
}
.gallery-tag-popover {
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 4800;
  width: max-content;
  max-width: min(320px, calc(100vw - 24px));
  max-height: var(--reka-popover-content-available-height);
  padding: 5px 7px 5px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--popover-foreground);
  background: var(--surface-raised);
  box-shadow: var(--shadow-soft);
  font-size: 13px;
  line-height: 1.5;
}
.gallery-tag-identity {
  min-width: 0;
  max-height: calc(var(--reka-popover-content-available-height) - 12px);
  overflow-y: auto;
  overflow-wrap: anywhere;
}
.gallery-tag-namespace {
  color: var(--muted-foreground);
}
.gallery-tag-search {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: 5px;
  color: var(--accent);
  background: var(--accent-soft);
  text-decoration: none;
}
.gallery-tag-search:hover {
  background: var(--muted);
}
.gallery-tag-popover :deep(.gallery-tag-arrow) {
  fill: var(--surface-raised);
}
@media (max-width: 767px), (pointer: coarse) {
  .gallery-tag-search {
    width: 36px;
    height: 36px;
  }
}
</style>
