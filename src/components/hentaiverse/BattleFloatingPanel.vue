<script setup lang="ts">
import { t } from '@/i18n'

import '@/assets/hentaiverse.css'
import CampScene from './CampScene.vue'
import ActionButton from '@/components/primitives/ActionButton.vue'
import ProgressMeter from '@/components/primitives/ProgressMeter.vue'
import Notice from '@/components/primitives/Notice.vue'
import IconFrame from '@/components/primitives/IconFrame.vue'
import Hint from '@/components/primitives/Hint.vue'
import ModalPanel from '@/components/primitives/ModalPanel.vue'
import SelectField from '@/components/primitives/SelectField.vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  Crosshair as Aim,
  Package as Box,
  CircleCheck,
  X as Close,
  HeartPulse as FirstAidKit,
  Zap as Lightning,
  LockKeyhole as Lock,
  WandSparkles as MagicStick,
  Minus,
  Navigation as Position,
  Send as Promotion,
  RefreshCw as Refresh,
  Search,
} from '@lucide/vue'
import { notify } from '@/components/primitives/feedback'
import {
  enterHentaiVerseBattle,
  hentaiVerseState,
  hideHentaiVerseBattle,
  performHentaiVerseBattleAction,
  showHentaiVerseBattle,
} from '@/core/hentaiverse/hentaiVerseStore'
import type {
  HentaiVerseBattleAction,
  HentaiVerseBattleMode,
  HentaiVerseBattleVital,
} from '@/core/hentaiverse/model/hentaiVerse'

interface QueuedBattleAction {
  mode: HentaiVerseBattleMode
  skill: number
  label: string
}

const selectedTarget = ref(1)
const battle = computed(() => hentaiVerseState.battle)
const livingMonsters = computed(
  () =>
    battle.value?.monsters.filter(
      (monster) =>
        !monster.defeated && monster.healthPercent !== undefined && monster.healthPercent > 0,
    ) || [],
)
const activeTarget = computed(() => {
  const monsters = battle.value?.monsters ?? []
  const available = new Set(livingMonsters.value.map((monster) => monster.id))
  if (available.has(selectedTarget.value)) return selectedTarget.value
  const previousIndex = monsters.findIndex((monster) => monster.id === selectedTarget.value)
  return (
    monsters.slice(previousIndex + 1).find((monster) => available.has(monster.id))?.id ??
    livingMonsters.value[0]?.id
  )
})
const newestLogFirst = computed(() => [...(battle.value?.log ?? [])].reverse())
const monsterGaugeWidth = ref(64)
const queue = ref<QueuedBattleAction[]>([])
const draftQueue = ref<string[]>([])
const queueDialogVisible = ref(false)
const queueRunning = ref(false)
const queueCountdown = ref(0)
let cancelDelay: (() => void) | undefined
let queueRunId = 0
const actionOptions = computed(
  () =>
    battle.value?.actions.map((action) => ({
      value: `${action.mode}:${action.skill}`,
      label: action.label,
    })) ?? [],
)

function updateGaugeWidth() {
  monsterGaugeWidth.value = window.innerWidth < 768 ? 54 : 64
}

onMounted(() => {
  updateGaugeWidth()
  window.addEventListener('resize', updateGaugeWidth)
})
onUnmounted(() => {
  window.removeEventListener('resize', updateGaugeWidth)
  cancelQueue()
})
const vitalColors: Record<HentaiVerseBattleVital['key'], string> = {
  health: '#4f9f64',
  magic: '#4f7fc4',
  spirit: '#c65d6f',
}

watch(
  activeTarget,
  (target) => {
    selectedTarget.value = target ?? 0
  },
  { immediate: true },
)

watch(
  () => battle.value?.completed,
  (completed, wasCompleted) => {
    if (!completed || wasCompleted) return
    notify.success({
      title: t('战斗已结束'),
      message: t('战斗结果已保留在面板中，查看后可关闭战斗面板。'),
      duration: 5000,
    })
  },
)

