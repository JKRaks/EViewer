<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type {
  HentaiVerseAbility,
  HentaiVerseAbilityActionName,
  HentaiVerseAbilityPage,
} from '@/core/hentaiverse/model/hentaiVerse'

const props = defineProps<{ data: HentaiVerseAbilityPage; loading?: boolean }>()
const emit = defineEmits<{
  tree: [id: string]
  action: [name: HentaiVerseAbilityActionName | 'reset_all', value: string]
  equip: [slotId: string, abilityId: string]
}>()

const selectedAbilityId = ref('')
const selectedAbility = computed(() => props.data.abilities.find((ability) => ability.id === selectedAbilityId.value))

watch(() => props.data.selectedTree, () => {
  selectedAbilityId.value = ''
})

function isAcquired(ability: HentaiVerseAbility) {
  return (ability.level ?? 0) > 0 || (ability.level === null && ability.action === 'reset_ability')
}

function selectAbility(ability: HentaiVerseAbility) {
  if (!isAcquired(ability) || props.loading) return
  selectedAbilityId.value = selectedAbilityId.value === ability.id ? '' : ability.id
}
</script>

<template>
  <section class="ability-panel">
    <div class="ability-summary">
      <el-tabs
        v-if="data.trees.length"
        :model-value="data.selectedTree"
        class="ability-trees"
        @tab-change="emit('tree', String($event))"
      >
        <el-tab-pane v-for="tree in data.trees" :key="tree.id" :label="tree.label" :name="tree.id" />
      </el-tabs>
      <span v-if="data.abilityPoints">可用能力点 <strong>{{ data.abilityPoints }}</strong></span>
    </div>

    <div v-if="data.slots.length" class="ability-slots">
      <header>
        <div>
          <span>能力槽</span>
          <p>{{ selectedAbility ? `选择槽位装备 ${selectedAbility.name}` : '先选择一个已解锁能力，再选择目标槽位' }}</p>
        </div>
      </header>
      <div class="slot-grid">
        <button
          v-for="slot in data.slots"
          :key="slot.id"
          type="button"
          :class="{ locked: slot.locked }"
          :disabled="loading || (!slot.locked && !selectedAbilityId)"
          @click="slot.locked && slot.action
            ? emit('action', slot.action, slot.id)
            : emit('equip', slot.id, selectedAbilityId)"
        >
          <span>{{ slot.label }}</span>
          <strong>{{ slot.locked ? '点击解锁' : slot.abilityName || '空槽位' }}</strong>
        </button>
      </div>
    </div>

    <div v-if="data.abilities.length" class="ability-list">
      <article
        v-for="ability in data.abilities"
        :key="ability.id"
        :class="{ selected: selectedAbilityId === ability.id, selectable: isAcquired(ability) }"
        @click="selectAbility(ability)"
      >
        <div class="ability-main">
          <div>
            <h3>{{ ability.name }}</h3>
            <p v-if="ability.description">{{ ability.description }}</p>
          </div>
          <span class="ability-level">{{ ability.level ?? '等级未知' }}<template v-if="ability.maxLevel"> / {{ ability.maxLevel }}</template></span>
        </div>
        <div class="ability-meta">
          <span v-if="ability.cost">{{ ability.cost }}</span>
          <el-button
            v-if="ability.action"
            size="small"
            :type="ability.action === 'reset_ability' ? 'danger' : 'primary'"
            :plain="ability.action === 'reset_ability'"
            :disabled="ability.disabled"
            :loading="loading"
            @click.stop="emit('action', ability.action, ability.id)"
          >
            {{ ability.actionLabel || (ability.action === 'reset_ability' ? '重置' : '解锁') }}
          </el-button>
        </div>
      </article>
    </div>
    <el-empty v-else description="未能从源站解析当前能力树" />

    <div v-if="data.canResetAll" class="ability-footer">
      <el-button type="danger" plain :loading="loading" @click="emit('action', 'reset_all', '1')">
        重置全部能力
      </el-button>
    </div>
  </section>
</template>

<style scoped>
.ability-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-width: 0;
  gap: 24px;
}

.ability-summary {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.ability-trees {
  min-width: 0;
  max-width: 100%;
  flex: 1;
}

.ability-trees :deep(.el-tabs__header) {
  margin-bottom: 0;
}

.ability-summary > span {
  flex: 0 0 auto;
  color: var(--el-text-color-secondary);
}

.ability-summary strong {
  color: var(--el-color-primary);
}

.ability-slots {
  padding: 16px 0 20px;
  border-top: 1px solid var(--el-border-color-lighter);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.ability-slots header span {
  font-weight: 700;
}

.ability-slots header p {
  margin: 4px 0 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.slot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
  gap: 8px;
}

.slot-grid button {
  min-width: 0;
  min-height: 62px;
  padding: 8px 10px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  text-align: left;
  background: var(--el-bg-color);
}

.slot-grid button:not(:disabled) {
  cursor: pointer;
}

.slot-grid button.locked {
  border-style: dashed;
  color: var(--el-text-color-secondary);
}

.slot-grid span,
.slot-grid strong {
  display: block;
}

.slot-grid span {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.slot-grid strong {
  margin-top: 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ability-list {
  border-top: 1px solid var(--el-border-color-lighter);
}

.ability-list article {
  padding: 15px 2px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.ability-list article.selectable {
  cursor: pointer;
}

.ability-list article.selected {
  padding-right: 10px;
  padding-left: 10px;
  background: var(--el-color-primary-light-9);
}

.ability-main,
.ability-meta {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.ability-main h3 {
  margin: 0;
  font-size: 16px;
  letter-spacing: 0;
}

.ability-main > div {
  min-width: 0;
  overflow-wrap: anywhere;
}

.ability-main p {
  margin: 5px 0 0;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.ability-level {
  flex: 0 0 auto;
  font-weight: 700;
}

.ability-meta {
  align-items: center;
  min-height: 26px;
  margin-top: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.ability-footer {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 767px) {
  .ability-summary {
    align-items: stretch;
    flex-direction: column-reverse;
    gap: 8px;
  }

  .slot-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
