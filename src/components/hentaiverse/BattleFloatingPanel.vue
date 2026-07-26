<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Aim,
  Box,
  CircleCheck,
  Close,
  FirstAidKit,
  Lightning,
  Lock,
  MagicStick,
  Minus,
  Position,
  Promotion,
  Refresh,
  Search,
} from '@element-plus/icons-vue'
import { ElMessage, ElNotification } from 'element-plus'
import {
  enterHentaiVerseBattle,
  hentaiVerseState,
  hideHentaiVerseBattle,
  performHentaiVerseBattleAction,
  showHentaiVerseBattle,
} from '@/core/hentaiverse/hentaiVerseStore'
import type { HentaiVerseBattleAction, HentaiVerseBattleVital } from '@/core/hentaiverse/model/hentaiVerse'

const selectedTarget = ref(1)
const battle = computed(() => hentaiVerseState.battle)
const livingMonsters = computed(() => battle.value?.monsters.filter((monster) => !monster.defeated) || [])
const vitalColors: Record<HentaiVerseBattleVital['key'], string> = {
  health: '#4f9f64',
  magic: '#4f7fc4',
  spirit: '#c65d6f',
}

watch(
  livingMonsters,
  (monsters) => {
    if (!monsters.some((monster) => monster.id === selectedTarget.value)) selectedTarget.value = monsters[0]?.id || 1
  },
  { immediate: true },
)

watch(
  () => battle.value?.completed,
  (completed, wasCompleted) => {
    if (!completed || wasCompleted) return
    ElNotification.success({
      title: '战斗已结束',
      message: '战斗结果已保留在面板中，查看后可关闭战斗面板。',
      duration: 5000,
      position: 'top-right',
      zIndex: 3300,
    })
  },
)

async function act(action: HentaiVerseBattleAction) {
  try {
    const target = action.target === 'enemy' ? selectedTarget.value : 0
    await performHentaiVerseBattleAction(action.mode, target, action.skill)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '战斗动作提交失败')
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
    ElMessage.error(error instanceof Error ? error.message : '恢复战斗失败')
  }
}

function closeLocalBattle() {
  hentaiVerseState.battle = undefined
  hentaiVerseState.battleVisible = false
  hentaiVerseState.error = ''
}
</script>