async function act(action: HentaiVerseBattleAction) {
  if (queueRunning.value) return
  try {
    const target = action.target === 'enemy' ? activeTarget.value : 0
    if (target === undefined) throw new Error(t('没有可用的怪物目标'))
    await performHentaiVerseBattleAction(action.mode, target, action.skill)
  } catch (error) {
    notify.error(error instanceof Error ? error.message : t('战斗动作提交失败'))
  }
}

function openQueueSettings() {
  draftQueue.value = queue.value.length
    ? queue.value.map((item) => `${item.mode}:${item.skill}`)
    : ['']
  queueDialogVisible.value = true
}

function saveQueue() {
  if (!draftQueue.value.length || draftQueue.value.some((key) => !key)) {
    notify.warning(t('请设置至少一项操作'))
    return
  }
  const actions = draftQueue.value.map((key) =>
    battle.value?.actions.find((action) => `${action.mode}:${action.skill}` === key),
  )
  if (actions.some((action) => !action)) {
    notify.warning(t('队列中有当前不可用的操作，请重新选择'))
    return
  }
  queue.value = actions.map((action) => ({
    mode: action!.mode,
    skill: action!.skill,
    label: action!.label,
  }))
  queueDialogVisible.value = false
}

function cancelQueue() {
  queueRunId++
  cancelDelay?.()
  cancelDelay = undefined
  queueCountdown.value = 0
}

function waitThreeSeconds(runId: number): Promise<boolean> {
  queueCountdown.value = 3
  return new Promise((resolve) => {
    const timer = window.setInterval(() => {
      if (runId !== queueRunId) {
        window.clearInterval(timer)
        cancelDelay = undefined
        resolve(false)
        return
      }
      queueCountdown.value--
      if (queueCountdown.value === 0) {
        window.clearInterval(timer)
        cancelDelay = undefined
        resolve(true)
      }
    }, 1000)
    cancelDelay = () => {
      window.clearInterval(timer)
      resolve(false)
    }
  })
}

async function executeQueue() {
  if (
    !queue.value.length ||
    queueRunning.value ||
    hentaiVerseState.actionPending ||
    battle.value?.completed
  )
    return
  const runId = ++queueRunId
  queueRunning.value = true
  try {
    for (const step of [...queue.value]) {
      if (!(await waitThreeSeconds(runId)) || runId !== queueRunId) return
      const current = battle.value
      if (!current || current.completed) return
      const action = current.actions.find(
        (item) => item.mode === step.mode && item.skill === step.skill,
      )
      if (!action) throw new Error(t('操作「{p0}」当前不可用，队列已停止', { p0: t(step.label) }))
      const target = action.target === 'enemy' ? activeTarget.value : 0
      if (target === undefined) {
        throw new Error(t('没有可用的怪物目标，队列已停止'))
      }
      await performHentaiVerseBattleAction(action.mode, target, action.skill)
      if (runId !== queueRunId || battle.value?.completed) return
    }
    notify.success(t('自动队列执行完成'))
  } catch (error) {
    notify.error(error instanceof Error ? error.message : t('自动队列执行失败'))
  } finally {
    if (runId === queueRunId) queueCountdown.value = 0
    queueRunning.value = false
  }
}

function getActionIcon(action: HentaiVerseBattleAction) {
  if (action.skill === 1001) return Position
  if (action.skill === 1011) return Search
  if (action.skill === 311) return FirstAidKit
  if (action.mode === 'attack') return Promotion
  if (action.mode === 'spirit') return Lightning
  if (action.mode === 'defend') return Lock
  if (action.mode === 'focus') return Aim
  if (action.mode === 'items') return Box
  return MagicStick
}

async function recover() {
  try {
    await enterHentaiVerseBattle(undefined)
  } catch (error) {
    notify.error(error instanceof Error ? error.message : t('恢复战斗失败'))
  }
}

function minimizeBattle() {
  cancelQueue()
  hideHentaiVerseBattle()
}

function closeLocalBattle() {
  cancelQueue()
  hentaiVerseState.battle = undefined
  hentaiVerseState.battleVisible = false
  hentaiVerseState.error = ''
}
</script>

