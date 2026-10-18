<script setup lang="ts">
import { t } from '@/i18n'

import Field from '@/components/primitives/Field.vue'
import ActionButton from '@/components/primitives/ActionButton.vue'
import SkeletonBlock from '@/components/primitives/SkeletonBlock.vue'
import StatusPanel from '@/components/primitives/StatusPanel.vue'
import SelectField from '@/components/primitives/SelectField.vue'
import ChoiceGroup from '@/components/primitives/ChoiceGroup.vue'
import RadioChoice from '@/components/primitives/RadioChoice.vue'
import TextField from '@/components/primitives/TextField.vue'
import Notice from '@/components/primitives/Notice.vue'
import CheckField from '@/components/primitives/CheckField.vue'
import ToggleField from '@/components/primitives/ToggleField.vue'
import { computed, onMounted, ref } from 'vue'
import { Trash2 as Delete, Pencil as Edit, Plus, RotateCw as RefreshRight, Star } from '@lucide/vue'
import { notify, dialogs } from '@/components/primitives/feedback'
import { userInfoBusi } from '@/core/auth/userInfoBusi'
import { useAuthState } from '@/core/auth/authState'
import {
  getUserConfigWithCache,
  rebuildUserConfigCache,
  updateUserConfigCache,
} from '@/core/auth/userConfigCache'
import {
  userConfigInput,
  userConfigProfileInput,
  userConfigUpdateInput,
  type userConfigProfileAction,
} from '@/core/model/auth/userConfigInput'
import {
  userConfigCategoryDefinitions,
  type userConfigData,
} from '@/core/model/auth/userConfigOutput'

defineOptions({
  name: 'UserConfigPanel',
})

interface SelectOption {
  value: string
  label: string
}

const infoBusi = new userInfoBusi()
const authState = useAuthState()
const memberId = authState.memberId
const accountIsCurrent = computed(() => authState.loggedIn && authState.memberId === memberId)
const config = ref<userConfigData>()
const baseline = ref<userConfigData>()
const loading = ref(false)
const saving = ref(false)
const profileBusy = ref(false)
const error = ref('')

const categoryLabels = {
  doujinshi: '同人志',
  manga: '漫画',
  artistCg: '画师 CG',
  gameCg: '游戏 CG',
  western: '西方作品',
  nonH: '非色情',
  imageSet: '图片集',
  cosplay: 'Cosplay',
  asianPorn: '亚洲色情',
  misc: '其他',
} as const

const languageLabels: Record<string, string> = {
  japanese: '日语',
  english: '英语',
  chinese: '中文',
  dutch: '荷兰语',
  french: '法语',
  german: '德语',
  hungarian: '匈牙利语',
  italian: '意大利语',
  korean: '韩语',
  polish: '波兰语',
  portuguese: '葡萄牙语',
  russian: '俄语',
  spanish: '西班牙语',
  thai: '泰语',
  vietnamese: '越南语',
  na: '无语言',
  other: '其他',
}

const hathOptions: SelectOption[] = [
  { value: '0', label: '任意客户端（推荐）' },
  { value: '1', label: '仅默认端口客户端' },
  { value: '2', label: '不使用 H@H（现代 HTTPS）' },
  { value: '3', label: '不使用 H@H（旧式 HTTP）' },
]
const regionOptions: SelectOption[] = [
  { value: '', label: '自动检测' },
  { value: 'NL', label: '欧洲' },
  { value: 'US', label: '北美洲' },
  { value: 'BR', label: '南美洲' },
  { value: 'JP', label: '亚洲' },
  { value: 'AU', label: '大洋洲' },
  { value: 'CN', label: '中国地区' },
]
const resolutionOptions: SelectOption[] = [
  { value: '0', label: '自动' },
  { value: '1', label: '800px' },
  { value: '3', label: '1280px' },
  { value: '4', label: '1920px' },
  { value: '5', label: '2560px' },
]
const archiverOptions: SelectOption[] = [
  { value: '0', label: '手动选择，手动开始（默认）' },
  { value: '1', label: '手动选择，自动开始' },
  { value: '2', label: '自动选择原图，手动开始' },
  { value: '3', label: '自动选择原图，自动开始' },
  { value: '4', label: '自动选择重采样图，手动开始' },
  { value: '5', label: '自动选择重采样图，自动开始' },
]
const displayModeOptions: SelectOption[] = [
  { value: '3', label: '极简' },
  { value: '4', label: '极简增强' },
  { value: '0', label: '紧凑' },
  { value: '2', label: '扩展' },
  { value: '1', label: '缩略图' },
]
const resultCountOptions: SelectOption[] = [
  { value: '0', label: '25 条' },
  { value: '1', label: '50 条' },
  { value: '2', label: '100 条' },
]
const thumbnailRowOptions: SelectOption[] = [
  { value: '0', label: '4 行' },
  { value: '1', label: '8 行' },
  { value: '2', label: '20 行' },
  { value: '3', label: '40 行' },
]

