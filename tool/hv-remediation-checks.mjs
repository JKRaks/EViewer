// Run through Vite: import('/tool/hv-remediation-checks.mjs').then(m => m.runChecks()).
// Synthetic source-shaped fixtures, never captured account data. No live requests.
import { parseHentaiVersePage as parseSourcePage } from '/src/core/hentaiverse/hentaiVerseParser.ts'
import { withoutTranslationCapture } from '/src/core/hentaiverse/hentaiVerseTranslationCapture.ts'
import { readHentaiVerseMarketQuote } from '/src/core/hentaiverse/hentaiVerseMarketQuote.ts'
import { buildHentaiVerseMarketOrder } from '/src/core/hentaiverse/hentaiVerseBazaar.ts'
import { HentaiVerseBusi } from '/src/core/hentaiverse/hentaiVerseBusi.ts'
import * as store from '/src/core/hentaiverse/hentaiVerseStore.ts'
import { hentaiVerseWorld } from '/src/core/hentaiverse/hentaiVerseWorld.ts'
import {
  translateHentaiVerseText,
  translateHentaiVerseDescription,
} from '/src/core/hentaiverse/hentaiVerseTranslations.ts'

export const characterTarget = { s: 'Character', ss: 'ch' }
export const marketTarget = { s: 'Bazaar', ss: 'mk', itemid: 'fixture-item' }
export const parseFixturePage = (html, target) =>
  withoutTranslationCapture(() => parseSourcePage(html, target))
const parseHentaiVersePage = parseFixturePage
export function shell(body = '', script = '') {
  return `<!doctype html><title>HentaiVerse</title><div id="mainpane">${body}</div><script>${script}</script>`
}
function table(id, headings, rows) {
  return `<table id="${id}"><tr>${headings.map((h) => `<th>${h}</th>`).join('')}</tr>${rows.map((row) => `<tr>${row.map((v) => `<td>${v}</td>`).join('')}</tr>`).join('')}</table>`
}
export function marketHtml(variant = 'normal') {
  let trades = [
    ['2026-11-03 10:48', 'Player A', 'Player B', '200', '1,240'],
    ['2026-11-03 09:40', 'Player C', 'Player D', '300', '1,180'],
    ['2026-11-03 10:02', 'Player E', 'Player F', '100', '1,200'],
    ['2026-11-03 10:45', 'Player G', 'Player H', '400', '1,220'],
  ]
  if (variant === 'empty') trades = []
  if (variant === 'single') trades = trades.slice(0, 1)
  if (variant === 'duplicate')
    trades.forEach((row) => {
      row[0] = '2026-11-03 10:48'
    })
  if (variant === 'flat')
    trades.forEach((row) => {
      row[4] = '1,200'
    })
  if (variant === 'invalid') trades[1][0] = '2026-02-30 10:00'
  if (variant === 'missing') trades[1][3] = ''
  return shell(
    `<div id="market_outer"><div id="market_left"><a href="?s=Bazaar&ss=mk&itemid=fixture-item">Health Potion</a></div><div id="market_right">
    <div id="market_xfer"><div class="credit_balance"><strong>2,000,000 C</strong></div><div class="credit_balance"><strong>250,000 C</strong></div></div>
    <div id="market_itempage"><div id="market_itemheader"><div></div><div>Health Potion</div></div>
    <div id="market_iteminfo">Restores health.</div>
    <div id="market_itembuy"><div class="market_itemorders">${table(
      '',
      ['Count', 'Price', 'Total'],
      [
        [2, 1200, 2400],
        [3, 1190, 3570],
      ],
    )}</div></div>
    <div id="market_itemsell"><div class="market_itemorders">${table(
      '',
      ['Count', 'Price', 'Total'],
      [
        [2, 1250, 2500],
        [1, 1260, 1260],
      ],
    )}</div></div>
    ${table(
      'market_price',
      ['', 'Sold', 'Low', 'Avg', 'High', 'Vol'],
      [
        ['Day', 1000, 1180, 1210, 1250, 12100],
        ['Week', 4000, 1100, 1200, 1350, 48000],
      ],
    )}
    ${table('market_recent', ['', 'Seller', 'Buyer', 'Sold', 'Price'], trades)}
    <a href="?s=Bazaar&ss=mk&itemid=fixture-second">Mana Potion</a></div></div></div>`,
    variant === 'no-batch' ? '' : 'var batch_size = 100; var player_stock = 2000;',
  )
}
export function battleFixture() {
  return {
    token: 'fixture-token',
    title: '离线战斗回归',
    vitals: [{ key: 'health', label: '生命', value: '600 / 1000', percent: 60 }],
    effects: [],
    monsters: [{ id: 1, name: 'Test Monster', status: '', healthPercent: 70, defeated: false }],
    actions: [
      {
        label: '普通攻击',
        description: '',
        mode: 'attack',
        skill: 0,
        target: 'enemy',
        available: true,
      },
    ],
    log: ['离线样本，不发送战斗请求'],
    completionText: '',
    completed: false,
    roundCompleted: false,
  }
}

