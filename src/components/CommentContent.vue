<script setup lang="ts">
import { t, locale } from '@/i18n'

import ActionButton from '@/components/primitives/ActionButton.vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { notify, dialogs } from '@/components/primitives/feedback'
import type { userComment } from '@/core/model/book/bookInfoOutput'
import { renderCommentHtml, resolveCommentLink } from '@/core/books/commentContent'

const props = defineProps<{ comment: userComment }>()
const router = useRouter()
const root = ref<HTMLElement>()
const body = ref<HTMLElement>()
const expanded = ref(false)
const overflowing = ref(false)
const html = computed(() => {
  void locale.value
  return renderCommentHtml(props.comment.contentHtml, props.comment.comment)
})
let observer: ResizeObserver | undefined

function measure() {
  if (!body.value) return
  overflowing.value =
    body.value.scrollHeight > parseFloat(getComputedStyle(body.value).lineHeight) * 12 + 1
}

async function toggle() {
  const top = root.value?.getBoundingClientRect().top ?? 0
  expanded.value = !expanded.value
  await nextTick()
  if (!expanded.value && top < 0) root.value?.scrollIntoView({ block: 'start' })
}

async function handleLink(event: MouseEvent) {
  const anchor = (event.target as Element).closest('a')
  if (!anchor || !body.value?.contains(anchor)) return
  event.preventDefault()
  if (event.type === 'auxclick' && event.button !== 1) return
  const link = resolveCommentLink(anchor.getAttribute('href') ?? '')
  if (!link) return
  if (link.bookId) {
    await router.push({
      name: 'bookinfo',
      query: { bookId: link.bookId.replace('/', '-'), site: link.site },
    })
    return
  }
  try {
    await navigator.clipboard.writeText(link.url)
    notify.success(t('链接已复制，请在浏览器中打开'))
  } catch {
    await dialogs
      .prompt(t('自动复制失败，请手动复制下方链接'), t('复制链接'), {
        inputValue: link.url,
        inputType: 'textarea',
        confirmButtonText: t('关闭'),
        showCancelButton: false,
      })
      .catch(() => undefined)
  }
}

watch(html, async () => {
  expanded.value = false
  await nextTick()
  measure()
})
onMounted(() => {
  observer = new ResizeObserver(measure)
  if (body.value) observer.observe(body.value)
  measure()
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div ref="root" class="comment-body">
    <div class="comment-clip" :class="{ collapsed: overflowing && !expanded }">
      <!-- html 由 renderCommentHtml 重建白名单节点，不直接展示源站 HTML。 -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div
        ref="body"
        class="comment-rich-text"
        @click="handleLink"
        @auxclick="handleLink"
        v-html="html"
      />
    </div>
    <ActionButton v-if="overflowing" variant="link" :aria-expanded="expanded" @click="toggle">
      {{ expanded ? t('收起') : t('展开全文') }}
    </ActionButton>
  </div>
</template>

<style scoped>
.comment-body {
  min-width: 0;
  white-space: normal;
}
.comment-clip.collapsed {
  max-height: 19.2em;
  overflow: hidden;
}
.comment-rich-text {
  display: flow-root;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.comment-rich-text :deep(a) {
  color: var(--accent);
  text-decoration: underline;
  cursor: pointer;
}
.comment-rich-text :deep(p) {
  margin: 0 0 0.6em;
}
.comment-rich-text :deep(blockquote) {
  margin: 0.5em 0;
  padding-left: 1em;
  border-left: 3px solid var(--border);
  color: var(--muted-foreground);
}
.comment-rich-text :deep(pre) {
  white-space: pre-wrap;
}
.comment-rich-text :deep(ul),
.comment-rich-text :deep(ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
}
.comment-body > .ui-button {
  margin-top: 8px;
}
</style>