const selectedProfile = computed(() =>
  config.value?.profiles.find((profile) => profile.slot === config.value?.selectedProfileSlot),
)
const uploaderCount = computed(
  () =>
    config.value?.filters.excludedUploaders.split(/\r?\n/).filter((name) => name.trim()).length ??
    0,
)
const isDirty = computed(() => {
  if (!config.value || !baseline.value) return false
  return (
    JSON.stringify(getEditableSettings(config.value)) !==
    JSON.stringify(getEditableSettings(baseline.value))
  )
})

onMounted(() => {
  void loadConfig()
})

async function loadConfig(confirmDiscard = false) {
  if (confirmDiscard && !(await allowDiscardChanges())) return
  if (!accountIsCurrent.value) return
  loading.value = true
  error.value = ''
  try {
    const result = confirmDiscard
      ? await rebuildUserConfigCache(memberId)
      : await getUserConfigWithCache(memberId)
    if (!accountIsCurrent.value) return
    if (!result.isSuccess || !result.data) throw new Error(result.msg || t('用户配置获取失败'))
    applyConfig(result.data)
  } catch (loadError) {
    if (!accountIsCurrent.value) return
    error.value = loadError instanceof Error ? loadError.message : t('用户配置获取失败')
  } finally {
    loading.value = false
  }
}

async function saveConfig() {
  if (!config.value || !baseline.value || !accountIsCurrent.value) return
  saving.value = true
  try {
    const edited = cloneConfig(config.value)
    const loadedBaseline = cloneConfig(baseline.value)
    const expectedSlot = baseline.value.selectedProfileSlot
    const expectedName = baseline.value.profiles.find(
      (profile) => profile.slot === expectedSlot,
    )?.name
    const latestResult = await infoBusi.getUserConfig(new userConfigInput())
    if (!accountIsCurrent.value) return
    if (!latestResult.isSuccess || !latestResult.data) {
      throw new Error(latestResult.msg || t('保存前校验 Profile 失败'))
    }
    updateUserConfigCache(memberId, latestResult.data)
    const latestProfile = latestResult.data.profiles.find(
      (profile) => profile.slot === latestResult.data?.selectedProfileSlot,
    )
    if (
      latestResult.data.selectedProfileSlot !== expectedSlot ||
      latestProfile?.name !== expectedName
    ) {
      applyConfig(latestResult.data)
      throw new Error(t('当前 Profile 已发生变化，已刷新配置，请重新修改后保存'))
    }

    const payload = cloneConfig(latestResult.data)
    Object.assign(
      payload,
      mergeEditedValues(
        getEditableSettings(loadedBaseline),
        getEditableSettings(edited),
        getEditableSettings(latestResult.data),
      ),
    )
    const result = await infoBusi.updateUserConfig(new userConfigUpdateInput(payload))
    if (!accountIsCurrent.value) return
    if (!result.isSuccess || !result.data) throw new Error(result.msg || t('用户配置保存失败'))
    updateUserConfigCache(memberId, result.data)
    applyConfig(result.data)
    notify.success(t('用户配置已保存'))
  } catch (saveError) {
    if (!accountIsCurrent.value) return
    notify.error(saveError instanceof Error ? saveError.message : t('用户配置保存失败'))
  } finally {
    saving.value = false
  }
}