export async function runChecks() {
  const results = []
  const assert = (condition, message) => {
    if (!condition) throw new Error(message)
  }
  const rejects = async (request, pattern) => {
    try {
      await request()
    } catch (error) {
      assert(pattern.test(error.message), error.message)
      return
    }
    throw new Error('Expected rejection')
  }
  const check = async (name, run) => {
    try {
      await run()
      results.push({ name, passed: true })
    } catch (error) {
      results.push({ name, passed: false, error: error.message })
    }
  }
  const prototype = HentaiVerseBusi.prototype
  const original = {
    requestText: prototype.requestText,
    enterBattle: prototype.enterBattle,
    sendBattleAction: prototype.sendBattleAction,
  }
  const originalWorld = hentaiVerseWorld.value
  const originalState = { ...store.hentaiVerseState }
  let response = '',
    actionCalls = 0,
    encounterArgument
  prototype.requestText = async () => response
  prototype.enterBattle = async (encounter) => {
    encounterArgument = encounter
    return battleFixture()
  }
  prototype.sendBattleAction = async () => {
    actionCalls++
    return battleFixture()
  }
  try {
    await check('Reject login, verification, server error and unrelated HTML', async () => {
      for (const [html, pattern] of [
        [shell('Please log on'), /登录/],
        ['<title>Just a moment...</title>', /验证/],
        ['<title>Service unavailable</title>', /不可用/],
        ['<h1>Unknown response</h1>', /有效/],
      ])
        await rejects(() => parseHentaiVersePage(html, characterTarget), pattern)
    })
    await check('Absent and partial attributes never become six zero values', () => {
      assert(
        parseHentaiVersePage(shell(), characterTarget).attributes.length === 0,
        'Absent attributes',
      )
      const partial = parseHentaiVersePage(
        shell('', 'var attr_current = {str:11};'),
        characterTarget,
      ).attributes
      assert(partial.length === 1 && partial[0].value === 11, 'Partial attributes')
    })
    await check('Translate season and classify explicit rejection', () => {
      const page = parseHentaiVersePage(
        shell(
          '<div id="world_text">Currently playing on Isekai: 2026 Season 2</div><div class="errorbox">Insufficient Credits</div>',
        ),
        characterTarget,
      )
      assert(page.season === '2026 年第 2 赛季', page.season)
      assert(
        page.noticeTones[page.notices[0]] === 'error' && !/Credits/.test(page.notices[0]),
        'Rejected notice',
      )
    })
    await check('Training rejects unchanged response and confirms actual progress', async () => {
      const busi = new HentaiVerseBusi(),
        target = { s: 'Character', ss: 'tr' }
      response = shell('<input name="cancel_train" value="0">')
      await rejects(() => busi.startTraining('1', target), /未确认训练开始/)
      response = shell('<div id="train_progress"><strong>Adept Learner</strong></div>')
      assert((await busi.startTraining('1', target)).confirmed, 'Active training was not confirmed')
      await rejects(() => busi.cancelTraining(target), /未确认训练取消/)
      response = shell()
      assert((await busi.cancelTraining(target)).confirmed, 'Idle training was not confirmed')
      response = shell('<div class="errorbox">Insufficient Credits</div>')
      await rejects(() => busi.startTraining('1', target), /不足/)
    })
    await check(
      'Recovery preserves encounter and world; explicit encounter consumes token',
      async () => {
        store.clearHentaiVerseState()
        hentaiVerseWorld.value = 'isekai'
        store.hentaiVerseState.encounter = { token: 'new-encounter', url: '', foundAt: 0 }
        await store.enterHentaiVerseBattle()
        assert(
          encounterArgument === undefined &&
            hentaiVerseWorld.value === 'isekai' &&
            store.hentaiVerseState.encounter.token === 'new-encounter',
          'Recovery used encounter',
        )
        await store.enterHentaiVerseBattle('new-encounter')
        assert(
          encounterArgument === 'new-encounter' &&
            hentaiVerseWorld.value === 'persistent' &&
            !store.hentaiVerseState.encounter,
          'Explicit encounter',
        )
      },
    )
    await check('Unknown outcome and recovery in flight block all battle actions', async () => {
      store.hentaiVerseState.battle = battleFixture()
      store.hentaiVerseState.error = 'unknown outcome'
      await rejects(() => store.performHentaiVerseBattleAction('attack', 1), /未确认/)
      assert(
        store.hentaiVerseState.error === 'unknown outcome' && actionCalls === 0,
        'Error was cleared or action sent',
      )
      store.hentaiVerseState.error = ''
      store.hentaiVerseState.battleLoading = true
      await rejects(() => store.performHentaiVerseBattleAction('attack', 1), /恢复/)
      assert(actionCalls === 0, 'Action sent while recovering')
    })
    await checkSourceContent(check, assert, rejects)
    await checkMarketAndServices(check, assert, rejects)
  } finally {
    Object.assign(prototype, original)
    hentaiVerseWorld.value = originalWorld
    store.clearHentaiVerseState()
    Object.assign(store.hentaiVerseState, originalState)
  }
  return {
    passed: results.filter((result) => result.passed).length,
    total: results.length,
    results,
  }
}

