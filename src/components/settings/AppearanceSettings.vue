<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'
import { Monitor, Moon, Plus, SlidersHorizontal, Sun } from '@lucide/vue'
import { t } from '@/i18n'
import ActionButton from '@/components/primitives/ActionButton.vue'
import ChoiceGroup from '@/components/primitives/ChoiceGroup.vue'
import RadioChoice from '@/components/primitives/RadioChoice.vue'
import ModalPanel from '@/components/primitives/ModalPanel.vue'
import ThemePaletteSwatch from './ThemePaletteSwatch.vue'
import { activeTheme, effectiveThemeScheme, themeSettings } from '@/core/theme/themeSettings'
import {
  contrastTextColor,
  defaultTheme,
  normalizeCustomTheme,
  paletteCssVariables,
  themeColorFields,
  themePresets,
  type ThemeColors,
  type ThemePreset,
  type ThemeScheme,
} from '@/core/theme/themePalette'

const id = useId()
const editorOpen = ref(false)
const editButton = ref<InstanceType<typeof ActionButton>>()
const editingScheme = ref<ThemeScheme>('light')
const draft = ref<ThemeColors>({ light: { ...defaultTheme.light }, dark: { ...defaultTheme.dark } })
const paletteChoices = computed<(ThemePreset | null)[]>(() => [
  ...themePresets,
  themeSettings.custom ? { id: 'custom', name: '自定义', ...themeSettings.custom } : null,
])
const editingSchemeLabel = computed(() => t(editingScheme.value === 'light' ? '日间' : '夜间'))
const previewStyle = computed(() =>
  paletteCssVariables({
    ...draft.value[editingScheme.value],
    onAccent: contrastTextColor(draft.value[editingScheme.value].accent),
  }),
)

function editCustomTheme() {
  const source = themeSettings.custom || activeTheme.value
  draft.value = { light: { ...source.light }, dark: { ...source.dark } }
  editingScheme.value = effectiveThemeScheme.value
  editorOpen.value = true
}

function saveCustomTheme() {
  const colors = normalizeCustomTheme(draft.value)
  if (!colors) return
  themeSettings.custom = colors
  themeSettings.preset = 'custom'
  editorOpen.value = false
}

function restoreEditorFocus(event: Event) {
  const button = editButton.value?.$el
  if (button instanceof HTMLElement && button.isConnected) {
    event.preventDefault()
    void nextTick(() => button.focus({ preventScroll: true }))
  }
}
</script>

