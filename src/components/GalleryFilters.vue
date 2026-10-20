<script setup lang="ts">
import { t, locale } from '@/i18n'

import { computed, ref } from 'vue'
import SearchTagPicker from './SearchTagPicker.vue'
import SearchConditionChip from './SearchConditionChip.vue'
import ActionButton from './primitives/ActionButton.vue'
import Field from './primitives/Field.vue'
import TextField from './primitives/TextField.vue'
import NumberField from './primitives/NumberField.vue'
import SelectField from './primitives/SelectField.vue'
import CheckField from './primitives/CheckField.vue'
import CheckGroup from './primitives/CheckGroup.vue'
import ToggleField from './primitives/ToggleField.vue'
import SegmentedControl from './primitives/SegmentedControl.vue'
import { galleryTagKey } from '@/core/books/gallerySearchState'
import {
  createGallerySearchCriteria,
  gallerySearchCategories,
  type gallerySearchCriteria,
} from '@/core/model/book/gallerySearchCriteria'
const draft = defineModel<gallerySearchCriteria>({ required: true })
const tagsExpanded = ref(false)
defineProps<{ error?: string }>()
const emit = defineEmits<{ apply: []; cancel: [] }>()
const title = computed({
  get: () => draft.value.titleTerms.join(' '),
  set: (value: string) => {
    draft.value.titleTerms = value.trim() ? [value] : []
  },
})
const allCategories = computed({
  get: () => draft.value.categories.length === 0,
  set: (value: boolean) => {
    if (value) draft.value.categories = []
  },
})
function reset() {
  draft.value = createGallerySearchCriteria({ freeText: draft.value.freeText })
}
</script>
<template>
  <div class="gallery-filters">
    <div class="filters-body">
      <header class="filters-heading">
        <div>
          <h2>{{ t('让结果更合心意') }}</h2>
          <p>{{ t('选择只保留在草稿中，应用后才更新结果。') }}</p>
        </div>
        <ActionButton variant="ghost" size="sm" @click="reset">{{ t('重置筛选') }}</ActionButton>
      </header>
      <Field :label="t('关键词')" class="keyword-field">
        <TextField
          v-model="draft.freeText"
          clearable
          :placeholder="t('标题、标签或关键词')"
          :aria-label="t('筛选关键词')"
          @keydown.enter.prevent="emit('apply')"
        />
      </Field>
      <section class="filter-section category-filter">
        <div class="category-heading">
          <h3>{{ t('分类') }}</h3>
          <Field :label="t('最低评分')" class="rating-field">
            <SelectField
              v-model="draft.minRating"
              clearable
              :placeholder="t('不限')"
              :aria-label="t('最低评分')"
            >
              <option v-for="rating in [2, 3, 4, 5]" :key="rating" :value="rating">
                {{ t('{p0} 星及以上', { p0: rating }) }}
              </option>
            </SelectField>
          </Field>
        </div>
        <div class="filter-categories">
          <CheckField v-model="allCategories">{{ t('全部分类') }}</CheckField>
          <CheckGroup v-model="draft.categories">
            <CheckField
              v-for="[label, value] in gallerySearchCategories"
              :key="value"
              :value="value"
            >
              {{ t(label) }}
            </CheckField>
          </CheckGroup>
        </div>
      </section>
      <details
        class="filter-details tag-filter-details"
        :open="tagsExpanded"
        @toggle="tagsExpanded = ($event.target as HTMLDetailsElement).open"
      >
        <summary>
          <span>{{ t('标签筛选') }}</span>
          <small>{{
            t('包含 {p0} · 排除 {p1}', {
              p0: draft.includeTags.length,
              p1: draft.excludeTags.length,
            })
          }}</small>
        </summary>
        <div class="filter-heading">
          <span>{{ t('匹配方式') }}</span>
          <SegmentedControl
            v-model="draft.tagMode"
            :options="[
              { label: t('包含全部'), value: 'all' },
              { label: t('包含任意'), value: 'any' },
            ]"
          />
        </div>
        <SearchTagPicker
          v-model:include-tags="draft.includeTags"
          v-model:exclude-tags="draft.excludeTags"
        />
      </details>
      <div
        v-if="!tagsExpanded && (draft.includeTags.length || draft.excludeTags.length)"
        class="collapsed-tag-selection"
        :aria-label="t('已选标签')"
      >
        <SearchConditionChip
          v-for="tag in draft.includeTags"
          :key="'include-' + galleryTagKey(tag)"
          :label="locale === 'en' ? tag.master : tag.displayName"
          :title="t('包含 {p0}', { p0: `${tag.namespace}:${tag.master}` })"
          removable
          @remove="
            draft.includeTags = draft.includeTags.filter(
              (item) => galleryTagKey(item) !== galleryTagKey(tag),
            )
          "
        />
        <SearchConditionChip
          v-for="tag in draft.excludeTags"
          :key="'exclude-' + galleryTagKey(tag)"
          :label="locale === 'en' ? tag.master : tag.displayName"
          :title="t('排除 {p0}', { p0: `${tag.namespace}:${tag.master}` })"
          excluded
          removable
          @remove="
            draft.excludeTags = draft.excludeTags.filter(
              (item) => galleryTagKey(item) !== galleryTagKey(tag),
            )
          "
        />
      </div>
      <details class="filter-details" open>
        <summary>{{ t('内容条件') }}</summary>
        <div class="filter-field-grid">
          <Field :label="t('标题')"
            ><TextField v-model="title" clearable :aria-label="t('筛选标题')" /></Field
          ><Field :label="t('上传者')"
            ><TextField v-model="draft.uploader" clearable :aria-label="t('上传者')" /></Field
          ><Field :label="t('上传者 UID')"
            ><TextField
              v-model="draft.uploaderUid"
              inputmode="numeric"
              :aria-label="t('上传者 UID')" /></Field
          ><Field :label="t('页数范围')" class="page-range-field"
            ><div class="page-range">
              <NumberField
                v-model="draft.minPages"
                :min="0"
                :placeholder="t('最少')"
                :aria-label="t('最少页数')"
              /><span>{{ t('至') }}</span
              ><NumberField
                v-model="draft.maxPages"
                :min="0"
                :placeholder="t('最多')"
                :aria-label="t('最多页数')"
              /></div
          ></Field>
        </div>
      </details>
      <details class="filter-details">
        <summary>{{ t('源站过滤') }}</summary>
        <div class="filter-switches">
          <ToggleField v-model="draft.requireTorrent" :label="t('存在种子')" /><ToggleField
            v-model="draft.browseExpunged"
            :label="t('显示已移除')"
          /><ToggleField
            v-model="draft.disableCustomFilters.language"
            :label="t('忽略账户语言过滤')"
          /><ToggleField
            v-model="draft.disableCustomFilters.uploader"
            :label="t('忽略账户上传者过滤')"
          /><ToggleField v-model="draft.disableCustomFilters.tags" :label="t('忽略账户标签过滤')" />
        </div>
      </details>
      <p v-if="error" class="field-error" role="alert" tabindex="-1">{{ t(error) }}</p>
    </div>
    <footer class="filters-footer">
      <span>{{
        t('标题与包含标签 {p0} / 5 · 排除标签 {p1} / 10', {
          p0: draft.titleTerms.length + draft.includeTags.length,
          p1: draft.excludeTags.length,
        })
      }}</span
      ><ActionButton @click="emit('cancel')">{{ t('取消') }}</ActionButton
      ><ActionButton variant="default" @click="emit('apply')">{{ t('应用筛选') }}</ActionButton>
    </footer>
  </div>
