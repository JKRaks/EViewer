<script setup lang="ts">
import { useAppLaunchReadiness } from '@/lib/appLaunch'
import { t } from '@/i18n'

import '@/assets/hentaiverse.css'
import CampScene from '@/components/hentaiverse/CampScene.vue'
import PixelIcon from '@/components/hentaiverse/PixelIcon.vue'
import ActionButton from '@/components/primitives/ActionButton.vue'
import Notice from '@/components/primitives/Notice.vue'
import SelectField from '@/components/primitives/SelectField.vue'
import SkeletonBlock from '@/components/primitives/SkeletonBlock.vue'
import StatusPanel from '@/components/primitives/StatusPanel.vue'
import TagChip from '@/components/primitives/TagChip.vue'
import EmptyState from '@/components/primitives/EmptyState.vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { notify, dialogs } from '@/components/primitives/feedback'
import { Zap as Lightning, RefreshCw as Refresh } from '@lucide/vue'
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
  HentaiVerseEquipmentDetail,
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
import { ASSISTANT_SETTINGS } from '@/core/connector/connectorProtocol'

defineOptions({ name: 'HentaiVerseView' })

const busi = new HentaiVerseBusi()
const authState = useAuthState()
const activeSection = ref<HentaiVerseSection>('character')
const page = ref<HentaiVersePage>()
const loading = ref(false)
useAppLaunchReadiness(() => loading.value, 'battle')
const error = ref('')
const battleBlocked = ref(false)
const currentTarget = ref<HentaiVersePageTarget>({ ...HENTAIVERSE_SECTIONS[0]!.target })
const characterSummary = ref({ name: '', persona: '' })
const equipmentDetails = ref<Record<string, HentaiVerseEquipmentDetail>>({})
const equipmentDetailsLoading = ref(false)
const equipmentDetailsError = ref('')
let requestId = 0
let equipmentDetailsRequestId = 0

watch(page, (nextPage) => void loadEquipmentDetails(nextPage))
watch(
  () => [authState.source, authState.loggedIn, authState.memberId],
  () => {
    requestId++
    page.value = undefined
    characterSummary.value = { name: '', persona: '' }
    loading.value = false
    error.value = ''
    battleBlocked.value = false
    if (authState.loggedIn) void loadSection()
  },
  { flush: 'sync' },
)
onBeforeUnmount(() => {
  requestId++
  equipmentDetailsRequestId++
})

