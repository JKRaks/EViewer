<script setup lang="ts">
import { computed, ref } from 'vue'
import { t } from '@/i18n'
import ActionButton from '@/components/primitives/ActionButton.vue'
import type { HentaiVerseBattleAction } from '@/core/hentaiverse/model/hentaiVerse'

const props = defineProps<{
  actions: HentaiVerseBattleAction[]
  pending: boolean
  activeKey: string
}>()
const emit = defineEmits<{ act: [action: HentaiVerseBattleAction] }>()
const category = ref('offense')
const groups = computed(() => {
  const common: HentaiVerseBattleAction[] = []
  const offense: HentaiVerseBattleAction[] = []
  const support: HentaiVerseBattleAction[] = []
  const other: HentaiVerseBattleAction[] = []
  for (const action of props.actions) {
    if (action.mode === 'attack' || action.mode === 'spirit' || action.kind === 'heal')
      common.push(action)
    else if (action.mode === 'magic' && ['offense', 'weapon', 'debuff'].includes(action.kind || ''))
      offense.push(action)
    else if (action.mode === 'magic' && ['full-heal', 'regen'].includes(action.kind || ''))
      support.push(action)
    else if (action.mode === 'magic' && action.target === 'self') support.push(action)
    else other.push(action)
  }
  return { common, offense, support, other }
})
</script>

<template>
  <div class="action-menu">
    <div v-for="group in ['common', 'skills', 'other']" :key="group">
      <div v-if="group === 'skills'" class="skill-tabs" :aria-label="t('技能分类')">
        <button
          v-for="tab in ['offense', 'support']"
          :key="tab"
          type="button"
          :aria-pressed="category === tab"
          @click="category = tab"
        >
          {{ t(tab === 'offense' ? '进攻' : '恢复 / 辅助') }}
        </button>
      </div>
      <component :is="group === 'other' ? 'details' : 'div'">
        <summary v-if="group === 'other'">{{ t('其他动作') }}</summary>
        <div class="action-grid" :class="{ common: group === 'common' }">
          <ActionButton
            v-for="action in group === 'common'
              ? groups.common
              : group === 'other'
                ? groups.other
                : category === 'offense'
                  ? groups.offense
                  : groups.support"
            :key="`${action.mode}:${action.skill}`"
            :variant="action.mode === 'attack' ? 'default' : 'outline'"
            :loading="pending && activeKey === `${action.mode}:${action.skill}`"
            :disabled="pending || action.available === false"
            :title="t(action.description)"
            :aria-label="`${t(action.label)}：${t(action.description)}`"
            @click="emit('act', action)"
            >{{ t(action.label) }}</ActionButton
          >
        </div>
      </component>
    </div>
    <p v-if="!actions.length">{{ t('未能解析当前回合的可用操作，请刷新战斗状态') }}</p>
  </div>
</template>

<style scoped>
.action-menu {
  display: grid;
  gap: 10px;
}
.action-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}
.action-grid.common {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.action-grid :deep(.ui-button) {
  min-width: 0;
  min-height: 44px;
  height: auto;
  white-space: normal;
  border-radius: 0;
  padding: 6px;
  font-size: 13px;
}
.skill-tabs {
  display: flex;
  gap: 18px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 8px;
}
.skill-tabs button {
  min-height: 44px;
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  color: var(--muted-foreground);
  cursor: pointer;
}
.skill-tabs button[aria-pressed='true'] {
  border-color: var(--accent);
  color: var(--foreground);
}
summary {
  min-height: 44px;
  align-content: center;
  cursor: pointer;
  font-size: 13px;
}
</style>
