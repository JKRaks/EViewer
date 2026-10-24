export const themeModes = ['auto', 'dark', 'light'] as const
export type ThemeMode = (typeof themeModes)[number]
export type ThemeScheme = Exclude<ThemeMode, 'auto'>
export type ThemePresetId = 'mist' | 'violet' | 'oat' | 'classic' | 'custom'

export const themeColorFields = [
  { key: 'accent', label: '主色' },
  { key: 'background', label: '页面背景' },
  { key: 'surface', label: '内容表面' },
  { key: 'text', label: '主要文字' },
  { key: 'muted', label: '辅助文字' },
  { key: 'border', label: '边框' },
] as const

export type ThemeColorRole = (typeof themeColorFields)[number]['key']
export type ThemePalette = Record<ThemeColorRole, string> & { onAccent: string }
export type ThemeColors = Record<ThemeScheme, ThemePalette>
export type ThemePreset = ThemeColors & { id: ThemePresetId; name: string }

export const themePresets: readonly ThemePreset[] = [
  {
    id: 'mist',
    name: '雾蓝灰',
    light: {
      accent: '#5D6F80',
      background: '#F1F3F4',
      surface: '#FAFBFB',
      text: '#30383F',
      muted: '#626D76',
      border: '#D2D9DE',
      onAccent: '#FFFFFF',
    },
    dark: {
      accent: '#A9BAC9',
      background: '#20272D',
      surface: '#2A3239',
      text: '#E3E8EC',
      muted: '#A7B4BE',
      border: '#46535D',
      onAccent: '#202A33',
    },
  },
  {
    id: 'violet',
    name: '烟紫',
    light: {
      accent: '#756581',
      background: '#F4F1F5',
      surface: '#FCFAFD',
      text: '#3D3643',
      muted: '#726879',
      border: '#DCD3E0',
      onAccent: '#FFFFFF',
    },
    dark: {
      accent: '#C8B7D2',
      background: '#29252F',
      surface: '#35303C',
      text: '#ECE5F0',
      muted: '#B9ADBF',
      border: '#554B5C',
      onAccent: '#302637',
    },
  },
  {
    id: 'oat',
    name: '燕麦米',
    light: {
      accent: '#7A6652',
      background: '#F5F1EA',
      surface: '#FFFCF6',
      text: '#403A33',
      muted: '#726758',
      border: '#DFD5C8',
      onAccent: '#FFFFFF',
    },
    dark: {
      accent: '#C9B59B',
      background: '#2B2823',
      surface: '#38332D',
      text: '#EEE7DC',
      muted: '#BDB09E',
      border: '#5A5045',
      onAccent: '#30291F',
    },
  },
  {
    id: 'classic',
    name: '经典蓝',
    light: {
      accent: '#285F8C',
      background: '#FAFAFA',
      surface: '#FFFFFF',
      text: '#292F31',
      muted: '#626D70',
      border: '#DDE2E3',
      onAccent: '#FFFFFF',
    },
    dark: {
      accent: '#99C7E5',
      background: '#1E2224',
      surface: '#272C2E',
      text: '#ECEEED',
      muted: '#A7B2B4',
      border: '#475153',
      onAccent: '#173145',
    },
  },
]

export const defaultTheme = themePresets[0]!

export function contrastTextColor(hex: string): string {
  const channels = [1, 3, 5].map((offset) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  const luminance = channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
  return 1.05 / (luminance + 0.05) > (luminance + 0.05) / 0.05 ? '#FFFFFF' : '#000000'
}

export function normalizeCustomTheme(value: unknown): ThemeColors | null {
  if (!value || typeof value !== 'object') return null
  const source = value as Record<string, unknown>
  const result = {} as ThemeColors
  for (const scheme of ['light', 'dark'] as const) {
    const candidate = source[scheme]
    if (!candidate || typeof candidate !== 'object') return null
    const palette = {} as ThemePalette
    for (const { key } of themeColorFields) {
      const color = (candidate as Record<string, unknown>)[key]
      if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) return null
      palette[key] = color.toUpperCase()
    }
    palette.onAccent = contrastTextColor(palette.accent)
    result[scheme] = palette
  }
  return result
}

export function paletteCssVariables(palette: ThemePalette): Record<string, string> {
  return {
    '--background': palette.background,
    '--surface': palette.surface,
    '--foreground': palette.text,
    '--muted-foreground': palette.muted,
    '--border': palette.border,
    '--accent': palette.accent,
    '--accent-foreground': palette.onAccent,
  }
}
