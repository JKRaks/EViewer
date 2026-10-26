import { formatSystemMessage } from '@/i18n'
import { eurlEnum } from '@/core/common/enum/eurlEnum'
import { connectionSettings } from '@/core/connector/connectionSettings'
import { currentHentaiVerseSignal, hentaiVerseWorld } from './hentaiVerseWorld'
import { requestLocalHentaiVerse } from '@/core/connector/hentaiVerseTransport'
import type {
  HentaiVerseAbilityActionName,
  HentaiVerseBattleMode,
  HentaiVerseBattleSnapshot,
  HentaiVerseFormSection,
  HentaiVerseFormData,
  HentaiVersePage,
  HentaiVersePageTarget,
} from './model/hentaiVerse'
import {
  isHentaiVerseBattleHtml,
  isHentaiVerseVerificationHtml,
  parseBattlePage,
  parseBattleResponse,
  parseHentaiVersePage,
} from './hentaiVerseParser'
import { parseEquipmentData } from './hentaiVerseEquipment'
import { isHentaiVerseBattleStart } from './hentaiVerseProtocol'

export class HentaiVerseBusi {
  private readonly proxyOrigin = new URL(eurlEnum.EH, window.location.origin).origin
  private readonly equipmentDataCache = new Map<
    string,
    ReturnType<HentaiVerseBusi['fetchEquipmentData']>
  >()

  /** Fetch each versioned source asset once; failed requests can be retried separately from the page. */
  getEquipmentDetails(source: string) {
    const key = `${connectionSettings.mode}:${hentaiVerseWorld.value}:${source}`
    const cached = this.equipmentDataCache.get(key)
    if (cached) return cached
    const request = this.fetchEquipmentData(source)
    this.equipmentDataCache.set(key, request)
    if (this.equipmentDataCache.size > 8)
      this.equipmentDataCache.delete(this.equipmentDataCache.keys().next().value!)
    void request.catch(() => {
      if (this.equipmentDataCache.get(key) === request) this.equipmentDataCache.delete(key)
    })
    return request
  }

  private async fetchEquipmentData(source: string) {
    const script = await this.requestText('/hentaiverse/equipment-data', {
      query: { path: source },
    })
    return parseEquipmentData(script)
  }

  /**
   * Input: 受白名单约束的 HentaiVerse 页面参数。
   * Output: 已解析的角色维护页面；源站在活动战斗期间会返回战斗页，此时返回战斗快照。
   */
  async getPage(
    target: HentaiVersePageTarget,
  ): Promise<{ page?: HentaiVersePage; battle?: HentaiVerseBattleSnapshot }> {
    const html = await this.requestText('/hentaiverse/page', { query: { ...target } })
    if (isHentaiVerseBattleHtml(html)) return { battle: parseBattlePage(html) }
    return { page: parseHentaiVersePage(html, target) }
  }

  /**
   * Input: 页面功能域与从源页面解析、编辑后的完整表单。
   * Output: 提交后重新解析的当前功能页。
   */
  async submitForm(
    section: HentaiVerseFormSection,
    data: HentaiVerseFormData,
    target: HentaiVersePageTarget,
  ): Promise<{ page?: HentaiVersePage; battle?: HentaiVerseBattleSnapshot }> {
    const html = await this.requestText('/hentaiverse/form', {
      method: 'POST',
      body: { section, data, target },
    })
    if (isHentaiVerseBattleHtml(html)) return { battle: parseBattlePage(html) }
    const page = parseHentaiVersePage(html, target)
    if (!page.authenticated || !isHentaiVerseBattleStart(section, data)) return { page }
    // A successful start can return an intermediate entry page. Confirm with one
    // read, rather than reporting a settings update or submitting the start again.
    let confirmed: Awaited<ReturnType<HentaiVerseBusi['getPage']>>
    try {
      confirmed = await this.getPage({})
    } catch {
      throw new Error('开战请求已提交，但无法确认战况，请使用“恢复战斗”继续。')
    }
    if (confirmed.battle) return confirmed
    throw new Error('源站未确认战斗开始，请刷新战斗入口后重试。')
  }

  /** Input: 装备套装编号。Output: 切换套装后的装备页。 */
  async selectEquipmentSet(setId: string, postToken: string, target: HentaiVersePageTarget) {
    const result = await this.submitForm(
      'equipment',
      {
        ...(postToken && { postoken: postToken }),
        equip_set: setId,
      },
      target,
    )
    if (result.battle || !result.page?.authenticated) return result
    const refreshed = await this.getPage({ s: 'Character', ss: 'eq' })
    if (refreshed.page?.equipment?.sets.find((set) => set.active)?.id !== setId) {
      throw new Error('源站未确认装备套装切换，请刷新后重试')
    }
    return refreshed
  }