async function switchProfile(slot: string) {
  if (!config.value) return
  const previousSlot = config.value.profiles.find((profile) => profile.selected)?.slot ?? ''
  if (slot === previousSlot) return
  if (!(await allowDiscardChanges())) {
    config.value.selectedProfileSlot = previousSlot
    return
  }
  await runProfileAction('switch', slot, '', t('Profile 已切换'), previousSlot)
}

async function renameProfile() {
  if (!config.value || !selectedProfile.value) return
  if (!(await allowDiscardChanges())) return
  try {
    const { value } = await dialogs.prompt(t('输入新的 Profile 名称'), t('重命名 Profile'), {
      inputValue: selectedProfile.value.name,
      inputPattern: /\S/,
      inputErrorMessage: t('Profile 名称不能为空'),
      confirmButtonText: t('保存'),
      cancelButtonText: t('取消'),
    })
    await runProfileAction(
      'rename',
      config.value.selectedProfileSlot,
      value.trim(),
      t('Profile 已重命名'),
    )
  } catch (promptError) {
    if (promptError !== 'cancel' && promptError !== 'close') throw promptError
  }
}

async function createProfile() {
  if (!config.value) return
  if (!(await allowDiscardChanges())) return
  try {
    const { value } = await dialogs.prompt(t('输入新 Profile 名称'), t('创建 Profile'), {
      inputPattern: /\S/,
      inputErrorMessage: t('Profile 名称不能为空'),
      confirmButtonText: t('创建'),
      cancelButtonText: t('取消'),
    })
    await runProfileAction(
      'create',
      config.value.selectedProfileSlot,
      value.trim(),
      t('Profile 已创建'),
    )
  } catch (promptError) {
    if (promptError !== 'cancel' && promptError !== 'close') throw promptError
  }
}

async function setDefaultProfile() {
  if (!config.value || !(await allowDiscardChanges())) return
  try {
    await dialogs.confirm(
      t('将“{p0}”设为默认 Profile？槽位顺序可能随之变化。', {
        p0: selectedProfile.value?.name ?? '',
      }),
      t('设置默认 Profile'),
      { confirmButtonText: t('设为默认'), cancelButtonText: t('取消') },
    )
    await runProfileAction(
      'default',
      config.value.selectedProfileSlot,
      '',
      t('默认 Profile 已更新'),
    )
  } catch (confirmError) {
    if (confirmError !== 'cancel' && confirmError !== 'close') throw confirmError
  }
}

async function deleteProfile() {
  if (!config.value || !(await allowDiscardChanges())) return
  try {
    await dialogs.confirm(
      t('确定删除“{p0}”吗？此操作无法撤销。', { p0: selectedProfile.value?.name ?? '' }),
      t('删除 Profile'),
      {
        type: 'warning',
        confirmButtonText: t('删除'),
        cancelButtonText: t('取消'),
        confirmButtonClass: 'ui-button--danger',
      },
    )
    await runProfileAction('delete', config.value.selectedProfileSlot, '', t('Profile 已删除'))
  } catch (confirmError) {
    if (confirmError !== 'cancel' && confirmError !== 'close') throw confirmError
  }
}

async function runProfileAction(
  action: userConfigProfileAction,
  slot: string,
  name: string,
  successMessage: string,
  restoreSlot?: string,
) {
  if (!config.value || !accountIsCurrent.value) return
  profileBusy.value = true
  try {
    const result = await infoBusi.updateUserConfigProfile(
      new userConfigProfileInput(action, slot, name),
    )
    if (!accountIsCurrent.value) return
    if (!result.isSuccess || !result.data) throw new Error(result.msg || t('Profile 操作失败'))
    updateUserConfigCache(memberId, result.data)
    applyConfig(result.data)
    notify.success(successMessage)
  } catch (actionError) {
    if (!accountIsCurrent.value) return
    if (restoreSlot && config.value) config.value.selectedProfileSlot = restoreSlot
    notify.error(actionError instanceof Error ? actionError.message : t('Profile 操作失败'))
  } finally {
    profileBusy.value = false
  }
}

async function allowDiscardChanges(): Promise<boolean> {
  if (!accountIsCurrent.value) return false
  if (!isDirty.value) return true
  try {
    await dialogs.confirm(t('当前修改尚未保存，继续将放弃这些修改。'), t('放弃修改？'), {
      type: 'warning',
      confirmButtonText: t('继续'),
      cancelButtonText: t('取消'),
    })
    return accountIsCurrent.value
  } catch {
    return false
  }
}

