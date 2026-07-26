<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { HentaiVersePage } from '@/core/hentaiverse/model/hentaiVerse'

const props = defineProps<{ page: HentaiVersePage; loading?: boolean }>()
const emit = defineEmits<{
  attributes: [data: Record<string, string | number | boolean>]
  persona: [data: Record<string, string | number | boolean>]
}>()

const deltas = reactive<Record<string, number>>({})
const rename = reactive({ value: '' })
const activePersona = computed(() => props.page.personas.find((persona) => persona.active)?.id || '')
const experienceCost = computed(() =>
  props.page.attributes.reduce((total, attribute) => {
    const target = Math.max(0, attribute.value + (deltas[attribute.key] || 0))
    return total + getTotalExperienceCost(target) - getTotalExperienceCost(attribute.value)
  }, 0),
)
const insufficientExperience = computed(
  () => experienceCost.value > 0 && experienceCost.value > props.page.usableExperience,
)

watch(
  () => props.page.attributes,
  (attributes) => attributes.forEach((attribute) => (deltas[attribute.key] = 0)),
  { immediate: true },
)

function applyAttributes() {
  emit('attributes', {
    attr_apply: 1,
    ...Object.fromEntries(props.page.attributes.map((attribute) => [`${attribute.key}_delta`, deltas[attribute.key] || 0])),
  })
}

function switchPersona(value: string) {
  if (value && value !== activePersona.value) emit('persona', { persona_set: value })
}

function renamePersona() {
  const value = rename.value.trim()
  if (value) emit('persona', { persona_rename: value })
}

function getTotalExperienceCost(level: number) {
  return level === 0
    ? 0
    : Math.round(Math.pow(level + 1, Math.pow(2.5475566751265, 1 + level / 950)))
}
</script>

<template>
  <div class="character-overview">
    <section v-if="page.metrics.length" class="metric-band">
      <div v-for="metric in page.metrics" :key="metric.label" class="metric-item">
        <span>{{ metric.label }}</span>
        <strong>{{ metric.value }}</strong>
      </div>
    </section>

    <section v-if="page.attributes.length" class="character-section">
      <div class="section-heading">
        <div>
          <h2>基础属性</h2>
          <p>分配可用经验后统一应用，负数表示回退尚未提交的调整。</p>
        </div>
        <div class="attribute-submit">
          <span :class="{ danger: insufficientExperience }">
            预计{{ experienceCost >= 0 ? '消耗' : '返还' }} {{ Math.abs(experienceCost).toLocaleString('zh-CN') }} 经验
          </span>
          <el-button
            type="primary"
            :disabled="insufficientExperience || experienceCost === 0"
            :loading="loading"
            @click="applyAttributes"
          >
            应用属性
          </el-button>
        </div>
      </div>
      <div class="attribute-grid">
        <div v-for="attribute in page.attributes" :key="attribute.key" class="attribute-row">
          <div>
            <span>{{ attribute.label }}</span>
            <strong>{{ attribute.value + (deltas[attribute.key] || 0) }}</strong>
          </div>
          <el-input-number v-model="deltas[attribute.key]" :min="-999" :max="999" controls-position="right" />
        </div>
      </div>
    </section>

    <section class="character-section">
      <div class="section-heading">
        <div>
          <h2>人格</h2>
          <p>当前人格：{{ page.personaName || '默认人格' }}</p>
        </div>
      </div>
      <div class="persona-controls">
        <el-select
          v-if="page.personas.length"
          :model-value="activePersona"
          aria-label="切换人格"
          @change="switchPersona"
        >
          <el-option v-for="persona in page.personas" :key="persona.id" :label="persona.name" :value="persona.id" />
        </el-select>
        <el-input v-model="rename.value" maxlength="64" placeholder="新的人格名称" @keyup.enter="renamePersona" />
        <el-button :disabled="!rename.value.trim()" :loading="loading" @click="renamePersona">重命名</el-button>
        <el-dropdown :disabled="loading" @command="(command: string) => emit('persona', { persona_create: command })">
          <el-button>创建人格</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="clone">克隆当前人格</el-dropdown-item>
              <el-dropdown-item command="blank">创建空白人格</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
      <el-alert title="新建的人格无法删除，请确认后再创建。" type="warning" :closable="false" show-icon />
    </section>
  </div>
</template>

<style scoped>
.metric-band {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-border-color-lighter);
}

.metric-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  padding: 14px;
  background: var(--el-bg-color);
}

.metric-item span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.metric-item strong {
  overflow: hidden;
  font-size: 18px;
  text-overflow: ellipsis;
}

.character-section {
  padding: 22px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.section-heading h2,
.section-heading p {
  margin: 0;
}

.section-heading h2 {
  font-size: 18px;
}

.section-heading p {
  margin-top: 5px;
  color: var(--el-text-color-secondary);
}

.attribute-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 24px;
}

.attribute-submit {
  display: flex;
  align-items: flex-end;
  flex-direction: column;
  gap: 6px;
}

.attribute-submit span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.attribute-submit span.danger {
  color: var(--el-color-danger);
}

.attribute-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 0;
}

.attribute-row > div {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.attribute-row span {
  color: var(--el-text-color-secondary);
}

.attribute-row strong {
  font-size: 20px;
}

.persona-controls {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(180px, 1fr) auto auto;
  gap: 10px;
  margin-bottom: 14px;
}

@media (max-width: 767px) {
  .attribute-grid {
    grid-template-columns: 1fr;
  }

  .section-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .attribute-submit {
    align-items: stretch;
  }

  .persona-controls {
    grid-template-columns: 1fr 1fr;
  }

  .persona-controls > :first-child,
  .persona-controls > :nth-child(2) {
    grid-column: 1 / -1;
  }
}
</style>
