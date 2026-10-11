<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Lightning, Refresh } from '@element-plus/icons-vue'
import AbilityPanel from '@/components/hentaiverse/AbilityPanel.vue'
import CharacterOverviewPanel from '@/components/hentaiverse/CharacterOverviewPanel.vue'
import EquipmentPanel from '@/components/hentaiverse/EquipmentPanel.vue'
import HentaiVerseFormPanel from '@/components/hentaiverse/HentaiVerseFormPanel.vue'
import InventoryPanel from '@/components/hentaiverse/InventoryPanel.vue'
import TrainingPanel from '@/components/hentaiverse/TrainingPanel.vue'
import StatGroupsPanel from '@/components/hentaiverse/StatGroupsPanel.vue'
import ChallengePanel from '@/components/hentaiverse/ChallengePanel.vue'
import ItemWorldPanel from '@/components/hentaiverse/ItemWorldPanel.vue'
import { HentaiVerseBusi } from '@/core/hentaiverse/hentaiVerseBusi'
import { HENTAIVERSE_SECTIONS } from '@/core/hentaiverse/hentaiVerseProtocol'
import type {
  HentaiVerseAbilityActionName,
  HentaiVerseFormSection,
  HentaiVerseFormData,
  HentaiVersePage,
  HentaiVersePageTarget,
  HentaiVerseSection,
} from '@/core/hentaiverse/model/hentaiVerse'
import {
  enterHentaiVerseBattle,
  hentaiVerseState,
  showHentaiVerseBattleSnapshot,
} from '@/core/hentaiverse/hentaiVerseStore'
import { useAuthState } from '@/core/auth/authState'

defineOptions({ name: 'HentaiVerseView' })

const busi = new HentaiVerseBusi()
const authState = useAuthState()
const activeSection = ref<HentaiVerseSection>('character')
const page = ref<HentaiVersePage>()
const loading = ref(false)
const error = ref('')
const battleBlocked = ref(false)
const currentTarget = ref<HentaiVersePageTarget>({ ...HENTAIVERSE_SECTIONS[0]!.target })
const characterSummary = ref({ name: '', persona: '' })
let requestId = 0

const currentMeta = computed(
  () => HENTAIVERSE_SECTIONS.find((item) => item.key === activeSection.value)!,
)
const characterSections = computed(() =>
  HENTAIVERSE_SECTIONS.filter((item) => item.group === 'character'),
)
const battleSections = computed(() =>
  HENTAIVERSE_SECTIONS.filter((item) => item.group === 'battle'),
)

watch(
  () => hentaiVerseState.battle?.completed,
  (completed, wasCompleted) => {
    if (completed && !wasCompleted && battleBlocked.value) void loadSection()
  },
)

function updateCharacterSummary(nextPage: HentaiVersePage) {
  const characterName =
    nextPage.characterName !== 'HentaiVerse' ? nextPage.characterName : nextPage.personaName
  if (characterName) {
    characterSummary.value = {
      name: characterName,
      persona: nextPage.personaName !== characterName ? nextPage.personaName : '',
    }
  }
}

function setPage(nextPage: HentaiVersePage) {
  page.value = nextPage
  if (nextPage.equipment)
    currentTarget.value.equip_slot = nextPage.equipment.selectedSlot || undefined
  updateCharacterSummary(nextPage)
}