async function checkSourceContent(check, assert, rejects) {
  await check(
    'Shop descriptions use the final tooltip fields and preserve transaction values',
    () => {
      const popup = String.raw`common.show_itemr_box(10,-40,'shop_pane',this,'left','Fixture&#039;s Token','A <b>rare</b> object &amp; it\'s yours.','Trophy')`
      const encoded = popup.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
      const page = parseHentaiVersePage(
        shell(
          `<div id="itshop_outer"><form id="shopform"></form><div id="item_pane"><div onclick="itemshop.set_item('item_pane',9801,7,17)" onmouseover="${encoded}">Fixture's Token</div></div><div id="shop_pane"><div onclick="itemshop.set_item('shop_pane',9802,9,23)" onmouseover="${encoded}">Fixture's Token</div><div onclick="itemshop.set_item('shop_pane',11191,11,25)" onmouseover="common.show_itemc_box(10,-40,'shop_pane',this,'left',11191)">Health Draught</div><div onclick="itemshop.set_item('shop_pane',98888,0,99)">Unknown Item</div></div></div>`,
        ),
        { s: 'Bazaar', ss: 'is' },
      ).bazaar
      const [owned, shop, common, unknown] = page.items
      assert(
        owned.description === "A rare object & it's yours." &&
          shop.description === owned.description,
        'Name, HTML entities or formatting leaked into description',
      )
      assert(
        owned.id === '9801' &&
          owned.mode === 'item_pane' &&
          owned.stock === 7 &&
          owned.price === 17 &&
          shop.id === '9802' &&
          shop.mode === 'shop_pane' &&
          shop.stock === 9 &&
          shop.price === 23,
        'Tooltip parsing changed transaction fields',
      )
      assert(
        common.description.includes('恢复') && unknown.description === '',
        'Known item fallback',
      )
    },
  )
  await check('Available ability upgrade markers do not hide or inflate the acquired rank', () => {
    for (const [marker, expected] of [
      ['ru', 2],
      ['unknown', null],
    ]) {
      const bars = ['rf', 'rf', marker, 'x']
        .map((state) => `<div style='background-image:url("/y/ab/10${state}.png")'></div>`)
        .join('')
      const html = shell(
        `<div id="ability_treepane"><div data-ability-id="1102"><div>MP Tank</div><div></div><div>${bars}</div></div></div>`,
      )
      const ability = parseHentaiVersePage(html, { s: 'Character', ss: 'ab' }).abilities
        .abilities[0]
      assert(ability.level === expected, `Ability rank with ${marker}: ${ability.level}`)
    }
  })
  await check(
    'Empty inventory remains valid; missing inventory structure is rejected',
    async () => {
      const target = { s: 'Character', ss: 'it' }
      assert(
        parseHentaiVersePage(shell('<div id="item_list"></div>'), target).inventory.items.length ===
          0,
        'Empty inventory',
      )
      await rejects(() => parseHentaiVersePage(shell(), target), /无法读取源站物品页面/)
    },
  )
  await check('Live source system labels and shrine descriptions are translated', () => {
    withoutTranslationCapture(() => {
      for (const [source, expected] of [
        ['Grand Prize for November 3rd:', '11 月 3 日 大奖：'],
        ['Grand Prize for January 21st:', '1 月 21 日 大奖：'],
        ['Crystal of Corruption', '腐蚀水晶'],
        ['Dark Strike (50%)', '黑暗打击 (50%)'],
        ['Power Gauntlets', '动力护手'],
        ['◀ Previous Consumable', '上一件物品'],
        ['Next Consumable ▶', '下一件物品'],
        ['Back to Consumables', '返回消耗品'],
      ])
        assert(translateHentaiVerseText(source) === expected, source)
      for (const source of [
        "Welcome to Snowflake's Shrine.",
        'Here you can make an offering to Snowflake, the Goddess of Loot and Harvest. Snowflake will grant you various boons depending on your offering.',
        'Select a trophy, artifact or collectible to continue.',
        'You can fuse this crystal with a monster in the monster tab to increase its Dark Resistance.',
        'You have handed in 1,000 credits worth of trophies.',
      ])
        assert(!/[a-z]/i.test(translateHentaiVerseDescription(source)), source)
      const limit = translateHentaiVerseDescription(
        'You cannot currently receive more than +7 to any primary stat. This increases by one for every tenth level. Gaining primary stats in this way will not increase how much EXP your next point costs.',
      )
      assert(limit.includes('7 点') && limit.includes('10 级') && !/EXP/.test(limit), limit)
    })
  })
}

