<script setup lang="ts">
import { t } from '@/i18n'

import '@/assets/hentaiverse.css'
import MonsterSprite from './MonsterSprite.vue'
import BattleActionMenu from './BattleActionMenu.vue'
import ActionButton from '@/components/primitives/ActionButton.vue'
import ProgressMeter from '@/components/primitives/ProgressMeter.vue'
import Notice from '@/components/primitives/Notice.vue'
import IconFrame from '@/components/primitives/IconFrame.vue'
import ModalPanel from '@/components/primitives/ModalPanel.vue'
import SelectField from '@/components/primitives/SelectField.vue'
import ToggleField from '@/components/primitives/ToggleField.vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  CircleCheck,
  X as Close,
  Zap as Lightning,
  Minus,
  RefreshCw as Refresh,
  Settings,
  Pause,
  Play,
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

defineProps<{ navigationExpanded?: boolean }>()

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
const manualOpen = ref(true)
const logOpen = ref(false)
const pendingAction = ref('')
const roundWaiting = ref(false)
const delaySeconds = ref(3)
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
const floatingLogs = ref<{ id: number; text: string }[]>([])
const logTimers = new Map<number, ReturnType<typeof setTimeout>>()
let floatingLogId = 0
const pendingLogs: string[] = []
let logQueueTimer: ReturnType<typeof setTimeout> | undefined

function presentNextLog() {
  logQueueTimer = undefined
  const text = pendingLogs.shift()
  if (text === undefined) return
  const id = ++floatingLogId
  floatingLogs.value = [...floatingLogs.value, { id, text }].slice(-3)
  for (const [oldId, timer] of logTimers) {
    if (!floatingLogs.value.some((line) => line.id === oldId)) {
      clearTimeout(timer)
      logTimers.delete(oldId)
    }
  }
  logTimers.set(
    id,
    setTimeout(() => {
      floatingLogs.value = floatingLogs.value.filter((line) => line.id !== id)
      logTimers.delete(id)
    }, 2000),
  )
  // Keep the gap even when another snapshot arrives just after this batch drains.
  logQueueTimer = setTimeout(presentNextLog, 300)
}

function clearFloatingLogs() {
  clearTimeout(logQueueTimer)
  logQueueTimer = undefined
  pendingLogs.length = 0
  logTimers.forEach((timer) => clearTimeout(timer))
  logTimers.clear()
  floatingLogs.value = []
}

watch(
  () => battle.value?.log,
  (current, previous) => {
    if (!current || !previous || !autoRunning.value || hentaiVerseState.battleVisible) return
    // Source snapshots include overlapping history; only announce newly appended entries.
    let overlap = Math.min(previous.length, current.length)
    while (overlap && !previous.slice(-overlap).every((line, index) => line === current[index]))
      overlap--
    pendingLogs.push(...current.slice(overlap))
    if (!logQueueTimer) presentNextLog()
  },
  { flush: 'sync' },
)
watch(
  () => hentaiVerseState.battleVisible,
  (visible) => {
    if (visible) clearFloatingLogs()
  },
)

let cancelDelay: (() => void) | undefined
let autoRunId = 0
const offensiveSpells = computed(
  () =>
    battle.value?.actions.filter(
      (action) => action.mode === 'magic' && action.kind === 'offense' && action.target === 'enemy',
    ) || [],
)
function handleVisibility() {
  if (document.hidden) pauseAutoBattle('页面已隐藏，自动战斗已暂停')
}
onMounted(() => document.addEventListener('visibilitychange', handleVisibility))
onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibility)
  pauseAutoBattle()
  clearFloatingLogs()
})

function toggleManual() {
  manualOpen.value = !manualOpen.value
  if (manualOpen.value) pauseAutoBattle('已切换为手动操作')
}

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

