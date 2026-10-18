<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { TabsContent } from '@/components/ui/tabs'
import { activeSection } from './SectionTabs'
const props = defineProps<{
  name: string | number
  label?: string
  disabled?: boolean
  lazy?: boolean
}>()
const active = inject(activeSection)
const visited = ref(false)
const selected = computed(() => active?.value === props.name)
watch(
  selected,
  (value) => {
    if (value) visited.value = true
  },
  { immediate: true },
)
</script>
<template>
  <TabsContent v-if="!lazy || visited" :value="name" force-mount class="ui-tab-pane"
    ><slot
  /></TabsContent>
</template>
