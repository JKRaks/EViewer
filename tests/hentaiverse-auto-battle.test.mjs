import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canUseAutomaticBattleAction,
  decideAutoBattleAction,
  defaultAutoBattleSettings,
  normalizeAutoBattleSettings,
} from '../src/core/hentaiverse/hentaiVerseAutoBattle.ts'

const attack = { mode: 'attack', skill: 0, target: 'enemy', available: true, kind: 'offense' }
const cure = {
  mode: 'magic',
  skill: 311,
  target: 'self',
  available: true,
  manaCost: 10,
  kind: 'heal',
}
const fullCure = { ...cure, skill: 313, manaCost: 25, kind: 'full-heal' }
const regen = { ...cure, skill: 312, manaCost: 8, kind: 'regen' }
const spell = { ...cure, skill: 111, manaCost: 20, target: 'enemy', kind: 'offense' }
const focus = { mode: 'focus', skill: 0, target: 'none', available: true }
const item = { ...cure, mode: 'items', skill: 10005, manaCost: 0 }
const defaults = { ...defaultAutoBattleSettings, maintainRegen: false }
const magic = { ...defaults, style: 'magic', spell: 'magic:111' }

function snapshot({ hp = 100, mp = 100, ...overrides } = {}) {
  return {
    token: 'testbattle',
    title: 'Test',
    effects: [],
    effectIds: [],
    completed: false,
    roundCompleted: false,
    completionText: '',
    log: [],
    vitals: [
      { key: 'health', current: hp, maximum: 100, percent: hp, percentKnown: true },
      { key: 'magic', current: mp, maximum: 100, percent: mp, percentKnown: true },
    ],
    monsters: [
      { id: 0, healthPercent: 100, defeated: false },
      { id: 1, healthPercent: 50, defeated: false },
    ],
    actions: [attack, cure, fullCure, regen, spell, focus, item],
    ...overrides,
  }
}

test('prioritizes Full-Cure for critical health and Cure for low health', () => {
  assert.equal(decideAutoBattleAction(snapshot({ hp: 25 }), defaults).action.skill, 313)
  assert.equal(decideAutoBattleAction(snapshot({ hp: 50 }), defaults).action.skill, 311)
  const unavailable = snapshot({
    hp: 25,
    actions: [attack, cure, { ...fullCure, available: false }],
  })
  assert.equal(decideAutoBattleAction(unavailable, defaults).action.skill, 311)
})

test('pauses without healing and never substitutes a restorative item', () => {
  const result = decideAutoBattleAction(snapshot({ hp: 25, mp: 0 }), defaults)
  assert.equal(result.action, undefined)
  assert.match(result.reason, /无法治疗/)
  assert.equal(
    decideAutoBattleAction(snapshot({ hp: 25, actions: [attack, item] }), defaults).action,
    undefined,
  )
})

test('recognizes unavailable spells and unknown costs instead of guessing', () => {
  const current = snapshot({ hp: 50, actions: [attack, { ...cure, available: false }, item] })
  assert.equal(decideAutoBattleAction(current, defaults).action, undefined)
  assert.equal(canUseAutomaticBattleAction(snapshot(), { ...cure, manaCost: undefined }), false)
  assert.equal(canUseAutomaticBattleAction(snapshot(), { ...cure, available: undefined }), false)
  assert.equal(canUseAutomaticBattleAction(snapshot(), { ...cure, manaCost: -1 }), false)
  assert.equal(canUseAutomaticBattleAction(snapshot(), { ...cure, target: 'enemy' }), false)
})

test('refreshes Regen only when absent, affordable, and healing mana remains', () => {
  const settings = { ...defaults, maintainRegen: true }
  assert.equal(decideAutoBattleAction(snapshot({ hp: 80 }), settings).action.skill, 312)
  assert.equal(
    decideAutoBattleAction(snapshot({ hp: 80, effectIds: ['regeneration'] }), settings).action.mode,
    'attack',
  )
  assert.equal(
    decideAutoBattleAction(snapshot({ hp: 80, effectIds: undefined }), settings).action.mode,
    'attack',
  )
  assert.equal(decideAutoBattleAction(snapshot({ hp: 80, mp: 17 }), settings).action.mode, 'attack')
})

