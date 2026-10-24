import type { tagCollection, tagItem } from '../model/book/tag'

export interface GallerySummaryTag {
  key: string
  collection: string
  tag: tagItem
}

/** Give each namespace's first official tag a turn before filling with its other tags. */
export function getGallerySummaryTags(collections: readonly tagCollection[]): GallerySummaryTag[] {
  const firstOfficial: GallerySummaryTag[] = []
  const remainingOfficial: GallerySummaryTag[] = []
  const fallback: GallerySummaryTag[] = []
  for (const collection of collections) {
    const official = collection.items.filter((tag) => tag.official && tag.name.trim())
    const items = official.length
      ? official
      : collection.items.filter((tag) => tag.name.trim()).slice(0, 1)
    items.forEach((tag, index) => {
      const entry = {
        key: `${collection.collection}:${tag.name}`,
        collection: collection.collection,
        tag,
      }
      if (!tag.official) fallback.push(entry)
      else if (index === 0) firstOfficial.push(entry)
      else remainingOfficial.push(entry)
    })
  }
  const seen = new Set<string>()
  const official = [...firstOfficial, ...remainingOfficial].filter(({ key }) => {
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (official.length >= 3) return official
  return [
    ...official,
    ...fallback.filter(({ key }) => {
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }),
  ]
}

/** Reserve the overflow count, then expand the shortest tags before the longer ones. */
export function fitGallerySummaryTags(
  naturalWidths: readonly number[],
  availableWidth: number,
  totalCount: number,
  counterWidth: number,
): number[] {
  const gap = 4
  for (let count = Math.min(3, naturalWidths.length); count > 0; count--) {
    const hasMore = totalCount > count
    const budget = availableWidth - (hasMore ? counterWidth + gap : 0) - gap * (count - 1)
    const desired = naturalWidths.slice(0, count).map((width) => Math.min(width, 110))
    const widths = desired.map((width) => Math.min(width, 24))
    let extraSpace = budget - widths.reduce((sum, width) => sum + width, 0)
    if (extraSpace < 0) continue
    const shortestFirst = desired
      .map((width, index) => ({ width, index }))
      .sort((a, b) => a.width - b.width)
    for (const { width, index } of shortestFirst) {
      const extra = Math.min(width - widths[index]!, extraSpace)
      widths[index]! += extra
      extraSpace -= extra
    }
    return widths
  }
  return []
}