  /** Input: 部位、装备编号及页面令牌。Output: 完成装备后的当前部位页面。 */
  async equipItem(
    slotId: string,
    equipmentId: string,
    postToken: string,
    target: HentaiVersePageTarget,
  ) {
    const result = await this.submitForm(
      'equipment',
      {
        postoken: postToken,
        equip_slot: slotId,
        'eqids[]': [equipmentId],
        action: 'equip',
      },
      { ...target, equip_slot: slotId },
    )
    return this.confirmEquipment(result, slotId, equipmentId)
  }

  /** Input: 部位及页面令牌。Output: 卸下装备后的当前部位页面。 */
  async unequipItem(slotId: string, postToken: string, target: HentaiVersePageTarget) {
    const result = await this.submitForm(
      'equipment',
      {
        postoken: postToken,
        equip_slot: slotId,
        action: 'unequip',
      },
      { ...target, equip_slot: slotId },
    )
    return this.confirmEquipment(result, slotId, '')
  }

  private async confirmEquipment(
    result: Awaited<ReturnType<HentaiVerseBusi['submitForm']>>,
    slotId: string,
    equipmentId: string,
  ) {
    if (result.battle || !result.page?.authenticated) return result
    const refreshed = await this.getPage({ s: 'Character', ss: 'eq' })
    if (refreshed.battle || !refreshed.page?.authenticated) return refreshed
    const slot = refreshed.page.equipment?.slots.find((item) => item.id === slotId)
    if (!slot || slot.equipmentId !== equipmentId)
      throw new Error('源站未确认装备更新，请刷新后重试')
    return refreshed
  }

  /** Input: 能力操作名和能力或槽位编号。Output: 更新后的能力页。 */
  async updateAbility(
    action: HentaiVerseAbilityActionName | 'reset_all',
    value: string,
    target: HentaiVersePageTarget,
  ) {
    const result = await this.submitForm('abilities', { [action]: value }, target)
    if (result.battle || !result.page?.authenticated) return result

    // Form responses can show the default tree even when another tab is selected.
    // Read that tree explicitly so the ability list matches its selected tab.
    return this.getPage(target)
  }

  /** Input: 能力槽位和已解锁能力编号。Output: 更新后的能力页。 */
  async equipAbility(slotId: string, abilityId: string, target: HentaiVersePageTarget) {
    const result = await this.submitForm(
      'abilities',
      { equip_slot: slotId, equip_ability: abilityId },
      target,
    )
    if (result.battle || !result.page?.authenticated) return result

    // A successful HTTP response can still leave a rejected assignment unchanged.
    // Read the selected tree again and confirm the actual destination slot.
    const refreshed = await this.getPage(target)
    if (refreshed.battle || !refreshed.page?.authenticated) return refreshed
    const slot = refreshed.page.abilities?.slots.find((item) => item.id === slotId)
    if (
      !slot ||
      (abilityId === '0'
        ? Boolean(slot.abilityId || slot.abilityName)
        : slot.abilityId !== abilityId)
    ) {
      throw new Error('源站未确认能力装配，请检查能力是否已解锁、槽位类型是否匹配，并刷新后重试')
    }
    return refreshed
  }

  /** Input: 训练项目编号。Output: 开始训练后的训练页。 */
  async startTraining(trainingId: string, target: HentaiVersePageTarget) {
    return this.submitForm('training', { start_train: trainingId }, target)
  }

  /** Input: 无。Output: 取消当前训练后的训练页。 */
  async cancelTraining(target: HentaiVersePageTarget) {
    return this.submitForm('training', { cancel_train: '1' }, target)
  }

  /** Input: 战斗物品槽位和物品编号。Output: 更新后的物品页。 */
  async assignInventoryItem(slotId: string, itemId: string, target: HentaiVersePageTarget) {
    const result = await this.submitForm('inventory', { slot: slotId, item: itemId }, target)
    if (result.battle || !result.page?.authenticated) return result
    const slot = result.page.inventory?.slots.find((item) => item.id === slotId)
    if (!slot || slot.itemId !== (itemId === '0' ? '' : itemId))
      throw new Error('源站未确认物品槽位更新，请检查物品类型并刷新后重试')
    return result
  }

  /**
   * Input: 可选随机遭遇令牌；不传时恢复服务端已有战斗。
   * Output: 当前战斗快照，令牌只保存在内存中。
   */
  async enterBattle(encounter?: string): Promise<HentaiVerseBattleSnapshot> {
    const query = encounter ? { s: 'Battle', ss: 'ba', encounter } : {}
    const html = await this.requestText('/hentaiverse/page', { query })
    const battle = parseBattlePage(html)
    if (
      !battle.token &&
      !battle.completed &&
      !battle.roundCompleted &&
      !battle.verificationRequired
    )
      throw new Error('当前没有可恢复的 HentaiVerse 战斗')
    return battle
  }

