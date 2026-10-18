<script setup lang="ts">
import { computed, onDeactivated, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Search } from '@lucide/vue'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent, PopoverClose } from 'reka-ui'
import { Button } from '@/components/ui/button'
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
        side="top"
        align="start"
        :side-offset="8"
        :collision-padding="12"
        class="gallery-tag-popover data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
      >
        <p class="gallery-tag-name">{{ display.text }}</p>
        <p class="gallery-tag-origin">{{ namespace }}:{{ tag.name }}</p>
        <PopoverClose as-child>
          <Button as-child variant="outline" size="sm" class="ui-button gallery-tag-search">
            <RouterLink :to="searchRoute">
              <Search :size="16" aria-hidden="true" />
              {{ t('搜索此标签') }}
            </RouterLink>
          </Button>
        </PopoverClose>
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
  z-index: 60;
  min-width: 180px;
  max-width: min(320px, calc(100vw - 24px));
  max-height: var(--reka-popover-content-available-height);
  overflow-y: auto;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  color: var(--popover-foreground);
  background: var(--popover);
  box-shadow: var(--shadow);
  transform-origin: var(--reka-popover-content-transform-origin);
}
.gallery-tag-name {
  margin: 0;
  font-weight: 500;
  overflow-wrap: anywhere;
}
.gallery-tag-origin {
  margin: 2px 0 12px;
  color: var(--muted-foreground);
  font-size: 12px;
  overflow-wrap: anywhere;
}
.gallery-tag-search {
  width: 100%;
  text-decoration: none;
}
</style>
