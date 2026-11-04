<script setup lang="ts">
import type { Component } from 'vue'
import {
  UserRound,
  Shirt,
  Sparkles,
  Dumbbell,
  Backpack,
  SlidersHorizontal,
  Swords,
  Droplet,
  Waves,
  Orbit,
  Castle,
  Anvil,
  Store,
  ChartNoAxesCombined,
  Landmark,
  FlaskConical,
  Mail,
  Sword,
  Shield,
} from '@lucide/vue'
import type { HentaiVerseSection } from '@/core/hentaiverse/model/hentaiVerse'

defineProps<{ kind: HentaiVerseSection }>()

// An exhaustive map keeps new sections from silently sharing a placeholder icon.
const icons: Record<HentaiVerseSection, Component> = {
  character: UserRound,
  equipment: Shirt,
  abilities: Sparkles,
  training: Dumbbell,
  inventory: Backpack,
  settings: SlidersHorizontal,
  arena: Swords,
  ringOfBlood: Droplet,
  grindfest: Waves,
  itemWorld: Orbit,
  tower: Castle,
  armory: Anvil,
  itemShop: Store,
  market: ChartNoAxesCombined,
  shrine: Landmark,
  monsterLab: FlaskConical,
  moogleMail: Mail,
  weaponLottery: Sword,
  armorLottery: Shield,
}
</script>

<template>
  <component
    :is="icons[kind]"
    class="hv-section-icon"
    :size="18"
    :stroke-width="1.8"
    aria-hidden="true"
    focusable="false"
  />
</template>

<style scoped>
.hv-section-icon {
  width: 18px;
  height: 18px;
  flex: none;
}
</style>
