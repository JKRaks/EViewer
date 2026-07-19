<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ArrowRight, Key, RefreshRight, SwitchButton } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import 'element-plus/es/components/message/style/css'
import { clearAuthCookies, saveAuthCookies, useAuthState } from '@/core/auth/authState'
import { userInfoBusi } from '@/core/auth/userInfoBusi'
import hathPerkTranslationData from '@/core/data/hathPerkTranslations.json'
import { userDonationInput } from '@/core/model/auth/userDonationInput'
import type { userDonationData } from '@/core/model/auth/userDonationOutput'
import { userHathPerksInput } from '@/core/model/auth/userHathPerksInput'
import type {
  userHathPerkData,
  userHathPerksData,
} from '@/core/model/auth/userHathPerksOutput'
import { userOverviewInput } from '@/core/model/auth/userOverviewInput'
import type { userOverviewData } from '@/core/model/auth/userOverviewOutput'

defineOptions({
  name: 'LoginView',
})

type AccountDataSection = 'overview' | 'donation' | 'hathPerks'
type AccountTab = 'authentication' | AccountDataSection
type AuthInputMode = 'cookie' | 'fields'

interface ModuleState {
  loading: boolean
  error: string
  requestId: number
}

interface HathPerkDisplay extends userHathPerkData {
  displayName: string
  displayDescription: string
  displayDonationRequirement: string
}

interface HathPerkGroup {
  parent: HathPerkDisplay
  children: HathPerkDisplay[]
}

const hathPerkTranslations = hathPerkTranslationData as Record<
  string,
  { name: string; description: string }
>

const donationTiers = [
  {
    level: 0,
    name: '未捐赠',
    requirement: '尚未捐赠，但依然感谢你的支持。',
    expBonus: '--',
    dailyCredits: '',
    dailyGp: '',
    dailyHath: '--',
    freeArchives: '--',
  },
  {
    level: 1,
    name: '铜星',
    requirement: '累计捐赠达到 $20',
    expBonus: '+25%',
    dailyCredits: '2,000',
    dailyGp: '2,000',
    dailyHath: '--',
    freeArchives: '5 GB / 周',
  },
  {
    level: 2,
    name: '银星',
    requirement: '累计捐赠达到 $50',
    expBonus: '+50%',
    dailyCredits: '5,000',
    dailyGp: '5,000',
    dailyHath: '1',
    freeArchives: '10 GB / 周',
  },
  {
    level: 3,
    name: '金星',
    requirement: '累计捐赠达到 $100',
    expBonus: '+100%',
    dailyCredits: '10,000',
    dailyGp: '10,000',
    dailyHath: '3',
    freeArchives: '20 GB / 周',
  },
  {
    level: 4,
    name: '金星 x3',
    requirement: '累计捐赠达到 $300',
    expBonus: '+150%',
    dailyCredits: '20,000',
    dailyGp: '20,000',
    dailyHath: '5',
    freeArchives: '40 GB / 周',
  },
  {
    level: 5,
    name: '金星 x5',
    requirement: '累计捐赠达到 $500',
    expBonus: '+200%',
    dailyCredits: '30,000',
    dailyGp: '30,000',
    dailyHath: '10',
    freeArchives: '60 GB / 周',
  },
  {
    level: 6,
    name: '金星 x7',
    requirement: '累计捐赠达到 $700',
    expBonus: '+250%',
    dailyCredits: '40,000',
    dailyGp: '40,000',
    dailyHath: '15',
    freeArchives: '80 GB / 周',
  },
  {
    level: 7,
    name: '荣誉猫娘',
    requirement: '累计捐赠达到 $1000',
    expBonus: '+300%',
    dailyCredits: '50,000',
    dailyGp: '50,000',
    dailyHath: '20',
    freeArchives: '100 GB / 周',
  },
] as const

const authState = useAuthState()
const infoBusi = new userInfoBusi()
const activeTab = ref<AccountTab>(authState.loggedIn ? 'overview' : 'authentication')
const authInputMode = ref<AuthInputMode>('cookie')
const submitting = ref(false)
const loggingOut = ref(false)
const overviewData = ref<userOverviewData>()
const donationData = ref<userDonationData>()
const hathPerksData = ref<userHathPerksData>()
const moduleStates = reactive<Record<AccountDataSection, ModuleState>>({
  overview: { loading: false, error: '', requestId: 0 },
  donation: { loading: false, error: '', requestId: 0 },
  hathPerks: { loading: false, error: '', requestId: 0 },
})
const form = reactive({
  cookieText: '',
  memberId: '',
  passHash: '',
})

