<script setup lang="ts">
import type { HentaiVerseTrainingPage } from '@/core/hentaiverse/model/hentaiVerse'

defineProps<{ data: HentaiVerseTrainingPage; loading?: boolean }>()
const emit = defineEmits<{ start: [id: string]; cancel: [] }>()
</script>

<template>
  <section class="training-panel">
    <div v-if="data.activeName || data.progress" class="training-progress">
      <div>
        <span>进行中的训练</span>
        <h3>{{ data.activeName || '训练进行中' }}</h3>
        <p v-if="data.remaining">{{ data.remaining }}</p>
      </div>
      <strong>{{ data.progress }}</strong>
      <el-button v-if="data.canCancel" type="danger" plain :loading="loading" @click="emit('cancel')">取消训练</el-button>
    </div>

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
    <el-empty v-else-if="!data.activeName" description="未能从源站解析训练项目" />
  </section>
</template>

<style scoped>
.training-panel {
  display: grid;
  gap: 24px;
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
