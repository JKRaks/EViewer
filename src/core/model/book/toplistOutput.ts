import { P } from '../P'
import type { bookItem } from './bookOutput'

export type toplistKind = 'gallery' | 'contributor'

export interface toplistCategoryOption {
  value: number
  label: string
  sourceLabel: string
}

export interface toplistPeriodOption {
  value: number
  label: string
  sourceLabel: string
}

export const toplistCategoryOptions: toplistCategoryOption[] = [
  { value: 1, label: '画册', sourceLabel: 'Galleries' },
  { value: 2, label: '上传者', sourceLabel: 'Uploader' },
  { value: 3, label: '标签贡献', sourceLabel: 'Tagging' },
  { value: 4, label: 'Hentai@Home', sourceLabel: 'Hentai@Home' },
  { value: 5, label: 'EHTracker', sourceLabel: 'EHTracker' },
  { value: 6, label: '清理维护', sourceLabel: 'Cleanup' },
  { value: 7, label: '评分与评论', sourceLabel: 'Rating & Reviewing' },
]

export const toplistPeriodOptions: toplistPeriodOption[] = [
  { value: 5, label: '昨日', sourceLabel: 'Yesterday' },
  { value: 3, label: '近一月', sourceLabel: 'Past Month' },
  { value: 2, label: '近一年', sourceLabel: 'Past Year' },
  { value: 1, label: '历史榜单', sourceLabel: 'All-Time' },
]

export interface galleryToplistEntry {
  kind: 'gallery'
  rank: number
  score?: number
  book: bookItem
}

export interface contributorToplistEntry {
  kind: 'contributor'
  rank: number
  score?: number
  username: string
  sourceUrl: string
}

export type toplistEntry = galleryToplistEntry | contributorToplistEntry

export interface toplistOverviewSection {
  tl: number
  category: number
  period: number
  kind: toplistKind
  entries: toplistEntry[]
}

export class toplistOverviewOutput extends P<toplistOverviewSection[]> {}

export class toplistDetailOutput extends P<toplistEntry[]> {
  tl: number = 15
  kind: toplistKind = 'gallery'
  currentPage: number = 1
  totalPages: number = 1
}

export function buildToplistCode(category: number, period: number): number {
  return category * 10 + period
}

export function getToplistKind(tl: number): toplistKind {
  return Math.floor(tl / 10) === 1 ? 'gallery' : 'contributor'
}
