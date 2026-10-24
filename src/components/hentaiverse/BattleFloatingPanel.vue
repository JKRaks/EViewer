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
import ToggleField from '@/components/primitives/ToggleField.vue'
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
  continueHentaiVerseBattleRound,
  hentaiVerseState,
  hideHentaiVerseBattle,
  performHentaiVerseBattleAction,
  showHentaiVerseBattle,
} from '@/core/hentaiverse/hentaiVerseStore'
import {
  decideAutoBattleAction,
  defaultAutoBattleSettings,
  normalizeAutoBattleSettings,
  type AutoBattleSettings,
} from '@/core/hentaiverse/hentaiVerseAutoBattle'
import type {
  HentaiVerseBattleAction,
  HentaiVerseBattleVital,
} from '@/core/hentaiverse/model/hentaiVerse'

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
const autoSettings = ref<AutoBattleSettings>({ ...defaultAutoBattleSettings })
try {
  autoSettings.value =
    normalizeAutoBattleSettings(
      JSON.parse(localStorage.getItem('eviewer:hv-auto-battle') || 'null'),
    ) || autoSettings.value
} catch {
  /* Strategy settings can remain session-only. */
}
const draftSettings = ref({ ...autoSettings.value })
const settingsOpen = ref(false)
const settingsError = ref('')
const autoRunning = ref(false)
const autoCountdown = ref(0)
const autoReason = ref('')
let cancelDelay: (() => void) | undefined
let autoRunId = 0
const offensiveSpells = computed(
  () =>
    battle.value?.actions.filter(
      (action) => action.mode === 'magic' && action.kind === 'offense' && action.target === 'enemy',
    ) || [],
)
const nextDecision = computed(() =>
  battle.value
    ? decideAutoBattleAction(battle.value, autoSettings.value, activeTarget.value)
    : undefined,
)
const autoStatus = computed(() => {
  const reason = t(autoReason.value || nextDecision.value?.reason || '自动战斗已暂停')
  return autoRunning.value && autoCountdown.value
    ? t('{p0} · {p1} 秒后操作', { p0: reason, p1: autoCountdown.value })
    : reason
})

function updateGaugeWidth() {
  monsterGaugeWidth.value = window.innerWidth < 768 ? 54 : 64
}

