import assert from 'node:assert/strict'
import test from 'node:test'

import { isTrustedAuthExportOrigin, parseAllowedAuthExportOrigins } from './auth-export-origin.js'

test('allows the Worker request origin itself', () => {
  assert.equal(isTrustedAuthExportOrigin('https://proxy.example', 'https://proxy.example'), true)
})

test('allows an explicitly configured complete origin', () => {
  const origins = parseAllowedAuthExportOrigins(
    ' https://viewer.example.com,https://second.example.com:8443 ',
  )
  assert.equal(
    isTrustedAuthExportOrigin('https://viewer.example.com', 'https://proxy.example', origins),
    true,
  )
})

test('never treats a configured wildcard as export authorization', () => {
  const origins = parseAllowedAuthExportOrigins('*')
  assert.deepEqual(origins, [])
  assert.equal(
    isTrustedAuthExportOrigin('https://viewer.example', 'https://proxy.example', origins),
    false,
  )
})

test('rejects an unconfigured origin and malformed non-origin configuration', () => {
  const origins = parseAllowedAuthExportOrigins('https://viewer.example/path,not-a-url')
  assert.deepEqual(origins, [])
  assert.equal(
    isTrustedAuthExportOrigin('https://viewer.example', 'https://proxy.example', origins),
    false,
  )
})

test('allows local HTTP development origins with an explicit port', () => {
  assert.equal(isTrustedAuthExportOrigin('http://localhost:5173', 'https://proxy.example'), true)
  assert.equal(isTrustedAuthExportOrigin('http://127.0.0.1:4173', 'https://proxy.example'), true)
})