test('magic strategy reserves healing mana even while Cure is on cooldown', () => {
  assert.equal(decideAutoBattleAction(snapshot({ mp: 30 }), magic).action.skill, 111)
  assert.equal(decideAutoBattleAction(snapshot({ mp: 29 }), magic).action.mode, 'attack')
  const current = snapshot({ mp: 29, actions: [attack, { ...cure, available: false }, spell] })
  assert.equal(decideAutoBattleAction(current, magic).action.mode, 'attack')
  assert.equal(decideAutoBattleAction(snapshot(), { ...magic, spell: '' }).action, undefined)
})

test('Focus requires confirmed Overcharge and healthy HP', () => {
  assert.equal(
    decideAutoBattleAction(snapshot({ mp: 9, overcharge: 25 }), defaults).action.mode,
    'focus',
  )
  assert.equal(
    decideAutoBattleAction(snapshot({ mp: 9, overcharge: 24 }), defaults).action.mode,
    'attack',
  )
  assert.equal(decideAutoBattleAction(snapshot({ mp: 9 }), defaults).action.mode, 'attack')
  assert.equal(
    decideAutoBattleAction(snapshot({ hp: 70, mp: 9, overcharge: 100 }), defaults).action.mode,
    'attack',
  )
})

test('retains target zero and switches only to confirmed living targets', () => {
  const current = snapshot()
  assert.equal(decideAutoBattleAction(current, defaults, 0).target, 0)
  assert.equal(decideAutoBattleAction(current, defaults, 1).target, 1)
  current.monsters[0].defeated = true
  assert.equal(decideAutoBattleAction(current, defaults, 0).target, 1)
  current.monsters[1].healthPercent = undefined
  assert.equal(decideAutoBattleAction(current, defaults).action, undefined)
})

test('stops at wave end, battle completion, or unknown health', () => {
  for (const patch of [
    { roundCompleted: true },
    { completed: true },
    { vitals: [] },
    { vitals: [{ key: 'health', percent: 50, percentKnown: false }] },
  ])
    assert.equal(decideAutoBattleAction(snapshot(patch), defaults).action, undefined)
})

test('excludes items, toggles, fleeing, and unclassified magic', () => {
  const current = snapshot()
  for (const action of [
    item,
    { ...attack, mode: 'spirit' },
    { ...spell, kind: 'other' },
    { ...attack, skill: 1001 },
    { ...spell, manaCost: NaN },
  ])
    assert.equal(canUseAutomaticBattleAction(current, action), false)
})

test('validates strategy thresholds and spell settings', () => {
  assert.deepEqual(normalizeAutoBattleSettings(defaults), defaults)
  for (const patch of [
    { healAt: 91 },
    { criticalAt: 9 },
    { criticalAt: 60 },
    { healAt: '' },
    { healAt: NaN },
    { style: 'items' },
    { maintainRegen: 'true' },
  ])
    assert.equal(normalizeAutoBattleSettings({ ...defaults, ...patch }), null)
  assert.equal(normalizeAutoBattleSettings(null), null)
})

test('no consumables or invalid targets across resource combinations', () => {
  for (const settings of [defaults, magic])
    for (let hp = 0; hp <= 100; hp += 5)
      for (let mp = 0; mp <= 100; mp += 10) {
        const current = snapshot({ hp, mp })
        const next = decideAutoBattleAction(current, settings, 0)
        if (!next.action) continue
        assert.notEqual(next.action.mode, 'items')
        assert(canUseAutomaticBattleAction(current, next.action))
        assert(
          next.target === 0 ||
            current.monsters.some((monster) => monster.id === next.target && !monster.defeated),
        )
      }
})
