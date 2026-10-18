<script setup lang="ts" generic="T extends string | number | boolean | undefined">
import { t } from '@/i18n'

import { Check, ChevronDown } from '@lucide/vue'
import { computed, Fragment, inject, useSlots, type VNode } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import {
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectPortal,
  SelectContent,
  SelectViewport,
  SelectItem,
  SelectItemText,
  SelectItemIndicator,
} from 'reka-ui'
import { fieldLabel } from './choiceContext'
defineOptions({ inheritAttrs: false })
const props = defineProps<{ placeholder?: string; clearable?: boolean; disabled?: boolean }>()
const value = defineModel<T>()
const emit = defineEmits<{ change: [value: T] }>()
const labelId = inject(fieldLabel, undefined)
const nativePicker = useMediaQuery('(pointer: coarse), (max-width: 767px)')
const slots = useSlots()
// Read the existing option VNodes, preserving their typed values and disabled state.
// No DOM mirroring, source-field renaming or separate desktop option data.
function getOptions(nodes: VNode[]): { value: T; label: string; disabled: boolean }[] {
  return nodes.flatMap((node) => {
    if (node.type === Fragment) return getOptions(node.children as VNode[])
    if (node.type !== 'option') return []
    const text =
      typeof node.children === 'string'
        ? node.children
        : ((node.children as VNode[]) || []).map((child) => child.children || '').join('')
    return [
      {
        value: (node.props?.value ?? text) as T,
        label: String(node.props?.label ?? text),
        disabled: node.props?.disabled !== undefined && node.props.disabled !== false,
      },
    ]
  })
}
// Slot content must be read during render, so parent option labels remain reactive.
let renderedOptions: ReturnType<typeof getOptions> = []
const options = () => (renderedOptions = getOptions(slots.default?.() || []))
const optionToken = (selected: T | undefined) =>
  selected === undefined ? '__empty' : `option:${String(selected)}`
const selectedToken = computed(() => optionToken(value.value))
function selectedLabel() {
  const selected = options().find((option) => optionToken(option.value) === selectedToken.value)
  return t(selected?.label ?? props.placeholder ?? (props.clearable ? '不限' : ''))
}
function selectDesktop(token: unknown) {
  const selected =
    token === '__empty'
      ? undefined
      : renderedOptions.find((option) => optionToken(option.value) === token)?.value
  value.value = selected as T
  emit('change', selected as T)
}
function select(event: Event) {
  const element = event.target as HTMLSelectElement
  const option = element.selectedOptions[0] as HTMLOptionElement & { _value?: string | number }
  const selected = (
    element.selectedIndex === 0 && (props.placeholder || props.clearable)
      ? undefined
      : (option?._value ?? element.value)
  ) as T
  value.value = selected
  emit('change', selected)
}
</script>
<template>
  <span class="ui-select" :class="$attrs.class">
    <select
      v-if="nativePicker"
      v-bind="{ ...$attrs, class: undefined }"
      :aria-labelledby="!$attrs['aria-label'] ? labelId : undefined"
      :value="value ?? ''"
      :disabled="disabled"
      @change="select"
    >
      <option v-if="placeholder || clearable" value="" :disabled="!clearable">
        {{ placeholder || t('不限') }}
      </option>
      <slot />
    </select>
    <SelectRoot
      v-else
      :model-value="selectedToken"
      :disabled="disabled"
      @update:model-value="selectDesktop"
    >
      <SelectTrigger
        v-bind="{ ...$attrs, class: undefined, name: undefined }"
        class="ui-select-trigger"
        :aria-labelledby="!$attrs['aria-label'] ? labelId : undefined"
      >
        <SelectValue :placeholder="t(placeholder)">{{ selectedLabel() }}</SelectValue>
      </SelectTrigger>
      <SelectPortal>
        <!-- The page already reserves its scrollbar gutter; a select must not add body lock padding. -->
        <SelectContent
          class="ui-select-popup"
          position="popper"
          :body-lock="false"
          :side-offset="5"
          :collision-padding="8"
        >
          <SelectViewport>
            <SelectItem
              v-if="props.placeholder || props.clearable"
              value="__empty"
              class="ui-select-option"
              :disabled="!clearable"
            >
              <SelectItemText>{{ placeholder || t('不限') }}</SelectItemText>
            </SelectItem>
            <SelectItem
              v-for="option in options()"
              :key="optionToken(option.value)"
              :value="optionToken(option.value)"
              :disabled="option.disabled"
              class="ui-select-option"
            >
              <SelectItemText>{{ t(option.label) }}</SelectItemText
              ><SelectItemIndicator class="select-check"><Check :size="14" /></SelectItemIndicator>
            </SelectItem>
          </SelectViewport>
        </SelectContent>
      </SelectPortal>
      <input
        v-if="$attrs.name"
        type="hidden"
        :name="String($attrs.name)"
        :value="String(value ?? '')"
        :disabled="disabled"
      />
    </SelectRoot>
    <ChevronDown :size="14" aria-hidden="true" />
  </span>
</template>
<style>
.ui-select-trigger {
  width: 100%;
  min-height: 40px;
  padding: 6px 30px 6px 11px;
  border: 1px solid var(--input);
  border-radius: 7px;
  color: var(--foreground);
  background: var(--surface);
  text-align: left;
  display: flex;
  align-items: center;
}
.ui-select-trigger > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ui-select-trigger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.ui-select-popup {
  z-index: 7000;
  min-width: var(--reka-select-trigger-width);
  max-width: min(440px, calc(100vw - 16px));
  max-height: min(320px, var(--reka-select-content-available-height));
  overflow: auto;
  padding: 5px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface);
  color: var(--foreground);
  box-shadow: var(--shadow);
  font-size: 14px;
}
.ui-select-option {
  position: relative;
  padding: 8px 30px 8px 10px;
  border-radius: 5px;
  cursor: pointer;
  outline: none;
}
.ui-select-option[data-highlighted] {
  background: var(--accent-soft);
  color: var(--accent);
}
.ui-select-option[data-disabled] {
  opacity: 0.45;
  cursor: not-allowed;
}
.select-check {
  position: absolute;
  right: 9px;
  top: 50%;
  transform: translateY(-50%);
}
</style>