const loginTime = computed(() =>
  authState.lastLoginAt ? new Date(authState.lastLoginAt).toLocaleString('zh-CN') : '--',
)

const imageUsagePercentage = computed(() => {
  const data = overviewData.value?.imageLimit
  if (!data || data.limit <= 0) return 0
  return Math.min(100, Math.round((data.usage / data.limit) * 100))
})

const gpGainedTotal = computed(() => {
  const data = overviewData.value?.gpGained
  if (!data) return undefined

  const values = [
    data.galleryVisits,
    data.torrentCompletions,
    data.archiveDownloads,
    data.hentaiHome,
  ]
  return values.every(Number.isFinite)
    ? values.reduce((total, value) => total + value, 0)
    : undefined
})

const currentDonationTier = computed(() =>
  donationTiers.find((tier) => tier.level === donationData.value?.donationLevel),
)

const hathPerksSummary = computed(() => {
  const perks = hathPerksData.value?.perks ?? []
  return {
    obtained: perks.filter((perk) => perk.obtained).length,
    purchasable: perks.filter((perk) => perk.purchasable).length,
    locked: perks.filter((perk) => perk.locked).length,
  }
})

const hathPerkGroups = computed<HathPerkGroup[]>(() => {
  const groups: HathPerkGroup[] = []
  for (const perk of hathPerksData.value?.perks ?? []) {
    const displayPerk = translateHathPerk(perk)
    const currentGroup = groups[groups.length - 1]
    if (perk.isSubPerk && currentGroup) {
      currentGroup.children.push(displayPerk)
    } else {
      groups.push({ parent: displayPerk, children: [] })
    }
  }
  return groups
})

watch(
  activeTab,
  (tab) => {
    if (tab !== 'authentication' && authState.loggedIn) {
      void loadAccountSection(tab)
    }
  },
  { immediate: true },
)

async function submitCookies() {
  const credentials = resolveAuthCredentials()
  if (!credentials) return

  submitting.value = true
  try {
    await saveAuthCookies(credentials.memberId, credentials.passHash)
    form.cookieText = ''
    form.memberId = ''
    form.passHash = ''
    resetAccountData()
    ElMessage.success('认证 Cookie 已保存')
  } catch (error) {
    console.error('保存认证 Cookie 失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '保存认证 Cookie 失败')
  } finally {
    submitting.value = false
  }
}

function resolveAuthCredentials() {
  if (authInputMode.value === 'fields') {
    const memberId = form.memberId.trim()
    const passHash = form.passHash.trim()
    if (!memberId || !passHash) {
      ElMessage.warning('请填写完整的认证 Cookie')
      return
    }
    return { memberId, passHash }
  }

  const cookies = new Map<string, string>()
  const cookieText = form.cookieText.trim().replace(/^cookie\s*:\s*/i, '')
  for (const part of cookieText.split(/[;\r\n]+/)) {
    const separator = part.indexOf('=')
    if (separator <= 0) continue
    cookies.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim())
  }

  const memberId = cookies.get('ipb_member_id') || ''
  const passHash = cookies.get('ipb_pass_hash') || ''
  if (!memberId || !passHash) {
    ElMessage.warning('Cookie 字符串中缺少 ipb_member_id 或 ipb_pass_hash')
    return
  }
  return { memberId, passHash }
}

