import { P } from '../P'

/** 用户配置页面请求结果 */
export class userConfigOutput extends P<userConfigData> {}

/** 用户配置页面的完整结构化数据 */
export class userConfigData {
  profiles: userConfigProfileData[] = []
  selectedProfileSlot: string = ''
  profileCapabilities: userConfigProfileCapabilities = new userConfigProfileCapabilities()
  imageLoad: userConfigImageLoadData = new userConfigImageLoadData()
  imageSize: userConfigImageSizeData = new userConfigImageSizeData()
  gallery: userConfigGalleryData = new userConfigGalleryData()
  search: userConfigSearchData = new userConfigSearchData()
  favorites: userConfigFavoritesData = new userConfigFavoritesData()
  thumbnails: userConfigThumbnailData = new userConfigThumbnailData()
  filters: userConfigFilterData = new userConfigFilterData()
  appearance: userConfigAppearanceData = new userConfigAppearanceData()
  disabledOptions: Record<string, string[]> = {}
}

/** Profile 下拉框中的一个配置槽位 */
export class userConfigProfileData {
  slot: string = ''
  displayName: string = ''
  name: string = ''
  selected: boolean = false
  isDefault: boolean = false
}

/** 当前 Profile 可执行的管理操作 */
export class userConfigProfileCapabilities {
  canRename: boolean = false
  canCreate: boolean = false
  canDelete: boolean = false
  canSetDefault: boolean = false
}

/** H@H 图片来源设置 */
export class userConfigImageLoadData {
  hathMode: string = '0'
  region: string = ''
}

/** 图片请求版本及原站页面显示上限 */
export class userConfigImageSizeData {
  resolution: string = '0'
  originalMode: string = '0'
  maxWidth: string = '0'
  maxHeight: string = '0'
}

/** 画廊详情、评论和标签显示设置 */
export class userConfigGalleryData {
  titleMode: string = '0'
  archiverMode: string = '0'
  commentSort: string = '0'
  commentVotes: string = '0'
  tagSort: string = '0'
  thumbnailLabel: string = '0'
}

/** 首页与搜索结果设置 */
export class userConfigSearchData {
  categories: Record<userConfigCategoryKey, boolean> = createDefaultCategories()
  displayMode: string = '2'
  rangeIndicator: string = '0'
  thumbnailSelectorEnabled: boolean = false
  resultCount: string = '0'
}

/** 收藏分类及排序设置 */
export class userConfigFavoritesData {
  names: string[] = Array.from({ length: 10 }, (_, index) => `Favorites ${index}`)
  sortMode: string = '0'
}

/** 缩略图加载及尺寸设置 */
export class userConfigThumbnailData {
  loadMode: string = '0'
  sizeMode: string = '0'
  rows: string = '0'
  coverScale: string = ''
}

/** 标签过滤和排除项设置 */
export class userConfigFilterData {
  ratingColors: string = ''
  watchedThreshold: string = '0'
  filteringThreshold: string = '0'
  showFilteredCount: string = '0'
  excludedLanguages: userConfigExcludedLanguageData[] = []
  excludedUploaders: string = ''
  usedUploaderExclusions: number = 0
  maxUploaderExclusions: number = 0
}

/** 原站页面视口覆盖设置 */
export class userConfigAppearanceData {
  viewportOverride: string = ''
}

/** 单个语言的原文、翻译和重写排除状态 */
export class userConfigExcludedLanguageData {
  key: userConfigLanguageKey = 'japanese'
  sourceName: string = ''
  base: number = 0
  originalAvailable: boolean = true
  original: boolean = false
  translated: boolean = false
  rewrite: boolean = false
}

export const userConfigCategoryDefinitions = [
  { key: 'doujinshi', field: 'ct_doujinshi', sourceName: 'Doujinshi' },
  { key: 'manga', field: 'ct_manga', sourceName: 'Manga' },
  { key: 'artistCg', field: 'ct_artistcg', sourceName: 'Artist CG' },
  { key: 'gameCg', field: 'ct_gamecg', sourceName: 'Game CG' },
  { key: 'western', field: 'ct_western', sourceName: 'Western' },
  { key: 'nonH', field: 'ct_non-h', sourceName: 'Non-H' },
  { key: 'imageSet', field: 'ct_imageset', sourceName: 'Image Set' },
  { key: 'cosplay', field: 'ct_cosplay', sourceName: 'Cosplay' },
  { key: 'asianPorn', field: 'ct_asianporn', sourceName: 'Asian Porn' },
  { key: 'misc', field: 'ct_misc', sourceName: 'Misc' },
] as const

export type userConfigCategoryKey = (typeof userConfigCategoryDefinitions)[number]['key']

export const userConfigLanguageDefinitions = [
  { key: 'japanese', sourceName: 'Japanese', base: 0, originalAvailable: false },
  { key: 'english', sourceName: 'English', base: 1, originalAvailable: true },
  { key: 'chinese', sourceName: 'Chinese', base: 10, originalAvailable: true },
  { key: 'dutch', sourceName: 'Dutch', base: 20, originalAvailable: true },
  { key: 'french', sourceName: 'French', base: 30, originalAvailable: true },
  { key: 'german', sourceName: 'German', base: 40, originalAvailable: true },
  { key: 'hungarian', sourceName: 'Hungarian', base: 50, originalAvailable: true },
  { key: 'italian', sourceName: 'Italian', base: 60, originalAvailable: true },
  { key: 'korean', sourceName: 'Korean', base: 70, originalAvailable: true },
  { key: 'polish', sourceName: 'Polish', base: 80, originalAvailable: true },
  { key: 'portuguese', sourceName: 'Portuguese', base: 90, originalAvailable: true },
  { key: 'russian', sourceName: 'Russian', base: 100, originalAvailable: true },
  { key: 'spanish', sourceName: 'Spanish', base: 110, originalAvailable: true },
  { key: 'thai', sourceName: 'Thai', base: 120, originalAvailable: true },
  { key: 'vietnamese', sourceName: 'Vietnamese', base: 130, originalAvailable: true },
  { key: 'na', sourceName: 'N/A', base: 254, originalAvailable: true },
  { key: 'other', sourceName: 'Other', base: 255, originalAvailable: true },
] as const

export type userConfigLanguageKey = (typeof userConfigLanguageDefinitions)[number]['key']

function createDefaultCategories(): Record<userConfigCategoryKey, boolean> {
  return Object.fromEntries(userConfigCategoryDefinitions.map(({ key }) => [key, true])) as Record<
    userConfigCategoryKey,
    boolean
  >
}
