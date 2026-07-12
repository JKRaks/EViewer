import type { tagItem } from '../model/book/tag'
import officialTagTranslationData from '../data/officialTagTranslations.json'

export const officialTagTranslations = officialTagTranslationData as Readonly<
  Record<string, Readonly<Record<string, string>>>
>

export interface tagDisplayInfo {
  text: string
  original: string
  translated: boolean
}

/** 解析标签展示文本；非官方标签与缺失翻译均回退英文原名。 */
export function getTagDisplayInfo(collection: string, tag: tagItem): tagDisplayInfo {
  const original = tag.name.trim()
  const translation = tag.official
    ? officialTagTranslations[collection.trim().toLowerCase()]?.[original.toLowerCase()]
    : undefined

  return {
    text: translation ?? original,
    original,
    translated: Boolean(translation && translation !== original),
  }
}
