<script setup lang="ts">
import { Lightning } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  dismissHentaiVerseEncounter,
  enterHentaiVerseBattle,
  hentaiVerseState,
} from '@/core/hentaiverse/hentaiVerseStore'

async function enterBattle() {
  try {
    await enterHentaiVerseBattle()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '进入随机遭遇失败')
  }
}
</script>

<template>
  <Transition name="encounter">
    <aside v-if="hentaiVerseState.encounter" class="encounter-prompt" role="alert">
      <el-icon :size="22"><Lightning /></el-icon>
      <div>
        <strong>发现随机遭遇</strong>
        <span>怪物正在等待你的回应</span>
      </div>
      <el-button type="primary" :loading="hentaiVerseState.battleLoading" @click="enterBattle">进入战斗</el-button>
      <el-button text @click="dismissHentaiVerseEncounter">忽略</el-button>
    </aside>
  </Transition>
</template>

<style scoped>
.encounter-prompt {
  position: fixed;
  top: calc(18px + env(safe-area-inset-top));
  left: 50%;
  z-index: 3200;
  display: flex;
  align-items: center;
  gap: 12px;
  width: min(560px, calc(100vw - 32px));
  padding: 12px 14px;
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: 8px;
  color: var(--el-text-color-primary);
  background: var(--el-bg-color-overlay);
  box-shadow: var(--el-box-shadow-dark);
  transform: translateX(-50%);
}

.encounter-prompt > div {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.encounter-prompt span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.encounter-enter-active,
.encounter-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.encounter-enter-from,
.encounter-leave-to {
  opacity: 0;
  transform: translate(-50%, -12px);
}

@media (max-width: 600px) {
  .encounter-prompt {
    align-items: stretch;
    flex-wrap: wrap;
  }

  .encounter-prompt > div {
    min-width: calc(100% - 40px);
  }
}
</style>
