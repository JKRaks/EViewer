<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ seed: string }>()
// Names seed the silhouette and palette; health and turn changes never redraw a monster.
const sprite = computed(() => {
  let state = 2166136261
  for (const char of props.seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0
  const random = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 4294967296
  }
  const hue = Math.floor(random() * 360)
  const colors = [`hsl(${hue} 42% 48%)`, `hsl(${hue} 55% 68%)`, `hsl(${hue} 35% 28%)`]
  const pixels: { x: number; y: number; color: string }[] = []
  const horns = random() > 0.5
  const wings = random() > 0.5
  for (let y = 2; y < 14; y++) {
    for (let x = 1; x < 8; x++) {
      const body = y >= 5 && y <= 11 && x >= (y === 5 || y === 11 ? 5 : 4)
      const horn = horns && y < 5 && x === 4 + Math.floor((y - 2) / 2)
      const wing = wings && y >= 6 && y <= 9 && x >= 1 + (y - 6) && x < 4
      const feet = y >= 12 && x >= 4 && x <= 5
      if (!body && !horn && !wing && !feet) continue
      const color = colors[Math.floor(random() * colors.length)]!
      pixels.push({ x, y, color }, { x: 15 - x, y, color })
    }
  }
  pixels.push(
    { x: 5, y: 7, color: '#f4f4da' },
    { x: 10, y: 7, color: '#f4f4da' },
    { x: 6, y: 8, color: '#18211b' },
    { x: 9, y: 8, color: '#18211b' },
    { x: 7, y: 10, color: '#18211b' },
    { x: 8, y: 10, color: '#18211b' },
  )
  return pixels
})
</script>

<template>
  <svg viewBox="0 0 16 16" width="40" height="40" shape-rendering="crispEdges" aria-hidden="true">
    <rect
      v-for="(pixel, index) in sprite"
      :key="index"
      :x="pixel.x"
      :y="pixel.y"
      width="1"
      height="1"
      :fill="pixel.color"
    />
  </svg>
</template>