function applyConfig(value: userConfigData) {
  config.value = cloneConfig(value)
  baseline.value = cloneConfig(value)
  error.value = ''
}

function getEditableSettings(value: userConfigData) {
  return {
    imageLoad: value.imageLoad,
    imageSize: value.imageSize,
    gallery: value.gallery,
    search: value.search,
    favorites: value.favorites,
    thumbnails: value.thumbnails,
    filters: value.filters,
    appearance: value.appearance,
  }
}

function cloneConfig(value: userConfigData): userConfigData {
  return JSON.parse(JSON.stringify(value)) as userConfigData
}

function mergeEditedValues<T>(baselineValue: T, editedValue: T, latestValue: T): T {
  if (Array.isArray(baselineValue) && Array.isArray(editedValue) && Array.isArray(latestValue)) {
    if (baselineValue.length !== editedValue.length || editedValue.length !== latestValue.length) {
      return editedValue
    }
    return editedValue.map((value, index) =>
      mergeEditedValues(baselineValue[index], value, latestValue[index]),
    ) as T
  }
  if (
    baselineValue !== null &&
    editedValue !== null &&
    latestValue !== null &&
    typeof baselineValue === 'object' &&
    typeof editedValue === 'object' &&
    typeof latestValue === 'object'
  ) {
    const baselineRecord = baselineValue as Record<string, unknown>
    const editedRecord = editedValue as Record<string, unknown>
    const mergedRecord = { ...(latestValue as Record<string, unknown>) }
    for (const key of Object.keys(editedRecord)) {
      mergedRecord[key] = mergeEditedValues(
        baselineRecord[key],
        editedRecord[key],
        mergedRecord[key],
      )
    }
    return mergedRecord as T
  }
  return Object.is(baselineValue, editedValue) ? latestValue : editedValue
}

function isOptionDisabled(field: string, value: string): boolean {
  return config.value?.disabledOptions[field]?.includes(value) ?? false
}
</script>