<template>
  <ActionButton
    v-if="battle && !hentaiVerseState.battleVisible"
    class="battle-resume-button"
    variant="destructive"
    size="icon"
    :icon="Lightning"
    :title="t('返回 HentaiVerse 战斗')"
    @click="showHentaiVerseBattle"
  />

  <Transition name="battle-panel">
    <section
      v-if="battle && hentaiVerseState.battleVisible"
      class="battle-panel hv-theme"
      :aria-label="t('HentaiVerse 战斗')"
    >
      <header class="battle-header">
        <div>
          <strong>{{ t(battle.title) }}</strong>
          <span v-if="battle.completed">{{ t('战斗已结束') }}</span>
          <span v-else>{{ t('回合进行中') }}</span>
        </div>
        <div class="battle-window-actions">
          <ActionButton
            v-if="!battle.completed"
            variant="ghost"
            size="icon"
            :icon="Minus"
            :title="t('隐藏战斗')"
            @click="minimizeBattle"
          />
          <ActionButton
            variant="ghost"
            size="icon"
            :icon="Close"
            :title="t('关闭本地战斗面板')"
            :disabled="hentaiVerseState.actionPending"
            @click="closeLocalBattle"
          />
        </div>
      </header>

      <div class="battle-body">
        <CampScene compact />
        <div v-if="battle.vitals.length" class="battle-vitals">
          <div v-for="vital in battle.vitals" :key="vital.key" class="battle-vital">
            <div class="battle-vital-label">
              <span>{{ t(vital.label) }}</span>
              <strong>{{ t(vital.value) }}</strong>
            </div>
            <ProgressMeter
              :percentage="vital.percent"
              :stroke-width="8"
              :show-text="false"
              :color="vitalColors[vital.key]"
            />
          </div>
        </div>

        <div v-if="battle.monsters.length" class="battle-monsters">
          <button
            v-for="monster in battle.monsters"
            :key="monster.id"
            type="button"
            :class="{ active: activeTarget === monster.id }"
            :disabled="battle.completed || !livingMonsters.some((target) => target.id === monster.id)"
            @click="selectedTarget = monster.id"
          >
            <strong>{{ t(monster.name) }}</strong>
            <span v-if="monster.status">{{ t(monster.status) }}</span>
            <span v-if="monster.defeated || monster.healthPercent === 0">{{
              t('已击败')
            }}</span>
            <span v-else-if="monster.healthPercent === undefined">{{ t('无血条 · 不可选择') }}</span>
            <div class="monster-gauges">
              <div v-if="monster.healthPercent !== undefined" class="monster-gauge">
                <ProgressMeter
                  :percentage="monster.healthPercent"
                  :width="monsterGaugeWidth"
                  :stroke-width="6"
                  color="#4f9f64"
                />
                <span>{{ t('生命') }}</span>
              </div>
              <div v-if="monster.magicPercent !== undefined" class="monster-gauge">
                <ProgressMeter
                  :percentage="monster.magicPercent"
                  :width="monsterGaugeWidth"
                  :stroke-width="6"
                  color="#4f7fc4"
                />
                <span>{{ t('魔力') }}</span>
              </div>
            </div>
          </button>
        </div>

        <Notice
          v-if="hentaiVerseState.error"
          :title="t(hentaiVerseState.error)"
          tone="error"
          :closable="false"
        >
          <ActionButton size="sm" :icon="Refresh" @click="recover">{{
            t('从服务器恢复')
          }}</ActionButton>
        </Notice>

        <div v-if="battle.completed" class="battle-completion" role="status">
          <IconFrame :size="30"><CircleCheck /></IconFrame>
          <div>
            <strong>{{ t('本次战斗已结束') }}</strong>
            <p>{{ t(battle.completionText || t('战斗结果已确认，可以关闭当前面板。')) }}</p>
          </div>
          <ActionButton variant="default" :icon="Close" @click="closeLocalBattle">{{
            t('关闭战斗面板')
          }}</ActionButton>
        </div>
        <div v-else class="battle-actions">
          <div class="battle-queue-controls">
            <ActionButton
              :disabled="queueRunning || hentaiVerseState.actionPending"
              @click="openQueueSettings"
              >{{ t('设置队列') }}</ActionButton
            >
            <ActionButton
              variant="default"
              :disabled="!queue.length || queueRunning || hentaiVerseState.actionPending"
              @click="executeQueue"
              >{{ t('执行队列') }}</ActionButton
            >
            <ActionButton v-if="queueRunning" variant="secondary" @click="cancelQueue">{{
              t('取消后续操作')
            }}</ActionButton>
            <span v-if="queueRunning" role="status">{{
              t(
                queueCountdown
                  ? t('{p0} 秒后执行下一项', { p0: queueCountdown })
                  : t('等待操作返回…'),
              )
            }}</span>
          </div>
          <div v-if="queue.length" class="battle-queue-summary">
            {{ t('队列：{p0}', { p0: queue.map((item) => t(item.label)).join(' → ') }) }}
          </div>
          <Hint
            v-for="action in battle.actions"
            :key="`${action.mode}:${action.skill}`"
            :content="t(action.description)"
            placement="top"
            trigger="click"
          >
            <ActionButton
              :variant="action.mode === 'attack' ? 'destructive' : 'default'"
              :plain="action.mode !== 'attack'"
              :icon="getActionIcon(action)"
              :loading="hentaiVerseState.actionPending"
              :disabled="queueRunning"
              :aria-label="t(`${action.label}：${action.description}`)"
              @click="act(action)"
            >
              {{ t(action.label) }}
            </ActionButton>
          </Hint>
          <span v-if="!battle.actions.length" class="battle-action-empty">{{
            t('未能解析当前回合的可用操作，请刷新战斗状态')
          }}</span>
        </div>
        <div class="battle-log" role="log" :aria-label="t('战斗日志')">
          <p v-for="(line, index) in newestLogFirst" :key="`${index}:${line}`">{{ t(line) }}</p>
          <p v-if="!battle.log.length" class="battle-log-empty">{{ t('等待战斗记录') }}</p>
        </div>
      </div>
    </section>
  </Transition>

  <ModalPanel
    v-model="queueDialogVisible"
    :title="t('设置自动战斗队列')"
    width="min(460px, 92vw)"
    :z-index="3300"
  >
    <p>{{ t('按顺序选择最多五项操作。每项执行前会等待三秒。') }}</p>
    <div class="queue-editor">
      <div v-for="(_, index) in draftQueue" :key="index" class="queue-editor__row">
        <span>{{ t(index + 1) }}.</span>
        <SelectField
          v-model="draftQueue[index]"
          :placeholder="t('选择操作')"
          :aria-label="t('队列第 {p0} 项操作', { p0: index + 1 })"
        >
          <option
            v-for="option in actionOptions"
            :key="option.value"
            :label="t(option.label)"
            :value="option.value"
          ></option>
        </SelectField>
        <ActionButton
          :icon="Close"
          :aria-label="t('移除队列第 {p0} 项操作', { p0: index + 1 })"
          @click="draftQueue.splice(index, 1)"
        />
      </div>
      <p v-if="!actionOptions.length" class="queue-editor__empty">
        {{ t('当前回合没有可选操作，请刷新战斗状态。') }}
      </p>
      <ActionButton
        :disabled="draftQueue.length >= 5 || !actionOptions.length"
        @click="draftQueue.push('')"
        >{{ t('添加操作') }}</ActionButton
      >
    </div>
    <template #footer>
      <ActionButton @click="queueDialogVisible = false">{{ t('取消') }}</ActionButton>
      <ActionButton variant="default" @click="saveQueue">{{ t('保存队列') }}</ActionButton>
    </template>
  </ModalPanel>
