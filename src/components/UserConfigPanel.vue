<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Delete, Edit, Plus, RefreshRight, Star } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'
import { userInfoBusi } from '@/core/auth/userInfoBusi'
import { useAuthState } from '@/core/auth/authState'
import { getUserConfigWithCache, updateUserConfigCache } from '@/core/auth/userConfigCache'
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
  loading.value = true
  error.value = ''
  try {
    const result = await getUserConfigWithCache(authState.memberId, confirmDiscard)
    if (!result.isSuccess || !result.data) throw new Error(result.msg || '用户配置获取失败')
    applyConfig(result.data)
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : '用户配置获取失败'
  } finally {
    loading.value = false
  }
}

async function saveConfig() {
  if (!config.value || !baseline.value) return
  saving.value = true
  try {
    const edited = cloneConfig(config.value)
    const loadedBaseline = cloneConfig(baseline.value)
    const expectedSlot = baseline.value.selectedProfileSlot
    const expectedName = baseline.value.profiles.find(
      (profile) => profile.slot === expectedSlot,
    )?.name
    const latestResult = await infoBusi.getUserConfig(new userConfigInput())
    if (!latestResult.isSuccess || !latestResult.data) {
      throw new Error(latestResult.msg || '保存前校验 Profile 失败')
    }
    updateUserConfigCache(authState.memberId, latestResult.data)
    const latestProfile = latestResult.data.profiles.find(
      (profile) => profile.slot === latestResult.data?.selectedProfileSlot,
    )
    if (
      latestResult.data.selectedProfileSlot !== expectedSlot ||
      latestProfile?.name !== expectedName
    ) {
      applyConfig(latestResult.data)
      throw new Error('当前 Profile 已发生变化，已刷新配置，请重新修改后保存')
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
    if (!result.isSuccess || !result.data) throw new Error(result.msg || '用户配置保存失败')
    updateUserConfigCache(authState.memberId, result.data)
    applyConfig(result.data)
    ElMessage.success('用户配置已保存')
  } catch (saveError) {
    ElMessage.error(saveError instanceof Error ? saveError.message : '用户配置保存失败')
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
  await runProfileAction('switch', slot, '', 'Profile 已切换', previousSlot)
}

async function renameProfile() {
  if (!config.value || !selectedProfile.value) return
  if (!(await allowDiscardChanges())) return
  try {
    const { value } = await ElMessageBox.prompt('输入新的 Profile 名称', '重命名 Profile', {
      inputValue: selectedProfile.value.name,
      inputPattern: /\S/,
      inputErrorMessage: 'Profile 名称不能为空',
      confirmButtonText: '保存',
      cancelButtonText: '取消',
    })
    await runProfileAction(
      'rename',
      config.value.selectedProfileSlot,
      value.trim(),
      'Profile 已重命名',
    )
  } catch (promptError) {
    if (promptError !== 'cancel' && promptError !== 'close') throw promptError
  }
}

async function createProfile() {
  if (!config.value) return
  if (!(await allowDiscardChanges())) return
  try {
    const { value } = await ElMessageBox.prompt('输入新 Profile 名称', '创建 Profile', {
      inputPattern: /\S/,
      inputErrorMessage: 'Profile 名称不能为空',
      confirmButtonText: '创建',
      cancelButtonText: '取消',
    })
    await runProfileAction(
      'create',
      config.value.selectedProfileSlot,
      value.trim(),
      'Profile 已创建',
    )
  } catch (promptError) {
    if (promptError !== 'cancel' && promptError !== 'close') throw promptError
  }
}

async function setDefaultProfile() {
  if (!config.value || !(await allowDiscardChanges())) return
  try {
    await ElMessageBox.confirm(
      `将“${selectedProfile.value?.name ?? ''}”设为默认 Profile？槽位顺序可能随之变化。`,
      '设置默认 Profile',
      { confirmButtonText: '设为默认', cancelButtonText: '取消' },
    )
    await runProfileAction('default', config.value.selectedProfileSlot, '', '默认 Profile 已更新')
  } catch (confirmError) {
    if (confirmError !== 'cancel' && confirmError !== 'close') throw confirmError
  }
}

async function deleteProfile() {
  if (!config.value || !(await allowDiscardChanges())) return
  try {
    await ElMessageBox.confirm(
      `确定删除“${selectedProfile.value?.name ?? ''}”吗？此操作无法撤销。`,
      '删除 Profile',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger',
      },
    )
    await runProfileAction('delete', config.value.selectedProfileSlot, '', 'Profile 已删除')
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
  if (!config.value) return
  profileBusy.value = true
  try {
    const result = await infoBusi.updateUserConfigProfile(
      new userConfigProfileInput(action, slot, name),
    )
    if (!result.isSuccess || !result.data) throw new Error(result.msg || 'Profile 操作失败')
    updateUserConfigCache(authState.memberId, result.data)
    applyConfig(result.data)
    ElMessage.success(successMessage)
  } catch (actionError) {
    if (restoreSlot && config.value) config.value.selectedProfileSlot = restoreSlot
    ElMessage.error(actionError instanceof Error ? actionError.message : 'Profile 操作失败')
  } finally {
    profileBusy.value = false
  }
}

async function allowDiscardChanges(): Promise<boolean> {
  if (!isDirty.value) return true
  try {
    await ElMessageBox.confirm('当前修改尚未保存，继续将放弃这些修改。', '放弃修改？', {
      type: 'warning',
      confirmButtonText: '继续',
      cancelButtonText: '取消',
    })
    return true
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
        <h2>用户配置</h2>
        <p>查看和修改 E-Hentai 当前账户的原站设置</p>
      </div>
      <el-button
        circle
        text
        :icon="RefreshRight"
        :loading="loading"
        aria-label="刷新用户配置"
        title="刷新用户配置"
        @click="loadConfig(true)"
      />
    </header>

    <div v-if="loading && !config" class="config-loading">
      <el-skeleton :rows="9" animated />
    </div>
    <el-result
      v-else-if="error && !config"
      icon="error"
      title="用户配置获取失败"
      :sub-title="error"
    >
      <template #extra>
        <el-button type="primary" :icon="RefreshRight" @click="loadConfig()">重试</el-button>
      </template>
    </el-result>

    <template v-else-if="config">
      <section class="profile-bar" aria-labelledby="profile-title">
        <div class="profile-select-wrap">
          <label id="profile-title">Profile</label>
          <el-select
            v-model="config.selectedProfileSlot"
            :disabled="profileBusy || saving"
            @change="switchProfile"
          >
            <el-option
              v-for="profile in config.profiles"
              :key="profile.slot"
              :label="profile.displayName"
              :value="profile.slot"
            />
          </el-select>
        </div>
        <div class="profile-actions">
          <el-button
            :icon="Edit"
            :disabled="!config.profileCapabilities.canRename || profileBusy || saving"
            @click="renameProfile"
          >
            重命名
          </el-button>
          <el-button
            :icon="Plus"
            :disabled="!config.profileCapabilities.canCreate || profileBusy || saving"
            @click="createProfile"
          >
            新建
          </el-button>
          <el-button
            :icon="Star"
            :disabled="!config.profileCapabilities.canSetDefault || profileBusy || saving"
            @click="setDefaultProfile"
          >
            设为默认
          </el-button>
          <el-button
            type="danger"
            plain
            :icon="Delete"
            :disabled="!config.profileCapabilities.canDelete || profileBusy || saving"
            @click="deleteProfile"
          >
            删除
          </el-button>
        </div>
      </section>

      <el-form class="config-form" label-position="top" @submit.prevent="saveConfig">
        <section class="config-group">
          <header>
            <h3>图片加载</h3>
            <p>控制原站在线浏览时使用的图片来源和请求版本</p>
          </header>
          <div class="config-grid">
            <el-form-item label="Hentai@Home 网络">
              <el-select v-model="config.imageLoad.hathMode">
                <el-option
                  v-for="option in hathOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                  :disabled="isOptionDisabled('uh', option.value)"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="H@H 区域">
              <el-select v-model="config.imageLoad.region" placeholder="自动检测">
                <el-option
                  v-for="option in regionOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                  :disabled="isOptionDisabled('co', option.value)"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="请求分辨率">
              <el-select v-model="config.imageSize.resolution">
                <el-option
                  v-for="option in resolutionOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                  :disabled="isOptionDisabled('xr', option.value)"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="图片版本">
              <el-radio-group v-model="config.imageSize.originalMode">
                <el-radio value="0">优先重采样图</el-radio>
                <el-radio value="1" :disabled="isOptionDisabled('oi', '1')"> 优先原图 </el-radio>
              </el-radio-group>
            </el-form-item>
          </div>
          <div class="config-grid size-limit-grid">
            <el-form-item label="原站显示最大宽度">
              <el-input v-model="config.imageSize.maxWidth" inputmode="numeric">
                <template #append>px</template>
              </el-input>
            </el-form-item>
            <el-form-item label="原站显示最大高度">
              <el-input v-model="config.imageSize.maxHeight" inputmode="numeric">
                <template #append>px</template>
              </el-input>
            </el-form-item>
          </div>
          <el-alert
            title="宽高仅限制 E-Hentai 原站页面中的浏览器显示尺寸，0 表示不限制，不会改变 EViewer 阅读器。"
            type="info"
            :closable="false"
            show-icon
          />
        </section>

        <section class="config-group">
          <header>
            <h3>搜索与列表</h3>
            <p>设置首页和搜索结果中显示的分类与列表形式</p>
          </header>
          <el-form-item label="显示分类">
            <div class="category-grid">
              <el-checkbox
                v-for="definition in userConfigCategoryDefinitions"
                :key="definition.key"
                v-model="config.search.categories[definition.key]"
              >
                {{ categoryLabels[definition.key] }}
              </el-checkbox>
            </div>
          </el-form-item>
          <div class="config-grid">
            <el-form-item label="显示模式">
              <el-select v-model="config.search.displayMode">
                <el-option
                  v-for="option in displayModeOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                  :disabled="isOptionDisabled('dm', option.value)"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="搜索范围指示器">
              <el-radio-group v-model="config.search.rangeIndicator">
                <el-radio value="0">正常显示</el-radio>
                <el-radio value="1">关闭</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="每页结果数">
              <el-select v-model="config.search.resultCount">
                <el-option
                  v-for="option in resultCountOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                  :disabled="isOptionDisabled('rc', option.value)"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="画廊缩略图选择器">
              <el-switch
                v-model="config.search.thumbnailSelectorEnabled"
                inline-prompt
                active-text="开启"
                inactive-text="关闭"
              />
            </el-form-item>
          </div>
        </section>

        <section class="config-group">
          <header>
            <h3>收藏分类</h3>
            <p>分类名称最多 20 个字符</p>
          </header>
          <div class="favorite-grid">
            <el-form-item
              v-for="(_, index) in config.favorites.names"
              :key="index"
              :label="`收藏 ${index}`"
            >
              <el-input v-model="config.favorites.names[index]" maxlength="20" show-word-limit />
            </el-form-item>
          </div>
          <el-form-item label="收藏排序">
            <el-radio-group v-model="config.favorites.sortMode">
              <el-radio value="0">按画廊最后更新时间</el-radio>
              <el-radio value="1">按加入收藏时间</el-radio>
            </el-radio-group>
          </el-form-item>
        </section>

        <section class="config-group">
          <header>
            <h3>缩略图</h3>
            <p>控制原站列表的缩略图加载时机、尺寸和行数</p>
          </header>
          <div class="config-grid">
            <el-form-item label="加载时机">
              <el-radio-group v-model="config.thumbnails.loadMode">
                <el-radio value="0">鼠标移入时</el-radio>
                <el-radio value="1">页面加载时</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="缩略图尺寸">
              <el-radio-group v-model="config.thumbnails.sizeMode">
                <el-radio value="0">自动</el-radio>
                <el-radio value="2">小</el-radio>
                <el-radio value="1">正常</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="显示行数">
              <el-select v-model="config.thumbnails.rows">
                <el-option
                  v-for="option in thumbnailRowOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                  :disabled="isOptionDisabled('tr', option.value)"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="封面缩放">
              <el-input
                v-model="config.thumbnails.coverScale"
                inputmode="numeric"
                placeholder="默认 100"
              >
                <template #append>%</template>
              </el-input>
              <div class="field-tip">可留空；填写时范围为 75–150</div>
            </el-form-item>
          </div>
        </section>

        <section class="config-group">
          <header>
            <h3>过滤</h3>
            <p>设置评分颜色、标签阈值及语言和上传者排除项</p>
          </header>
          <div class="config-grid">
            <el-form-item label="评分颜色">
              <el-input
                v-model="config.filters.ratingColors"
                maxlength="5"
                placeholder="默认 RRGGB"
                @input="config.filters.ratingColors = config.filters.ratingColors.toUpperCase()"
              />
              <div class="field-tip">可留空；支持 R、G、B、Y，需正好 5 位</div>
            </el-form-item>
            <el-form-item label="关注标签阈值">
              <el-input v-model="config.filters.watchedThreshold" inputmode="numeric" />
              <div class="field-tip">范围 0–9999</div>
            </el-form-item>
            <el-form-item label="软过滤阈值">
              <el-input v-model="config.filters.filteringThreshold" inputmode="numeric" />
              <div class="field-tip">范围 -9999–0</div>
            </el-form-item>
            <el-form-item label="显示被过滤数量">
              <el-radio-group v-model="config.filters.showFilteredCount">
                <el-radio value="0">显示</el-radio>
                <el-radio value="1">隐藏</el-radio>
              </el-radio-group>
            </el-form-item>
          </div>

          <div class="language-section">
            <div class="language-heading">
              <strong>排除语言</strong>
              <span>勾选后隐藏对应版本</span>
            </div>
            <div class="language-table-wrap">
              <table class="language-table">
                <thead>
                  <tr>
                    <th>语言</th>
                    <th>原文</th>
                    <th>翻译</th>
                    <th>改写</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="language in config.filters.excludedLanguages" :key="language.key">
                    <td>{{ languageLabels[language.key] ?? language.sourceName }}</td>
                    <td>
                      <el-checkbox
                        v-if="language.originalAvailable"
                        v-model="language.original"
                        :aria-label="`${language.sourceName} 原文`"
                      />
                      <span v-else>--</span>
                    </td>
                    <td>
                      <el-checkbox
                        v-model="language.translated"
                        :aria-label="`${language.sourceName} 翻译`"
                      />
                    </td>
                    <td>
                      <el-checkbox
                        v-model="language.rewrite"
                        :aria-label="`${language.sourceName} 改写`"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <el-form-item class="uploader-field" label="排除上传者">
            <el-input
              v-model="config.filters.excludedUploaders"
              type="textarea"
              :rows="6"
              resize="vertical"
              placeholder="每行一个用户名"
            />
            <div class="field-tip">
              已填写 {{ uploaderCount }} / {{ config.filters.maxUploaderExclusions || '--' }} 个
            </div>
          </el-form-item>
        </section>

        <section class="config-group">
          <header>
            <h3>画廊页面</h3>
            <p>设置原站画廊标题、评论、标签和存档行为</p>
          </header>
          <div class="config-grid">
            <el-form-item label="默认标题">
              <el-radio-group v-model="config.gallery.titleMode">
                <el-radio value="0">默认标题</el-radio>
                <el-radio value="1">日文标题（如有）</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="存档下载行为">
              <el-select v-model="config.gallery.archiverMode">
                <el-option
                  v-for="option in archiverOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                  :disabled="isOptionDisabled('ar', option.value)"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="评论排序">
              <el-select v-model="config.gallery.commentSort">
                <el-option label="最早评论优先" value="0" />
                <el-option label="最新评论优先" value="1" />
                <el-option label="最高评分优先" value="2" />
              </el-select>
            </el-form-item>
            <el-form-item label="评论评分显示">
              <el-radio-group v-model="config.gallery.commentVotes">
                <el-radio value="0">悬停或点击时</el-radio>
                <el-radio value="1">始终显示</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="标签排序">
              <el-radio-group v-model="config.gallery.tagSort">
                <el-radio value="0">按字母</el-radio>
                <el-radio value="1">按标签权重</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="缩略图标注">
              <el-select v-model="config.gallery.thumbnailLabel">
                <el-option label="无" value="0" />
                <el-option label="仅页码" value="1" />
                <el-option label="页码和名称" value="2" />
              </el-select>
            </el-form-item>
            <el-form-item label="移动端虚拟宽度">
              <el-input
                v-model="config.appearance.viewportOverride"
                inputmode="numeric"
                placeholder="自动"
              >
                <template #append>px</template>
              </el-input>
              <div class="field-tip">可留空；原站建议范围为 640–1400</div>
            </el-form-item>
          </div>
        </section>

        <footer class="config-actions">
          <span v-if="isDirty">有尚未保存的修改</span>
          <span v-else>当前配置已同步</span>
          <el-button type="primary" native-type="submit" :loading="saving" :disabled="profileBusy">
            保存配置
          </el-button>
        </footer>
      </el-form>
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
  color: var(--el-text-color-secondary);
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
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.profile-select-wrap {
  display: grid;
  gap: 7px;
  min-width: min(280px, 100%);
}

.profile-select-wrap label {
  color: var(--el-text-color-regular);
  font-size: 13px;
  font-weight: 600;
}

.profile-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.profile-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.config-form {
  margin-top: 4px;
}

.config-group {
  padding: 28px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
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

.config-grid :deep(.el-select),
.profile-select-wrap :deep(.el-select) {
  width: 100%;
}

.config-grid :deep(.el-radio-group) {
  min-height: 32px;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  width: 100%;
  gap: 8px 16px;
}

.category-grid :deep(.el-checkbox) {
  min-width: 0;
  margin-right: 0;
}

.favorite-grid :deep(.el-form-item) {
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
  border: 1px solid var(--el-border-color-lighter);
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
  border-bottom: 1px solid var(--el-border-color-lighter);
  text-align: center;
}

.language-table th {
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
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

.language-table :deep(.el-checkbox) {
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

  .profile-actions :deep(.el-button) {
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

  .config-actions :deep(.el-button) {
    width: 100%;
  }
}
</style>
