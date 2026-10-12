<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type {
  HentaiVerseFormAction,
  HentaiVerseFormBlock,
} from '@/core/hentaiverse/model/hentaiVerse'

const props = defineProps<{
  form: HentaiVerseFormBlock
  loading?: boolean
}>()

const emit = defineEmits<{
  submit: [
    section: HentaiVerseFormBlock['section'],
    data: Record<string, string | number | boolean>,
  ]
}>()

const expandedGroups = ref<string[]>([])
const values = reactive<Record<string, string | boolean>>({})
const controlGroups = computed(() => {
  const definitions = props.form.groups?.length
    ? props.form.groups
    : [{ key: 'default', title: '', description: '' }]
  const controlsByGroup = new Map(
    definitions.map((group) => [group.key, [] as typeof props.form.controls]),
  )
  props.form.controls.forEach((control) => {
    const key =
      control.group && controlsByGroup.has(control.group) ? control.group : definitions[0]!.key
    controlsByGroup.get(key)!.push(control)
  })

  return definitions.flatMap((group) => {
    const controls = controlsByGroup.get(group.key) || []
    if (!controls.length) return []
    const radioGroups = new Map<string, typeof controls>()
    controls
      .filter((control) => control.type === 'radio')
      .forEach((control) => {
        const radioGroup = radioGroups.get(control.name) || []
        radioGroup.push(control)
        radioGroups.set(control.name, radioGroup)
      })
    return [
      {
        ...group,
        controls: controls.filter((control) => control.type !== 'radio'),
        radioGroups: Array.from(radioGroups, ([name, radioControls]) => ({
          name,
          controls: radioControls,
        })),
      },
    ]
  })
})

watch(
  () => props.form.id,
  () => {
    expandedGroups.value = controlGroups.value.slice(0, 1).map((group) => group.key)
  },
  { immediate: true },
)

function toggleGroup(key: string) {
  expandedGroups.value = expandedGroups.value.includes(key)
    ? expandedGroups.value.filter((value) => value !== key)
    : [...expandedGroups.value, key]
}

const allExpanded = computed(() =>
  controlGroups.value.every((group) => expandedGroups.value.includes(group.key)),
)

watch(
  () => props.form,
  (form) => {
    Object.keys(values).forEach((key) => delete values[key])
    form.controls.forEach((control) => {
      if (control.type === 'checkbox') values[control.name] = Boolean(control.checked)
      else if (control.type === 'radio') {
        if (control.checked) values[control.name] = control.value
        else if (!(control.name in values)) values[control.name] = ''
      } else values[control.name] = control.value
    })
  },
  { immediate: true },
)

function submit(action?: HentaiVerseFormAction) {
  const data: Record<string, string | number | boolean> = { ...props.form.hidden }
  props.form.controls.forEach((control) => {
    if (control.disabled) return
    const value = values[control.name]
    if (control.type === 'checkbox') {
      if (value) data[control.name] = control.value || '1'
      return
    }
    if (value !== undefined) data[control.name] = value
  })
  if (action?.name) data[action.name] = action.value
  emit('submit', props.form.section, data)
}
</script>