</template>

<style scoped>
.battle-panel {
  position: fixed;
  right: 82px;
  bottom: calc(16px + env(safe-area-inset-bottom));
  z-index: 3100;
  display: flex;
  flex-direction: column;
  width: min(720px, calc(100vw - 110px));
  max-height: min(760px, calc(100dvh - 32px));
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-strong);
}

.battle-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 58px;
  padding: 8px 10px 8px 18px;
  border-bottom: 1px solid var(--border-soft);
}

.battle-header > div:first-child {
  display: flex;
  flex-direction: column;
}

.battle-header span {
  color: var(--muted-foreground);
  font-size: 12px;
}

.battle-window-actions {
  display: flex;
}

.battle-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  padding: 16px;
  overflow: auto;
}

.battle-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.battle-queue-controls,
.battle-queue-summary {
  grid-column: 1 / -1;
}

.battle-queue-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.battle-queue-controls :deep(.ui-button + .ui-button) {
  margin-left: 0;
}

.battle-queue-controls span,
.battle-queue-summary {
  color: var(--muted-foreground);
  font-size: 12px;
}

.queue-editor {
  display: grid;
  gap: 10px;
}
.queue-editor__row {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) 32px;
  align-items: center;
  gap: 8px;
}
.queue-editor__row > span {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.queue-editor__row :deep(.ui-select) {
  width: 100%;
  min-width: 0;
}
.queue-editor__row :deep(.ui-button) {
  width: 32px;
  margin: 0;
}
.queue-editor__empty {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 13px;
}

.battle-actions :deep(.ui-button) {
  min-width: 0;
  width: 100%;
}

.battle-vitals {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.battle-vital {
  min-width: 0;
  padding: 8px 10px 10px;
  border-radius: 4px;
  background: var(--muted);
}

.battle-vital-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 6px;
  font-size: 12px;
}

.battle-vital-label span {
  overflow: hidden;
  color: var(--muted-foreground);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.battle-vital-label strong {
  font-variant-numeric: tabular-nums;
}

.battle-monsters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 8px;
}

.battle-monsters button {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--foreground);
  text-align: left;
  background: var(--surface);
  cursor: pointer;
}

