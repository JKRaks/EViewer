<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { HentaiVerseFormAction, HentaiVerseFormBlock } from '@/core/hentaiverse/model/hentaiVerse'

const props = defineProps<{
  form: HentaiVerseFormBlock
  loading?: boolean
}>()

const emit = defineEmits<{
  submit: [section: HentaiVerseFormBlock['section'], data: Record<string, string | number | boolean>]
}>()

const values = reactive<Record<string, string | boolean>>({})
const visibleControls = computed(() => props.form.controls.filter((control) => control.type !== 'radio'))
const radioGroups = computed(() => {
  const groups = new Map<string, typeof props.form.controls>()
  props.form.controls.filter((control) => control.type === 'radio').forEach((control) => {
    const group = groups.get(control.name) || []
    group.push(control)
    groups.set(control.name, group)
  })
  return Array.from(groups, ([name, controls]) => ({ name, controls }))
})

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
    const value = values[control.name]
    if (control.type === 'checkbox') {
      if (value) data[control.name] = control.value || '1'
      return
    }
    if (value !== undefined && value !== '') data[control.name] = value
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
    </header>

    <div class="hv-form-grid">
      <template v-for="control in visibleControls" :key="`${control.name}:${control.value}`">
        <label v-if="control.type !== 'checkbox'" class="hv-field-label">{{ control.label }}</label>
        <el-select
          v-if="control.type === 'select'"
          v-model="values[control.name]"
          :aria-label="control.label"
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
          type="textarea"
          :rows="3"
        />
        <el-input-number
          v-else-if="control.type === 'number'"
          v-model="values[control.name] as string"
          :min="control.min"
          :max="control.max"
          :step="control.step || 1"
          controls-position="right"
        />
        <el-checkbox
          v-else-if="control.type === 'checkbox'"
          v-model="values[control.name] as boolean"
          class="hv-checkbox"
        >
          {{ control.label }}
        </el-checkbox>
        <el-input
          v-else
          v-model="values[control.name] as string"
          :type="control.type === 'password' ? 'password' : 'text'"
          :aria-label="control.label"
        />
      </template>

      <template v-for="group in radioGroups" :key="group.name">
        <label class="hv-field-label">{{ group.controls[0]?.label }}</label>
        <el-radio-group v-model="values[group.name]">
          <el-radio v-for="control in group.controls" :key="control.value" :value="control.value">
            {{ control.label }}
          </el-radio>
        </el-radio-group>
      </template>
    </div>

    <footer class="hv-form-actions">
      <el-button
        v-for="action in form.actions"
        :key="`${action.name}:${action.value}`"
        :type="action.danger ? 'danger' : 'primary'"
        :plain="action.danger"
        :loading="loading"
        @click="submit(action)"
      >
        {{ action.label }}
      </el-button>
    </footer>
  </section>
</template>

<style scoped>
.hv-form-panel {
  padding: 18px 0;
  border-top: 1px solid var(--el-border-color-lighter);
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

.hv-form-grid {
  display: grid;
  grid-template-columns: minmax(150px, 220px) minmax(220px, 1fr);
  gap: 12px 18px;
  align-items: center;
  margin-top: 18px;
}

.hv-field-label {
  color: var(--el-text-color-regular);
  font-weight: 600;
}

.hv-checkbox {
  grid-column: 1 / -1;
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
