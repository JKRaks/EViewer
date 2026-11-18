/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'

const statusKey = 'eviewer:connection-onboarding'
const modeKey = 'eviewer:request-mode'
const heading = (page: Page) => page.getByRole('heading', { name: '先选择连接方式' })
const confirm = (page: Page) => page.getByRole('button', { name: '确认并继续' })
const server = (page: Page) => page.getByRole('radio', { name: '服务代理', exact: true })

async function seed(page: Page, values: Record<string, string>) {
  await page.addInitScript((values) => {
    // Seed once so refresh exercises the app's actual persisted state.
    if (sessionStorage.getItem('fixture-seeded')) return
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value)
    sessionStorage.setItem('fixture-seeded', 'true')
  }, values)
}

async function stored(page: Page, key: string) {
  return page.evaluate((key) => localStorage.getItem(key), key)
}

async function installAssistant(page: Page) {
  // Simulate only the public postMessage protocol; no app modules are replaced.
  await page.addInitScript(() => {
    window.addEventListener('message', (event) => {
      const message = event.data
      if (message?.channel !== 'eviewer-browser-assistant' || message.direction !== 'page') return
      const identity = {
        instance: 'onboarding-fixture',
        flavor: 'tampermonkey',
        scriptVersion: '1.0.0',
        buildVersion: '1.0.0',
        protocolVersion: 1,
        origin: location.origin,
        manager: 'Test fixture',
        managerVersion: '1',
        available: true,
        capabilities: ['text', 'binary', 'multipart', 'exhentai', 'hentaiverse'],
      }
      if (message.action === 'hello') {
        window.postMessage(
          {
            channel: message.channel,
            direction: 'assistant',
            action: 'ready',
            instance: identity.instance,
            identity,
          },
          location.origin,
        )
      }
      if (message.action === 'request') {
        const requests = JSON.parse(
          sessionStorage.getItem('assistant-requests') || '[]',
        ) as string[]
        requests.push(message.request.url)
        sessionStorage.setItem('assistant-requests', JSON.stringify(requests))
        window.postMessage(
          {
            channel: message.channel,
            direction: 'assistant',
            action: 'response',
            instance: identity.instance,
            id: message.id,
            ok: true,
            result: {
              status: 200,
              finalUrl: message.request.url,
              text: '<html><body></body></html>',
              base64: '',
              mimeType: 'text/html',
            },
          },
          location.origin,
        )
      }
    })
  })
}

test.beforeEach(async ({ page }) => {
  // Do not contact source sites or a real proxy in regression tests.
  await page.route(
    /https?:\/\/(?:127\.0\.0\.1:8787|(?:[^/]+\.)?e-hentai\.org|exhentai\.org|hentaiverse\.org)\//,
    async (route) => {
      const url = new URL(route.request().url())
      if (url.pathname.endsWith('assistant-manifest.json')) {
        await route.fulfill({
          json: {
            schema: 1,
            environment: 'development',
            revision: null,
            productionOrigin: null,
            scripts: Object.fromEntries(
              ['tampermonkey', 'userscripts'].map((flavor) => [
                flavor,
                {
                  version: '1.0.0',
                  protocolVersion: 1,
                  installPath: `/auth/bridge/eviewer-assistant.${flavor}.user.js`,
                },
              ]),
            ),
          },
        })
      } else if (url.pathname.endsWith('/auth/status')) {
        await route.fulfill({ json: { success: true, credentialReady: false } })
      } else {
        await route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' })
      }
    },
  )
})