<template>
  <section class="user-config-panel">
    <header class="config-header">
      <div>
        <h2>{{ t('用户配置') }}</h2>
        <p>{{ t('查看和修改 E-Hentai 当前账户的原站设置') }}</p>
      </div>
      <ActionButton
        size="icon"
        variant="ghost"
        :icon="RefreshRight"
        :loading="loading"
        :disabled="saving || profileBusy"
        :aria-label="t('刷新用户配置')"
        :title="t('刷新用户配置')"
        @click="loadConfig(true)"
      />
    </header>

    <div v-if="loading && !config" class="config-loading">
      <SkeletonBlock :rows="9" />
    </div>
    <StatusPanel
      v-else-if="error && !config"
      icon="error"
      :title="t('用户配置获取失败')"
      :sub-title="t(error)"
    >
      <template #extra>
        <ActionButton variant="default" :icon="RefreshRight" @click="loadConfig()">{{
          t('重试')
        }}</ActionButton>
      </template>
    </StatusPanel>
    <template v-else-if="config">
      <Notice v-if="error" :title="t(error)" tone="error" :closable="false">
        <template #default>
          <ActionButton variant="ghost" :loading="loading" @click="loadConfig(true)">{{
            t('重试')
          }}</ActionButton>
        </template>
      </Notice>
      <section class="profile-bar" aria-labelledby="profile-title">
        <div class="profile-select-wrap">
          <label id="profile-title">{{ t('配置档案') }}</label>
          <SelectField
            v-model="config.selectedProfileSlot"
            :aria-label="t('配置档案')"
            :disabled="profileBusy || saving"
            @change="switchProfile"
          >
            <option
              v-for="profile in config.profiles"
              :key="profile.slot"
              :label="t(profile.displayName)"
              :value="profile.slot"
            ></option>
          </SelectField>
        </div>
        <div class="profile-actions">
          <ActionButton
            :icon="Edit"
            :disabled="!config.profileCapabilities.canRename || profileBusy || saving"
            @click="renameProfile"
            >{{ t('重命名') }}</ActionButton
          >
          <ActionButton
            :icon="Plus"
            :disabled="!config.profileCapabilities.canCreate || profileBusy || saving"
            @click="createProfile"
            >{{ t('新建') }}</ActionButton
          >
          <ActionButton
            :icon="Star"
            :disabled="!config.profileCapabilities.canSetDefault || profileBusy || saving"
            @click="setDefaultProfile"
            >{{ t('设为默认') }}</ActionButton
          >
          <ActionButton
            variant="destructive"
            :icon="Delete"
            :disabled="!config.profileCapabilities.canDelete || profileBusy || saving"
            @click="deleteProfile"
            >{{ t('删除') }}</ActionButton
          >
        </div>
      </section>

      <form class="config-form" @submit.prevent="saveConfig">
        <section class="config-group">
          <header>
            <h3>{{ t('图片加载') }}</h3>
            <p>{{ t('控制原站在线浏览时使用的图片来源和请求版本') }}</p>
          </header>
          <div class="config-grid">
            <Field :label="t('Hentai@Home 网络')">
              <SelectField v-model="config.imageLoad.hathMode">
                <option
                  v-for="option in hathOptions"
                  :key="option.value"
                  :label="t(option.label)"
                  :value="option.value"
                  :disabled="isOptionDisabled('uh', option.value)"
                ></option>
              </SelectField>
            </Field>
            <Field :label="t('H@H 区域')">
              <SelectField v-model="config.imageLoad.region" :placeholder="t('自动检测')">
                <option
                  v-for="option in regionOptions"
                  :key="option.value"
                  :label="t(option.label)"
                  :value="option.value"
                  :disabled="isOptionDisabled('co', option.value)"
                ></option>
              </SelectField>
            </Field>
            <Field :label="t('请求分辨率')">
              <SelectField v-model="config.imageSize.resolution">
                <option
                  v-for="option in resolutionOptions"
                  :key="option.value"
                  :label="t(option.label)"
                  :value="option.value"
                  :disabled="isOptionDisabled('xr', option.value)"
                ></option>
              </SelectField>
            </Field>
            <Field :label="t('图片版本')">
              <ChoiceGroup v-model="config.imageSize.originalMode">
                <RadioChoice value="0">{{ t('优先重采样图') }}</RadioChoice>
                <RadioChoice value="1" :disabled="isOptionDisabled('oi', '1')">{{
                  t('优先原图')
                }}</RadioChoice>
              </ChoiceGroup>
            </Field>
          </div>
          <div class="config-grid size-limit-grid">
            <Field :label="t('原站显示最大宽度')">
              <TextField v-model="config.imageSize.maxWidth" inputmode="numeric">
                <template #append>px</template>
              </TextField>
            </Field>
            <Field :label="t('原站显示最大高度')">
              <TextField v-model="config.imageSize.maxHeight" inputmode="numeric">
                <template #append>px</template>
              </TextField>
            </Field>
          </div>
          <Notice
            :title="
              t(
                '宽高仅限制 E-Hentai 原站页面中的浏览器显示尺寸，0 表示不限制，不会改变 EViewer 阅读器。',
              )
            "
            tone="info"
            :closable="false"
          />
        </section>

        <section class="config-group">
          <header>
            <h3>{{ t('搜索与列表') }}</h3>
            <p>{{ t('设置首页和搜索结果中显示的分类与列表形式') }}</p>
          </header>
          <Field :label="t('显示分类')">
            <div class="category-grid">
              <CheckField
                v-for="definition in userConfigCategoryDefinitions"
                :key="definition.key"
                v-model="config.search.categories[definition.key]"
              >
                {{ t(categoryLabels[definition.key]) }}
              </CheckField>
            </div>
          </Field>
          <div class="config-grid">
            <Field :label="t('显示模式')">
              <SelectField v-model="config.search.displayMode">
                <option
                  v-for="option in displayModeOptions"
                  :key="option.value"
                  :label="t(option.label)"
                  :value="option.value"
                  :disabled="isOptionDisabled('dm', option.value)"
                ></option>
              </SelectField>
            </Field>
            <Field :label="t('搜索范围指示器')">
              <ChoiceGroup v-model="config.search.rangeIndicator">
                <RadioChoice value="0">{{ t('正常显示') }}</RadioChoice>
                <RadioChoice value="1">{{ t('关闭') }}</RadioChoice>
              </ChoiceGroup>
            </Field>
            <Field :label="t('每页结果数')">
              <SelectField v-model="config.search.resultCount">
                <option
                  v-for="option in resultCountOptions"
                  :key="option.value"
                  :label="t(option.label)"
                  :value="option.value"
                  :disabled="isOptionDisabled('rc', option.value)"
                ></option>
              </SelectField>
            </Field>
            <Field :label="t('画廊缩略图选择器')">
              <ToggleField v-model="config.search.thumbnailSelectorEnabled" :label="t('开启')" />
            </Field>
          </div>
        </section>

        <section class="config-group">
          <header>
            <h3>{{ t('收藏分类') }}</h3>
            <p>{{ t('分类名称最多 20 个字符') }}</p>
          </header>
          <div class="favorite-grid">
            <Field
              v-for="(_, index) in config.favorites.names"
              :key="index"
              :label="t('收藏 {p0}', { p0: index })"
            >
              <TextField v-model="config.favorites.names[index]" maxlength="20" show-word-limit />
            </Field>
          </div>
          <Field :label="t('收藏排序')">
            <ChoiceGroup v-model="config.favorites.sortMode">
              <RadioChoice value="0">{{ t('按画廊最后更新时间') }}</RadioChoice>
              <RadioChoice value="1">{{ t('按加入收藏时间') }}</RadioChoice>
            </ChoiceGroup>
          </Field>
        </section>

        <section class="config-group">
          <header>
            <h3>{{ t('缩略图') }}</h3>
            <p>{{ t('控制原站列表的缩略图加载时机、尺寸和行数') }}</p>
          </header>
          <div class="config-grid">
            <Field :label="t('加载时机')">
              <ChoiceGroup v-model="config.thumbnails.loadMode">
                <RadioChoice value="0">{{ t('鼠标移入时') }}</RadioChoice>
                <RadioChoice value="1">{{ t('页面加载时') }}</RadioChoice>
              </ChoiceGroup>
            </Field>
            <Field :label="t('缩略图尺寸')">
              <ChoiceGroup v-model="config.thumbnails.sizeMode">
                <RadioChoice value="0">{{ t('自动') }}</RadioChoice>
                <RadioChoice value="2">{{ t('小') }}</RadioChoice>
                <RadioChoice value="1">{{ t('正常') }}</RadioChoice>
              </ChoiceGroup>
            </Field>
            <Field :label="t('显示行数')">
              <SelectField v-model="config.thumbnails.rows">
                <option
                  v-for="option in thumbnailRowOptions"
                  :key="option.value"
                  :label="t(option.label)"
                  :value="option.value"
                  :disabled="isOptionDisabled('tr', option.value)"
                ></option>
              </SelectField>
            </Field>
            <Field :label="t('封面缩放')">
              <TextField
                v-model="config.thumbnails.coverScale"
                inputmode="numeric"
                :placeholder="t('默认 100')"
              >
                <template #append>%</template>
              </TextField>
              <div class="field-tip">{{ t('可留空；填写时范围为 75–150') }}</div>
            </Field>
          </div>
        </section>

        <section class="config-group">
          <header>
            <h3>{{ t('过滤') }}</h3>
            <p>{{ t('设置评分颜色、标签阈值及语言和上传者排除项') }}</p>
          </header>
          <div class="config-grid">
            <Field :label="t('评分颜色')">
              <TextField
                v-model="config.filters.ratingColors"
                maxlength="5"
                :placeholder="t('默认 RRGGB')"
                @input="config.filters.ratingColors = config.filters.ratingColors.toUpperCase()"
              />
              <div class="field-tip">{{ t('可留空；支持 R、G、B、Y，需正好 5 位') }}</div>
            </Field>
            <Field :label="t('关注标签阈值')">
              <TextField v-model="config.filters.watchedThreshold" inputmode="numeric" />
              <div class="field-tip">{{ t('范围 0–9999') }}</div>
            </Field>
            <Field :label="t('软过滤阈值')">
              <TextField v-model="config.filters.filteringThreshold" inputmode="numeric" />
              <div class="field-tip">{{ t('范围 -9999–0') }}</div>
            </Field>
            <Field :label="t('显示被过滤数量')">
              <ChoiceGroup v-model="config.filters.showFilteredCount">
                <RadioChoice value="0">{{ t('显示') }}</RadioChoice>
                <RadioChoice value="1">{{ t('隐藏') }}</RadioChoice>
              </ChoiceGroup>
            </Field>
          </div>

          <div class="language-section">
            <div class="language-heading">
              <strong>{{ t('排除语言') }}</strong>
              <span>{{ t('勾选后隐藏对应版本') }}</span>
            </div>
            <div class="language-table-wrap">
              <table class="language-table">
                <thead>
                  <tr>
                    <th>{{ t('语言') }}</th>
                    <th>{{ t('原文') }}</th>
                    <th>{{ t('翻译') }}</th>
                    <th>{{ t('改写') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="language in config.filters.excludedLanguages" :key="language.key">
                    <td>{{ t(languageLabels[language.key] ?? language.sourceName) }}</td>
                    <td>
                      <CheckField
                        v-if="language.originalAvailable"
                        v-model="language.original"
                        :aria-label="t('{p0} 原文', { p0: language.sourceName })"
                      />
                      <span v-else>--</span>
                    </td>
                    <td>
                      <CheckField
                        v-model="language.translated"
                        :aria-label="t('{p0} 翻译', { p0: language.sourceName })"
                      />
                    </td>
                    <td>
                      <CheckField
                        v-model="language.rewrite"
                        :aria-label="t('{p0} 改写', { p0: language.sourceName })"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <Field class="uploader-field" :label="t('排除上传者')">
            <TextField
              v-model="config.filters.excludedUploaders"
              type="textarea"
              :rows="6"
              resize="vertical"
              :placeholder="t('每行一个用户名')"
            />
            <div class="field-tip">
              {{
                t('已填写 {p0} / {p1} 个', {
                  p0: uploaderCount,
                  p1: config.filters.maxUploaderExclusions || '--',
                })
              }}
            </div>
          </Field>
        </section>

        <section class="config-group">
          <header>
            <h3>{{ t('画廊页面') }}</h3>
            <p>{{ t('设置原站画廊标题、评论、标签和存档行为') }}</p>
          </header>
          <div class="config-grid">
            <Field :label="t('默认标题')">
              <ChoiceGroup v-model="config.gallery.titleMode">
                <RadioChoice value="0">{{ t('默认标题') }}</RadioChoice>
                <RadioChoice value="1">{{ t('日文标题（如有）') }}</RadioChoice>
              </ChoiceGroup>
            </Field>
            <Field :label="t('存档下载行为')">
              <SelectField v-model="config.gallery.archiverMode">
                <option
                  v-for="option in archiverOptions"
                  :key="option.value"
                  :label="t(option.label)"
                  :value="option.value"
                  :disabled="isOptionDisabled('ar', option.value)"
                ></option>
              </SelectField>
            </Field>
            <Field :label="t('评论排序')">
              <SelectField v-model="config.gallery.commentSort">
                <option :label="t('最早评论优先')" value="0"></option>
                <option :label="t('最新评论优先')" value="1"></option>
                <option :label="t('最高评分优先')" value="2"></option>
              </SelectField>
            </Field>
            <Field :label="t('评论评分显示')">
              <ChoiceGroup v-model="config.gallery.commentVotes">
                <RadioChoice value="0">{{ t('悬停或点击时') }}</RadioChoice>
                <RadioChoice value="1">{{ t('始终显示') }}</RadioChoice>
              </ChoiceGroup>
            </Field>
            <Field :label="t('标签排序')">
              <ChoiceGroup v-model="config.gallery.tagSort">
                <RadioChoice value="0">{{ t('按字母') }}</RadioChoice>
                <RadioChoice value="1">{{ t('按标签权重') }}</RadioChoice>
              </ChoiceGroup>
            </Field>
            <Field :label="t('缩略图标注')">
              <SelectField v-model="config.gallery.thumbnailLabel">
                <option :label="t('无')" value="0"></option>
                <option :label="t('仅页码')" value="1"></option>
                <option :label="t('页码和名称')" value="2"></option>
              </SelectField>
            </Field>
            <Field :label="t('移动端虚拟宽度')">
              <TextField
                v-model="config.appearance.viewportOverride"
                inputmode="numeric"
                :placeholder="t('自动')"
              >
                <template #append>px</template>
              </TextField>
              <div class="field-tip">{{ t('可留空；原站建议范围为 640–1400') }}</div>
            </Field>
          </div>
        </section>

        <footer class="config-actions">
          <span v-if="isDirty">{{ t('有尚未保存的修改') }}</span>
          <span v-else>{{ t('当前配置已同步') }}</span>
          <ActionButton variant="default" type="submit" :loading="saving" :disabled="profileBusy">{{
            t('保存配置')
          }}</ActionButton>
        </footer>
      </form>
    </template>
  </section>
</template>

<style scoped>
.user-config-panel {
  min-height: 240px;
}

.config-header,
.profile-bar,
.config-actions,
.language-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.config-header {
  margin-bottom: 20px;
}

.config-header h2,
.config-group h3 {
  margin: 0;
  line-height: 1.35;
}

.config-header h2 {
  font-size: 20px;
}

.config-header p,
.config-group header p,
.language-heading span,
.field-tip,
.config-actions span {
  color: var(--muted-foreground);
}

.config-header p,
.config-group header p {
  margin: 5px 0 0;
  font-size: 13px;
}

.config-loading {
  padding: 20px 0;
}

.profile-bar {
  align-items: flex-end;
  padding: 16px;
  background: var(--muted);
  border: 1px solid var(--border-soft);
  border-radius: 6px;
}

.profile-select-wrap {
  display: grid;
  gap: 7px;
  min-width: min(280px, 100%);
}

.profile-select-wrap label {
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
}

.profile-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.profile-actions :deep(.ui-button + .ui-button) {
  margin-left: 0;
}

.config-form {
  margin-top: 4px;
}

.config-group {
  padding: 28px 0;
  border-bottom: 1px solid var(--border-soft);
}

.config-group h3 {
  font-size: 17px;
}

.config-group > header {
  margin-bottom: 20px;
}

.config-grid,
.favorite-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2px 24px;
}

.config-grid :deep(.ui-select),
.profile-select-wrap :deep(.ui-select) {
  width: 100%;
}

.config-grid :deep(.ui-radio-group) {
  min-height: 32px;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  width: 100%;
  gap: 8px 16px;
}

.category-grid :deep(.ui-checkbox) {
  min-width: 0;
  margin-right: 0;
}

.favorite-grid :deep(.ui-form-item) {
  margin-bottom: 16px;
}

.field-tip {
  width: 100%;
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
}

.language-section {
  margin-top: 4px;
}

.language-heading {
  margin-bottom: 10px;
  font-size: 14px;
}

.language-heading span {
  font-size: 12px;
}

.language-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border-soft);
  border-radius: 6px;
}

