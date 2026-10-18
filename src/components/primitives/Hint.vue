<script setup lang="ts">
import { t } from '@/i18n'
defineOptions({ name: 'InputHint' })
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
defineProps<{ content?: string; placement?: string; disabled?: boolean }>()
</script>
<template>
  <Tooltip :disabled="disabled"
    ><TooltipTrigger as-child><slot /></TooltipTrigger
    ><TooltipContent
      v-if="!disabled"
      :side="placement === 'bottom' ? 'bottom' : placement === 'right' ? 'right' : 'top'"
      >{{ t(content) }}<slot name="content" /></TooltipContent
  ></Tooltip>
</template>