  /**
   * Input: 当前战斗令牌、动作、目标和技能编号。
   * Output: 合并增量片段，再同步完整战斗页确认怪物状态；动作不会自动重试。
   */
  async sendBattleAction(
    current: HentaiVerseBattleSnapshot,
    mode: HentaiVerseBattleMode,
    target: number,
    skill = 0,
    automatic = false,
  ): Promise<HentaiVerseBattleSnapshot> {
    const text = await this.requestText('/hentaiverse/action', {
      method: 'POST',
      body: { token: current.token, mode, target, skill },
    })
    if (isHentaiVerseVerificationHtml(text))
      return {
        ...current,
        verificationRequired: true,
        completed: false,
        roundCompleted: false,
        actions: [],
      }
    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(text)
    } catch {
      throw new Error(
        formatSystemMessage('HentaiVerse 未返回战斗数据，请打开源站确认登录后恢复战斗'),
      )
    }
    if (!payload || typeof payload !== 'object') throw new Error('HentaiVerse 战斗响应无效')
    if (typeof payload.error === 'string') throw new Error(payload.error)
    const updated = parseBattleResponse(payload, current)
    if (updated.verificationRequired) return updated
    // Loading the full page can enter the next wave. Automatic play must stop first.
    if (
      automatic &&
      (updated.roundCompleted ||
        (updated.monsters.length > 0 && updated.monsters.every((monster) => monster.defeated)))
    ) {
      return { ...updated, roundCompleted: true, actions: [] }
    }
    // These are the complete panes returned by a confirmed native action. Retain
    // unchanged action buttons; fetch a full page only when essential state is missing.
    if (
      automatic &&
      !payload.reload &&
      (mode !== 'spirit' ||
        (typeof payload.pane_action === 'string' && updated.spiritStance !== undefined)) &&
      ['pane_vitals', 'pane_monster', 'pane_effects', 'table_skills', 'table_magic'].every(
        (name) => typeof payload[name] === 'string',
      ) &&
      updated.vitals.some((vital) => vital.key === 'health' && vital.percentKnown !== false) &&
      updated.monsters.length > 0 &&
      updated.monsters.every((monster) => monster.healthPercent !== undefined || monster.defeated)
    )
      return updated
    // The source also uses its completion pane between arena rounds. Confirm
    // the full page before treating the entire challenge as finished.
    let html: string
    try {
      html = await this.requestText('/hentaiverse/page')
    } catch {
      throw new Error('战斗动作已提交，但无法确认最新目标状态；请恢复战斗后再操作')
    }
    if (isHentaiVerseBattleHtml(html)) {
      const refreshed = parseBattlePage(html)
      const maxOverlap = Math.min(updated.log.length, refreshed.log.length)
      let overlap = 0
      for (let count = maxOverlap; count > 0; count--) {
        if (updated.log.slice(-count).every((line, index) => line === refreshed.log[index])) {
          overlap = count
          break
        }
      }
      return {
        ...refreshed,
        log: [...updated.log, ...refreshed.log.slice(overlap)].slice(-40),
      }
    }

    const page = parseHentaiVersePage(html, {})
    if (!page.authenticated) throw new Error('HentaiVerse 登录态已失效')
    return {
      ...updated,
      actions: [],
      completed: true,
      completionText: updated.completionText || '源站已确认本次战斗结束。',
    }
  }

  /** Continue at a confirmed wave boundary, manually or through the enabled auto-fight loop. */
  async continueBattleRound(
    current: HentaiVerseBattleSnapshot,
  ): Promise<HentaiVerseBattleSnapshot> {
    const result = await this.getPage({})
    if (result.battle) return result.battle
    if (!result.page?.authenticated) throw new Error('HentaiVerse 登录态已失效')
    return { ...current, completed: true, roundCompleted: true, actions: [] }
  }

  private async requestText(
    path: string,
    options: { method?: 'GET' | 'POST'; query?: Record<string, unknown>; body?: unknown } = {},
  ) {
    const signal = currentHentaiVerseSignal()
    options = {
      ...options,
      query: { ...options.query, world: hentaiVerseWorld.value },
      ...(options.body
        ? { body: { ...(options.body as object), world: hentaiVerseWorld.value } }
        : {}),
    }
    if (connectionSettings.mode === 'local') {
      const response = await requestLocalHentaiVerse(path, options, signal)
      signal.throwIfAborted()
      if (response.status < 200 || response.status >= 300)
        throw new Error(readError(response.text, response.status))
      return response.text
    }
    const url = new URL(path, this.proxyOrigin)
    Object.entries(options.query || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
    })
    const response = await fetch(url, {
      method: options.method || 'GET',
      cache: 'no-store',
      credentials: 'include',
      signal:
        path === '/hentaiverse/equipment-data'
          ? AbortSignal.any([signal, AbortSignal.timeout(30_000)])
          : signal,
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
    const text = await response.text()
    signal.throwIfAborted()
    if (!response.ok) throw new Error(readError(text, response.status))
    return text
  }
}

function readError(text: string, status: number) {
  try {
    const parsed = JSON.parse(text) as { error?: string }
    return parsed.error || formatSystemMessage('HentaiVerse 请求失败 ({p0})', { p0: status })
  } catch {
    return status === 302 || status === 303
      ? 'HentaiVerse 登录态已失效'
      : formatSystemMessage('HentaiVerse 请求失败 ({p0})', { p0: status })
  }
}
