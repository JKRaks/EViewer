<script setup lang="ts">
import { t } from '@/i18n'

import IconFrame from '@/components/primitives/IconFrame.vue'
import ActionButton from '@/components/primitives/ActionButton.vue'
import { Zap as Lightning } from '@lucide/vue'
import { notify } from '@/components/primitives/feedback'
import {
  dismissHentaiVerseEncounter,
  enterHentaiVerseBattle,
  hentaiVerseState,
} from '@/core/hentaiverse/hentaiVerseStore'

async function enterBattle() {
  const token = hentaiVerseState.encounter?.token
  if (!token) return
  try {
    await enterHentaiVerseBattle(token)
  } catch (error) {
    notify.error(error instanceof Error ? error.message : t('进入随机遭遇失败'))
  }
}
</script>

<template>
  <Transition name="encounter">
    <aside v-if="hentaiVerseState.encounter" class="encounter-prompt" role="alert">
      <IconFrame :size="22"><Lightning /></IconFrame>
      <div>
        <strong>{{ t('发现随机遭遇') }}</strong>
        <span>{{ t('怪物正在等待你的回应') }}</span>
      </div>
      <ActionButton
        variant="default"
        :loading="hentaiVerseState.battleLoading"
        @click="enterBattle"
        >{{ t('进入战斗') }}</ActionButton
      >
      <ActionButton variant="ghost" @click="dismissHentaiVerseEncounter">{{
        t('忽略')
      }}</ActionButton>
    </aside>
  </Transition>
</template>

<style scoped>
.encounter-prompt {
  position: fixed;
  top: calc(18px + env(safe-area-inset-top));
  left: 50%;
  z-index: 3200;
  display: flex;
  align-items: center;
  gap: 12px;
  width: min(560px, calc(100vw - 32px));
  padding: 12px 14px;
  border: 1px solid var(--warning-soft);
  border-radius: 8px;
  color: var(--foreground);
  background: var(--surface-raised);
  box-shadow: var(--shadow-strong);
  transform: translateX(-50%);
}

.encounter-prompt > div {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.encounter-prompt span {
  color: var(--muted-foreground);
  font-size: 12px;
}

.encounter-enter-active,
.encounter-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.encounter-enter-from,
.encounter-leave-to {
  opacity: 0;
  transform: translate(-50%, -12px);
}

@media (max-width: 600px) {
  .encounter-prompt {
    align-items: stretch;
    flex-wrap: wrap;
  }

  .encounter-prompt > div {
    min-width: calc(100% - 40px);
  }
}
</style>