test('fresh launch gates home requests and persists an explicit default server choice', async ({
  page,
}) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes(':8787')) requests.push(request.url())
  })
  await page.goto('/')
  await expect(heading(page)).toBeVisible()
  await expect(page.locator('#app-launch')).toHaveCount(0)
  await expect(page.getByText('未检测到浏览器助手', { exact: true })).toBeVisible()
  await expect(confirm(page)).toBeDisabled()
  await expect(page.locator('.floating-actions')).toHaveCount(0)
  expect(requests).toEqual([])
  expect(await stored(page, statusKey)).toBe('pending')
  await server(page).check()
  // Two synchronous clicks must not start two completions or navigations.
  await confirm(page).evaluate((button: HTMLButtonElement) => {
    button.click()
    button.click()
  })
  await expect(heading(page)).toHaveCount(0)
  expect(await stored(page, statusKey)).toBe('completed')
  expect(await stored(page, modeKey)).toBe('server')
  await expect.poll(() => requests.some((url) => url.includes('/auth/status'))).toBe(true)
  await page.reload()
  await expect(page.locator('.site-header')).toBeVisible()
  await expect(heading(page)).toHaveCount(0)
})

const existingUsers: { name: string; values: Record<string, string>; mode: string | null }[] = [
  { name: 'default server with theme history', values: { 'eviewer-theme': 'auto' }, mode: null },
  {
    name: 'local with missing assistant',
    values: { [modeKey]: 'local', 'eviewer:gallery-site': 'ex' },
    mode: 'local',
  },
  { name: 'completed marker', values: { [statusKey]: 'completed' }, mode: null },
]
for (const history of existingUsers) {
  test(`existing user: ${history.name}`, async ({ page }) => {
    await seed(page, history.values)
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: '系统设置', exact: true })).toBeVisible()
    await expect(heading(page)).toHaveCount(0)
    expect(await stored(page, statusKey)).toBe('completed')
    expect(await stored(page, modeKey)).toBe(history.mode)
    if (history.mode === 'local') {
      await expect(page.getByRole('radio', { name: /本机代理/ })).toBeChecked()
      expect(await stored(page, 'eviewer:gallery-site')).toBe('ex')
    }
  })
}

test('pending wins over history, survives refresh and completes after installing the assistant', async ({
  page,
}) => {
  await seed(page, { [statusKey]: 'pending', 'eviewer-theme': 'dark' })
  const deepLink = '/booklist?site=ex&f_search=fixture#saved-position'
  await page.goto(deepLink)
  await expect(heading(page)).toBeVisible()
  expect(await stored(page, statusKey)).toBe('pending')
  await page.reload()
  await expect(heading(page)).toBeVisible()
  await installAssistant(page)
  await page.reload()
  await expect(confirm(page)).toBeEnabled()
  expect(await page.evaluate(() => sessionStorage.getItem('assistant-requests'))).toBeNull()
  await confirm(page).click()
  await expect(heading(page)).toHaveCount(0)
  await expect(page).toHaveURL(new RegExp(deepLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'))
  expect(await stored(page, modeKey)).toBe('local')
  expect(await stored(page, 'eviewer:gallery-site')).toBe('ex')
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('assistant-requests')))
    .not.toBeNull()
})

test('a fresh query.site deep link cannot migrate itself to completed', async ({ page }) => {
  await page.goto('/hentaiverse?site=ex#equipment')
  await expect(heading(page)).toBeVisible()
  expect(await stored(page, statusKey)).toBe('pending')
  await page.reload()
  await expect(heading(page)).toBeVisible()
  await server(page).check()
  await confirm(page).click()
  await expect(heading(page)).toHaveCount(0)
  await expect(page).toHaveURL(/\/hentaiverse\?site=ex#equipment$/)
})

test('settings can reopen, cancel and change the guide without resetting existing preferences', async ({
  page,
}) => {
  await seed(page, { [modeKey]: 'local', 'eviewer:gallery-site': 'ex' })
  await page.goto('/settings#browser-assistant')
  await page.getByRole('link', { name: '重新查看连接引导' }).click()
  await expect(heading(page)).toBeVisible()
  await server(page).check()
  await page.getByRole('button', { name: '返回设置' }).click()
  expect(await stored(page, modeKey)).toBe('local')
  await page.getByRole('link', { name: '重新查看连接引导' }).click()
  await server(page).check()
  await confirm(page).click()
  await expect(page).toHaveURL(/\/settings#browser-assistant$/)
  expect(await stored(page, modeKey)).toBe('server')
  expect(await stored(page, 'eviewer:gallery-site')).toBe('ex')
  await page.goBack()
  await expect(heading(page)).toHaveCount(0)
})

test('blocked storage still allows session completion and navigation', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    for (const property of ['localStorage', 'sessionStorage'])
      Object.defineProperty(window, property, {
        get() {
          throw new DOMException('Blocked by test', 'SecurityError')
        },
      })
  })
  await page.goto('/settings')
  await expect(heading(page)).toBeVisible()
  await server(page).check()
  await confirm(page).click()
  await expect(page.getByRole('heading', { name: '系统设置', exact: true })).toBeVisible()
  await page.getByRole('link', { name: '重新查看连接引导' }).click()
  await page.getByRole('button', { name: '返回设置' }).click()
  await expect(heading(page)).toHaveCount(0)
  expect(errors).toEqual([])
})

