<script setup lang="ts">
import { t } from '@/i18n'

import PixelIcon from './PixelIcon.vue'
import ActionButton from '@/components/primitives/ActionButton.vue'
import ProgressMeter from '@/components/primitives/ProgressMeter.vue'
import EmptyState from '@/components/primitives/EmptyState.vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { HentaiVerseTrainingPage } from '@/core/hentaiverse/model/hentaiVerse'

const props = defineProps<{ data: HentaiVerseTrainingPage; loading?: boolean }>()
const emit = defineEmits<{ start: [id: string]; cancel: []; refresh: [] }>()
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | undefined
const updateClock = () => {
  now.value = Date.now()
}
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
    return Math.max(
      0,
      Math.min(100, 100 - (props.data.endsAt - now.value) / (props.data.durationSeconds * 10)),
    )
  }
  const match = props.data.progress.match(/(\d+(?:\.\d+)?)\s*%/)
  return match ? Math.max(0, Math.min(100, Number(match[1]))) : undefined
})
const progressLabel = computed(() =>
  progressPercent.value !== undefined
    ? `${progressPercent.value.toFixed(2)}%`
    : props.data.progress,
)
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
  if (!seconds) return t('训练时间已到')
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return t('剩余 {p0}{p1} 分 {p2} 秒', {
    p0: hours ? t('{p0} 小时 ', { p0: hours }) : '',
    p1: minutes,
    p2: seconds % 60,
  })
})
</script>

<template>
  <section class="training-panel">
    <div v-if="active" class="training-progress">
      <div>
        <span>{{ t('进行中的训练') }}</span>
        <h3>{{ t(data.activeName || t('训练进行中')) }}</h3>
        <p v-if="remaining">{{ t(remaining) }}</p>
      </div>
      <strong>{{ t(progressLabel) }}</strong>
      <ActionButton
        v-if="data.canCancel"
        variant="destructive"
        :loading="loading"
        @click="emit('cancel')"
        >{{ t('取消训练') }}</ActionButton
      >
    </div>
    <p v-else class="training-idle">{{ t('当前没有进行中的训练') }}</p>
    <ProgressMeter
      v-if="active && progressPercent !== undefined"
      :percentage="progressPercent"
      :show-text="false"
    />

    <div v-if="data.options.length" class="training-list">
      <article v-for="option in data.options" :key="option.id">
        <div class="training-name">
          <h3 class="pixel-title"><PixelIcon kind="training" />{{ t(option.name) }}</h3>
          <p v-if="option.description">{{ t(option.description) }}</p>
        </div>
        <dl>
          <template v-if="option.level"
            ><dt>{{ t('等级') }}</dt>
            <dd>{{ t(option.level) }}</dd></template
          >
          <template v-if="option.cost"
            ><dt>{{ t('费用') }}</dt>
            <dd>{{ t(option.cost) }}</dd></template
          >
          <template v-if="option.duration"
            ><dt>{{ t('耗时') }}</dt>
            <dd>{{ t(option.duration) }}</dd></template
          >
        </dl>
        <ActionButton
          variant="default"
          :disabled="!option.canStart"
          :loading="loading"
          @click="emit('start', option.id)"
        >
          {{ t(option.canStart ? t('开始训练') : option.unavailableReason || t('暂不可训练')) }}
        </ActionButton>
      </article>
    </div>
    <EmptyState v-else-if="!active" :description="t('当前没有可用训练项目')" />
  </section>
</template>

<style scoped>
.training-panel {
  display: grid;
  gap: 24px;
}

.training-idle {
  margin: 0;
  color: var(--muted-foreground);
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
  border-top: 1px solid var(--border-soft);
  border-bottom: 1px solid var(--border-soft);
}

.training-progress span {
  color: var(--muted-foreground);
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
  color: var(--muted-foreground);
  line-height: 1.5;
}

.training-list {
  border-top: 1px solid var(--border-soft);
}

.training-list article {
  grid-template-columns: minmax(220px, 1fr) minmax(220px, auto) auto;
  padding: 14px 2px;
  border-bottom: 1px solid var(--border-soft);
}

.training-list dl {
  display: grid;
  grid-template-columns: auto auto;
  gap: 3px 12px;
  margin: 0;
  font-size: 12px;
}

.training-list dt {
  color: var(--muted-foreground);
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