</template>
<style scoped>
.gallery-filters {
  min-width: 0;
}
.filters-heading,
.filter-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}
.filters-heading h2 {
  font-size: 18px;
  margin: 0 0 4px;
}
.filters-heading p {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 12px;
}
.filter-heading > span {
  font-size: 13px;
  color: var(--muted-foreground);
}
.filter-section {
  padding: 14px 0;
  border-top: 1px solid var(--border-soft);
}
.category-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-bottom: 10px;
}
.category-heading h3 {
  margin: 0;
  font-size: 13px;
}
.rating-field {
  flex-direction: row;
  align-items: center;
  margin: 0;
}
.rating-field :deep(label) {
  font-size: 12px;
  color: var(--muted-foreground);
}
.rating-field :deep(.ui-select) {
  min-width: 135px;
}
.filter-details > summary {
  min-height: 44px;
  align-content: center;
}
.tag-filter-details summary small {
  margin-left: 12px;
  color: var(--muted-foreground);
  font-size: 11px;
}
.tag-filter-details .filter-heading {
  margin: 12px 0 16px;
}
.filter-details {
  border-top: 1px solid var(--border-soft);
  margin-top: 0;
  padding: 0;
}
.filter-details summary {
  cursor: pointer;
  font-size: 13px;
  color: var(--text);
}
.filter-field-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px 16px;
  margin-top: 10px;
}
.collapsed-tag-selection {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px 8px;
  padding: 8px 0 16px;
}
.page-range {
  display: flex;
  align-items: center;
  gap: 7px;
}
.page-range :deep(input) {
  width: 100%;
  min-width: 0;
}
.filter-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.filter-switches {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  padding-top: 14px;
}
.filters-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  position: sticky;
  bottom: 0;
  z-index: 15;
  padding: 14px 0 2px;
  background: var(--surface);
  border-top: 1px solid var(--border-soft);
}
.filters-footer > span {
  margin-right: auto;
  color: var(--muted-foreground);
  font-size: 11px;
}
@media (max-width: 767px) {
  .gallery-filters {
    display: flex;
    flex-direction: column;
    max-height: calc(100dvh - 135px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  }
  .filters-body {
    overflow-y: auto;
    min-height: 0;
    padding-right: 3px;
  }
  .filter-field-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .filters-heading {
    align-items: flex-start;
  }
  .filters-footer {
    flex: none;
    flex-wrap: wrap;
    padding-bottom: 8px;
  }
  .filters-footer > span {
    width: 100%;
  }
  .filters-footer :deep(button) {
    flex: 1;
  }
  .filter-heading {
    flex-wrap: wrap;
  }
}
</style>