async function loadEquipmentDetails(nextPage = page.value) {
  const currentRequest = ++equipmentDetailsRequestId
  equipmentDetails.value = {}
  equipmentDetailsError.value = ''
  const sources = nextPage?.equipmentSources || []
  equipmentDetailsLoading.value = sources.length > 0
  if (!sources.length) return
  await Promise.all(
    sources.map(async (source) => {
      try {
        const details = await busi.getEquipmentDetails(source)
        if (currentRequest === equipmentDetailsRequestId && page.value === nextPage)
          Object.assign(equipmentDetails.value, details)
      } catch {
        if (currentRequest === equipmentDetailsRequestId && page.value === nextPage)
          equipmentDetailsError.value = t('装备属性暂时无法加载，请重试')
      }
    }),
  )
  if (currentRequest === equipmentDetailsRequestId && page.value === nextPage)
    equipmentDetailsLoading.value = false
}

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
    if (completed && !wasCompleted) void loadSection()
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
  if (
    !meta ||
    (loading.value &&
      meta.target.s === currentTarget.value.s &&
      meta.target.ss === currentTarget.value.ss)
  )
    return
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
    if (currentRequest !== requestId) return
    if (result.battle) {
      page.value = undefined
      battleBlocked.value = true
      showHentaiVerseBattleSnapshot(result.battle)
      return
    }
    if (!result.page?.authenticated)
      throw new Error(t('HentaiVerse 登录态已失效，请在当前连接模式下重新登录'))
    setPage(result.page)
  } catch (loadError) {
    if (currentRequest === requestId)
      error.value = loadError instanceof Error ? loadError.message : t('页面加载失败')
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

async function runDomainAction(
  request: () => ReturnType<HentaiVerseBusi['submitForm']>,
  successMessage: string,
) {
  if (loading.value) return
  const currentRequest = ++requestId
  const memberId = authState.memberId
  loading.value = true
  try {
    const result = await request()
    if (currentRequest !== requestId || memberId !== authState.memberId) return
    if (result.battle) {
      showHentaiVerseBattleSnapshot(result.battle)
      notify.success(t('已进入 HentaiVerse 战斗'))
    } else if (result.page) {
      if (!result.page.authenticated)
        throw new Error(t('HentaiVerse 登录态已失效，请在当前连接模式下重新登录'))
      setPage(result.page)
      notify.success(successMessage)
    }
  } catch (actionError) {
    if (currentRequest === requestId && memberId === authState.memberId) {
      notify.error(actionError instanceof Error ? actionError.message : t('操作失败'))
    }
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

async function submitForm(section: HentaiVerseFormSection, data: HentaiVerseFormData) {
  if (section === 'persona' && data.persona_create) {
    try {
      await dialogs.confirm(t('人格创建后无法删除，确定继续吗？'), t('创建人格'), {
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
        HENTAIVERSE_SECTIONS.find((item) => item.key === section)?.label || t('战斗')
      const challenge = page.value?.challenges?.find((item) => item.id === data.initid)
      const entryId = Array.isArray(data['eqids[]']) ? data['eqids[]'][0] : ''
      const entryInfo = entryId ? page.value?.itemWorld?.entryInfo[entryId] : undefined
      const details = challenge
        ? t('{p0}，{p1} 轮，入场费用 {p2}。', {
            p0: t(challenge.name),
            p1: challenge.rounds,
            p2: t(challenge.entryCost || '无'),
          })
        : entryInfo
          ? t('{p0} 轮，消耗 {p1} 世界种子。', { p0: entryInfo.rounds, p1: entryInfo.cost })
          : ''
      await dialogs.confirm(
        t('{p0}即将进入{p1}，进入后需要完成或退出当前战斗。确定继续吗？', {
          p0: details,
          p1: t(sectionLabel),
        }),
        t('确认开始战斗'),
        {
          type: 'warning',
          confirmButtonText: t('开始战斗'),
          cancelButtonText: t('暂不进入'),
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
      notify.success(t('已进入 HentaiVerse 战斗'))
    } else if (result.page) {
      if (!result.page.authenticated)
        throw new Error(t('HentaiVerse 登录态已失效，请重新维护认证 Cookie'))
      setPage(result.page)
      notify.success(t('HentaiVerse 设置已更新'))
    }
  } catch (submitError) {
    notify.error(submitError instanceof Error ? submitError.message : t('提交失败'))
  } finally {
    loading.value = false
  }
}

function selectEquipmentSet(id: string, postToken: string) {
  void runDomainAction(
    () => busi.selectEquipmentSet(id, postToken, currentTarget.value),
    t('装备套装已切换'),
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
    t('装备已更新'),
  )
}

function unequipItem(slotId: string, postToken: string) {
  void runDomainAction(
    () => busi.unequipItem(slotId, postToken, currentTarget.value),
    t('装备已卸下'),
  )
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
        ? t('解锁{p0}槽位，需要 {p1} 精通点。', {
            p0: t(slot?.group || '能力'),
            p1: cost ?? t('未知数量的'),
          })
        : t('重置{p0}，{p1}。', {
            p0: t(action === 'reset_all' ? '全部能力与精通点分配' : ability?.name || '此能力'),
            p1:
              cost === 0 ? t('本次免费') : t('需要 {p0} 灵魂碎片', { p0: cost ?? t('未知数量的') }),
          })
    try {
      await dialogs.confirm(t('{p0}确定继续吗？', { p0: description }), t('确认能力操作'), {
        type: 'warning',
      })
    } catch {
      return
    }
  }
  void runDomainAction(
    () => busi.updateAbility(action, value, currentTarget.value),
    t('能力配置已更新'),
  )
}

function equipAbility(slotId: string, abilityId: string) {
  void runDomainAction(
    () => busi.equipAbility(slotId, abilityId, currentTarget.value),
    t('能力槽已更新'),
  )
}

function startTraining(id: string) {
  void runDomainAction(() => busi.startTraining(id, currentTarget.value), t('训练已开始'))
}

function cancelTraining() {
  void runDomainAction(() => busi.cancelTraining(currentTarget.value), t('训练已取消'))
}

function assignInventoryItem(slotId: string, itemId: string) {
  void runDomainAction(
    () => busi.assignInventoryItem(slotId, itemId, currentTarget.value),
    t('物品槽位已更新'),
  )
}

async function resumeBattle() {
  try {
    await enterHentaiVerseBattle(undefined)
  } catch (resumeError) {
    notify.info(resumeError instanceof Error ? resumeError.message : t('当前没有可恢复的战斗'))
  }
}

onMounted(() => {
  if (authState.loggedIn) void loadSection()
})
</script>

<template>
  <div class="hv-view hv-theme">
    <header class="hv-page-header">
      <div>
        <span>{{ t('冒险手帐') }}</span>
        <h1>HentaiVerse</h1>
        <p class="hv-module-description">
          {{ t('培养角色、配置装备与能力，并参加竞技场等战斗内容。') }}
        </p>
        <p v-if="characterSummary.name" class="hv-character-summary">
          {{ t('当前角色：') }}{{ t(characterSummary.name)
          }}<template v-if="characterSummary.persona">
            · {{ t(characterSummary.persona) }}</template
          >
        </p>
      </div>
      <div class="hv-header-actions">
        <ActionButton :icon="Lightning" @click="resumeBattle">{{ t('恢复战斗') }}</ActionButton>
        <ActionButton
          :icon="Refresh"
          size="icon"
          :title="t('刷新当前页面')"
          :loading="loading"
          @click="loadSection()"
        />
      </div>
    </header>

    <CampScene :compact="activeSection !== 'character'" />
    <div v-if="authState.source === 'local'" class="hv-local-help">
      <p>
        {{
          t(
            'HentaiVerse 使用当前浏览器的源站会话。首次使用请更新助手，并在同一浏览器打开源站确认登录。',
          )
        }}
      </p>
      <a href="https://hentaiverse.org/" target="_blank" rel="noopener noreferrer">{{
        t('打开 HentaiVerse')
      }}</a>
      <RouterLink :to="ASSISTANT_SETTINGS">{{ t('安装或更新浏览器助手') }}</RouterLink>
    </div>
    <Notice
      v-if="!authState.loggedIn"
      :title="t('请先在账号信息中完成当前连接模式的登录验证。')"
      tone="warning"
      :closable="false"
    />

    <div v-else class="hv-shell">
      <aside class="hv-navigation">
        <strong>{{ t('角色') }}</strong>
        <button
          v-for="item in characterSections"
          :key="item.key"
          type="button"
          :class="{ active: activeSection === item.key }"
          @click="loadSection(item.key)"
        >
          <PixelIcon :kind="item.key" />{{ t(item.label) }}
        </button>
        <strong>{{ t('战斗') }}</strong>
        <button
          v-for="item in battleSections"
          :key="item.key"
          type="button"
          :class="{ active: activeSection === item.key }"
          @click="loadSection(item.key)"
        >
          <PixelIcon :kind="item.key" />{{ t(item.label) }}
        </button>
      </aside>

      <main class="hv-content">
        <SelectField
          v-model="activeSection"
          class="hv-mobile-navigation"
          :aria-label="t('HentaiVerse 页面')"
          @change="loadSection"
        >
          <option
            v-for="item in HENTAIVERSE_SECTIONS"
            :key="item.key"
            :label="t(item.label)"
            :value="item.key"
          ></option>
        </SelectField>

        <div v-if="loading && !page" class="hv-loading">
          <SkeletonBlock :rows="7" />
        </div>
        <StatusPanel
          v-else-if="battleBlocked"
          icon="warning"
          :title="t('当前正在进行 HentaiVerse 战斗')"
          :sub-title="
            t(
              '源站会在战斗期间锁定角色维护页面。请完成或退出当前战斗后，再重新加载装备和角色配置。',
            )
          "
        >
          <template #extra
            ><ActionButton variant="default" @click="resumeBattle">{{
              t('继续战斗')
            }}</ActionButton></template
          >
        </StatusPanel>
        <StatusPanel
          v-else-if="error"
          icon="error"
          :title="t('HentaiVerse 页面加载失败')"
          :sub-title="t(error)"
        >
          <template #extra
            ><ActionButton variant="default" @click="loadSection()">{{
              t('重新加载')
            }}</ActionButton></template
          >
        </StatusPanel>
        <template v-else-if="page">
          <div class="hv-content-heading">
            <div>
              <span>{{
                t(currentMeta.group === 'character' ? t('角色维护') : t('战斗入口'))
              }}</span>
              <h2>{{ t(currentMeta.label) }}</h2>
            </div>
            <TagChip v-if="loading" tone="info">{{ t('更新中') }}</TagChip>
          </div>

          <Notice
            v-for="notice in page.notices"
            :key="notice"
            :title="t(notice)"
            tone="info"
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
            :details="equipmentDetails"
            :details-loading="equipmentDetailsLoading"
            :details-error="equipmentDetailsError"
            @retry-details="loadEquipmentDetails()"
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
            :details="equipmentDetails"
            :details-loading="equipmentDetailsLoading"
            :details-error="equipmentDetailsError"
            @retry-details="loadEquipmentDetails()"
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

          <EmptyState
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
            :description="t('当前页面没有可用操作')"
          />
        </template>
      </main>
    </div>
  </div>
</template>

<style scoped>
.hv-local-help {
  margin: 16px 0;
  color: var(--muted-foreground);
  font-size: 13px;
  line-height: 1.7;
}

.hv-local-help p {
  margin: 0 0 4px;
}

.hv-local-help a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  margin-right: 16px;
}

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
  color: var(--accent);
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
  color: var(--muted-foreground);
}

.hv-page-header .hv-character-summary {
  color: var(--text);
  font-size: 13px;
}

.hv-header-actions {
  display: flex;
  gap: 8px;
}

.hv-header-actions :deep(.ui-button + .ui-button) {
  margin-left: 0;
}

.hv-shell {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  border-top: 1px solid var(--border);
}

.hv-navigation {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 22px 18px 22px 0;
  border-right: 1px solid var(--border-soft);
}

.hv-navigation strong {
  margin: 14px 10px 5px;
  color: var(--muted-foreground);
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
  color: var(--text);
  text-align: left;
  background: transparent;
  cursor: pointer;
}

.hv-navigation button:hover {
  background: var(--muted);
}

.hv-navigation button.active {
  color: var(--accent);
  font-weight: 700;
  background: var(--accent-soft);
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

  .hv-header-actions .ui-button:first-child {
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