onMounted(() => {
  updateGaugeWidth()
  window.addEventListener('resize', updateGaugeWidth)
})
onUnmounted(() => {
  window.removeEventListener('resize', updateGaugeWidth)
  pauseAutoBattle()
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
  [battle, () => hentaiVerseState.battleVisible, () => hentaiVerseState.error],
  ([current, visible, error], [previous, , previousError]) => {
    if (!current || !visible) pauseAutoBattle()
    else if (error) pauseAutoBattle('战斗状态待确认，请从服务器恢复')
    else if (current.completed) {
      pauseAutoBattle('本次战斗已结束')
      if (!previous?.completed)
        notify.success({
          title: t('战斗已结束'),
          message: t('战斗结果已保留在面板中，查看后可关闭战斗面板。'),
          duration: 5000,
        })
    } else if (current.roundCompleted) pauseAutoBattle('本轮已结束，等待手动继续')
    else if (previousError || !previous || previous.completed || previous.roundCompleted)
      autoReason.value = ''
  },
)

async function act(action: HentaiVerseBattleAction) {
  pauseAutoBattle('已切换为手动操作')
  if (hentaiVerseState.actionPending || hentaiVerseState.battleLoading) return
  try {
    const target = action.target === 'enemy' ? activeTarget.value : 0
    if (target === undefined) throw new Error(t('没有可用的怪物目标'))
    await performHentaiVerseBattleAction(action.mode, target, action.skill)
  } catch (error) {
    notify.error(error instanceof Error ? error.message : t('战斗动作提交失败'))
  }
}

function openAutoSettings() {
  pauseAutoBattle()
  draftSettings.value = { ...autoSettings.value }
  settingsError.value = ''
  settingsOpen.value = true
}

function saveAutoSettings() {
  const settings = normalizeAutoBattleSettings(draftSettings.value)
  if (!settings || (settings.style === 'magic' && !settings.spell)) {
    settingsError.value = t('生命阈值需在 10–90% 内，危急阈值须更低；法术策略需要选择进攻法术。')
    return
  }
  autoSettings.value = settings
  try {
    localStorage.setItem('eviewer:hv-auto-battle', JSON.stringify(settings))
  } catch {
    /* The current session can still use the selected strategy. */
  }
  autoReason.value = ''
  settingsOpen.value = false
}

function pauseAutoBattle(reason = '自动战斗已暂停') {
  autoRunId++
  cancelDelay?.()
  cancelDelay = undefined
  autoCountdown.value = 0
  autoRunning.value = false
  autoReason.value = reason
}

function waitAutoStep(runId: number): Promise<boolean> {
  autoCountdown.value = 3
  return new Promise((resolve) => {
    const timer = window.setInterval(() => {
      if (runId !== autoRunId) {
        window.clearInterval(timer)
        cancelDelay = undefined
        resolve(false)
        return
      }
      autoCountdown.value--
      if (autoCountdown.value === 0) {
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

async function startAutoBattle() {
  if (
    !battle.value ||
    autoRunning.value ||
    hentaiVerseState.actionPending ||
    hentaiVerseState.battleLoading ||
    hentaiVerseState.error ||
    battle.value.completed ||
    battle.value.roundCompleted
  )
    return
  const runId = ++autoRunId
  autoRunning.value = true
  try {
    while (runId === autoRunId && hentaiVerseState.battleVisible) {
      const current = battle.value
      if (!current) return
      const decision = decideAutoBattleAction(current, autoSettings.value, activeTarget.value)
      autoReason.value = decision.reason
      if (!decision.action || !(await waitAutoStep(runId)) || runId !== autoRunId) return
      // Re-evaluate after the countdown, so changed resources and targets are not stale.
      const latest = battle.value
      if (!latest) return
      const next = decideAutoBattleAction(latest, autoSettings.value, activeTarget.value)
      autoReason.value = next.reason
      if (!next.action || next.target === undefined) return
      await performHentaiVerseBattleAction(next.action.mode, next.target, next.action.skill, true)
    }
  } catch (error) {
    if (runId === autoRunId) {
      autoReason.value = '战斗状态待确认，请从服务器恢复'
      notify.error(error instanceof Error ? error.message : t('自动战斗已暂停'))
    }
  } finally {
    if (runId === autoRunId) {
      autoCountdown.value = 0
      autoRunning.value = false
    }
  }
}

async function continueRound(automatic = false) {
  pauseAutoBattle()
  try {
    await continueHentaiVerseBattleRound()
    if (automatic) await startAutoBattle()
  } catch (error) {
    notify.error(error instanceof Error ? error.message : t('继续战斗失败'))
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
  pauseAutoBattle()
  try {
    await enterHentaiVerseBattle(undefined)
  } catch (error) {
    notify.error(error instanceof Error ? error.message : t('恢复战斗失败'))
  }
}

function minimizeBattle() {
  pauseAutoBattle()
  hideHentaiVerseBattle()
}

function closeLocalBattle() {
  pauseAutoBattle()
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
          <span v-else-if="battle.roundCompleted">{{ t('本轮已结束') }}</span>
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
            :disabled="hentaiVerseState.actionPending || hentaiVerseState.battleLoading"
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
            :disabled="
              battle.completed ||
              battle.roundCompleted ||
              !livingMonsters.some((target) => target.id === monster.id)
            "
            @click="
              () => {
                pauseAutoBattle('已切换为手动操作')
                selectedTarget = monster.id
              }
            "
          >
            <strong>{{ t(monster.name) }}</strong>
            <span v-if="monster.status">{{ t(monster.status) }}</span>
            <span v-if="monster.defeated || monster.healthPercent === 0">{{ t('已击败') }}</span>
            <span v-else-if="monster.healthPercent === undefined">{{
              t('无血条 · 不可选择')
            }}</span>
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
        <div v-else-if="battle.roundCompleted" class="battle-completion" role="status">
          <IconFrame :size="30"><CircleCheck /></IconFrame>
          <div>
            <strong>{{ t('本轮已结束') }}</strong>
            <p>{{ t('本轮已暂停，下一轮由你手动继续。') }}</p>
          </div>
          <div class="battle-completion-actions">
            <ActionButton :loading="hentaiVerseState.battleLoading" @click="continueRound()">
              {{ t('继续下一轮') }}
            </ActionButton>
            <ActionButton
              variant="default"
              :loading="hentaiVerseState.battleLoading"
              @click="continueRound(true)"
            >
              {{ t('继续并自动战斗') }}
            </ActionButton>
          </div>
        </div>
        <div v-else class="battle-actions">
          <div class="battle-auto-controls">
            <ActionButton
              :disabled="hentaiVerseState.actionPending || hentaiVerseState.battleLoading"
              @click="openAutoSettings"
              >{{ t('策略设置') }}</ActionButton
            >
            <ActionButton
              v-if="!autoRunning"
              variant="default"
              :disabled="
                hentaiVerseState.actionPending ||
                hentaiVerseState.battleLoading ||
                Boolean(hentaiVerseState.error)
              "
              @click="startAutoBattle"
              >{{ t('开始本轮自动') }}</ActionButton
            >
            <ActionButton v-else variant="secondary" @click="pauseAutoBattle()">{{
              t('暂停自动')
            }}</ActionButton>
          </div>
          <p class="battle-auto-status" role="status" aria-live="polite">{{ autoStatus }}</p>
          <Hint
            v-for="action in battle.actions"
            :key="`${action.mode}:${action.skill}`"
            :content="t(action.description)"
            placement="top"
            trigger="click"
          >
            <ActionButton
              :variant="action.mode === 'attack' ? 'destructive' : 'default'"
              :icon="getActionIcon(action)"
              :loading="hentaiVerseState.actionPending"
              :disabled="
                hentaiVerseState.actionPending ||
                hentaiVerseState.battleLoading ||
                action.available === false
              "
              :aria-label="`${t(action.label)}：${t(action.description)}`"
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

  <ModalPanel v-model="settingsOpen" :title="t('自动战斗策略')" width="min(460px, 92vw)">
    <div class="auto-settings">
      <p class="auto-settings-copy">
        {{ t('每步确认战况后等待三秒，本轮结束后暂停。自动战斗不使用消耗品。') }}
      </p>
      <label class="auto-setting">
        <span>{{ t('攻击策略') }}</span>
        <SelectField v-model="draftSettings.style" :aria-label="t('攻击策略')">
          <option value="physical">{{ t('物理优先') }}</option>
          <option value="magic">{{ t('法术优先') }}</option>
        </SelectField>
      </label>
      <label v-if="draftSettings.style === 'magic'" class="auto-setting">
        <span>{{ t('进攻法术') }}</span>
        <SelectField v-model="draftSettings.spell" :aria-label="t('进攻法术')">
          <option value="">{{ t('选择进攻法术') }}</option>
          <option
            v-for="spell in offensiveSpells"
            :key="spell.skill"
            :value="`${spell.mode}:${spell.skill}`"
          >
            {{ t(spell.label) }}
          </option>
        </SelectField>
      </label>
      <div class="auto-thresholds">
        <label class="auto-setting">
          <span>{{ t('治疗生命阈值（%）') }}</span>
          <input v-model.number="draftSettings.healAt" type="number" min="10" max="90" step="1" />
        </label>
        <label class="auto-setting">
          <span>{{ t('危急生命阈值（%）') }}</span>
          <input
            v-model.number="draftSettings.criticalAt"
            type="number"
            min="10"
            max="89"
            step="1"
          />
        </label>
      </div>
      <ToggleField v-model="draftSettings.maintainRegen" :label="t('按需补充再生')" />
      <p class="auto-settings-copy">
        {{ t('施法时预留一次治疗所需魔力；无法确认资源或没有合适操作时暂停。') }}
      </p>
      <p v-if="settingsError" role="alert" class="field-error">{{ settingsError }}</p>
    </div>
    <template #footer>
      <ActionButton @click="settingsOpen = false">{{ t('取消') }}</ActionButton>
      <ActionButton variant="default" @click="saveAutoSettings">{{ t('保存策略') }}</ActionButton>
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
  min-width: 0;
  overflow-wrap: anywhere;
}

.battle-header span {
  color: var(--muted-foreground);
  font-size: 12px;
}

.battle-window-actions {
  display: flex;
  flex-shrink: 0;
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

.battle-auto-controls,
.battle-auto-status {
  grid-column: 1 / -1;
}

.battle-auto-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.battle-actions .battle-auto-controls :deep(.ui-button) {
  margin-left: 0;
  width: auto;
  flex: 1 1 auto;
}

.battle-auto-status {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 12px;
}

.auto-settings {
  display: grid;
  gap: 14px;
}
.auto-thresholds {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.auto-setting {
  display: grid;
  min-width: 0;
  gap: 6px;
  font-size: 13px;
}
.auto-setting :deep(.ui-select),
.auto-setting input {
  width: 100%;
  min-width: 0;
}
.auto-setting input {
  min-height: 44px;
  padding: 6px 10px;
  border: 1px solid var(--input);
  border-radius: 7px;
  background: var(--surface);
  color: var(--foreground);
  font-size: 16px;
  margin: 0;
}
.auto-settings-copy {
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

.battle-monsters strong {
  overflow-wrap: anywhere;
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

.battle-completion-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.battle-completion-actions :deep(.ui-button) {
  flex: 1 1 auto;
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
    width: 100%;
    height: 100dvh;
    max-height: 100dvh;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom)
      env(safe-area-inset-left);
    border: 0;
    border-radius: 0;
  }

  .battle-body {
    padding: 14px;
  }

  .battle-actions :deep(.ui-button) {
    height: auto;
    min-height: 44px;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .battle-vital-label {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }

  .battle-vital-label strong {
    max-width: 100%;
    overflow-wrap: anywhere;
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

@media (max-width: 480px) {
  .battle-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .battle-actions .battle-auto-controls :deep(.ui-button) {
    flex-basis: 120px;
  }
}
</style>
