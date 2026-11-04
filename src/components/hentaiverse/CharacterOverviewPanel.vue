<script setup lang="ts">
import { t, getDisplayLocale } from '@/i18n'

import ActionButton from '@/components/primitives/ActionButton.vue'
import NumberField from '@/components/primitives/NumberField.vue'
import SelectField from '@/components/primitives/SelectField.vue'
import TextField from '@/components/primitives/TextField.vue'
import Notice from '@/components/primitives/Notice.vue'
import ProgressMeter from '@/components/primitives/ProgressMeter.vue'
import StatGroupsPanel from './StatGroupsPanel.vue'
import { Minus, Plus } from '@lucide/vue'
import { computed, reactive, watch } from 'vue'
import type { HentaiVersePage } from '@/core/hentaiverse/model/hentaiVerse'

const props = defineProps<{ page: HentaiVersePage; loading?: boolean }>()
const emit = defineEmits<{
  attributes: [data: Record<string, string | number | boolean>]
  persona: [data: Record<string, string | number | boolean>]
}>()

const deltas = reactive<Record<string, number>>({})
const rename = reactive({ value: '' })
const activePersona = computed(
  () => props.page.personas.find((persona) => persona.active)?.id || '',
)
const experienceCost = computed(() =>
  props.page.attributes.reduce((total, attribute) => {
    const target = Math.max(0, attribute.value + (deltas[attribute.key] || 0))
    return total + getTotalExperienceCost(target) - getTotalExperienceCost(attribute.value)
  }, 0),
)
const insufficientExperience = computed(
  () => experienceCost.value > 0 && experienceCost.value > props.page.usableExperience,
)
const changedAttributes = computed(() =>
  props.page.attributes.filter((attribute) => Number(deltas[attribute.key] || 0) !== 0),
)
const overviewMetrics = computed(() =>
  props.page.metrics.filter((metric) =>
    ['可用经验', '等级与难度', '升级经验'].includes(metric.label),
  ),
)
const profileMetrics = computed(() =>
  props.page.metrics.filter(
    (metric) => !['可用经验', '等级与难度', '升级经验'].includes(metric.label),
  ),
)
const resources = computed(() =>
  props.page.statGroups.find((group) => group.title === '基础资源与恢复'),
)

watch(
  () => props.page.attributes,
  (attributes) => attributes.forEach((attribute) => (deltas[attribute.key] = 0)),
  { immediate: true },
)