watch([battle, () => hentaiVerseState.error], ([current, error], [previous, previousError]) => {
  if (!current) {
    pauseAutoBattle()
    clearFloatingLogs()
  } else if (current.verificationRequired) {
    pauseAutoBattle('源站需要手动验证，自动战斗已暂停')
    clearFloatingLogs()
    hentaiVerseState.battleVisible = true
  } else if (error) pauseAutoBattle('战斗状态待确认，请从服务器恢复')
  else if (current.completed) {
    pauseAutoBattle('本次战斗已结束')
    if (!previous?.completed)
      notify.success({
        title: t('战斗已结束'),
        message: t('战斗结果已保留在面板中，查看后可关闭战斗面板。'),
        duration: 5000,
      })
  } else if (current.roundCompleted && (!autoRunning.value || !autoSettings.value.continueRounds))
    pauseAutoBattle('本轮已结束，等待手动继续')
  else if (previousError || !previous || previous.completed || previous.roundCompleted)
    autoReason.value = ''
})

async function act(action: HentaiVerseBattleAction) {
  pauseAutoBattle('已切换为手动操作')
  if (hentaiVerseState.actionPending || hentaiVerseState.battleLoading) return
  pendingAction.value = `${action.mode}:${action.skill}`
  try {
    const target = action.target === 'enemy' ? activeTarget.value : 0
    if (target === undefined) throw new Error(t('没有可用的怪物目标'))
    await performHentaiVerseBattleAction(action.mode, target, action.skill)
  } catch (error) {
    notify.error(error instanceof Error ? error.message : t('战斗动作提交失败'))
  } finally {
    pendingAction.value = ''
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
  roundWaiting.value = false
  autoReason.value = reason
}

function waitAutoStep(runId: number, seconds = 3): Promise<boolean> {
  delaySeconds.value = seconds
  autoCountdown.value = seconds
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
    battle.value.verificationRequired ||
    document.hidden
  )
    return
  const runId = ++autoRunId
  autoRunning.value = true
  manualOpen.value = false
  try {
    while (runId === autoRunId) {
      const current = battle.value
      if (!current || current.completed || current.verificationRequired || document.hidden) return
      if (current.roundCompleted) {
        if (!autoSettings.value.continueRounds) {
          autoReason.value = '本轮已结束，等待手动继续'
          return
        }
        roundWaiting.value = true
        if (!(await waitAutoStep(runId, 5)) || runId !== autoRunId) return
        roundWaiting.value = false
        await continueHentaiVerseBattleRound()
        if (runId !== autoRunId) return
        if (battle.value?.roundCompleted && !battle.value.completed)
          throw new Error(t('未能确认下一轮，请恢复战斗状态'))
        continue
      }
      const decision = decideAutoBattleAction(current, autoSettings.value, activeTarget.value)
      autoReason.value = decision.reason
      if (!decision.action || !(await waitAutoStep(runId)) || runId !== autoRunId) return
      // Re-evaluate after the countdown, so changed resources and targets are not stale.
      const latest = battle.value
      if (!latest) return
      const next = decideAutoBattleAction(latest, autoSettings.value, activeTarget.value)
      autoReason.value = next.reason
      if (!next.action || next.target === undefined) return
      pendingAction.value = `${next.action.mode}:${next.action.skill}`
      await performHentaiVerseBattleAction(next.action.mode, next.target, next.action.skill, true)
      pendingAction.value = ''
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
      roundWaiting.value = false
      pendingAction.value = ''
    }
  }
}

