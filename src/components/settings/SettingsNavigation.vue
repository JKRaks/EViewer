<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { ChevronRight, ChevronLeft } from '@lucide/vue'
import { t } from '@/i18n'

const groups = [
  {
    title: '常用设置',
    items: [
      { id: 'appearance', title: '外观与语言' },
      { id: 'browser-assistant', title: '浏览器助手', beta: true },
      { id: 'hv-translations', title: 'HV 翻译收集' },
      { id: 'sharing', title: '分享设置' },
    ],
  },
  {
    title: '存储与维护',
    items: [
      { id: 'cache-preferences', title: '缓存偏好' },
      { id: 'cache-maintenance', title: '缓存维护' },
      { id: 'storage-environment', title: '环境校验' },
      { id: 'data-cleanup', title: '数据清理' },
    ],
  },
]
const opened = ref(false)
const active = ref('appearance')
const navigation = ref<HTMLElement>()
const trigger = ref<HTMLButtonElement>()
const dragTop = ref<number>()
const dragging = ref(false)
let pointer: { id: number; y: number; top: number } | undefined
let suppressClick = false
let sections: HTMLElement[] = []
let frame = 0
let observer: ResizeObserver | undefined

function handleDrag(event: PointerEvent) {
  const button = trigger.value
  if (!button) return
  if (event.type === 'pointerdown') {
    if (!event.isPrimary || event.button !== 0) return
    pointer = { id: event.pointerId, y: event.clientY, top: button.getBoundingClientRect().top }
    suppressClick = false
    button.setPointerCapture(event.pointerId)
    return
  }
  if (!pointer || pointer.id !== event.pointerId) return
  if (event.type === 'pointermove') {
    const delta = event.clientY - pointer.y
    if (!dragging.value && Math.abs(delta) < 6) return
    dragging.value = true
    suppressClick = true
    opened.value = false
    dragTop.value = Math.min(
      Math.max(12, pointer.top + delta),
      Math.max(12, window.innerHeight - 84),
    )
    return
  }
  pointer = undefined
  dragging.value = false
  if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId)
}
function toggleDirectory(event: MouseEvent) {
  if (!suppressClick || event.detail === 0) opened.value = !opened.value
  suppressClick = false
}

function updateActive() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(() => {
    let current = sections[0]
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= 100) current = section
    }
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 3)
      current = sections.at(-1)
    if (current) active.value = current.id
  })
}
function jump(id: string) {
  opened.value = false
  document.getElementById(id)?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    block: 'start',
  })
}
function dismiss(event: Event) {
  if (event instanceof KeyboardEvent) {
    if (event.key !== 'Escape' || !opened.value) return
    opened.value = false
    trigger.value?.focus()
  } else if (!navigation.value?.contains(event.target as Node)) opened.value = false
}
onMounted(() => {
  sections = groups
    .flatMap((group) => group.items)
    .map((item) => document.getElementById(item.id))
    .filter((element): element is HTMLElement => !!element)
  window.addEventListener('scroll', updateActive, { passive: true, capture: true })
  window.addEventListener('resize', updateActive)
  document.addEventListener('pointerdown', dismiss)
  document.addEventListener('keydown', dismiss)
  observer = new ResizeObserver(updateActive)
  sections.forEach((section) => observer?.observe(section))
  updateActive()
})
onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  observer?.disconnect()
  window.removeEventListener('scroll', updateActive, true)
  window.removeEventListener('resize', updateActive)
  document.removeEventListener('pointerdown', dismiss)
  document.removeEventListener('keydown', dismiss)
})
</script>

<template>
  <aside
    ref="navigation"
    class="settings-navigation"
    :class="{ 'is-open': opened, 'is-dragging': dragging }"
    :style="dragTop === undefined ? undefined : { '--navigation-y': `${dragTop}px` }"
  >
    <button
      ref="trigger"
      type="button"
      class="navigation-trigger"
      :aria-label="opened ? t('关闭目录') : t('展开目录')"
      :aria-expanded="opened"
      aria-controls="settings-navigation-links"
      @pointerdown="handleDrag"
      @pointermove="handleDrag"
      @pointerup="handleDrag"
      @pointercancel="handleDrag"
      @lostpointercapture="handleDrag"
      @click="toggleDirectory"
    >
      <component :is="opened ? ChevronLeft : ChevronRight" :size="20" aria-hidden="true" />
    </button>
    <nav id="settings-navigation-links" :aria-label="t('设置章节')">
      <div v-for="group in groups" :key="group.title" class="navigation-group">
        <div class="navigation-heading">{{ t(group.title) }}</div>
        <a
          v-for="item in group.items"
          :key="item.id"
          :href="`#${item.id}`"
          :aria-current="active === item.id ? 'location' : undefined"
          @click.prevent="jump(item.id)"
        >
          {{ t(item.title) }}<span v-if="'beta' in item" class="navigation-beta">Beta</span>
        </a>
      </div>
    </nav>
  </aside>
</template>

<style scoped>
.settings-navigation {
  position: sticky;
  top: 24px;
  align-self: start;
  min-width: 0;
}
.navigation-trigger {
  display: none;
}
nav {
  padding: 8px 0;
}
.navigation-group + .navigation-group {
  margin-top: 20px;
}
.navigation-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 12px 8px;
  color: var(--muted-foreground);
  font-size: 12px;
  line-height: 20px;
  white-space: nowrap;
}
.navigation-heading::after {
  content: '';
  height: 1px;
  flex: 1;
  background: var(--border-soft);
}
nav a {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 10px 12px;
  border-left: 2px solid transparent;
  text-decoration: none;
  font-size: 14px;
  line-height: 22px;
  color: var(--muted-foreground);
}
nav a:hover {
  color: var(--foreground);
  background: var(--muted);
}
nav a[aria-current] {
  color: var(--accent);
  background: var(--accent-soft);
  border-left-color: var(--accent);
}
.navigation-beta {
  font-size: 11px;
  color: var(--accent);
}
@media (max-width: 767px) {
  .settings-navigation {
    position: fixed;
    left: 0;
    top: clamp(
      max(12px, env(safe-area-inset-top)),
      var(--navigation-y, max(120px, 24dvh)),
      calc(100dvh - 84px - env(safe-area-inset-bottom))
    );
    z-index: 40;
  }
  .navigation-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 72px;
    padding: 0 5px 0 0;
    border: 1px solid var(--border);
    border-left: 0;
    border-radius: 0 72px 72px 0;
    background: var(--background);
    color: var(--accent);
    box-shadow: 0 2px 10px rgb(0 0 0 / 10%);
    cursor: grab;
    touch-action: none;
    user-select: none;
    -webkit-touch-callout: none;
  }
  .is-dragging .navigation-trigger {
    cursor: grabbing;
  }
  nav {
    display: none;
    position: fixed;
    left: calc(44px + env(safe-area-inset-left));
    top: clamp(
      max(12px, env(safe-area-inset-top)),
      calc(var(--navigation-y, max(120px, 24dvh)) - 48px),
      calc(100dvh - min(520px, 70dvh) - 12px - env(safe-area-inset-bottom))
    );
    width: min(260px, calc(100vw - 76px));
    max-height: min(520px, 70dvh);
    overflow-y: auto;
    padding: 12px 8px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--background);
    box-shadow: 0 8px 28px rgb(0 0 0 / 16%);
  }
  .is-open nav {
    display: block;
  }
}
</style>