<template>
  <el-button
    v-if="battle && !hentaiVerseState.battleVisible"
    class="battle-resume-button"
    type="danger"
    circle
    :icon="Lightning"
    title="返回 HentaiVerse 战斗"
    @click="showHentaiVerseBattle"
  />

  <Transition name="battle-panel">
    <section v-if="battle && hentaiVerseState.battleVisible" class="battle-panel" aria-label="HentaiVerse 战斗">
      <header class="battle-header">
        <div>
          <strong>{{ battle.title }}</strong>
          <span v-if="battle.completed">战斗已结束</span>
          <span v-else>回合进行中</span>
        </div>
        <div class="battle-window-actions">
          <el-button v-if="!battle.completed" text circle :icon="Minus" title="隐藏战斗" @click="hideHentaiVerseBattle" />
          <el-button text circle :icon="Close" title="关闭本地战斗面板" @click="closeLocalBattle" />
        </div>
      </header>

      <div class="battle-body">
        <div v-if="battle.vitals.length" class="battle-vitals">
          <div v-for="vital in battle.vitals" :key="vital.key" class="battle-vital">
            <div class="battle-vital-label">
              <span>{{ vital.label }}</span>
              <strong>{{ vital.value }}</strong>
            </div>
            <el-progress
              :percentage="vital.percent"
              :stroke-width="8"
              :show-text="false"
              :color="vitalColors[vital.key]"
            />
          </div>
        </div>

        <div v-if="livingMonsters.length" class="battle-monsters">
          <button
            v-for="monster in livingMonsters"
            :key="monster.id"
            type="button"
            :class="{ active: selectedTarget === monster.id }"
            @click="selectedTarget = monster.id"
          >
            <strong>{{ monster.name }}</strong>
            <span>{{ monster.status }}</span>
          </button>
        </div>

        <el-alert
          v-if="hentaiVerseState.error"
          :title="hentaiVerseState.error"
          type="error"
          :closable="false"
          show-icon
        >
          <el-button size="small" :icon="Refresh" @click="recover">从服务器恢复</el-button>
        </el-alert>

        <div v-if="battle.completed" class="battle-completion" role="status">
          <el-icon :size="30"><CircleCheck /></el-icon>
          <div>
            <strong>本次战斗已结束</strong>
            <p>{{ battle.completionText || '战斗结果已确认，可以关闭当前面板。' }}</p>
          </div>
          <el-button type="primary" :icon="Close" @click="closeLocalBattle">关闭战斗面板</el-button>
        </div>
        <div v-else class="battle-actions">
          <el-tooltip
            v-for="action in battle.actions"
            :key="`${action.mode}:${action.skill}`"
            :content="action.description"
            placement="top"
            trigger="click"
            :popper-style="{ zIndex: 3205 }"
          >
            <el-button
              :type="action.mode === 'attack' ? 'danger' : 'primary'"
              :plain="action.mode !== 'attack'"
              :icon="getActionIcon(action)"
              :loading="hentaiVerseState.actionPending"
              :aria-label="`${action.label}：${action.description}`"
              @click="act(action)"
            >
              {{ action.label }}
            </el-button>
          </el-tooltip>
          <span v-if="!battle.actions.length" class="battle-action-empty">未能解析当前回合的可用操作，请刷新战斗状态</span>
        </div>

        <div class="battle-log">
          <p v-for="(line, index) in battle.log" :key="`${index}:${line}`">{{ line }}</p>
          <p v-if="!battle.log.length" class="battle-log-empty">等待战斗记录</p>
        </div>
      </div>
    </section>
  </Transition>
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
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color-overlay);
  box-shadow: var(--el-box-shadow-dark);
}

.battle-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 58px;
  padding: 8px 10px 8px 18px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.battle-header > div:first-child {
  display: flex;
  flex-direction: column;
}

.battle-header span {
  color: var(--el-text-color-secondary);
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

.battle-actions :deep(.el-button) {
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
  background: var(--el-fill-color-light);
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
  color: var(--el-text-color-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.battle-vital-label strong {
  font-variant-numeric: tabular-nums;
}

.battle-monsters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
}

.battle-monsters button {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  color: var(--el-text-color-primary);
  text-align: left;
  background: var(--el-bg-color);
  cursor: pointer;
}

.battle-monsters button.active {
  border-color: var(--el-color-danger);
  box-shadow: 0 0 0 1px var(--el-color-danger) inset;
}

.battle-monsters span {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.battle-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.battle-action-empty {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.battle-completion {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--el-color-success-light-7);
  border-radius: 6px;
  background: var(--el-color-success-light-9);
}

.battle-completion > .el-icon {
  color: var(--el-color-success);
}

.battle-completion p {
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.battle-log {
  min-height: 120px;
  max-height: 230px;
  padding: 12px;
  overflow: auto;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
  font-size: 13px;
  line-height: 1.55;
}

.battle-log p {
  margin: 0 0 5px;
}

.battle-log-empty {
  color: var(--el-text-color-placeholder);
}

.battle-resume-button {
  position: fixed;
  right: 80px;
  bottom: calc(18px + env(safe-area-inset-bottom));
  z-index: 3050;
  width: 46px;
  height: 46px;
  box-shadow: var(--el-box-shadow);
}

.battle-panel-enter-active,
.battle-panel-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.battle-panel-enter-from,
.battle-panel-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

@media (max-width: 767px) {
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

  .battle-actions :deep(.el-button) {
    min-height: 42px;
  }

  .battle-vital {
    padding: 7px 8px 9px;
  }

  .battle-completion {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .battle-completion :deep(.el-button) {
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