test('storage quota failures do not block completion', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Full', 'QuotaExceededError')
    }
  })
  await page.goto('/settings')
  await expect(heading(page)).toBeVisible()
  await server(page).check()
  await confirm(page).click()
  await expect(page.getByRole('heading', { name: '系统设置', exact: true })).toBeVisible()
  await expect(heading(page)).toHaveCount(0)
})

test('unavailable helper blocks confirmation and preserves a saved local choice', async ({
  page,
}) => {
  const makeUnavailable = () =>
    page.evaluate(() => {
      window.postMessage(
        {
          channel: 'eviewer-browser-assistant',
          direction: 'assistant',
          action: 'ready',
          instance: 'onboarding-fixture',
          identity: {
            instance: 'onboarding-fixture',
            flavor: 'tampermonkey',
            scriptVersion: '1.0.0',
            buildVersion: '1.0.0',
            protocolVersion: 1,
            origin: location.origin,
            manager: 'Test fixture',
            managerVersion: '1',
            available: false,
            capabilities: [],
          },
        },
        location.origin,
      )
    })
  await installAssistant(page)
  await page.goto('/settings')
  await expect(confirm(page)).toBeEnabled()
  await makeUnavailable()
  await expect(confirm(page)).toBeDisabled()
  expect(await stored(page, statusKey)).toBe('pending')
  await page.reload()
  await expect(confirm(page)).toBeEnabled()
  await confirm(page).click()
  expect(await stored(page, modeKey)).toBe('local')
  await makeUnavailable()
  await expect(
    page.getByText('脚本能力或通信协议不兼容，请更新并检查权限', { exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('radio', { name: /本机代理/ })).toBeChecked()
  expect(await stored(page, modeKey)).toBe('local')
})

test('scrolling the guide keeps the original page scroll memory intact', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('layout-scroll:/settings', '350'))
  await page.goto('/settings')
  await expect(heading(page)).toBeInViewport()
  await page.locator('.guide-actions').scrollIntoViewIfNeeded()
  expect(await page.evaluate(() => sessionStorage.getItem('layout-scroll:/settings'))).toBe('350')
  await server(page).check()
  await confirm(page).click()
  await expect(heading(page)).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
})

test('guide fits viewport, supports keyboard choice and has no console errors', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto('/settings#browser-assistant')
  await expect(heading(page)).toBeVisible()
  await expect(heading(page)).toBeInViewport()
  await expect(page.getByText('未检测到浏览器助手', { exact: true })).toBeVisible()
  const local = page.getByRole('radio', { name: /浏览器助手（本机代理）/ })
  await local.focus()
  await page.keyboard.press('ArrowRight')
  await expect(server(page)).toBeChecked()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await confirm(page).focus()
  await page.keyboard.press('Enter')
  await expect(heading(page)).toHaveCount(0)
  expect(errors).toEqual([])
})