async function continueRound(automatic = false) {
  if (hentaiVerseState.battleLoading || hentaiVerseState.actionPending) return
  pauseAutoBattle()
  const runId = autoRunId
  try {
    await continueHentaiVerseBattleRound()
    if (automatic && runId === autoRunId && battle.value && !document.hidden) {
      if (battle.value?.roundCompleted && !battle.value.completed)
        throw new Error(t('未能确认下一轮，请恢复战斗状态'))
      await startAutoBattle()
    }
  } catch (error) {
    notify.error(error instanceof Error ? error.message : t('继续战斗失败'))
  }
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
  <div
    v-if="battle && !hentaiVerseState.battleVisible"
    v-show="!navigationExpanded"
    class="battle-minimized hv-theme"
  >
    <ActionButton
      class="floating-btn battle-resume-button"
      :class="{ 'is-auto-running': autoRunning, 'is-active': autoRunning }"
      :aria-label="t(autoRunning ? '自动战斗中，点击展开' : '返回 HentaiVerse 战斗')"
      size="icon"
      :icon="Lightning"
      :title="t('返回 HentaiVerse 战斗')"
      @click="showHentaiVerseBattle"
    />

    <div class="battle-floating-logs" role="log" aria-live="polite" :aria-label="t('战斗日志')">
      <TransitionGroup name="battle-log-tip" tag="div" class="battle-log-stack">
        <p v-for="line in floatingLogs" :key="line.id">{{ t(line.text) }}</p>
      </TransitionGroup>
    </div>
  </div>

  <Transition name="battle-panel">
    <section
      v-if="battle && hentaiVerseState.battleVisible"
      class="battle-panel hv-theme"
      :aria-label="t('HentaiVerse 战斗')"
    >
      <header class="battle-header">
        <div>
          <strong>{{ t(battle.title) }}</strong>
          <span v-if="battle.verificationRequired">{{ t('等待手动验证') }}</span>
          <span v-else-if="battle.completed">{{ t('战斗已结束') }}</span>
          <span v-else-if="battle.roundCompleted">{{ t('本轮已结束') }}</span>
          <span v-else>{{ t('回合进行中') }}</span>
        </div>
        <div class="battle-header-right">
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
          <div
            v-if="!battle.completed && !battle.verificationRequired"
            class="battle-auto-indicator"
            :title="t(autoReason)"
          >
            <span>{{ t(autoRunning ? '自动战斗中' : '手动操作') }}</span>
            <div
              class="auto-countdown-line"
              :aria-label="t('自动操作倒计时')"
              role="progressbar"
              :aria-valuenow="autoCountdown"
              :aria-valuemin="0"
              :aria-valuemax="delaySeconds"
            >
              <i
                :style="{ transform: `scaleX(${autoRunning ? autoCountdown / delaySeconds : 0})` }"
              />
            </div>
          </div>
        </div>
      </header>

      <div class="battle-body">
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

        <div
          v-if="
            battle.monsters.length &&
            !battle.roundCompleted &&
            !battle.completed &&
            !battle.verificationRequired
          "
          class="battle-monsters"
        >
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
            <MonsterSprite :seed="monster.name" />
            <div class="monster-info">
              <strong>{{ t(monster.name) }}</strong>
              <div class="monster-secondary">
                <span v-if="monster.status">{{ t(monster.status) }}</span>
                <span
                  v-if="monster.magicPercent !== undefined"
                  class="pixel-gauge mana"
                  role="meter"
                  :aria-label="t('魔力')"
                  :aria-valuenow="monster.magicPercent"
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  <i :style="{ width: `${monster.magicPercent}%` }" />
                  <b>{{ Math.round(monster.magicPercent) }}%</b>
                </span>
              </div>
              <small v-if="monster.defeated || monster.healthPercent === 0">{{
                t('已击败')
              }}</small>
              <small v-else-if="monster.healthPercent === undefined">{{
                t('无血条 · 不可选择')
              }}</small>
            </div>
            <span
              v-if="monster.healthPercent !== undefined"
              class="pixel-gauge health"
              role="meter"
              :aria-label="t('生命')"
              :aria-valuenow="monster.healthPercent"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <i :style="{ width: `${monster.healthPercent}%` }" />
              <b>{{ Math.round(monster.healthPercent) }}%</b>
            </span>
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

        <Notice v-if="battle.verificationRequired" tone="warning" :title="t('源站需要手动验证')">
          <p>{{ t('自动战斗已暂停。请在源站完成图片选择或答题，再返回恢复战斗。') }}</p>
          <p>{{ t('请使用与当前连接方式相同的账号登录源站。') }}</p>
          <div class="verification-actions">
            <a
              class="ui-button"
              href="https://hentaiverse.org/"
              target="_blank"
              rel="noopener noreferrer"
              >{{ t('打开源站完成验证') }}</a
            >
            <ActionButton :loading="hentaiVerseState.battleLoading" @click="recover">{{
              t('我已完成验证，恢复战斗')
            }}</ActionButton>
          </div>
        </Notice>
        <div v-else-if="battle.completed" class="battle-completion" role="status">
          <IconFrame :size="30"><CircleCheck /></IconFrame>
          <div>
            <strong>{{ t('本次战斗已结束') }}</strong>
            <p>{{ t(battle.completionText || t('战斗结果已确认，可以关闭当前面板。')) }}</p>
          </div>
          <ActionButton variant="default" :icon="Close" @click="closeLocalBattle">{{
            t('关闭战斗面板')
          }}</ActionButton>
        </div>
        <div v-else-if="battle.roundCompleted" class="round-completion" role="status">
          <IconFrame :size="32"><CircleCheck /></IconFrame>
          <strong>{{ t('本轮已结束') }}</strong>
          <template v-if="roundWaiting">
            <div class="round-countdown">
              {{ autoCountdown }} <small>{{ t('秒后继续') }}</small>
            </div>
            <ProgressMeter
              :percentage="(autoCountdown / 5) * 100"
              :show-text="false"
              :label="t('轮间倒计时')"
            />
          </template>
          <p>
            {{
              t(
                hentaiVerseState.battleLoading
                  ? '正在进入下一轮'
                  : roundWaiting
                    ? '即将进入下一轮'
                    : '本轮已暂停，下一轮由你手动继续。',
              )
            }}
          </p>
        </div>
        <div v-else class="battle-manual">
          <button
            type="button"
            class="section-toggle"
            :aria-expanded="manualOpen"
            @click="toggleManual"
          >
            <span aria-hidden="true">{{ manualOpen ? '▾' : '▸' }}</span> {{ t('手动操作') }}
          </button>
          <BattleActionMenu
            v-if="manualOpen"
            :actions="battle.actions"
            :pending="hentaiVerseState.actionPending || hentaiVerseState.battleLoading"
            :active-key="pendingAction"
            @act="act"
          />
        </div>
        <p
          v-if="
            !autoRunning &&
            autoReason &&
            !battle.completed &&
            !battle.verificationRequired &&
            !['自动战斗已暂停', '已切换为手动操作', '本轮已结束，等待手动继续'].includes(autoReason)
          "
          class="battle-stop-reason"
          role="status"
        >
          {{ t(autoReason) }}
        </p>
        <div class="battle-log" :aria-label="t('战斗日志')">
          <button
            type="button"
            class="section-toggle"
            :aria-expanded="logOpen"
            @click="logOpen = !logOpen"
          >
            <strong>{{ t('最近战况') }}</strong
            ><span>{{ t(logOpen ? '收起日志' : '展开完整日志') }}</span>
          </button>
          <div :class="{ 'expanded-log': logOpen }">
            <p
              v-for="(line, index) in logOpen ? newestLogFirst : newestLogFirst.slice(0, 3)"
              :key="`${index}:${line}`"
            >
              {{ t(line) }}
            </p>
            <p v-if="!battle.log.length" class="battle-log-empty">{{ t('等待战斗记录') }}</p>
          </div>
        </div>
      </div>
      <footer v-if="!battle.completed && !battle.verificationRequired" class="battle-footer">
        <p>{{ t('轮间自动继续') }} · {{ t(autoSettings.continueRounds ? '已开启' : '已关闭') }}</p>
        <div class="battle-footer-actions">
          <ActionButton
            v-if="!battle.roundCompleted"
            variant="outline"
            :icon="Settings"
            :disabled="hentaiVerseState.actionPending || hentaiVerseState.battleLoading"
            @click="openAutoSettings"
            >{{ t('策略设置') }}</ActionButton
          >
          <ActionButton
            v-if="autoRunning"
            variant="outline"
            :icon="Pause"
            @click="pauseAutoBattle()"
            >{{ t('暂停自动') }}</ActionButton
          >
          <ActionButton
            v-else-if="!battle.roundCompleted"
            variant="default"
            :icon="Play"
            :disabled="
              hentaiVerseState.actionPending ||
              hentaiVerseState.battleLoading ||
              Boolean(hentaiVerseState.error)
            "
            @click="startAutoBattle"
            >{{ t('开始自动战斗') }}</ActionButton
          >
          <template v-if="battle.roundCompleted">
            <ActionButton
              v-if="!autoRunning"
              variant="outline"
              :disabled="hentaiVerseState.battleLoading || Boolean(hentaiVerseState.error)"
              @click="continueRound()"
              >{{ t('继续下一轮') }}</ActionButton
            >
            <ActionButton
              variant="default"
              :loading="hentaiVerseState.battleLoading"
              :disabled="Boolean(hentaiVerseState.error)"
              @click="continueRound(true)"
              >{{ t(autoRunning ? '立即继续' : '继续并自动战斗') }}</ActionButton
            >
          </template>
        </div>
      </footer>
    </section>
  </Transition>

  <ModalPanel v-model="settingsOpen" :title="t('自动战斗策略')" width="min(460px, 92vw)">
    <div class="auto-settings">
      <p class="auto-settings-copy">
        {{
          t(
            '每步确认战况后等待三秒；开启轮间自动继续后，等待五秒进入下一轮。自动战斗不使用消耗品。',
          )
        }}
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
      <ToggleField v-model="draftSettings.continueRounds" :label="t('轮间自动继续')" />
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
  width: min(580px, calc(100vw - 110px));
  max-height: min(800px, calc(100dvh - 32px));
  overflow: hidden;
  border: 2px solid var(--border);
  border-radius: 0;
  background: var(--surface-raised);
  box-shadow: 3px 3px 0 var(--border-soft);
  color: var(--foreground);
}
.battle-panel :deep(.ui-button) {
  border-radius: 0;
  min-height: 44px;
}
.battle-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.battle-header > div:first-child {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 4px;
}
.battle-header strong {
  font-family: var(--font-display);
  font-size: 16px;
  overflow-wrap: anywhere;
}
.battle-header span {
  font-size: 12px;
  color: var(--muted-foreground);
}
.battle-header-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
}
.battle-window-actions {
  display: flex;
}
.battle-auto-indicator {
  display: inline-flex;
  flex-direction: column;
  gap: 4px;
  width: max-content;
}
.battle-auto-indicator > span {
  color: var(--accent);
  font-size: 12px;
}
/* The track derives its entire width from the status text, with no box or counter. */
.auto-countdown-line {
  width: 100%;
  height: 2px;
  background: var(--border-soft);
  overflow: hidden;
}
.auto-countdown-line i {
  display: block;
  width: 100%;
  height: 100%;
  background: var(--accent);
  transform-origin: left;
  transition: transform 1s linear;
}
.battle-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  padding: 12px;
  overflow: auto;
  overscroll-behavior: contain;
}
.battle-panel.hv-theme .battle-vitals {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
}
.battle-vital {
  min-width: 0;
}
.battle-panel.hv-theme .battle-vital-label {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 3px;
  font-size: 11px;
  margin-bottom: 5px;
}
.battle-panel.hv-theme .battle-vital-label strong {
  font-size: 11px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.battle-panel :deep(.ui-progress__track),
.battle-panel :deep(.ui-progress__track > span) {
  border-radius: 0;
}
.battle-panel :deep(.ui-progress__track > span) {
  background-image: repeating-linear-gradient(
    90deg,
    transparent 0 10px,
    var(--surface-raised) 10px 12px
  );
}
.battle-monsters {
  display: grid;
  gap: 8px;
}
.battle-panel.hv-theme .battle-monsters button {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 80px;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 0;
  color: var(--foreground);
  text-align: left;
  cursor: pointer;
}
.battle-panel.hv-theme .battle-monsters button.active {
  border-color: var(--accent);
  box-shadow: inset 2px 0 var(--accent);
}
.battle-monsters button:disabled {
  opacity: 0.55;
  cursor: default;
}
.monster-info {
  min-width: 0;
}
.monster-info strong {
  display: block;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.monster-secondary {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 5px;
  flex-wrap: wrap;
}
.monster-secondary > span:first-child,
.monster-info small {
  font-size: 11px;
  color: var(--muted-foreground);
}
.pixel-gauge {
  position: relative;
  display: block;
  height: 17px;
  background: var(--muted);
  border: 1px solid var(--border);
  overflow: hidden;
}
.pixel-gauge i {
  position: absolute;
  inset: 0 auto 0 0;
  background-color: #4f9f64;
  background-image: repeating-linear-gradient(90deg, transparent 0 9px, #24342c66 9px 11px);
}
.pixel-gauge b {
  position: relative;
  display: block;
  font-size: 11px;
  line-height: 15px;
  text-align: center;
  color: #fff;
  text-shadow:
    1px 1px #17271e,
    -1px -1px #17271e;
  font-variant-numeric: tabular-nums;
}
.pixel-gauge.mana {
  width: 64px;
  height: 14px;
}
.pixel-gauge.mana i {
  background-color: #4f7fc4;
}
.pixel-gauge.mana b {
  font-size: 10px;
  line-height: 12px;
}
.section-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  width: 100%;
  padding: 6px 0;
  border: 0;
  background: none;
  color: var(--foreground);
  text-align: left;
  font-size: 13px;
  cursor: pointer;
}
.battle-manual {
  border-block: 1px solid var(--border-soft);
}
.battle-panel.hv-theme .battle-log {
  min-height: 100px;
  padding: 0;
  border: 0;
  font-size: 12px;
  line-height: 1.7;
}
.battle-log .section-toggle {
  justify-content: space-between;
}
.battle-log .section-toggle span {
  font-size: 11px;
  color: var(--muted-foreground);
}
.battle-log p {
  margin: 0 0 5px;
  overflow-wrap: anywhere;
}
.expanded-log {
  max-height: 280px;
  overflow: auto;
}
.battle-stop-reason {
  margin: 0;
  font-size: 12px;
  color: var(--muted-foreground);
}
.battle-footer {
  flex-shrink: 0;
  padding: 8px 12px 12px;
  border-top: 1px solid var(--border);
  background: var(--surface-raised);
}
.battle-footer > p {
  text-align: center;
  color: var(--muted-foreground);
  font-size: 11px;
  margin: 0 0 8px;
}
.battle-footer-actions {
  display: flex;
  gap: 8px;
}
.battle-footer-actions :deep(.ui-button) {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  white-space: normal;
  padding: 6px;
  height: auto;
}
.battle-completion,
.round-completion {
  display: grid;
  justify-items: center;
  gap: 16px;
  padding: 24px 12px;
  border: 1px solid var(--border);
  text-align: center;
}
.round-completion > .ui-progress {
  width: min(260px, 100%);
}
.round-completion p,
.battle-completion p {
  font-size: 13px;
  margin: 0;
  color: var(--muted-foreground);
}
.round-countdown {
  font-size: 56px;
  font-family: monospace;
}
.round-countdown small {
  font-size: 13px;
}
.verification-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
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
  border-radius: 0;
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
.battle-minimized {
  position: fixed;
  right: calc(var(--fab-inset) + var(--fab-size) + 12px);
  bottom: calc(var(--fab-inset) + env(safe-area-inset-bottom));
  z-index: 1090;
  display: flex;
  flex-direction: row-reverse;
  align-items: flex-end;
  gap: 12px;
  width: max-content;
  max-width: calc(100% - var(--fab-inset) - var(--fab-size) - 24px);
  pointer-events: none;
}
.battle-resume-button {
  pointer-events: auto;
}
.battle-resume-button.is-auto-running {
  animation: battle-running-pulse 1.8s ease-in-out infinite;
}
.battle-resume-button.is-auto-running :deep(svg) {
  animation: battle-running-icon 1.8s ease-in-out infinite;
}
.battle-floating-logs {
  width: 300px;
  min-width: 0;
  overflow: clip;
}
.battle-log-stack {
  position: relative;
}
.battle-log-stack p {
  margin: 6px 0 0;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-raised);
  color: var(--foreground);
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.battle-log-tip-move,
.battle-log-tip-enter-active,
.battle-log-tip-leave-active {
  transition:
    opacity 220ms ease,
    transform 220ms ease;
}
.battle-log-tip-enter-from {
  opacity: 0;
  transform: translateX(calc(100% + 10px));
}
.battle-log-tip-leave-active {
  position: absolute;
  width: 100%;
}
.battle-log-tip-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}
@keyframes battle-running-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 40%, transparent);
  }
  60% {
    box-shadow: 0 0 0 8px transparent;
  }
}
@keyframes battle-running-icon {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
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
  .battle-panel {
    inset: 0;
    width: 100%;
    height: 100dvh;
    max-height: 100dvh;
    border: 0;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom)
      env(safe-area-inset-left);
  }
  .battle-body {
    flex: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .battle-resume-button.is-auto-running,
  .battle-resume-button.is-auto-running :deep(svg) {
    animation: none;
  }
  .battle-resume-button.is-auto-running {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
  .battle-log-tip-move,
  .battle-log-tip-enter-active,
  .battle-log-tip-leave-active {
    transition: none;
  }
  .auto-countdown-line i {
    transition: none;
  }
}
</style>