async function loadSection(
  section: HentaiVerseSection = activeSection.value,
  targetOverride?: Partial<HentaiVersePageTarget>,
) {
  const meta = HENTAIVERSE_SECTIONS.find((item) => item.key === section)
  if (!meta || (loading.value && section === activeSection.value)) return
  const changedSection = section !== page.value?.section
  activeSection.value = section
  currentTarget.value = {
    ...meta.target,
    ...(!changedSection && !targetOverride ? currentTarget.value : targetOverride || {}),
  }
  if (changedSection) page.value = undefined
  const currentRequest = ++requestId
  loading.value = true
  error.value = ''
  battleBlocked.value = false
  try {
    const result = await busi.getPage(currentTarget.value)
    if (currentRequest !== requestId) {
      if (result.page) updateCharacterSummary(result.page)
      return
    }
    if (result.battle) {
      page.value = undefined
      battleBlocked.value = true
      showHentaiVerseBattleSnapshot(result.battle)
      return
    }
    if (!result.page?.authenticated)
      throw new Error('HentaiVerse 登录态已失效，请重新维护认证 Cookie')
    setPage(result.page)
  } catch (loadError) {
    if (currentRequest === requestId)
      error.value = loadError instanceof Error ? loadError.message : '页面加载失败'
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

async function runDomainAction(
  request: () => ReturnType<HentaiVerseBusi['submitForm']>,
  successMessage: string,
) {
  loading.value = true
  try {
    const result = await request()
    if (result.battle) {
      showHentaiVerseBattleSnapshot(result.battle)
      ElMessage.success('已进入 HentaiVerse 战斗')
    } else if (result.page) {
      if (!result.page.authenticated)
        throw new Error('HentaiVerse 登录态已失效，请重新维护认证 Cookie')
      setPage(result.page)
      ElMessage.success(successMessage)
    }
  } catch (actionError) {
    ElMessage.error(actionError instanceof Error ? actionError.message : '操作失败')
  } finally {
    loading.value = false
  }
}

async function submitForm(section: HentaiVerseFormSection, data: HentaiVerseFormData) {
  if (section === 'persona' && data.persona_create) {
    try {
      await ElMessageBox.confirm('人格创建后无法删除，确定继续吗？', '创建人格', {
        type: 'warning',
      })
    } catch {
      return
    }
  }
  if (
    (['arena', 'ringOfBlood', 'grindfest'].includes(section) && data.initid) ||
    section === 'itemWorld'
  ) {
    try {
      const sectionLabel =
        HENTAIVERSE_SECTIONS.find((item) => item.key === section)?.label || '战斗'
      const challenge = page.value?.challenges?.find((item) => item.id === data.initid)
      const entryId = Array.isArray(data['eqids[]']) ? data['eqids[]'][0] : ''
      const entryInfo = entryId ? page.value?.itemWorld?.entryInfo[entryId] : undefined
      const details = challenge
        ? `${challenge.name}，${challenge.rounds} 轮，入场费用 ${challenge.entryCost || '无'}。`
        : entryInfo
          ? `${entryInfo.rounds} 轮，消耗 ${entryInfo.cost} 世界种子。`
          : ''
      await ElMessageBox.confirm(
        `${details}即将进入${sectionLabel}，进入后需要完成或退出当前战斗。确定继续吗？`,
        '确认开始战斗',
        {
          type: 'warning',
          confirmButtonText: '开始战斗',
          cancelButtonText: '暂不进入',
        },
      )
    } catch {
      return
    }
  }
  loading.value = true
  try {
    const result = await busi.submitForm(section, data, currentTarget.value)
    if (result.battle) {
      showHentaiVerseBattleSnapshot(result.battle)
      ElMessage.success('已进入 HentaiVerse 战斗')
    } else if (result.page) {
      if (!result.page.authenticated)
        throw new Error('HentaiVerse 登录态已失效，请重新维护认证 Cookie')
      setPage(result.page)
      ElMessage.success('HentaiVerse 设置已更新')
    }
  } catch (submitError) {
    ElMessage.error(submitError instanceof Error ? submitError.message : '提交失败')
  } finally {
    loading.value = false
  }
}

function selectEquipmentSet(id: string, postToken: string) {
  void runDomainAction(
    () => busi.selectEquipmentSet(id, postToken, currentTarget.value),
    '装备套装已切换',
  )
}

function selectEquipmentSlot(id: string) {
  void loadSection('equipment', { equip_slot: id })
}

function showEquipmentOverview() {
  void loadSection('equipment', {})
}

function equipItem(slotId: string, equipmentId: string, postToken: string) {
  void runDomainAction(
    () => busi.equipItem(slotId, equipmentId, postToken, currentTarget.value),
    '装备已更新',
  )
}

function unequipItem(slotId: string, postToken: string) {
  void runDomainAction(() => busi.unequipItem(slotId, postToken, currentTarget.value), '装备已卸下')
}

function selectAbilityTree(id: string) {
  void loadSection('abilities', { tree: id })
}

async function updateAbility(action: HentaiVerseAbilityActionName | 'reset_all', value: string) {
  if (['reset_all', 'reset_ability', 'unlock_slot'].includes(action)) {
    const ability = page.value?.abilities?.abilities.find((item) => item.id === value)
    const slot = page.value?.abilities?.slots.find((item) => item.id === value)
    const cost =
      action === 'reset_all'
        ? page.value?.abilities?.resetCost
        : action === 'reset_ability'
          ? ability?.resetCost
          : slot?.unlockCost
    const description =
      action === 'unlock_slot'
        ? `解锁${slot?.group || '能力'}槽位，需要 ${cost ?? '未知数量的'} 精通点。`
        : `重置${action === 'reset_all' ? '全部能力与精通点分配' : ability?.name || '此能力'}，${cost === 0 ? '本次免费' : `需要 ${cost ?? '未知数量的'} 灵魂碎片`}。`
    try {
      await ElMessageBox.confirm(`${description}确定继续吗？`, '确认能力操作', { type: 'warning' })
    } catch {
      return
    }
  }
  void runDomainAction(
    () => busi.updateAbility(action, value, currentTarget.value),
    '能力配置已更新',
  )
}

function equipAbility(slotId: string, abilityId: string) {
  void runDomainAction(
    () => busi.equipAbility(slotId, abilityId, currentTarget.value),
    '能力槽已更新',
  )
}

function startTraining(id: string) {
  void runDomainAction(() => busi.startTraining(id, currentTarget.value), '训练已开始')
}

function cancelTraining() {
  void runDomainAction(() => busi.cancelTraining(currentTarget.value), '训练已取消')
}

function assignInventoryItem(slotId: string, itemId: string) {
  void runDomainAction(
    () => busi.assignInventoryItem(slotId, itemId, currentTarget.value),
    '物品槽位已更新',
  )
}

async function resumeBattle() {
  try {
    await enterHentaiVerseBattle(undefined)
  } catch (resumeError) {
    ElMessage.info(resumeError instanceof Error ? resumeError.message : '当前没有可恢复的战斗')
  }
}

onMounted(() => {
  if (authState.loggedIn) void loadSection()
})
</script>

<template>
  <div class="hv-view">
    <header class="hv-page-header">
      <div>
        <span>E-Hentai 联动网页游戏</span>
        <h1>HentaiVerse 角色养成与战斗</h1>
        <p class="hv-module-description">培养角色、配置装备与能力，并参加竞技场等战斗内容。</p>
        <p v-if="characterSummary.name" class="hv-character-summary">
          当前角色：{{ characterSummary.name
          }}<template v-if="characterSummary.persona"> · {{ characterSummary.persona }}</template>
        </p>
      </div>
      <div class="hv-header-actions">
        <el-button :icon="Lightning" @click="resumeBattle">恢复战斗</el-button>
        <el-button
          :icon="Refresh"
          circle
          title="刷新当前页面"
          :loading="loading"
          @click="loadSection()"
        />
      </div>
    </header>

    <el-alert
      v-if="!authState.loggedIn"
      title="请先在账号信息中维护认证 Cookie，HentaiVerse 与主站共用认证信息。"
      type="warning"
      :closable="false"
      show-icon
    />

    <div v-else class="hv-shell">
      <aside class="hv-navigation">
        <strong>角色</strong>
        <button
          v-for="item in characterSections"
          :key="item.key"
          type="button"
          :class="{ active: activeSection === item.key }"
          @click="loadSection(item.key)"
        >
          {{ item.label }}
        </button>
        <strong>战斗</strong>
        <button
          v-for="item in battleSections"
          :key="item.key"
          type="button"
          :class="{ active: activeSection === item.key }"
          @click="loadSection(item.key)"
        >
          {{ item.label }}
        </button>
      </aside>

      <main class="hv-content">
        <el-select
          v-model="activeSection"
          class="hv-mobile-navigation"
          aria-label="HentaiVerse 页面"
          @change="loadSection"
        >
          <el-option
            v-for="item in HENTAIVERSE_SECTIONS"
            :key="item.key"
            :label="item.label"
            :value="item.key"
          />
        </el-select>

        <div v-if="loading && !page" class="hv-loading">
          <el-skeleton :rows="7" animated />
        </div>
        <el-result
          v-else-if="battleBlocked"
          icon="warning"
          title="当前正在进行 HentaiVerse 战斗"
          sub-title="源站会在战斗期间锁定角色维护页面。请完成或退出当前战斗后，再重新加载装备和角色配置。"
        >
          <template #extra
            ><el-button type="primary" @click="resumeBattle">继续战斗</el-button></template
          >
        </el-result>
        <el-result
          v-else-if="error"
          icon="error"
          title="HentaiVerse 页面加载失败"
          :sub-title="error"
        >
          <template #extra
            ><el-button type="primary" @click="loadSection()">重新加载</el-button></template
          >
        </el-result>
        <template v-else-if="page">
          <div class="hv-content-heading">
            <div>
              <span>{{ currentMeta.group === 'character' ? '角色维护' : '战斗入口' }}</span>
              <h2>{{ currentMeta.label }}</h2>
            </div>
            <el-tag v-if="loading" type="info">更新中</el-tag>
          </div>

          <el-alert
            v-for="notice in page.notices"
            :key="notice"
            :title="notice"
            type="info"
            :closable="false"
            class="hv-notice"
          />

          <CharacterOverviewPanel
            v-if="activeSection === 'character'"
            :page="page"
            :loading="loading"
            @attributes="submitForm('character', $event)"
            @persona="submitForm('persona', $event)"
          />

          <EquipmentPanel
            v-else-if="activeSection === 'equipment' && page.equipment"
            :data="page.equipment"
            :loading="loading"
            @set="selectEquipmentSet"
            @overview="showEquipmentOverview"
            @slot="selectEquipmentSlot"
            @equip="equipItem"
            @unequip="unequipItem"
          />

          <AbilityPanel
            v-else-if="activeSection === 'abilities' && page.abilities"
            :data="page.abilities"
            :loading="loading"
            @tree="selectAbilityTree"
            @action="updateAbility"
            @equip="equipAbility"
          />

          <TrainingPanel
            v-else-if="activeSection === 'training' && page.training"
            :data="page.training"
            :loading="loading"
            @start="startTraining"
            @cancel="cancelTraining"
            @refresh="loadSection()"
          />

          <InventoryPanel
            v-else-if="activeSection === 'inventory' && page.inventory"
            :data="page.inventory"
            :loading="loading"
            @assign="assignInventoryItem"
          />

          <ChallengePanel
            v-else-if="page.challenges"
            :challenges="page.challenges"
            :post-token="page.challengePostToken || ''"
            :tokens="page.metrics.find((metric) => metric.label === '鲜血代币')?.value"
            :loading="loading"
            @start="submitForm(activeSection as HentaiVerseFormSection, $event)"
          />

          <ItemWorldPanel
            v-else-if="page.itemWorld"
            :data="page.itemWorld"
            :loading="loading"
            @category="loadSection('itemWorld', { filter: $event })"
            @start="submitForm('itemWorld', $event)"
          />

          <StatGroupsPanel
            v-if="['character', 'equipment'].includes(activeSection)"
            :groups="page.statGroups"
          />

          <HentaiVerseFormPanel
            v-for="form in page.forms.filter(
              (item) =>
                activeSection !== 'character' || !['character', 'persona'].includes(item.section),
            )"
            :key="form.id"
            :form="form"
            :loading="loading"
            @submit="submitForm"
          />

          <el-empty
            v-if="
              activeSection !== 'character' &&
              !page.forms.length &&
              !page.equipment &&
              !page.abilities &&
              !page.training &&
              !page.inventory &&
              !page.challenges &&
              !page.itemWorld
            "
            description="当前页面没有可用操作"
          />
        </template>
      </main>
    </div>
  </div>
</template>

<style scoped>
.hv-view {
  width: min(1240px, 100%);
  min-height: 100%;
  margin: 0 auto;
  padding-bottom: 80px;
}

.hv-page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding: 18px 0 22px;
}