function applyAttributes() {
  if (props.loading || insufficientExperience.value || !changedAttributes.value.length) return
  emit('attributes', {
    attr_apply: 1,
    ...Object.fromEntries(
      props.page.attributes.map((attribute) => [
        `${attribute.key}_delta`,
        deltas[attribute.key] || 0,
      ]),
    ),
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
      <div
        v-for="metric in overviewMetrics"
        :key="metric.label"
        class="metric-item"
        :class="{ 'metric-item--progress': metric.percent !== undefined }"
      >
        <span>{{ t(metric.label) }}</span>
        <template v-if="metric.percent !== undefined">
          <ProgressMeter
            :percentage="metric.percent"
            :stroke-width="8"
            :label="t(metric.label)"
            :value-text="t(metric.value)"
          />
          <small class="experience-readout">{{ t(metric.value) }}</small>
        </template>
        <strong v-else>{{ t(metric.value) }}</strong>
      </div>
    </section>

    <div class="character-columns">
      <section v-if="page.attributes.length" class="character-section hv-window">
        <div class="section-heading">
          <div>
            <h2>{{ t('基础属性') }}</h2>
          </div>
          <span>{{ page.attributes.length }}</span>
        </div>
        <div class="attribute-grid">
          <div v-for="attribute in page.attributes" :key="attribute.key" class="attribute-row">
            <div>
              <strong>{{ t(attribute.label) }}</strong>
              <small v-if="deltas[attribute.key]"
                >{{ attribute.value }} → {{ attribute.value + (deltas[attribute.key] || 0) }}</small
              >
            </div>
            <div class="attribute-stepper">
              <ActionButton
                size="icon"
                :icon="Minus"
                :aria-label="t('减少{p0}', { p0: t(attribute.label) })"
                :disabled="loading || attribute.value + (deltas[attribute.key] || 0) <= 0"
                @click="deltas[attribute.key] = (deltas[attribute.key] || 0) - 1"
              />
              <NumberField
                :model-value="attribute.value + (deltas[attribute.key] || 0)"
                :aria-label="t('{p0}目标值', { p0: t(attribute.label) })"
                :disabled="loading"
                :min="0"
                :max="attribute.value + 999"
                @update:model-value="
                  deltas[attribute.key] =
                    Math.max(0, Math.min(attribute.value + 999, Number($event) || 0)) -
                    attribute.value
                "
              />
              <ActionButton
                size="icon"
                :icon="Plus"
                :aria-label="t('增加{p0}', { p0: t(attribute.label) })"
                :disabled="loading || (deltas[attribute.key] || 0) >= 999"
                @click="deltas[attribute.key] = (deltas[attribute.key] || 0) + 1"
              />
            </div>
          </div>
        </div>
        <div class="attribute-submit hv-window-footer">
          <div>
            <span :class="{ danger: insufficientExperience }">{{
              t('预计{p0} {p1} 经验', {
                p0: experienceCost >= 0 ? t('消耗') : t('返还'),
                p1: Math.abs(experienceCost).toLocaleString(getDisplayLocale()),
              })
            }}</span>
            <p>{{ t('分配可用经验后统一应用；减点会降低已分配的属性并返还经验。') }}</p>
          </div>
          <ActionButton
            variant="default"
            :disabled="insufficientExperience || !changedAttributes.length"
            :loading="loading"
            @click="applyAttributes"
            >{{ t('应用属性') }}</ActionButton
          >
        </div>
      </section>

      <aside class="character-side">
        <section class="hv-window character-profile">
          <h2 class="hv-window-title">{{ t('角色档案') }}</h2>
          <div class="hv-window-body">
            <h3>{{ page.personaName || t('默认人格') }}</h3>
            <dl class="hv-values">
              <template v-for="metric in profileMetrics" :key="metric.label"
                ><dt>{{ t(metric.label) }}</dt>
                <dd>{{ t(metric.value) }}</dd></template
              >
              <template v-if="page.personaCapacity"
                ><dt>{{ t('人格槽') }}</dt>
                <dd>
                  {{ page.personaCapacity.used }} / {{ page.personaCapacity.total }}
                </dd></template
              >
            </dl>
            <details class="persona-section">
              <summary
                class="section-heading"
                :data-expand-label="t('展开')"
                :data-collapse-label="t('收起')"
              >
                <div>
                  <h2>{{ t('人格') }}</h2>
                </div>
              </summary>
              <div class="persona-controls">
                <SelectField
                  v-if="page.personas.length"
                  :model-value="activePersona"
                  :aria-label="t('切换人格')"
                  @change="switchPersona"
                >
                  <option
                    v-for="persona in page.personas"
                    :key="persona.id"
                    :label="t(persona.name)"
                    :value="persona.id"
                  ></option>
                </SelectField>
                <TextField
                  v-model="rename.value"
                  maxlength="64"
                  :placeholder="t('新的人格名称')"
                  @keyup.enter="renamePersona"
                />
                <ActionButton
                  :disabled="!rename.value.trim()"
                  :loading="loading"
                  @click="renamePersona"
                  >{{ t('重命名') }}</ActionButton
                >
                <div class="persona-create">
                  <ActionButton
                    :disabled="
                      loading ||
                      Boolean(
                        page.personaCapacity &&
                          page.personaCapacity.used >= page.personaCapacity.total,
                      )
                    "
                    @click="emit('persona', { persona_create: 'clone' })"
                    >{{ t('克隆当前人格') }}</ActionButton
                  ><ActionButton
                    :disabled="
                      loading ||
                      Boolean(
                        page.personaCapacity &&
                          page.personaCapacity.used >= page.personaCapacity.total,
                      )
                    "
                    @click="emit('persona', { persona_create: 'blank' })"
                    >{{ t('创建空白人格') }}</ActionButton
                  >
                </div>
              </div>
              <Notice
                :title="t('新建的人格无法删除，请确认后再创建。')"
                tone="warning"
                :closable="false"
              />
            </details>
          </div>
        </section>
        <section v-if="resources" class="hv-window">
          <h2 class="hv-window-title">{{ t(resources.title) }}</h2>
          <dl class="hv-values hv-window-body">
            <template v-for="metric in resources.metrics" :key="metric.label"
              ><dt>{{ t(metric.label) }}</dt>
              <dd>{{ t(metric.value) }}</dd></template
            >
          </dl>
        </section>
      </aside>
    </div>
    <details class="character-details hv-window">
      <summary>{{ t('详细属性与熟练度') }} · {{ page.statGroups.length }}</summary>
      <StatGroupsPanel :groups="page.statGroups" />
    </details>
  </div>
</template>

<style scoped>
.metric-band {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  overflow: hidden;
}

.metric-item {
  flex: 1 1 130px;
  border: 1px solid var(--border-soft);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  padding: 14px;
  background: var(--surface);
}

.metric-item span {
  color: var(--muted-foreground);
  font-size: 12px;
}

.metric-item strong {
  overflow: hidden;
  font-size: 18px;
  text-overflow: ellipsis;
}

.metric-item--progress {
  flex-basis: 280px;
  justify-content: center;
}

.experience-readout {
  color: var(--muted-foreground);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.character-section {
  padding: 22px 0;
  border-bottom: 1px solid var(--border-soft);
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
  color: var(--muted-foreground);
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
  color: var(--muted-foreground);
  font-size: 12px;
}

.attribute-submit span.danger {
  color: var(--danger);
}

.attribute-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--border-soft);
  border-radius: 10px;
}

.attribute-row > div {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.attribute-row span {
  color: var(--muted-foreground);
}

.attribute-row strong {
  font-size: 20px;
}

.persona-section > summary {
  cursor: pointer;
}

.persona-section > summary::after {
  content: attr(data-expand-label);
  flex-shrink: 0;
  color: var(--accent);
  font-size: 13px;
}

.persona-section[open] > summary::after {
  content: attr(data-collapse-label);
}

.persona-section:not([open]) > summary {
  margin-bottom: 0;
}

.persona-section > summary h2 {
  display: inline;
}

.persona-create {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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

  .persona-section > summary {
    flex-direction: row;
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
