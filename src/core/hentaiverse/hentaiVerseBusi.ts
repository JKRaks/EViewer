import { eurlEnum } from '@/core/common/enum/eurlEnum'
import type {
  HentaiVerseBattleMode,
  HentaiVerseBattleSnapshot,
  HentaiVerseFormSection,
  HentaiVersePage,
  HentaiVersePageTarget,
} from './model/hentaiVerse'
import {
  isHentaiVerseBattleHtml,
  parseBattlePage,
  parseBattleResponse,
  parseHentaiVersePage,
} from './hentaiVerseParser'

export class HentaiVerseBusi {
  private readonly proxyOrigin = new URL(eurlEnum.EH, window.location.origin).origin

  /**
   * Input: 受白名单约束的 HentaiVerse 页面参数。
   * Output: 已解析的角色、维护或战斗入口页面。
   */
  async getPage(target: HentaiVersePageTarget): Promise<HentaiVersePage> {
    const html = await this.requestText('/hentaiverse/page', { query: { ...target } })
    return parseHentaiVersePage(html, target)
  }

  /**
   * Input: 页面功能域与从源页面解析、编辑后的完整表单。
   * Output: 提交后重新解析的当前功能页。
   */
  async submitForm(
    section: HentaiVerseFormSection,
    data: Record<string, string | number | boolean>,
    target: HentaiVersePageTarget,
  ): Promise<{ page?: HentaiVersePage; battle?: HentaiVerseBattleSnapshot }> {
    const html = await this.requestText('/hentaiverse/form', { method: 'POST', body: { section, data } })
    if (isHentaiVerseBattleHtml(html)) return { battle: parseBattlePage(html) }
    return { page: parseHentaiVersePage(html, target) }
  }

  /**
   * Input: 可选随机遭遇令牌；不传时恢复服务端已有战斗。
   * Output: 当前战斗快照，令牌只保存在内存中。
   */
  async enterBattle(encounter?: string): Promise<HentaiVerseBattleSnapshot> {
    const query = encounter ? { s: 'Battle', ss: 'ba', encounter } : {}
    const html = await this.requestText('/hentaiverse/page', { query })
    const battle = parseBattlePage(html)
    if (!battle.token && !battle.completed) throw new Error('当前没有可恢复的 HentaiVerse 战斗')
    return battle
  }

  /**
   * Input: 当前战斗令牌、动作、目标和技能编号。
   * Output: 合并源站增量片段后的新战斗快照；动作不会自动重试。
   */
  async sendBattleAction(
    current: HentaiVerseBattleSnapshot,
    mode: HentaiVerseBattleMode,
    target: number,
    skill = 0,
  ): Promise<HentaiVerseBattleSnapshot> {
    const payload = await this.requestJson<Record<string, unknown>>('/hentaiverse/action', {
      token: current.token,
      mode,
      target,
      skill,
    })
    return parseBattleResponse(payload, current)
  }

  private async requestText(
    path: string,
    options: { method?: 'GET' | 'POST'; query?: Record<string, unknown>; body?: unknown } = {},
  ) {
    const url = new URL(path, this.proxyOrigin)
    Object.entries(options.query || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
    })
    const response = await fetch(url, {
      method: options.method || 'GET',
      credentials: 'include',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
    const text = await response.text()
    if (!response.ok) throw new Error(readError(text, response.status))
    return text
  }

  private async requestJson<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(new URL(path, this.proxyOrigin), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = (await response.json().catch(() => ({}))) as T & { error?: string }
    if (!response.ok) throw new Error(payload.error || `HentaiVerse 请求失败 (${response.status})`)
    return payload
  }
}

function readError(text: string, status: number) {
  try {
    const parsed = JSON.parse(text) as { error?: string }
    return parsed.error || `HentaiVerse 请求失败 (${status})`
  } catch {
    return status === 302 || status === 303 ? 'HentaiVerse 登录态已失效' : `HentaiVerse 请求失败 (${status})`
  }
}
