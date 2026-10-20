export interface AuthInstallContext {
  userAgent: string
  platform?: string
  maxTouchPoints?: number
  userAgentData?: { platform?: string; brands?: { brand: string; version: string }[] }
  standalone?: boolean
}

/** Installation hints describe a device/browser family, not installed extension capabilities. */
export function detectAuthInstallEnvironment(context: AuthInstallContext) {
  const ua = context.userAgent
  const platform = context.userAgentData?.platform || context.platform || ''
  const brands = context.userAgentData?.brands?.map(({ brand }) => brand).join(' ') || ''
  const ipad =
    /iPad/i.test(ua) || (context.platform === 'MacIntel' && (context.maxTouchPoints || 0) > 1)
  const appleMobile = ipad || /iPhone|iPod/i.test(ua)
  const os = ipad
    ? 'ipados'
    : appleMobile
      ? 'ios'
      : /Android/i.test(ua + platform)
        ? 'android'
        : /Windows|Win32|Win64/i.test(ua + platform)
          ? 'windows'
          : /Macintosh|Mac OS|macOS|MacIntel/i.test(ua + platform)
            ? 'macos'
            : /Linux|CrOS/i.test(ua + platform)
              ? 'linux'
              : 'unknown'
  const browser =
    /Edg(?:e|A|iOS)?\//i.test(ua) || /Microsoft Edge/i.test(brands)
      ? 'edge'
      : /Firefox\/|FxiOS\//i.test(ua) || /Firefox/i.test(brands)
        ? 'firefox'
        : /OPR\/|OPiOS\//i.test(ua) || /Opera/i.test(brands)
          ? 'opera'
          : /Chrome\/|CriOS\//i.test(ua) || /Chromium|Google Chrome/i.test(brands)
            ? 'chrome'
            : /Safari\//i.test(ua)
              ? 'safari'
              : 'unknown'
  const manager =
    appleMobile || (os === 'macos' && browser === 'safari')
      ? 'userscripts'
      : os !== 'unknown' && browser !== 'safari'
        ? 'tampermonkey'
        : undefined
  const helperRequired =
    !!context.standalone ||
    /\bwv\b|MicroMessenger|FBAN|FBAV|Instagram|Line\//i.test(ua) ||
    (appleMobile && browser !== 'safari') ||
    (os === 'android' && browser !== 'firefox' && browser !== 'edge') ||
    browser === 'unknown'
  const tampermonkeyBrowser =
    os === 'android' && browser !== 'edge'
      ? 'firefox'
      : {
          edge: 'microsoftedge',
          firefox: 'firefox',
          opera: 'opera',
          chrome: 'chrome',
          safari: 'safari',
          unknown: '',
        }[browser]
  return {
    os,
    osLabel: {
      ipados: 'iPadOS',
      ios: 'iOS',
      android: 'Android',
      windows: 'Windows',
      macos: 'macOS',
      linux: 'Linux',
      unknown: '未知系统',
    }[os],
    browser,
    browserLabel: {
      edge: 'Microsoft Edge',
      firefox: 'Firefox',
      opera: 'Opera',
      chrome: 'Chrome / Chromium',
      safari: 'Safari',
      unknown: '未知浏览器',
    }[browser],
    manager,
    helperRequired,
    standalone: !!context.standalone,
    tampermonkeyUrl:
      'https://www.tampermonkey.net/' +
      (tampermonkeyBrowser ? '?browser=' + tampermonkeyBrowser : ''),
  } as const
}