.battle-monsters button.active {
  border-color: var(--danger);
  box-shadow: 0 0 0 1px var(--danger) inset;
}

.battle-monsters button:disabled {
  color: var(--muted-foreground);
  background: var(--muted);
  border-style: dashed;
  cursor: not-allowed;
}

.battle-monsters span {
  overflow: hidden;
  color: var(--muted-foreground);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.monster-gauges {
  display: flex;
  width: 100%;
  justify-content: center;
  gap: 8px;
  margin-top: 6px;
}

.monster-gauge {
  display: grid;
  justify-items: center;
  color: var(--muted-foreground);
  font-size: 11px;
}

.battle-actions :deep(.ui-button + .ui-button) {
  margin-left: 0;
}

.battle-action-empty {
  color: var(--muted-foreground);
  font-size: 13px;
}

.battle-completion {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--success-border);
  border-radius: 6px;
  background: var(--success-soft);
}

.battle-completion > .ui-icon {
  color: var(--success);
}

.battle-completion p {
  margin: 4px 0 0;
  color: var(--muted-foreground);
  font-size: 13px;
}

.battle-log {
  min-height: 120px;
  max-height: 230px;
  padding: 12px;
  overflow: auto;
  border: 1px solid var(--border-soft);
  background: var(--muted-soft);
  font-size: 13px;
  line-height: 1.55;
}

.battle-log p {
  margin: 0 0 5px;
}

.battle-log-empty {
  color: var(--placeholder);
}

.battle-resume-button {
  position: fixed;
  right: 80px;
  bottom: calc(18px + env(safe-area-inset-bottom));
  z-index: 3050;
  width: 46px;
  height: 46px;
  box-shadow: var(--shadow);
}

.battle-panel-enter-active,
.battle-panel-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.battle-panel-enter-from,
.battle-panel-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

@media (max-width: 767px) {
  .battle-monsters {
    grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
  }
  .battle-panel {
    inset: 0;
    width: 100vw;
    max-height: 100dvh;
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    border: 0;
    border-radius: 0;
  }

  .battle-body {
    padding: 14px;
  }

  .battle-actions :deep(.ui-button) {
    min-height: 42px;
  }

  .battle-vital {
    padding: 7px 8px 9px;
  }

  .battle-completion {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .battle-completion :deep(.ui-button) {
    grid-column: 1 / -1;
    width: 100%;
  }

  .battle-resume-button {
    right: 72px;
    bottom: calc(14px + env(safe-area-inset-bottom));
    width: 50px;
    height: 50px;
  }
}
</style>
