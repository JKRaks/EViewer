<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { HentaiVerseTrainingPage } from '@/core/hentaiverse/model/hentaiVerse'

const props = defineProps<{ data: HentaiVerseTrainingPage; loading?: boolean }>()
const emit = defineEmits<{ start: [id: string]; cancel: []; refresh: [] }>()
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | undefined
const updateClock = () => { now.value = Date.now() }
onMounted(() => {
  clock = setInterval(updateClock, 1_000)
  document.addEventListener('visibilitychange', updateClock)
})
onUnmounted(() => {
  clearInterval(clock)
  document.removeEventListener('visibilitychange', updateClock)
})
const active = computed(() => props.data.active)
const progressPercent = computed(() => {
  if (!active.value) return undefined
  if (props.data.endsAt !== undefined && props.data.durationSeconds) {
    return Math.max(0, Math.min(100, 100 - (props.data.endsAt - now.value) / (props.data.durationSeconds * 10)))
  }
  const match = props.data.progress.match(/(\d+(?:\.\d+)?)\s*%/)
  return match ? Math.max(0, Math.min(100, Number(match[1]))) : undefined
})
const progressLabel = computed(() => progressPercent.value !== undefined
  ? `${progressPercent.value.toFixed(2)}%`
  : props.data.progress)
let completionRefreshed = false
watch([active, () => props.data.activeName], () => {
  completionRefreshed = false
})
watch(
  [() => active.value && progressPercent.value === 100, () => props.loading],
  ([completed, loading]) => {
    if (!completed || loading || completionRefreshed) return
    completionRefreshed = true
    emit('refresh')
  },
  { immediate: true },
)
const remaining = computed(() => {
  if (props.data.endsAt === undefined) return props.data.remaining
  const seconds = Math.max(0, Math.ceil((props.data.endsAt - now.value) / 1000))
  if (!seconds) return '训练时间已到'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor(seconds % 3600 / 60)
  return `剩余 ${hours ? `${hours} 小时 ` : ''}${minutes} 分 ${seconds % 60} 秒`
})
</script>

<template>
  <section class="training-panel">
    <div v-if="active" class="training-progress">
      <div>
        <span>进行中的训练</span>
        <h3>{{ data.activeName || '训练进行中' }}</h3>
        <p v-if="remaining">{{ remaining }}</p>
      </div>
      <strong>{{ progressLabel }}</strong>
      <el-button v-if="data.canCancel" type="danger" plain :loading="loading" @click="emit('cancel')">取消训练</el-button>
    </div>
    <p v-else class="training-idle">当前没有进行中的训练</p>
    <el-progress v-if="active && progressPercent !== undefined" :percentage="progressPercent" :show-text="false" />

    <div v-if="data.options.length" class="training-list">
      <article v-for="option in data.options" :key="option.id">
        <div class="training-name">
          <h3>{{ option.name }}</h3>
          <p v-if="option.description">{{ option.description }}</p>
        </div>
        <dl>
          <template v-if="option.level"><dt>等级</dt><dd>{{ option.level }}</dd></template>
          <template v-if="option.cost"><dt>费用</dt><dd>{{ option.cost }}</dd></template>
          <template v-if="option.duration"><dt>耗时</dt><dd>{{ option.duration }}</dd></template>
        </dl>
        <el-button type="primary" :disabled="!option.canStart" :loading="loading" @click="emit('start', option.id)">
          开始训练
        </el-button>
      </article>
    </div>
    <el-empty v-else-if="!active" description="当前没有可用训练项目" />
  </section>
</template>

<style scoped>
.training-panel {
  display: grid;
  gap: 24px;
}

.training-idle {
  margin: 0;
  color: var(--el-text-color-secondary);
}

.training-progress,
.training-list article {
  display: grid;
  align-items: center;
  gap: 18px;
}

.training-progress {
  grid-template-columns: minmax(0, 1fr) auto auto;
  padding: 16px 0;
  border-top: 1px solid var(--el-border-color-lighter);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.training-progress span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.training-progress h3,
.training-name h3 {
  margin: 3px 0 0;
  font-size: 16px;
  letter-spacing: 0;
}

.training-progress p,
.training-name p {
  margin: 5px 0 0;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.training-list {
  border-top: 1px solid var(--el-border-color-lighter);
}

.training-list article {
  grid-template-columns: minmax(220px, 1fr) minmax(220px, auto) auto;
  padding: 14px 2px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.training-list dl {
  display: grid;
  grid-template-columns: auto auto;
  gap: 3px 12px;
  margin: 0;
  font-size: 12px;
}

.training-list dt {
  color: var(--el-text-color-secondary);
}

.training-list dd {
  margin: 0;
  text-align: right;
}

@media (max-width: 767px) {
  .training-progress,
  .training-list article {
    grid-template-columns: 1fr;
  }

  .training-progress > strong {
    font-size: 18px;
  }
}
</style>