async function logout() {
  loggingOut.value = true
  try {
    await clearAuthCookies()
    resetAccountData()
    activeTab.value = 'authentication'
    ElMessage.success('认证 Cookie 已清除')
  } catch (error) {
    console.error('清除认证 Cookie 失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '清除认证 Cookie 失败')
  } finally {
    loggingOut.value = false
  }
}

async function loadAccountSection(section: AccountDataSection, force = false) {
  if (!authState.loggedIn) return

  const state = moduleStates[section]
  const hasData = {
    overview: overviewData.value,
    donation: donationData.value,
    hathPerks: hathPerksData.value,
  }[section]
  if (state.loading || (!force && hasData)) return

  const requestId = ++state.requestId
  state.loading = true
  state.error = ''
  try {
    if (section === 'overview') {
      const result = await infoBusi.getUserOverview(new userOverviewInput())
      if (!result.isSuccess || !result.data) {
        throw new Error(result.msg || '账户总览获取失败')
      }
      if (state.requestId === requestId) overviewData.value = result.data
    } else if (section === 'donation') {
      const result = await infoBusi.getUserDonation(new userDonationInput())
      if (!result.isSuccess || !result.data) {
        throw new Error(result.msg || '捐赠信息获取失败')
      }
      if (state.requestId === requestId) donationData.value = result.data
    } else {
      const result = await infoBusi.getUserHathPerks(new userHathPerksInput())
      if (!result.isSuccess || !result.data) {
        throw new Error(result.msg || 'Hath 特权获取失败')
      }
      if (state.requestId === requestId) hathPerksData.value = result.data
    }
  } catch (error) {
    if (state.requestId === requestId) {
      state.error = error instanceof Error ? error.message : '数据获取失败'
    }
    const sectionName = {
      overview: '账户总览',
      donation: '捐赠信息',
      hathPerks: 'Hath 特权',
    }[section]
    console.error(`获取${sectionName}失败:`, error)
  } finally {
    if (state.requestId === requestId) state.loading = false
  }
}

function resetAccountData() {
  overviewData.value = undefined
  donationData.value = undefined
  hathPerksData.value = undefined
  for (const state of Object.values(moduleStates)) {
    state.requestId += 1
    state.loading = false
    state.error = ''
  }
}

function formatNumber(value?: number) {
  return value === undefined || !Number.isFinite(value) ? '--' : value.toLocaleString('zh-CN')
}

function formatText(value?: string) {
  return value?.trim() || '--'
}

function getHathPerkStatus(perk: userHathPerkData) {
  if (perk.obtained) return { label: '已获得', type: 'success' as const }
  if (perk.locked) return { label: '前置未解锁', type: 'info' as const }
  if (perk.purchasable) return { label: '可购买', type: 'warning' as const }
  if (hathPerksData.value && hathPerksData.value.balance < perk.cost) {
    return { label: 'Hath 不足', type: 'info' as const }
  }
  return { label: '暂不可用', type: 'info' as const }
}

function translateHathPerk(perk: userHathPerkData): HathPerkDisplay {
  const translation = hathPerkTranslations[perk.name]
  const donationMatch = perk.donationRequirement.match(
    /^Free with a \$([\d,.]+) donation\.$/i,
  )
  return {
    ...perk,
    displayName: translation?.name ?? perk.name,
    displayDescription: translation?.description ?? perk.description,
    displayDonationRequirement: donationMatch?.[1]
      ? `累计捐赠 $${donationMatch[1]} 可免费解锁。`
      : perk.donationRequirement,
  }
}

onBeforeUnmount(resetAccountData)
</script>

<template>
  <main class="account-view">
    <header class="account-header">
      <h1>账号信息</h1>
    </header>

    <el-tabs v-model="activeTab" class="account-tabs">
      <el-tab-pane label="账户总览" name="overview" :disabled="!authState.loggedIn">
        <section class="data-section">
          <div class="data-section-header">
            <div>
              <h2>账户总览</h2>
              <p>Member ID {{ authState.memberId }}</p>
            </div>
            <el-button
              circle
              text
              :icon="RefreshRight"
              :loading="moduleStates.overview.loading"
              aria-label="刷新账户总览"
              title="刷新账户总览"
              @click="loadAccountSection('overview', true)"
            />
          </div>

          <div v-if="moduleStates.overview.loading" class="data-loading">
            <el-skeleton :rows="8" animated />
          </div>
          <el-result
            v-else-if="moduleStates.overview.error"
            icon="error"
            title="账户总览获取失败"
            :sub-title="moduleStates.overview.error"
          >
            <template #extra>
              <el-button
                type="primary"
                :icon="RefreshRight"
                @click="loadAccountSection('overview', true)"
              >
                重试
              </el-button>
            </template>
          </el-result>
          <template v-else-if="overviewData">
            <section class="data-group">
              <h3>图片限额</h3>
              <div class="limit-summary">
                <strong>
                  {{ formatNumber(overviewData.imageLimit.usage) }} /
                  {{ formatNumber(overviewData.imageLimit.limit) }}
                </strong>
                <span>{{ imageUsagePercentage }}%</span>
              </div>
              <el-progress
                :percentage="imageUsagePercentage"
                :show-text="false"
                :stroke-width="8"
              />
            </section>

            <section class="data-group">
              <h3>GP</h3>
              <div class="metric-total">
                <span>GP 总计</span>
                <strong>{{ formatNumber(gpGainedTotal) }}</strong>
              </div>
              <h4 class="metric-breakdown-title">GP 构成</h4>
              <dl class="metric-grid">
                <div>
                  <dt>画廊访问</dt>
                  <dd>{{ formatNumber(overviewData.gpGained.galleryVisits) }}</dd>
                </div>
                <div>
                  <dt>种子完成</dt>
                  <dd>{{ formatNumber(overviewData.gpGained.torrentCompletions) }}</dd>
                </div>
                <div>
                  <dt>存档下载</dt>
                  <dd>{{ formatNumber(overviewData.gpGained.archiveDownloads) }}</dd>
                </div>
                <div>
                  <dt>Hentai@Home</dt>
                  <dd>{{ formatNumber(overviewData.gpGained.hentaiHome) }}</dd>
                </div>
              </dl>
            </section>

            <section class="data-group">
              <h3>MP</h3>
              <div class="metric-total">
                <span>MP 总计</span>
                <strong>{{ formatNumber(overviewData.moderationPower.currentMp) }}</strong>
              </div>
              <h4 class="metric-breakdown-title">MP 构成</h4>
              <dl class="metric-grid">
                <div>
                  <dt>基础 MP</dt>
                  <dd>{{ formatNumber(overviewData.moderationPower.base) }}</dd>
                </div>
                <div>
                  <dt>奖励 MP</dt>
                  <dd>{{ formatNumber(overviewData.moderationPower.awards) }}</dd>
                </div>
                <div>
                  <dt>标签维护</dt>
                  <dd>{{ formatNumber(overviewData.moderationPower.tagging) }}</dd>
                </div>
                <div>
                  <dt>等级</dt>
                  <dd>{{ formatNumber(overviewData.moderationPower.level) }}</dd>
                </div>
                <div>
                  <dt>论坛活跃</dt>
                  <dd>{{ formatNumber(overviewData.moderationPower.forumActivity) }}</dd>
                </div>
                <div>
                  <dt>捐赠贡献</dt>
                  <dd>{{ formatNumber(overviewData.moderationPower.donations) }}</dd>
                </div>
                <div>
                  <dt>Hentai@Home 上传</dt>
                  <dd>{{ formatNumber(overviewData.moderationPower.uploadHH) }}</dd>
                </div>
                <div>
                  <dt>账户年限</dt>
                  <dd>{{ formatNumber(overviewData.moderationPower.accountAge) }}</dd>
                </div>
              </dl>
            </section>
          </template>
        </section>
      </el-tab-pane>

      <el-tab-pane label="捐赠信息" name="donation" :disabled="!authState.loggedIn">
        <section class="data-section">
          <div class="data-section-header">
            <div>
              <h2>捐赠信息</h2>
              <p>Member ID {{ authState.memberId }}</p>
            </div>
            <el-button
              circle
              text
              :icon="RefreshRight"
              :loading="moduleStates.donation.loading"
              aria-label="刷新捐赠信息"
              title="刷新捐赠信息"
              @click="loadAccountSection('donation', true)"
            />
          </div>

          <div v-if="moduleStates.donation.loading" class="data-loading">
            <el-skeleton :rows="5" animated />
          </div>
          <el-result
            v-else-if="moduleStates.donation.error"
            icon="error"
            title="捐赠信息获取失败"
            :sub-title="moduleStates.donation.error"
          >
            <template #extra>
              <el-button
                type="primary"
                :icon="RefreshRight"
                @click="loadAccountSection('donation', true)"
              >
                重试
              </el-button>
            </template>
          </el-result>
          <template v-else-if="donationData">
            <dl class="donation-grid">
              <div class="donation-item donation-item--highlight">
                <dt>未使用余额</dt>
                <dd>{{ formatText(donationData.unspent) }}</dd>
              </div>
              <div class="donation-item donation-item--highlight">
                <dt>累计捐赠</dt>
                <dd>{{ formatText(donationData.totalDonated) }}</dd>
              </div>
              <div class="donation-item">
                <dt>服务器认领天数</dt>
                <dd>{{ formatNumber(donationData.totalAdoptServerDay) }}</dd>
              </div>
              <div class="donation-item">
                <dt>捐赠等级</dt>
                <dd>
                  {{
                    currentDonationTier?.name ?? `Level ${formatNumber(donationData.donationLevel)}`
                  }}
                </dd>
              </div>
            </dl>
          </template>

          <section class="donation-tier-section">
            <header class="donation-tier-header">
              <h3>会员等级</h3>
              <p>
                会员等级由累计捐赠金额决定，并提供 EXP 加成、每日 Credits、GP、Hath 及免费存档额度。
              </p>
            </header>
            <div class="donation-tier-table-wrap">
              <table class="donation-tier-table">
                <thead>
                  <tr>
                    <th>捐赠等级</th>
                    <th>获得条件</th>
                    <th>EXP 加成</th>
                    <th>每日奖励</th>
                    <th>每日 Hath</th>
                    <th>免费存档</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="tier in donationTiers"
                    :key="tier.level"
                    :class="{ 'is-current': donationData?.donationLevel === tier.level }"
                  >
                    <td>
                      <div class="tier-name">
                        <strong>{{ tier.name }}</strong>
                        <el-tag
                          v-if="donationData?.donationLevel === tier.level"
                          size="small"
                          effect="plain"
                        >
                          当前
                        </el-tag>
                      </div>
                    </td>
                    <td>{{ tier.requirement }}</td>
                    <td class="tier-number">{{ tier.expBonus }}</td>
                    <td class="daily-bonus">
                      <template v-if="tier.dailyCredits">
                        <span>{{ tier.dailyCredits }} Credits</span>
                        <span>{{ tier.dailyGp }} GP</span>
                      </template>
                      <span v-else>--</span>
                    </td>
                    <td class="tier-number">{{ tier.dailyHath }}</td>
                    <td class="tier-number">{{ tier.freeArchives }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </el-tab-pane>

      <el-tab-pane label="Hath 特权" name="hathPerks" :disabled="!authState.loggedIn">
        <section class="data-section">
          <div class="data-section-header">
            <div>
              <h2>Hath 特权</h2>
              <p>Member ID {{ authState.memberId }}</p>
            </div>
            <el-button
              circle
              text
              :icon="RefreshRight"
              :loading="moduleStates.hathPerks.loading"
              aria-label="刷新 Hath 特权"
              title="刷新 Hath 特权"
              @click="loadAccountSection('hathPerks', true)"
            />
          </div>

          <div v-if="moduleStates.hathPerks.loading" class="data-loading">
            <el-skeleton :rows="8" animated />
          </div>
          <el-result
            v-else-if="moduleStates.hathPerks.error"
            icon="error"
            title="Hath 特权获取失败"
            :sub-title="moduleStates.hathPerks.error"
          >
            <template #extra>
              <el-button
                type="primary"
                :icon="RefreshRight"
                @click="loadAccountSection('hathPerks', true)"
              >
                重试
              </el-button>
            </template>
          </el-result>
          <template v-else-if="hathPerksData">
            <dl class="hath-summary">
              <div class="hath-summary-balance">
                <dt>Hath 余额</dt>
                <dd>{{ formatNumber(hathPerksData.balance) }}</dd>
              </div>
              <div>
                <dt>已获得</dt>
                <dd>{{ formatNumber(hathPerksSummary.obtained) }}</dd>
              </div>
              <div>
                <dt>可购买</dt>
                <dd>{{ formatNumber(hathPerksSummary.purchasable) }}</dd>
              </div>
              <div>
                <dt>前置未解锁</dt>
                <dd>{{ formatNumber(hathPerksSummary.locked) }}</dd>
              </div>
            </dl>

            <section class="hath-perks-section">
              <header class="hath-perks-header">
                <h3>特权列表</h3>
                <span>{{ formatNumber(hathPerksData.perks.length) }} 项</span>
              </header>
              <div v-if="hathPerksData.perks.length" class="hath-perks-list">
                <details
                  v-for="group in hathPerkGroups"
                  :key="group.parent.name"
                  class="hath-perk-group"
                  :class="{ 'has-children': group.children.length }"
                  :open="
                    group.children.length > 0 &&
                    group.children.some((child) => child.obtained || child.purchasable)
                  "
                >
                  <summary
                    :title="group.children.length ? `${group.children.length} 项子特权` : undefined"
                    @click="!group.children.length && $event.preventDefault()"
                  >
                    <article
                      class="hath-perk-item hath-perk-item--parent"
                      :class="{
                        'is-obtained': group.parent.obtained,
                        'is-locked': group.parent.locked,
                      }"
                    >
                      <div class="hath-perk-content">
                        <div class="hath-perk-title">
                          <h4 :title="group.parent.name">{{ group.parent.displayName }}</h4>
                          <el-tag
                            :type="getHathPerkStatus(group.parent).type"
                            size="small"
                            effect="plain"
                          >
                            {{ getHathPerkStatus(group.parent).label }}
                          </el-tag>
                        </div>
                        <p>{{ formatText(group.parent.displayDescription) }}</p>
                        <span
                          v-if="group.parent.displayDonationRequirement"
                          class="hath-donation-requirement"
                        >
                          {{ group.parent.displayDonationRequirement }}
                        </span>
                      </div>
                      <div class="hath-perk-cost">
                        <strong>{{ formatNumber(group.parent.cost) }}</strong>
                        <span>Hath</span>
                      </div>
                    </article>
                    <span v-if="group.children.length" class="hath-collapse-meta">
                      {{ formatNumber(group.children.length) }}
                    </span>
                    <el-icon v-if="group.children.length" class="hath-collapse-icon">
                      <ArrowRight />
                    </el-icon>
                  </summary>

                  <template v-if="group.children.length">
                    <div class="hath-sub-perks-list">
                      <article
                        v-for="perk in group.children"
                        :key="perk.name"
                        class="hath-perk-item hath-perk-item--sub"
                        :class="{
                          'is-obtained': perk.obtained,
                          'is-locked': perk.locked,
                        }"
                      >
                        <div class="hath-perk-content">
                          <div class="hath-perk-title">
                            <h4 :title="perk.name">{{ perk.displayName }}</h4>
                            <el-tag
                              :type="getHathPerkStatus(perk).type"
                              size="small"
                              effect="plain"
                            >
                              {{ getHathPerkStatus(perk).label }}
                            </el-tag>
                          </div>
                          <p>{{ formatText(perk.displayDescription) }}</p>
                          <span
                            v-if="perk.displayDonationRequirement"
                            class="hath-donation-requirement"
                          >
                            {{ perk.displayDonationRequirement }}
                          </span>
                        </div>
                        <div class="hath-perk-cost">
                          <strong>{{ formatNumber(perk.cost) }}</strong>
                          <span>Hath</span>
                        </div>
                      </article>
                    </div>
                  </template>
                </details>
              </div>
              <el-empty v-else :image-size="56" description="暂无 Hath 特权数据" />
            </section>
          </template>
        </section>
      </el-tab-pane>

      <el-tab-pane label="认证信息" name="authentication">
        <section class="account-section">
          <h2>登录态</h2>
          <div v-if="authState.loggedIn" class="account-status">
            <div>
              <div class="status-line">
                <el-tag type="success" effect="plain">已保存</el-tag>
                <strong>Member ID {{ authState.memberId }}</strong>
              </div>
              <div class="status-meta">保存时间 {{ loginTime }}</div>
            </div>
            <el-button
              type="danger"
              plain
              :icon="SwitchButton"
              :loading="loggingOut"
              @click="logout"
            >
              退出
            </el-button>
          </div>
          <el-empty v-else :image-size="56" description="尚未维护登录态" />
        </section>

        <section class="account-section">
          <h2>{{ authState.loggedIn ? '更换认证 Cookie' : '认证 Cookie' }}</h2>
          <el-form class="cookie-form" label-position="top" @submit.prevent="submitCookies">
            <el-radio-group
              v-model="authInputMode"
              class="auth-input-mode"
              aria-label="认证信息输入方式"
            >
              <el-radio-button value="cookie">Cookie 字符串</el-radio-button>
              <el-radio-button value="fields">仅输入所需值</el-radio-button>
            </el-radio-group>

            <el-form-item v-if="authInputMode === 'cookie'" label="Cookie 字符串">
              <el-input
                v-model="form.cookieText"
                type="textarea"
                :rows="4"
                resize="vertical"
                autocomplete="off"
                placeholder="ipb_member_id=...; ipb_pass_hash=..."
              />
            </el-form-item>
            <template v-else>
              <el-form-item label="ipb_member_id">
                <el-input
                  v-model="form.memberId"
                  autocomplete="off"
                  placeholder="输入 ipb_member_id"
                />
              </el-form-item>
              <el-form-item label="ipb_pass_hash">
                <el-input
                  v-model="form.passHash"
                  type="password"
                  autocomplete="off"
                  placeholder="输入 ipb_pass_hash"
                  show-password
                />
              </el-form-item>
            </template>
            <el-button
              class="save-button"
              type="primary"
              native-type="submit"
              :icon="Key"
              :loading="submitting"
            >
              保存 Cookie
            </el-button>
          </el-form>
          <el-alert
            class="cookie-tip"
            title="认证值将由代理写入浏览器 HttpOnly Cookie，不会保存到 EViewer 本地数据中。"
            type="info"
            :closable="false"
            show-icon
          />
        </section>
      </el-tab-pane>
    </el-tabs>
  </main>