<template>
  <section class="hv-form-panel">
    <header class="hv-panel-heading">
      <div>
        <h2>{{ form.title }}</h2>
        <p v-if="form.description">{{ form.description }}</p>
      </div>
      <el-button
        v-if="controlGroups.length > 1"
        text
        type="primary"
        @click="expandedGroups = allExpanded ? [] : controlGroups.map((group) => group.key)"
        >{{ allExpanded ? '全部收起' : '全部展开' }}</el-button
      >
    </header>

    <component
      :is="group.title ? 'details' : 'section'"
      v-for="group in controlGroups"
      :key="group.key"
      class="hv-form-group"
      :class="{ 'is-grouped': group.title }"
      :open="group.title && expandedGroups.includes(group.key)"
    >
      <summary
        v-if="group.title"
        class="hv-form-group-heading"
        @click.prevent="toggleGroup(group.key)"
      >
        <span class="group-title"
          >{{ group.title }}
          <small>{{ group.controls.length + group.radioGroups.length }} 项</small>
        </span>
        <p v-if="group.description">{{ group.description }}</p>
      </summary>

      <div class="hv-form-grid">
        <template v-for="control in group.controls" :key="`${control.name}:${control.value}`">
          <label v-if="control.type !== 'checkbox'" class="hv-field-label">{{
            control.label
          }}</label>
          <el-select
            v-if="control.type === 'select'"
            v-model="values[control.name]"
            :aria-label="control.label"
            :disabled="loading || control.disabled"
          >
            <el-option
              v-for="option in control.options"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-input
            v-else-if="control.type === 'textarea'"
            v-model="values[control.name] as string"
            :aria-label="control.label"
            type="textarea"
            :rows="3"
            :disabled="loading || control.disabled"
          />
          <el-input-number
            v-else-if="control.type === 'number'"
            v-model="values[control.name] as string"
            :aria-label="control.label"
            :min="control.min"
            :max="control.max"
            :step="control.step || 1"
            controls-position="right"
            :disabled="loading || control.disabled"
          />
          <el-checkbox
            v-else-if="control.type === 'checkbox'"
            v-model="values[control.name] as boolean"
            class="hv-checkbox"
            :disabled="loading || control.disabled"
          >
            {{ control.label }}
          </el-checkbox>
          <el-input
            v-else
            v-model="values[control.name] as string"
            :type="control.type === 'password' ? 'password' : 'text'"
            :disabled="loading || control.disabled"
            :aria-label="control.label"
          />
        </template>

        <template v-for="radioGroup in group.radioGroups" :key="radioGroup.name">
          <label class="hv-field-label">{{
            radioGroup.controls[0]?.groupLabel || radioGroup.controls[0]?.label
          }}</label>
          <el-radio-group v-model="values[radioGroup.name]" class="hv-radio-group">
            <el-radio
              v-for="control in radioGroup.controls"
              :key="control.value"
              :value="control.value"
              :disabled="loading || control.disabled"
            >
              {{ control.label }}
              <small v-if="control.help" class="control-help"> · {{ control.help }}</small>
            </el-radio>
          </el-radio-group>
        </template>
      </div>
    </component>

    <footer class="hv-form-actions">
      <el-button
        v-for="action in form.actions"
        :key="`${action.name}:${action.value}`"
        :type="action.danger ? 'danger' : 'primary'"
        :plain="action.danger"
        :loading="loading"
        :disabled="action.disabled"
        @click="submit(action)"
      >
        {{ action.label }}
      </el-button>
    </footer>
  </section>
</template>

<style scoped>
.control-help {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.hv-form-panel {
  padding: 18px 0;
  border-top: 1px solid var(--el-border-color-lighter);
}

.hv-panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 16px;
}

.hv-panel-heading .el-button {
  flex-shrink: 0;
}

.hv-panel-heading h2 {
  margin: 0;
  font-size: 17px;
  letter-spacing: 0;
}

.hv-panel-heading p {
  margin: 6px 0 0;
  color: var(--el-text-color-secondary);
  line-height: 1.55;
}

.hv-form-group {
  min-width: 0;
  padding: 18px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.hv-form-group.is-grouped {
  padding: 16px;
  margin-bottom: 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-bg-color);
}

.hv-form-group-heading {
  cursor: pointer;
}
.group-title {
  font-size: 15px;
  font-weight: 600;
}
.group-title small {
  margin-left: 8px;
  font-weight: 400;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.hv-form-group-heading p {
  padding-left: 16px;
}

.hv-form-group-heading p {
  margin: 5px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.hv-form-grid {
  display: grid;
  grid-template-columns: minmax(150px, 220px) minmax(220px, 1fr);
  gap: 12px 18px;
  align-items: center;
  min-width: 0;
  margin-top: 18px;
}

.hv-form-grid > * {
  min-width: 0;
}

.hv-form-grid :deep(.el-input),
.hv-form-grid :deep(.el-input-number),
.hv-form-grid :deep(.el-select),
.hv-form-grid :deep(.el-textarea),
.hv-form-grid :deep(.el-radio-group) {
  width: 100%;
  max-width: 100%;
}

.hv-radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
}

.hv-radio-group :deep(.el-radio) {
  height: auto;
  min-height: 32px;
  margin-right: 0;
  white-space: normal;
}

.hv-field-label {
  color: var(--el-text-color-regular);
  font-weight: 600;
}

.hv-checkbox {
  grid-column: 1 / -1;
  height: auto;
  white-space: normal;
}

.hv-checkbox :deep(.el-checkbox__label) {
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.hv-form-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}

.hv-form-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

@media (max-width: 767px) {
  .hv-form-grid {
    grid-template-columns: 1fr;
    gap: 7px;
  }

  .hv-field-label:not(:first-child) {
    margin-top: 8px;
  }

  .hv-form-actions .el-button {
    flex: 1 1 120px;
    min-height: 40px;
  }
}
</style>
