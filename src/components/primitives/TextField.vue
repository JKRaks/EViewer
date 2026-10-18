<script setup lang="ts">
import { t } from '@/i18n'

import { inject, ref, useAttrs } from 'vue'
import { fieldLabel } from './choiceContext'
import { Eye, EyeOff, X } from '@lucide/vue'
import { Input } from '@/components/ui/input'
defineOptions({ inheritAttrs: false })
const attrs = useAttrs()
withDefaults(
  defineProps<{
    type?: string
    clearable?: boolean
    showPassword?: boolean
    rows?: number
    autosize?: boolean | object
    showWordLimit?: boolean
  }>(),
  { type: 'text', rows: 4 },
)
const value = defineModel<string | number | undefined>()
const revealed = ref(false)
const labelId = inject(fieldLabel, undefined)
</script>
<template>
  <div class="ui-input" :class="attrs.class">
    <span v-if="$slots.prepend" class="ui-input__addon"><slot name="prepend" /></span>
    <span v-if="$slots.prefix" class="ui-input__prefix"><slot name="prefix" /></span>
    <textarea
      v-if="type === 'textarea'"
      v-bind="{ ...attrs, class: undefined }"
      v-model="value"
      :aria-labelledby="!attrs['aria-label'] ? labelId : undefined"
      :rows="rows"
      class="ui-textarea__inner"
    />
    <Input
      v-else
      v-bind="{ ...attrs, class: undefined }"
      v-model="value"
      :aria-labelledby="!attrs['aria-label'] ? labelId : undefined"
      :type="showPassword && revealed ? 'text' : type"
      class="ui-input__inner"
    />
    <button
      v-if="clearable && value && !attrs.disabled"
      type="button"
      class="ui-input__utility"
      :aria-label="t('清空输入')"
      :disabled="attrs.disabled !== undefined && attrs.disabled !== false"
      @click="value = ''"
    >
      <X :size="14" />
    </button>
    <button
      v-if="showPassword"
      type="button"
      class="ui-input__utility"
      :aria-label="revealed ? t('隐藏内容') : t('显示内容')"
      :disabled="attrs.disabled !== undefined && attrs.disabled !== false"
      @click="revealed = !revealed"
    >
      <component :is="revealed ? EyeOff : Eye" :size="16" />
    </button>
    <slot name="suffix" />
    <span v-if="showWordLimit && attrs.maxlength" class="ui-input__addon"
      >{{ String(value ?? '').length }}/{{ attrs.maxlength }}</span
    >
    <span v-if="$slots.append" class="ui-input__addon"><slot name="append" /></span>
  </div>
</template>