<template>
  <div class="appearance-settings">
    <div class="appearance-mode-row">
      <div class="appearance-mode-copy">
        <span>{{ t('明暗模式') }}</span>
        <small>{{ t('让界面随你的习惯切换') }}</small>
      </div>
      <ChoiceGroup
        v-model="themeSettings.mode"
        class="appearance-mode-control"
        :aria-label="t('明暗模式')"
      >
        <RadioChoice value="light"
          ><Sun :size="14" aria-hidden="true" />{{ t('日间') }}</RadioChoice
        >
        <RadioChoice value="dark"
          ><Moon :size="14" aria-hidden="true" />{{ t('夜间') }}</RadioChoice
        >
        <RadioChoice value="auto"
          ><Monitor :size="14" aria-hidden="true" />{{ t('跟随系统') }}</RadioChoice
        >
      </ChoiceGroup>
    </div>

    <fieldset class="appearance-palettes">
      <legend>{{ t('界面配色') }}</legend>
      <div class="appearance-palette-grid">
        <div
          v-for="preset in paletteChoices"
          :key="preset?.id || 'custom'"
          class="appearance-palette-item"
        >
          <label v-if="preset" class="appearance-palette-choice">
            <input
              v-model="themeSettings.preset"
              type="radio"
              :name="`${id}-palette`"
              :value="preset.id"
              :aria-label="t(preset.name)"
            />
            <ThemePaletteSwatch
              :preset="preset"
              :scheme="effectiveThemeScheme"
              :selected="themeSettings.preset === preset.id"
            />
            <span class="appearance-palette-name">{{ t(preset.name) }}</span>
            <span class="appearance-palette-status">{{
              themeSettings.preset === preset.id ? t('使用中') : ''
            }}</span>
          </label>
          <button
            v-else
            type="button"
            class="appearance-custom-empty"
            :aria-label="t('自定义配色')"
            @click="editCustomTheme"
          >
            <span class="appearance-custom-slot"
              ><span><Plus :size="24" aria-hidden="true" /></span
            ></span>
            <span class="appearance-palette-name">{{ t('自定义') }}</span>
            <span class="appearance-palette-status" />
          </button>
        </div>
      </div>
    </fieldset>

    <div class="appearance-current-row">
      <span class="appearance-current" role="status">{{
        t('正在使用{p0} · {p1}', {
          p0: t(activeTheme.name),
          p1: t(effectiveThemeScheme === 'light' ? '日间' : '夜间'),
        })
      }}</span>
      <ActionButton
        v-if="themeSettings.preset === 'custom'"
        ref="editButton"
        variant="ghost"
        size="sm"
        :icon="SlidersHorizontal"
        class="appearance-edit"
        @click="editCustomTheme"
        >{{ t('编辑配色') }}</ActionButton
      >
    </div>

    <ModalPanel
      v-model="editorOpen"
      :title="t('自定义配色')"
      width="480px"
      @close-auto-focus="restoreEditorFocus"
    >
      <div class="theme-editor">
        <ChoiceGroup
          v-model="editingScheme"
          class="appearance-mode-control theme-editor-modes"
          :aria-label="t('正在编辑的模式')"
        >
          <RadioChoice value="light"
            ><Sun :size="14" aria-hidden="true" />{{ t('日间配色') }}</RadioChoice
          >
          <RadioChoice value="dark"
            ><Moon :size="14" aria-hidden="true" />{{ t('夜间配色') }}</RadioChoice
          >
        </ChoiceGroup>
        <div class="theme-color-grid">
          <div v-for="field in themeColorFields" :key="field.key" class="theme-color-field">
            <div class="theme-color-caption">
              <label :for="`${id}-${field.key}`">{{ t(field.label) }}</label>
              <output :for="`${id}-${field.key}`">{{
                draft[editingScheme][field.key].toUpperCase()
              }}</output>
            </div>
            <input
              :id="`${id}-${field.key}`"
              v-model="draft[editingScheme][field.key]"
              type="color"
              :aria-label="[editingSchemeLabel, t(field.label)].join(' · ')"
            />
          </div>
        </div>
        <div
          class="theme-color-preview"
          :style="previewStyle"
          :aria-label="t('自定义配色实时预览')"
        >
          <span class="theme-preview-brand">EViewer<span>.</span></span>
          <div class="theme-preview-row">
            <div>
              <span>{{ t('刚刚好的颜色') }}</span
              ><small>{{ t('让每次打开，都合心意。') }}</small>
            </div>
            <span class="theme-preview-action">{{ t('已选中') }}</span>
          </div>
        </div>
      </div>
      <template #footer>
        <ActionButton @click="editorOpen = false">{{ t('取消') }}</ActionButton>
        <ActionButton variant="default" @click="saveCustomTheme">{{
          t('保存并使用')
        }}</ActionButton>
      </template>
    </ModalPanel>
  </div>
</template>

<style scoped>
.appearance-settings {
  padding: 10px 0 8px;
}
.appearance-mode-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 26px;
}
.appearance-mode-copy {
  display: grid;
  gap: 3px;
}
.appearance-mode-copy > span {
  font-size: 15px;
}
.appearance-mode-copy small {
  font-size: 12px;
  color: var(--muted-foreground);
}
.appearance-mode-control {
  gap: 3px;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}
