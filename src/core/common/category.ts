const categoryDisplayNames: Readonly<Record<string, string>> = {
  Doujinshi: '同人志',
  Manga: '漫画',
  'Artist CG': '艺术家CG',
  'Game CG': '游戏CG',
  Western: '西方',
  'Non-H': '非H',
  'Image Set': '图像集',
  Cosplay: 'Cosplay',
  'Asian Porn': '亚洲色情',
  Misc: '杂项',
}

const categoryTypes: Readonly<Record<string, string>> = {
  Doujinshi: 'danger',
  Manga: 'warning',
  'Artist CG': 'success',
  'Game CG': 'info',
  Western: 'primary',
  'Non-H': '',
  'Image Set': 'success',
  Cosplay: 'warning',
  'Asian Porn': 'danger',
  Misc: 'info',
}

export function getCategoryDisplayName(category: string): string {
  return categoryDisplayNames[category] ?? category
}

export function getCategoryType(category: string): string {
  return categoryTypes[category] ?? 'info'
}
