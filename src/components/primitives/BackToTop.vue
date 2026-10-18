<script setup lang="ts">
import { t } from '@/i18n'

import { onMounted, onUnmounted, ref } from 'vue'
import { ArrowUp } from '@lucide/vue'
import { getLayoutScrollTop, scrollLayoutTo } from '@/composables/layoutScroll'
const visible = ref(false)
function update() {
  visible.value = getLayoutScrollTop() > 600
}
onMounted(() => {
  document.addEventListener('scroll', update, true)
  update()
})
onUnmounted(() => document.removeEventListener('scroll', update, true))
</script>
<template>
  <button
    v-if="visible"
    type="button"
    class="ui-backtop"
    :aria-label="t('回到顶部')"
    @click="scrollLayoutTo(0)"
  >
    <ArrowUp :size="18" />
  </button>
</template>