.appearance-mode-control :deep(.ui-radio) {
  position: relative;
  min-height: 38px;
  padding: 0;
  border-radius: 5px;
}
.appearance-mode-control :deep(.ui-radio input),
.appearance-palette-choice > input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
}
.appearance-mode-control :deep(.ui-radio > span) {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 38px;
  padding: 6px 10px;
  border-radius: 5px;
  color: var(--muted-foreground);
  font-size: 13px;
  white-space: nowrap;
}
.appearance-mode-control :deep(.ui-radio.is-checked > span) {
  background: var(--accent);
  color: var(--accent-foreground);
}
.appearance-mode-control :deep(.ui-radio:has(input:focus-visible)) {
  outline: 2px solid var(--ring);
  outline-offset: 3px;
}
.appearance-palettes {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.appearance-palettes > legend {
  padding: 0;
  font-size: 14px;
}
.appearance-palette-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 10px;
}
.appearance-palette-item {
  min-width: 0;
  text-align: center;
}
.appearance-palette-choice,
.appearance-custom-empty {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding: 0;
  border: 0;
  color: var(--foreground);
  background: transparent;
  cursor: pointer;
}
.appearance-palette-choice:has(input:focus-visible) :deep(.theme-swatch) {
  outline: 2px solid var(--ring);
  outline-offset: 6px;
}
.appearance-palette-name {
  margin-top: 3px;
  font-size: 13px;
  font-weight: 500;
}
.appearance-palette-choice:has(input:checked) .appearance-palette-name {
  color: var(--accent);
}
.appearance-palette-status {
  min-height: 22px;
  font-size: 11px;
  color: var(--muted-foreground);
}
.appearance-custom-slot {
  display: grid;
  place-items: center;
  width: 100%;
  height: 116px;
}
.appearance-custom-slot > span {
  display: grid;
  place-items: center;
  width: 96px;
  height: 96px;
  border: 1px dashed var(--border);
  border-radius: 7px;
  background: var(--surface);
  color: var(--muted-foreground);
}
.appearance-current-row {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0 8px;
  min-height: 44px;
  margin-top: 12px;
}
.appearance-current {
  min-width: 0;
  font-size: 12px;
  color: var(--muted-foreground);
}
.appearance-edit.ui-button {
  min-height: 36px;
  padding: 4px 8px;
  color: var(--muted-foreground);
  font-size: 12px;
}
.theme-editor {
  display: grid;
  gap: 18px;
}
.theme-editor-modes {
  flex-wrap: nowrap;
}
.theme-editor-modes :deep(.ui-radio),
.theme-editor-modes :deep(.ui-radio > span) {
  flex: 1;
}
.theme-color-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 18px;
}
.theme-color-field {
  min-width: 0;
}
.theme-color-caption {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0 4px;
  margin-bottom: 5px;
  font-size: 12px;
}
.theme-color-caption output {
  font-size: 11px;
  color: var(--muted-foreground);
  font-variant-numeric: tabular-nums;
}
.theme-color-field input {
  display: block;
  width: 100%;
  height: 38px;
  padding: 3px;
  border: 1px solid var(--input);
  border-radius: 6px;
  background: var(--surface);
  cursor: pointer;
}
.theme-color-field input::-webkit-color-swatch-wrapper {
  padding: 0;
}
.theme-color-field input::-webkit-color-swatch {
  border: 0;
  border-radius: 3px;
}
.theme-color-preview {
  padding: 13px 15px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--background);
  color: var(--foreground);
}
.theme-preview-brand {
  font:
    italic 21px/1.5 Georgia,
    serif;
}
.theme-preview-brand > span {
  color: var(--accent);
}
.theme-preview-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 9px;
  padding: 10px 11px;
  border-radius: 5px;
  background: var(--surface);
}
.theme-preview-row > div {
  display: grid;
  gap: 2px;
  font-size: 13px;
}
.theme-preview-row small {
  font-size: 11px;
  color: var(--muted-foreground);
}
.theme-preview-action {
  padding: 6px 10px;
  border-radius: 5px;
  font-size: 12px;
  background: var(--accent);
  color: var(--accent-foreground);
}
@media (max-width: 560px) {
  .appearance-palette-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .appearance-mode-control {
    width: 100%;
    flex-wrap: nowrap;
  }
  .appearance-mode-control :deep(.ui-radio),
  .appearance-mode-control :deep(.ui-radio > span) {
    flex: 1;
  }
  .appearance-mode-control :deep(.ui-radio > span) {
    padding: 6px 8px;
  }
  .theme-color-grid {
    gap: 10px 12px;
  }
}
@media (pointer: coarse) {
  .appearance-mode-control :deep(.ui-radio > span),
  .appearance-edit.ui-button,
  .theme-color-field input {
    min-height: 44px;
  }
}
@media (max-width: 420px) {
  .appearance-mode-control :deep(.ui-radio > span) {
    gap: 4px;
    padding: 6px 5px;
    font-size: 12px;
  }
  .appearance-mode-control :deep(svg) {
    width: 13px;
    height: 13px;
  }
}
</style>
