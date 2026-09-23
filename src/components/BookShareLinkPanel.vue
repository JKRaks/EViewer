<script setup lang="ts">
import { computed } from 'vue'
import { CopyDocument, Share } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import 'element-plus/es/components/message/style/css'
import type { bookInfoOutput } from '@/core/model/book/bookInfoOutput'
import { buildBookShareLinks, type BookShareLink } from '@/core/share/bookShareLinks'

const props = defineProps<{
  book: bookInfoOutput
}>()

const links = computed(() => buildBookShareLinks(props.book))

async function copyLink(link: BookShareLink) {
  try {
    await copyText(link.url)
    ElMessage.success(`${link.label}已复制`)
  } catch (error) {
    console.error('复制分享链接失败:', error)
    ElMessage.warning('无法自动复制，请选择链接后手动复制')
    document.querySelector<HTMLInputElement>('.link-share-url')?.select()
  }
}

async function shareLink(link: BookShareLink) {
  if (!navigator.share) {
    try {
      await copyText(link.url)
      ElMessage.info('当前浏览器不支持系统分享，已复制链接')
    } catch (error) {
      console.error('复制分享链接失败:', error)
      ElMessage.warning('当前浏览器不支持系统分享，请手动复制链接')
    }
    return
  }

  try {
    await navigator.share({
      title: props.book.bookName || 'EViewer 画册',
      text: `分享画册：${props.book.bookName || '未命名画册'}`,
      url: link.url,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    console.error('调起链接分享失败:', error)
    ElMessage.error('调起系统分享失败')
  }
}

function fallbackCopy(value: string) {
  const input = document.createElement('textarea')
  input.value = value
  input.setAttribute('readonly', '')
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.appendChild(input)
  input.select()
  const copied = document.execCommand('copy')
  input.remove()
  if (!copied) throw new Error('浏览器拒绝复制操作')
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return
    } catch {
      // 非安全上下文或权限被拒绝时继续使用兼容方案。
    }
  }
  fallbackCopy(value)
}
</script>

<template>
  <section class="link-share-panel" aria-label="链接分享">
    <header class="link-share-header">
      <h2>分享画册链接</h2>
      <p>选择本站或源站地址，复制链接或调起系统分享。</p>
    </header>

    <div class="link-share-list">
      <article v-for="link in links" :key="link.type" class="link-share-card">
        <div class="link-share-meta">
          <strong>{{ link.label }}</strong>
          <span>{{ link.description }}</span>
        </div>
        <input
          class="link-share-url"
          :value="link.url"
          readonly
          :aria-label="link.label"
          @focus="($event.target as HTMLInputElement).select()"
        />
        <div class="link-share-actions">
          <el-button :icon="CopyDocument" type="primary" @click="copyLink(link)"
            >复制链接</el-button
          >
          <el-button :icon="Share" @click="shareLink(link)">系统分享</el-button>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.link-share-panel {
  width: min(760px, 100%);
  padding: 28px;
  border: 1px solid rgba(255, 255, 255, 0.26);
  border-radius: 18px;
  color: #fff;
  background: rgba(32, 49, 75, 0.88);
  box-shadow: 0 24px 44px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(14px);
}

.link-share-header h2 {
  margin: 0 0 8px;
  font-size: 22px;
}

.link-share-header p {
  margin: 0;
  color: rgba(255, 255, 255, 0.72);
}

.link-share-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 24px;
}

.link-share-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
}

.link-share-meta {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.link-share-meta strong {
  font-size: 17px;
}

.link-share-meta span {
  color: rgba(255, 255, 255, 0.66);
  font-size: 13px;
}

.link-share-url {
  box-sizing: border-box;
  width: 100%;
  padding: 10px 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  outline: none;
  color: #dcecff;
  background: rgba(13, 25, 42, 0.7);
  font: inherit;
  font-size: 13px;
  text-overflow: ellipsis;
}

.link-share-url:focus {
  border-color: var(--el-color-primary);
}

.link-share-actions {
  display: flex;
  gap: 10px;
}

.link-share-actions :deep(.el-button) {
  flex: 1;
  margin-left: 0;
}

@media (max-width: 650px) {
  .link-share-panel {
    padding: 20px;
  }

  .link-share-list {
    grid-template-columns: 1fr;
  }
}
</style>
