<script setup lang="ts">
import { useAppLaunchReadiness } from '@/lib/appLaunch'
import { t } from '@/i18n'

import '@/assets/hentaiverse.css'
import SectionIcon from '@/components/hentaiverse/SectionIcon.vue'
import ActionButton from '@/components/primitives/ActionButton.vue'
import Notice from '@/components/primitives/Notice.vue'
import SelectField from '@/components/primitives/SelectField.vue'
import SkeletonBlock from '@/components/primitives/SkeletonBlock.vue'
import StatusPanel from '@/components/primitives/StatusPanel.vue'
import TagChip from '@/components/primitives/TagChip.vue'
import EmptyState from '@/components/primitives/EmptyState.vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { notify, dialogs } from '@/components/primitives/feedback'
import { Swords, PanelsTopLeft, RefreshCw as Refresh } from '@lucide/vue'
import AbilityPanel from '@/components/hentaiverse/AbilityPanel.vue'
import CharacterOverviewPanel from '@/components/hentaiverse/CharacterOverviewPanel.vue'
import EquipmentPanel from '@/components/hentaiverse/EquipmentPanel.vue'
import ArmoryPanel from '@/components/hentaiverse/ArmoryPanel.vue'
import BazaarPanel from '@/components/hentaiverse/BazaarPanel.vue'
import ServicesPanel from '@/components/hentaiverse/ServicesPanel.vue'
import HentaiVerseFormPanel from '@/components/hentaiverse/HentaiVerseFormPanel.vue'
import InventoryPanel from '@/components/hentaiverse/InventoryPanel.vue'
import TrainingPanel from '@/components/hentaiverse/TrainingPanel.vue'
import StatGroupsPanel from '@/components/hentaiverse/StatGroupsPanel.vue'
import ChallengePanel from '@/components/hentaiverse/ChallengePanel.vue'
import ItemWorldPanel from '@/components/hentaiverse/ItemWorldPanel.vue'
import { HentaiVerseBusi } from '@/core/hentaiverse/hentaiVerseBusi'
import { hentaiVerseWorld, hentaiVerseSourceUrl } from '@/core/hentaiverse/hentaiVerseWorld'
import {
  HENTAIVERSE_SECTIONS,
  HENTAIVERSE_SECTION_GROUPS,
  isHentaiVerseBattleStart,
} from '@/core/hentaiverse/hentaiVerseProtocol'
import type {
  HentaiVerseAbilityActionName,
  HentaiVerseBattleSnapshot,
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
const mobileNavigationGroup = ref<(typeof HENTAIVERSE_SECTION_GROUPS)[number]['key']>('character')
const mobileSectionsElement = ref<HTMLElement>()
const page = ref<HentaiVersePage>()
const loading = ref(false)
const submitting = ref(false)
useAppLaunchReadiness(() => loading.value, 'battle')
const error = ref('')
const battleBlocked = ref(false)
const currentTarget = ref<HentaiVersePageTarget>({ s: 'Character', ss: 'ch' })
const characterSummary = ref({ name: '', persona: '' })
const equipmentDetails = ref<Record<string, HentaiVerseEquipmentDetail>>({})
const equipmentDetailsLoading = ref(false)
const equipmentDetailsError = ref('')
let requestId = 0
let equipmentDetailsRequestId = 0

watch(page, (nextPage) => void loadEquipmentDetails(nextPage))
watch(
  () => [
    authState.source,
    authState.site,
    authState.loggedIn,
    authState.memberId,
    hentaiVerseWorld.value,
  ],
  () => {
    requestId++
    page.value = undefined
    characterSummary.value = { name: '', persona: '' }
    loading.value = false
    submitting.value = false
    error.value = ''
    battleBlocked.value = false
    if (authState.loggedIn) {
      if (!availableSections.value.some((section) => section.key === activeSection.value))
        activeSection.value = 'character'
      restoreSection()
    }
  },
  { flush: 'sync' },
)
onBeforeUnmount(() => {
  requestId++
  equipmentDetailsRequestId++
})

async function loadEquipmentDetails(nextPage = page.value) {
  const currentRequest = ++equipmentDetailsRequestId
  equipmentDetails.value = { ...nextPage?.armory?.inlineDetails }
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
const availableSections = computed(() =>
  HENTAIVERSE_SECTIONS.filter(
    (section) => !section.worlds || section.worlds.includes(hentaiVerseWorld.value),
  ),
)
const navigationGroups = computed(() =>
  HENTAIVERSE_SECTION_GROUPS.map((group) => ({
    ...group,
    sections: availableSections.value.filter((item) => item.group === group.key),
  })).filter((group) => group.sections.length),
)
const mobileNavigationSections = computed(
  () =>
    navigationGroups.value.find((group) => group.key === mobileNavigationGroup.value)?.sections ||
    [],
)

// Browsing a mobile group only reveals its links; selecting a link loads the page.
watch(activeSection, (section) => {
  mobileNavigationGroup.value = HENTAIVERSE_SECTIONS.find((item) => item.key === section)!.group
})

watch(
  [activeSection, mobileNavigationSections],
  () => {
    const navigation = mobileSectionsElement.value
    const selected = navigation?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!navigation?.clientWidth || !selected) return
    const bounds = navigation.getBoundingClientRect()
    const item = selected.getBoundingClientRect()
    if (item.left < bounds.left) navigation.scrollLeft += item.left - bounds.left
    else if (item.right > bounds.right) navigation.scrollLeft += item.right - bounds.right
  },
  { flush: 'post' },
)

const currentGroup = computed(
  () => HENTAIVERSE_SECTION_GROUPS.find((group) => group.key === currentMeta.value.group)!,
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
  battleBlocked.value = false
  if (nextPage.services?.canonicalQuery)
    currentTarget.value = { ...nextPage.services.canonicalQuery, world: hentaiVerseWorld.value }
  if (nextPage.equipment)
    currentTarget.value.equip_slot = nextPage.equipment.selectedSlot || undefined
  updateCharacterSummary(nextPage)
  try {
    sessionStorage.setItem(
      navigationKey(),
      JSON.stringify({ section: activeSection.value, target: currentTarget.value }),
    )
  } catch {
    // Navigation remains usable when session storage is unavailable.
  }
}

function navigationKey() {
  return `eviewer:hv-navigation:${authState.source}:${authState.site}:${authState.memberId}:${hentaiVerseWorld.value}`
}

function restoreSection() {
  let section = activeSection.value
  let target: Partial<HentaiVersePageTarget> = {}
  try {
    const saved = JSON.parse(sessionStorage.getItem(navigationKey()) || 'null')
    const meta = availableSections.value.find((item) => item.key === saved?.section)
    if (meta && saved.target && typeof saved.target === 'object') {
      section = meta.key
      const keys = [
        'equip_slot',
        'tree',
        'filter',
        'screen',
        'eqids[]',
        'itemid',
        'tradelog',
        'playerstock',
        'marketstock',
        'lottery',
        'create',
        'slot',
        'pane',
      ]
      target = Object.fromEntries(
        Object.entries(saved.target).filter(
          ([key, value]) => keys.includes(key) && typeof value === 'string',
        ),
      )
    }
  } catch {
    // Invalid saved navigation falls back to the current available section.
  }
  if (!availableSections.value.some((item) => item.key === section)) section = 'character'
  void loadSection(section, target)
}

function openBattle(snapshot: HentaiVerseBattleSnapshot) {
  page.value = undefined
  battleBlocked.value = true
  showHentaiVerseBattleSnapshot(snapshot)
}

async function loadSection(
  section: HentaiVerseSection = activeSection.value,
  targetOverride?: Partial<HentaiVersePageTarget>,
) {
  const meta = HENTAIVERSE_SECTIONS.find((item) => item.key === section)
  if (!meta || submitting.value) return
  const changedSection = section !== activeSection.value
  const target = {
    ...meta.target,
    ...(!changedSection && !targetOverride ? currentTarget.value : targetOverride || {}),
    world: hentaiVerseWorld.value,
  }
  const targetChanged = Object.keys({ ...currentTarget.value, ...target }).some(
    (key) =>
      currentTarget.value[key as keyof HentaiVersePageTarget] !==
      target[key as keyof HentaiVersePageTarget],
  )
  if (loading.value && !targetChanged) return
  activeSection.value = section
  currentTarget.value = target
  if (changedSection || targetChanged) page.value = undefined
  const currentRequest = ++requestId
  loading.value = true
  error.value = ''
  battleBlocked.value = false
  try {
    const result = await busi.getPage(currentTarget.value)
    if (currentRequest !== requestId) return
    if (result.battle) {
      openBattle(result.battle)
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
  submitting.value = true
  error.value = ''
  try {
    const result = await request()
    if (currentRequest !== requestId || memberId !== authState.memberId) return
    if (result.battle) {
      openBattle(result.battle)
      notify.success(t('已进入 HentaiVerse 战斗'))
    } else if (result.page) {
      if (!result.page.authenticated)
        throw new Error(t('HentaiVerse 登录态已失效，请在当前连接模式下重新登录'))
      setPage(result.page)
      if (result.confirmed) notify.success(successMessage)
      else notify.info(t('已收到源站响应，请核对更新结果'))
    }
  } catch (actionError) {
    if (currentRequest === requestId && memberId === authState.memberId) {
      notify.error(t(actionError instanceof Error ? actionError.message : '操作失败'))
    }
  } finally {
    if (currentRequest === requestId) {
      submitting.value = false
      loading.value = false
    }
  }
}

async function submitForm(section: HentaiVerseFormSection, data: HentaiVerseFormData) {
  if (loading.value) return
  const currentRequest = ++requestId
  const memberId = authState.memberId
  const target = { ...currentTarget.value }
  loading.value = true
  submitting.value = true
  error.value = ''
  try {
    try {
      if (section === 'persona' && data.persona_create) {
        await dialogs.confirm(t('人格创建后无法删除，确定继续吗？'), t('创建人格'), {
          type: 'warning',
        })
      }
      if (isHentaiVerseBattleStart(section, data)) {
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
      }
    } catch {
      return
    }
    if (currentRequest !== requestId || memberId !== authState.memberId) return
    const result = await busi.submitForm(section, data, target)
    if (currentRequest !== requestId || memberId !== authState.memberId) return
    if (result.battle) {
      openBattle(result.battle)
      notify.success(t('已进入 HentaiVerse 战斗'))
    } else if (result.page) {
      if (!result.page.authenticated)
        throw new Error(t('HentaiVerse 登录态已失效，请重新维护认证 Cookie'))
      setPage(result.page)
      notify.info(t('已收到源站响应，请核对更新结果'))
    }
  } catch (submitError) {
    if (currentRequest === requestId && memberId === authState.memberId)
      notify.error(t(submitError instanceof Error ? submitError.message : '提交失败'))
  } finally {
    if (currentRequest === requestId) {
      submitting.value = false
      loading.value = false
    }
  }
}

function navigateService(query: Record<string, string>) {
  const target = { ...currentMeta.value.target, ...query }
  const meta = availableSections.value.find(
    (item) => item.target.s === target.s && item.target.ss === target.ss,
  )
  if (meta) void loadSection(meta.key, target)
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
  const source = page.value
  if (loading.value) return
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
  if (page.value !== source || loading.value) return
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

async function startTraining(id: string) {
  const source = page.value
  const option = source?.training?.options.find((item) => item.id === id)
  if (!option?.canStart || loading.value) return
  try {
    await dialogs.confirm(
      `${t(option.name)} · ${t('费用')} ${t(option.cost)} · ${t('耗时')} ${t(option.duration)}`,
      t('确认开始训练'),
      { confirmButtonText: t('开始训练'), cancelButtonText: t('取消') },
    )
  } catch {
    return
  }
  if (page.value !== source || loading.value) return
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
    await enterHentaiVerseBattle()
  } catch (resumeError) {
    notify.info(resumeError instanceof Error ? resumeError.message : t('当前没有可恢复的战斗'))
  }
}

onMounted(() => {
  if (authState.loggedIn) restoreSection()
})
</script>

<template>
  <div class="hv-view hv-theme">
    <header class="hv-page-header">
      <span class="hv-module-mark" aria-hidden="true"><Swords :size="22" /></span>
      <div class="hv-header-title">
        <h1>HentaiVerse</h1>
        <p v-if="characterSummary.name" class="hv-character-summary">
          {{ t('当前角色：') }}{{ t(characterSummary.name)
          }}<template v-if="characterSummary.persona">
            · {{ t(characterSummary.persona) }}</template
          >
        </p>
      </div>
      <SelectField
        v-if="authState.loggedIn"
        v-model="hentaiVerseWorld"
        class="hv-world-select"
        :aria-label="t('世界')"
        :disabled="loading || hentaiVerseState.actionPending || hentaiVerseState.battleLoading"
      >
        <option value="persistent" :label="t('永久世界')" />
        <option value="isekai" :label="t('异世界')" />
      </SelectField>
      <div class="hv-header-actions">
        <ActionButton :icon="Swords" @click="resumeBattle">{{ t('恢复战斗') }}</ActionButton>
        <ActionButton
          :icon="Refresh"
          size="icon"
          :title="t('刷新当前页面')"
          :loading="loading"
          @click="loadSection()"
        />
      </div>
    </header>

    <details v-if="authState.source === 'local'" class="hv-local-help" :open="!authState.loggedIn">
      <summary>{{ t('连接说明') }}</summary>
      <p>
        {{
          t(
            'HentaiVerse 使用当前浏览器的源站会话。首次使用请更新助手，并在同一浏览器打开源站确认登录。',
          )
        }}
      </p>
      <a :href="hentaiVerseSourceUrl" target="_blank" rel="noopener noreferrer">{{
        t('打开 HentaiVerse')
      }}</a>
      <RouterLink :to="ASSISTANT_SETTINGS">{{ t('安装或更新浏览器助手') }}</RouterLink>
    </details>
    <Notice
      v-if="!authState.loggedIn"
      :title="t('请先在账号信息中完成当前连接模式的登录验证。')"
      tone="warning"
      :closable="false"
    />

    <div v-else class="hv-shell">
      <aside class="hv-navigation">
        <div class="hv-window-title">
          <PanelsTopLeft :size="16" aria-hidden="true" />{{ t('功能目录') }}
        </div>
        <details
          v-for="group in navigationGroups"
          :key="group.key"
          class="hv-navigation-group"
          :open="currentMeta.group === group.key"
        >
          <summary>{{ t(group.label) }}</summary>
          <button
            v-for="item in group.sections"
            :key="item.key"
            type="button"
            :class="{ active: activeSection === item.key }"
            :aria-current="activeSection === item.key ? 'page' : undefined"
            @click="loadSection(item.key)"
          >
            <SectionIcon :kind="item.key" />{{ t(item.label) }}
          </button>
        </details>
      </aside>

      <main class="hv-content">
        <div class="hv-mobile-navigation">
          <nav class="hv-mobile-groups" :aria-label="t('HentaiVerse 分区')">
            <button
              v-for="group in navigationGroups"
              :key="group.key"
              type="button"
              :aria-pressed="mobileNavigationGroup === group.key"
              :class="{ active: mobileNavigationGroup === group.key }"
              aria-controls="hv-mobile-sections"
              @click="mobileNavigationGroup = group.key"
            >
              {{ t(group.label) }}
            </button>
          </nav>
          <nav
            ref="mobileSectionsElement"
            id="hv-mobile-sections"
            class="hv-mobile-sections"
            :aria-label="t('当前分区功能')"
          >
            <button
              v-for="item in mobileNavigationSections"
              :key="item.key"
              type="button"
              :class="{ active: activeSection === item.key }"
              :aria-current="activeSection === item.key ? 'page' : undefined"
              @click="loadSection(item.key)"
            >
              {{ t(item.label) }}
            </button>
          </nav>
        </div>

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
          v-else-if="error && !page"
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
          <Notice v-if="error" tone="error" :title="t(error)" class="hv-notice">
            <ActionButton size="sm" @click="loadSection()">{{ t('重新加载') }}</ActionButton>
          </Notice>
          <div class="hv-content-heading">
            <div>
              <span>{{ t(currentGroup.heading) }}</span>
              <h2>{{ t(currentMeta.label) }}</h2>
              <small v-if="page.season">{{ page.season }}</small>
            </div>
            <TagChip v-if="loading" tone="info">{{ t('更新中') }}</TagChip>
          </div>

          <Notice
            v-for="notice in page.notices"
            :key="notice"
            :title="t(notice)"
            :tone="page.noticeTones?.[notice] || 'info'"
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

          <ArmoryPanel
            v-else-if="page.armory"
            :data="page.armory"
            :loading="loading"
            :details="equipmentDetails"
            :details-loading="equipmentDetailsLoading"
            :details-error="equipmentDetailsError"
            @retry-details="loadEquipmentDetails()"
            @navigate="navigateService"
            @submit="submitForm('armory', $event)"
          />
          <BazaarPanel
            v-else-if="page.bazaar"
            :data="page.bazaar"
            :loading="loading"
            @navigate="navigateService"
            @submit="submitForm(activeSection, $event)"
          />
          <ServicesPanel
            v-else-if="page.services"
            :data="page.services"
            :loading="loading"
            @navigate="navigateService"
            @submit="submitForm(activeSection, $event)"
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

          <StatGroupsPanel v-if="activeSection === 'equipment'" :groups="page.statGroups" />

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
              !page.armory &&
              !page.bazaar &&
              !page.services &&
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
.hv-local-help summary {
  cursor: pointer;
  padding: 8px 0;
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
  padding-bottom: calc(
    5 * (var(--fab-size) + var(--fab-gap, 10px)) + var(--fab-inset) + env(safe-area-inset-bottom)
  );
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

.hv-mobile-world,
.hv-mobile-navigation {
  display: none;
}

/* Keep the shared primitives visually consistent inside the HV feature. */
.hv-view :deep(.ui-button) {
  min-height: 36px;
  border-radius: 5px;
  box-shadow: none;
  font-weight: 500;
}

.hv-navigation button:focus-visible,
.hv-mobile-navigation button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.hv-notice {
  margin-bottom: 10px;
}

.hv-loading {
  padding: 16px 0;
}

@media (max-width: 767px) {
  .hv-view.hv-theme .hv-page-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(116px, auto);
    align-items: center;
    gap: 10px;
    padding: 8px 0 12px;
  }

  .hv-header-title {
    min-width: 0;
  }

  .hv-header-title > span,
  .hv-module-description {
    display: none;
  }

  .hv-view.hv-theme .hv-page-header h1 {
    font-size: 22px;
  }

  .hv-page-header .hv-character-summary {
    overflow: hidden;
    font-size: 12px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .hv-mobile-world {
    display: block;
    min-width: 0;
    width: 100%;
  }

  .hv-header-actions {
    grid-column: 1 / -1;
  }

  .hv-view :deep(.camp-scene) {
    height: 64px;
    margin-bottom: 10px;
  }

  .hv-view :deep(.camp-scene .scene-caption) {
    bottom: 8px;
    font-size: 10px;
  }

  .hv-local-help {
    margin: 4px 0;
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
    display: grid;
    gap: 8px;
    margin-bottom: 16px;
  }

  .hv-mobile-groups {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 4px;
    padding: 4px;
    border: 1px solid var(--border-soft);
    border-radius: 6px;
    background: var(--muted-soft);
  }

  .hv-mobile-navigation button {
    min-width: 0;
    min-height: 44px;
    padding: 8px;
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--muted-foreground);
    font-size: 14px;
    line-height: 1.4;
    background: transparent;
    cursor: pointer;
    overflow-wrap: anywhere;
  }

  .hv-mobile-groups button.active {
    color: var(--accent);
    background: var(--background);
    border-color: var(--border);
    font-weight: 700;
  }

  .hv-mobile-sections {
    display: flex;
    flex-wrap: nowrap;
    gap: 4px;
    min-width: 0;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: thin;
  }

  .hv-mobile-sections button {
    flex: 0 0 auto;
    padding-inline: 12px;
    border-color: var(--border-soft);
    color: var(--text);
    white-space: nowrap;
    overflow-wrap: normal;
  }

  .hv-mobile-sections button.active {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-soft);
    font-weight: 700;
  }

  .hv-view :deep(.ui-button) {
    min-height: 44px;
    white-space: normal;
  }

  .hv-view :deep(.ui-button--icon) {
    min-width: 44px;
    flex-shrink: 0;
  }

  .hv-view :deep(input:not([type='checkbox']):not([type='radio'])),
  .hv-view :deep(select),
  .hv-view :deep(textarea),
  .hv-view :deep(.ui-select-trigger) {
    min-height: 44px;
    font-size: 16px;
  }

  .hv-local-help summary {
    min-height: 44px;
  }
}
</style>
