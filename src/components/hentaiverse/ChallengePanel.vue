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
    <div v-if="challenges.length" class="challenge-scroll">
      <table>
        <thead>
          <tr>
            <th>挑战</th>
            <th>最高通关</th>
            <th>最低等级</th>
            <th>轮数</th>
            <th>经验倍率</th>
            <th>入场费用</th>
            <th>通关奖励</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="challenge in challenges" :key="challenge.id">
            <td>{{ challenge.name }}</td>
            <td>{{ challenge.highestClear || '—' }}</td>
            <td>{{ challenge.minLevel }}</td>
            <td>{{ challenge.rounds }}</td>
            <td>{{ challenge.experienceModifier }}</td>
            <td>{{ challenge.entryCost || '—' }}</td>
            <td>{{ challenge.clearBonus || '—' }}</td>
            <td>
              <el-button
                v-if="challenge.available"
                type="primary"
                size="small"
                :disabled="!postToken || loading"
                @click="emit('start', { initid: challenge.id, postoken: postToken })"
                >开始挑战</el-button
              >
              <span v-else>{{ challenge.unavailableReason }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <el-empty v-else description="当前等级没有可参加的挑战" />
  </section>
</template>

<style scoped>
.challenge-panel {
  min-width: 0;
}
.challenge-scroll {
  max-width: 100%;
  overflow-x: auto;
}
table {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
  font-size: 13px;
}
th,
td {
  padding: 12px 10px;
  text-align: left;
  border-bottom: 1px solid var(--el-border-color);
}
th {
  white-space: nowrap;
  color: var(--el-text-color-secondary);
}
td:last-child {
  min-width: 180px;
}
</style>