async function checkMarketAndServices(check, assert, rejects) {
  await check('Source market units, timestamps, weighted quotes and summaries agree', () => {
    const page = parseHentaiVersePage(marketHtml(), marketTarget).bazaar
    const quote = readHentaiVerseMarketQuote(page)
    assert(page.batchSize === 100 && page.receivedAt > 0, 'Batch size or freshness')
    assert(
      quote.trades.length === 4 &&
        quote.trades[0].time === '2026-11-03 09:40' &&
        quote.trades[0].quantity === 300,
      'Trade order/quantity',
    )
    assert(quote.bid === 1200 && quote.ask === 1250 && quote.spread === 50, 'Best quotes')
    assert(
      quote.depth.find((book) => book.side === 'buy').averages[1].price === 1194,
      'Weighted price',
    )
    assert(
      quote.periods[0].volume === 12100 && quote.periods.length === 2,
      'Period amount vs quantity',
    )
  })
  await check('Missing/invalid trades cannot draw partial or zero-filled history', () => {
    for (const variant of ['invalid', 'missing']) {
      const quote = readHentaiVerseMarketQuote(
        parseHentaiVersePage(marketHtml(variant), marketTarget).bazaar,
      )
      assert(!quote.trades.length && quote.unavailable.includes('最近交易'), variant)
    }
    for (const [variant, length] of [
      ['empty', 0],
      ['single', 1],
      ['duplicate', 4],
      ['flat', 4],
    ])
      assert(
        readHentaiVerseMarketQuote(parseHentaiVersePage(marketHtml(variant), marketTarget).bazaar)
          .trades.length === length,
        variant,
      )
  })
  await check('Unknown table schema retains raw data and disables its derived chart', () => {
    const page = parseHentaiVersePage(marketHtml(), marketTarget).bazaar
    page.tables.find((table) => table.title === '最近交易').rawHeaders[4] = 'Unknown'
    const quote = readHentaiVerseMarketQuote(page)
    assert(
      !quote.trades.length &&
        quote.unavailable.includes('最近交易') &&
        page.tables.at(-1).rows.length === 4,
      'Schema fallback',
    )
  })
  await check('Missing batch size cannot be guessed or used for orders', async () => {
    const page = parseHentaiVersePage(marketHtml('no-batch'), marketTarget).bazaar
    const order = {
      side: 'sell',
      maxCount: 10,
      hidden: {},
      countName: 'count',
      priceName: 'price',
      actionName: 'submit',
      actionValue: '1',
    }
    page.orders.push(order)
    assert(page.batchSize === 0, 'Guessed batch size')
    await rejects(() => buildHentaiVerseMarketOrder(page, order, 1, 1200), /无效/)
  })
  await check('Monster name remains user content, status is separated and translated', () => {
    const html = shell(
      '<div id="monster_outer"><div id="slot_pane"><div><a href="?s=Bazaar&ss=ml&slot=0">Happy Player Monster</a><div>Power Level: 150</div><div>Hungry</div></div></div><div id="monster_actions"><div><div><img onclick="do_unlock_slot()"></div><div>Cost: 2 Chaos Tokens<br>Stock: 2</div></div></div></div>',
    )
    const services = parseHentaiVersePage(html, { s: 'Bazaar', ss: 'ml' }).services
    const monster = services.monsters[0]
    assert(
      monster.name === 'Happy Player Monster' &&
        monster.description.includes('150') &&
        !/Power|Hungry/.test(monster.description),
      JSON.stringify(monster),
    )
    assert(services.notices[0] === '费用: 2 混沌令牌 · 库存: 2', services.notices[0])
    assert(
      services.actions[0].description === services.notices[0],
      'Unlock description lost line break',
    )
  })
}
