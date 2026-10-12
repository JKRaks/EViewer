<script setup lang="ts">
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
    <p v-if="tokens !== undefined">鲜血代币：{{ tokens }}</p>
    <div v-if="challenges.length" class="challenge-grid">
      <article
        v-for="challenge in challenges"
        :key="challenge.id"
        class="challenge-card"
        :class="{ available: challenge.available }"
      >
        <header>
          <h3>{{ challenge.name }}</h3>
          <span class="challenge-state">{{ challenge.available ? '可挑战' : '暂不可挑战' }}</span>
        </header>
        <dl>
          <div>
            <dt>最高通关</dt>
            <dd>{{ challenge.highestClear || '—' }}</dd>
          </div>
          <div>
            <dt>最低等级</dt>
            <dd>{{ challenge.minLevel || '—' }}</dd>
          </div>
          <div>
            <dt>轮数</dt>
            <dd>{{ challenge.rounds || '—' }}</dd>
          </div>
          <div>
            <dt>经验倍率</dt>
            <dd>{{ challenge.experienceModifier || '—' }}</dd>
          </div>
          <div>
            <dt>入场费用</dt>
            <dd>{{ challenge.entryCost || '—' }}</dd>
          </div>
          <div>
            <dt>通关奖励</dt>
            <dd>{{ challenge.clearBonus || '—' }}</dd>
          </div>
        </dl>
        <footer>
          <el-button
            v-if="challenge.available"
            type="primary"
            :disabled="!postToken || loading"
            @click="emit('start', { initid: challenge.id, postoken: postToken })"
            >开始挑战</el-button
          >
          <p v-else>{{ challenge.unavailableReason || '尚未满足挑战条件' }}</p>
        </footer>
      </article>
    </div>
    <el-empty v-else description="当前等级没有可参加的挑战" />
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
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  background: var(--el-bg-color);
}
.challenge-card.available {
  border-color: var(--el-color-primary-light-5);
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
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color);
}
.available .challenge-state {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
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
  color: var(--el-text-color-secondary);
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
  border-top: 1px solid var(--el-border-color-lighter);
}
footer .el-button {
  width: 100%;
  min-height: 40px;
}
footer p {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.6;
}
</style>
