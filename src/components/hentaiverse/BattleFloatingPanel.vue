<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Close, Lightning, Minus, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  enterHentaiVerseBattle,
  hentaiVerseState,
  hideHentaiVerseBattle,
  performHentaiVerseBattleAction,
  showHentaiVerseBattle,
} from '@/core/hentaiverse/hentaiVerseStore'
import type { HentaiVerseBattleAction } from '@/core/hentaiverse/model/hentaiVerse'

const selectedTarget = ref(1)
const battle = computed(() => hentaiVerseState.battle)
const livingMonsters = computed(() => battle.value?.monsters.filter((monster) => !monster.defeated) || [])

watch(
  livingMonsters,
  (monsters) => {
    if (!monsters.some((monster) => monster.id === selectedTarget.value)) selectedTarget.value = monsters[0]?.id || 1
  },
  { immediate: true },
)

async function act(action: HentaiVerseBattleAction) {
  try {
    await performHentaiVerseBattleAction(action.mode, selectedTarget.value, action.skill)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '战斗动作提交失败')
  }
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
          <el-button text circle :icon="Minus" title="隐藏战斗" @click="hideHentaiVerseBattle" />
          <el-button text circle :icon="Close" title="关闭本地战斗面板" @click="closeLocalBattle" />
        </div>
      </header>

      <div class="battle-body">
        <div v-if="battle.vitals.length" class="battle-vitals">
          <span v-for="vital in battle.vitals" :key="vital">{{ vital }}</span>
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

        <div v-if="battle.completed" class="battle-completion">
          <strong>战斗完成</strong>
          <p>{{ battle.completionText }}</p>
        </div>
        <div v-else class="battle-actions">
          <el-button
            v-for="action in battle.actions"
            :key="`${action.mode}:${action.skill}`"
            :type="action.mode === 'attack' ? 'danger' : 'primary'"
            :plain="action.mode !== 'attack'"
            :loading="hentaiVerseState.actionPending"
            @click="act(action)"
          >
            {{ action.label }}
          </el-button>
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

.battle-vitals,
.battle-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.battle-vitals span {
  padding: 6px 10px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
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

.battle-completion p {
  margin-bottom: 0;
  color: var(--el-text-color-secondary);
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

  .battle-actions .el-button {
    flex: 1 1 calc(33.333% - 8px);
    min-height: 42px;
  }

  .battle-resume-button {
    right: 72px;
    bottom: calc(14px + env(safe-area-inset-bottom));
    width: 50px;
    height: 50px;
  }
}
</style>