.language-table {
  width: 100%;
  min-width: 460px;
  border-collapse: collapse;
  table-layout: fixed;
}

.language-table th,
.language-table td {
  padding: 9px 12px;
  border-bottom: 1px solid var(--border-soft);
  text-align: center;
}

.language-table th {
  color: var(--muted-foreground);
  background: var(--muted);
  font-size: 12px;
  font-weight: 600;
}

.language-table th:first-child,
.language-table td:first-child {
  width: 40%;
  text-align: left;
}

.language-table tbody tr:last-child td {
  border-bottom: 0;
}

.language-table :deep(.ui-checkbox) {
  height: 20px;
  margin-right: 0;
}

.uploader-field {
  margin-top: 24px;
}

.config-actions {
  padding-top: 24px;
}

.config-actions span {
  font-size: 13px;
}

@media (max-width: 700px) {
  .profile-bar {
    align-items: stretch;
    flex-direction: column;
  }

  .profile-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .profile-actions :deep(.ui-button) {
    width: 100%;
  }

  .config-grid,
  .favorite-grid {
    grid-template-columns: 1fr;
  }

  .category-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .config-group {
    padding: 24px 0;
  }
}

@media (max-width: 420px) {
  .profile-actions {
    grid-template-columns: 1fr;
  }

  .config-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .config-actions :deep(.ui-button) {
    width: 100%;
  }
}
</style>