.hv-page-header span,
.hv-content-heading span {
  color: var(--el-color-primary);
  font-size: 12px;
  font-weight: 700;
}

.hv-page-header h1 {
  margin: 3px 0 0;
  font-size: 30px;
  letter-spacing: 0;
}

.hv-page-header p {
  margin: 5px 0 0;
  color: var(--el-text-color-secondary);
}

.hv-page-header .hv-character-summary {
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.hv-header-actions {
  display: flex;
  gap: 8px;
}

.hv-header-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.hv-shell {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  border-top: 1px solid var(--el-border-color);
}

.hv-navigation {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 22px 18px 22px 0;
  border-right: 1px solid var(--el-border-color-lighter);
}

.hv-navigation strong {
  margin: 14px 10px 5px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.hv-navigation strong:first-child {
  margin-top: 0;
}

.hv-navigation button {
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-radius: 6px;
  color: var(--el-text-color-regular);
  text-align: left;
  background: transparent;
  cursor: pointer;
}

.hv-navigation button:hover {
  background: var(--el-fill-color-light);
}

.hv-navigation button.active {
  color: var(--el-color-primary);
  font-weight: 700;
  background: var(--el-color-primary-light-9);
}

.hv-content {
  min-width: 0;
  padding: 24px 0 24px 28px;
}

.hv-content-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.hv-content-heading h2 {
  margin: 3px 0 0;
  font-size: 24px;
  letter-spacing: 0;
}

.hv-mobile-navigation {
  display: none;
  width: 100%;
  margin-bottom: 18px;
}

.hv-notice {
  margin-bottom: 10px;
}

.hv-loading {
  padding: 16px 0;
}

@media (max-width: 767px) {
  .hv-page-header {
    align-items: stretch;
    flex-direction: column;
    gap: 14px;
    padding-top: 8px;
  }

  .hv-page-header h1 {
    font-size: 26px;
  }

  .hv-header-actions .el-button:first-child {
    flex: 1;
  }

  .hv-shell {
    display: block;
    border-top: 0;
  }

  .hv-navigation {
    display: none;
  }

  .hv-content {
    padding: 14px 0;
  }

  .hv-mobile-navigation {
    display: block;
  }
}
</style>
