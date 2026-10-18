<script setup lang="ts">
import { t } from '@/i18n'

import ActionButton from '@/components/primitives/ActionButton.vue'
import EmptyState from '@/components/primitives/EmptyState.vue'
import type {
  HentaiVerseChallenge,
  HentaiVerseFormData,
} from '@/core/hentaiverse/model/hentaiVerse'
defineProps<{
  challenges: HentaiVerseChallenge[]
  postToken: string
  loading?: boolean
  tokens?: string
}>()
const emit = defineEmits<{ start: [data: HentaiVerseFormData] }>()
</script>

<template>
  <section class="challenge-panel">
    <p v-if="tokens !== undefined">{{ t('鲜血代币：{p0}', { p0: tokens }) }}</p>
    <div v-if="challenges.length" class="challenge-grid">
      <article
        v-for="challenge in challenges"
        :key="challenge.id"
        class="challenge-card"
        :class="{ available: challenge.available }"
      >
        <header>
          <h3>{{ t(challenge.name) }}</h3>
          <span class="challenge-state">{{
            t(challenge.available ? t('可挑战') : t('暂不可挑战'))
          }}</span>
        </header>
        <dl>
          <div>
            <dt>{{ t('最高通关') }}</dt>
            <dd>{{ t(challenge.highestClear || '—') }}</dd>
          </div>
          <div>
            <dt>{{ t('最低等级') }}</dt>
            <dd>{{ t(challenge.minLevel || '—') }}</dd>
          </div>
          <div>
            <dt>{{ t('轮数') }}</dt>
            <dd>{{ t(challenge.rounds || '—') }}</dd>
          </div>
          <div>
            <dt>{{ t('经验倍率') }}</dt>
            <dd>{{ t(challenge.experienceModifier || '—') }}</dd>
          </div>
          <div>
            <dt>{{ t('入场费用') }}</dt>
            <dd>{{ t(challenge.entryCost || '—') }}</dd>
          </div>
          <div>
            <dt>{{ t('通关奖励') }}</dt>
            <dd>{{ t(challenge.clearBonus || '—') }}</dd>
          </div>
        </dl>
        <footer>
          <ActionButton
            v-if="challenge.available"
            variant="default"
            :disabled="!postToken || loading"
            @click="emit('start', { initid: challenge.id, postoken: postToken })"
            >{{ t('开始挑战') }}</ActionButton
          >
          <p v-else>{{ t(challenge.unavailableReason || t('尚未满足挑战条件')) }}</p>
        </footer>
      </article>
    </div>
    <EmptyState v-else :description="t('当前等级没有可参加的挑战')" />
  </section>
</template>

<style scoped>
.challenge-panel {
  min-width: 0;
}
.challenge-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
  gap: 14px;
}
.challenge-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}
.challenge-card.available {
  border-color: var(--accent-ring);
}
.challenge-card header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
h3 {
  margin: 0;
  font-size: 17px;
  overflow-wrap: anywhere;
}
.challenge-state {
  flex-shrink: 0;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--muted-foreground);
  background: var(--muted);
}
.available .challenge-state {
  color: var(--accent);
  background: var(--accent-soft);
}
dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin: 20px 0;
}
dl div {
  min-width: 0;
}
dt {
  color: var(--muted-foreground);
  font-size: 12px;
}
dd {
  margin: 5px 0 0;
  font-size: 14px;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}
footer {
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid var(--border-soft);
}
footer .ui-button {
  width: 100%;
  min-height: 40px;
}
footer p {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 13px;
  line-height: 1.6;
}
</style>