</template>

<style scoped>
.account-view {
  width: min(100%, 860px);
  margin: 0 auto;
  padding: 28px 20px 96px;
  color: var(--el-text-color-primary);
}

.account-header {
  padding-bottom: 18px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.account-header h1 {
  margin: 0;
  font-size: 24px;
  line-height: 1.3;
}

.account-tabs {
  margin-top: 8px;
}

.account-section,
.data-section {
  padding: 24px 0 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.account-section h2,
.data-section-header h2 {
  margin: 0 0 16px;
  color: var(--el-text-color-secondary);
  font-size: 15px;
  font-weight: 600;
}

.account-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-height: 56px;
}

.account-section :deep(.el-empty) {
  padding: 20px 0 12px;
}

.status-line {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-line strong {
  font-size: 15px;
  font-weight: 600;
}

.status-meta,
.data-section-header p {
  margin: 6px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.cookie-form {
  max-width: 520px;
}

.auth-input-mode {
  display: flex;
  width: min(100%, 360px);
  margin-bottom: 20px;
}

.auth-input-mode :deep(.el-radio-button) {
  flex: 1;
}

.auth-input-mode :deep(.el-radio-button__inner) {
  width: 100%;
}

.save-button {
  min-width: 132px;
}

.cookie-tip {
  max-width: 680px;
  margin-top: 18px;
}

.data-section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.data-section-header h2 {
  margin-bottom: 0;
  color: var(--el-text-color-primary);
  font-size: 18px;
}

.data-section-header .el-button {
  flex: 0 0 auto;
}

.data-loading {
  padding: 16px 0 24px;
}

.data-group {
  padding: 22px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.data-group:last-child {
  border-bottom: 0;
}

.data-group h3 {
  margin: 0 0 14px;
  color: var(--el-text-color-secondary);
  font-size: 14px;
  font-weight: 600;
}

.metric-total {
  display: flex;
  min-height: 62px;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 12px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-left: 3px solid var(--el-color-primary);
  border-radius: 6px;
  background: var(--el-fill-color-light);
}

.metric-total span {
  color: var(--el-text-color-regular);
  font-size: 14px;
  font-weight: 600;
}

.metric-total strong {
  overflow-wrap: anywhere;
  color: var(--el-color-primary);
  font-size: 22px;
  font-weight: 700;
}

.metric-breakdown-title {
  margin: 18px 0 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 500;
}

.limit-summary {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
}

.limit-summary strong {
  font-size: 18px;
  font-weight: 600;
}

.limit-summary span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.metric-grid,
.donation-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.metric-grid > div,
.donation-item {
  min-width: 0;
  padding: 14px 16px;
  background: var(--el-bg-color-page);
}

.metric-grid dt,
.donation-item dt {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-grid dd,
.donation-item dd {
  margin: 8px 0 0;
  overflow-wrap: anywhere;
  color: var(--el-text-color-primary);
  font-size: 16px;
  font-weight: 600;
}

.donation-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 22px;
}

.donation-item--highlight dd {
  color: var(--el-color-primary);
  font-size: 18px;
}

.hath-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  margin: 22px 0 0;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-border-color-lighter);
}

.hath-summary > div {
  min-width: 0;
  padding: 14px 16px;
  background: var(--el-bg-color-page);
}

.hath-summary dt {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hath-summary dd {
  margin: 8px 0 0;
  overflow-wrap: anywhere;
  color: var(--el-text-color-primary);
  font-size: 18px;
  font-weight: 700;
}

.hath-summary .hath-summary-balance dd {
  color: var(--el-color-primary);
  font-size: 20px;
}

.hath-perks-section {
  margin-top: 30px;
  padding-top: 24px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.hath-perks-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
}

.hath-perks-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.hath-perks-header span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.hath-perks-list {
  margin-top: 16px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.hath-perk-group + .hath-perk-group {
  border-top: 1px solid var(--el-border-color-lighter);
}

.hath-perk-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 84px;
  gap: 20px;
  align-items: center;
  padding: 16px;
  background: var(--el-bg-color);
}

.hath-perk-item--parent {
  background: var(--el-bg-color);
}

.hath-perk-item.is-obtained {
  box-shadow: inset 3px 0 0 var(--el-color-success);
}

.hath-perk-item.is-obtained .hath-perk-title h4 {
  color: var(--el-color-success-dark-2);
}

.hath-perk-item.is-locked > * {
  opacity: 0.62;
}

.hath-perk-group > summary {
  position: relative;
  list-style: none;
}

.hath-perk-group > summary::-webkit-details-marker {
  display: none;
}

.hath-perk-group > summary::marker {
  content: '';
}

.hath-perk-group.has-children > summary {
  cursor: pointer;
  user-select: none;
}

.hath-perk-group.has-children > summary .hath-perk-item {
  padding-right: 64px;
}

.hath-perk-group.has-children > summary:hover .hath-perk-item {
  background: var(--el-fill-color-lighter);
}

.hath-collapse-icon,
.hath-collapse-meta {
  position: absolute;
  top: 50%;
  z-index: 1;
  color: var(--el-text-color-secondary);
  transform: translateY(-50%);
}

.hath-collapse-icon {
  right: 16px;
  transition: transform 0.18s ease;
}

.hath-collapse-meta {
  right: 38px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.hath-perk-group[open] > summary .hath-collapse-icon {
  transform: translateY(-50%) rotate(90deg);
}

.hath-sub-perks-list {
  border-top: 1px solid var(--el-border-color-lighter);
}

.hath-perk-item--sub {
  padding: 14px 16px 14px 38px;
  background: var(--el-bg-color-page);
}

.hath-perk-item--sub + .hath-perk-item--sub {
  border-top: 1px solid var(--el-border-color-lighter);
}

.hath-perk-item--sub .hath-perk-title h4 {
  font-size: 13px;
}

.hath-perk-content {
  min-width: 0;
}

.hath-perk-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.hath-perk-title h4 {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 14px;
  font-weight: 650;
}

.hath-perk-title .el-tag {
  flex: 0 0 auto;
}

.hath-perk-content p {
  margin: 7px 0 0;
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.6;
}

.hath-donation-requirement {
  display: block;
  margin-top: 5px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  line-height: 1.5;
}

.hath-perk-cost {
  min-width: 0;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.hath-perk-cost strong,
.hath-perk-cost span {
  display: block;
}

.hath-perk-cost strong {
  overflow-wrap: anywhere;
  color: var(--el-text-color-primary);
  font-size: 16px;
}

.hath-perk-cost span {
  margin-top: 3px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.donation-tier-section {
  margin-top: 30px;
  padding-top: 24px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.donation-tier-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.donation-tier-header p {
  max-width: 680px;
  margin: 8px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.7;
}

.donation-tier-table-wrap {
  margin-top: 16px;
  overflow-x: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  -webkit-overflow-scrolling: touch;
}

.donation-tier-table {
  width: 100%;
  min-width: 780px;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 12px;
}

.donation-tier-table th,
.donation-tier-table td {
  padding: 12px 14px;
  text-align: left;
  vertical-align: middle;
}

.donation-tier-table th {
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  font-weight: 600;
  white-space: nowrap;
}

.donation-tier-table th:nth-child(1) {
  width: 148px;
}

.donation-tier-table th:nth-child(2) {
  width: 190px;
}

.donation-tier-table th:nth-child(4) {
  width: 132px;
}

.donation-tier-table th:nth-child(6) {
  width: 116px;
}

.donation-tier-table tbody tr {
  border-top: 1px solid var(--el-border-color-lighter);
}

.donation-tier-table tbody tr.is-current {
  background: var(--el-color-primary-light-9);
}

.tier-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tier-name strong {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.tier-number {
  color: var(--el-text-color-regular);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.daily-bonus span {
  display: block;
  line-height: 1.55;
  white-space: nowrap;
}

@media (max-width: 700px) {
  .account-view {
    padding: 20px 68px 88px 14px;
  }

  .account-status {
    align-items: stretch;
    flex-direction: column;
  }

  .save-button,
  .account-status .el-button {
    width: 100%;
  }

  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .hath-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 420px) {
  .donation-grid {
    grid-template-columns: 1fr;
  }

  .hath-perk-item {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }

  .hath-perk-item--sub {
    padding-left: 28px;
  }

  .hath-perk-group.has-children > summary .hath-perk-item {
    padding-right: 48px;
  }

  .hath-collapse-meta {
    display: none;
  }

  .hath-perk-cost {
    display: flex;
    align-items: baseline;
    gap: 5px;
    text-align: left;
  }

  .hath-perk-cost strong,
  .hath-perk-cost span {
    display: inline;
  }
}
</style>
