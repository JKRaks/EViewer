const defaultEhUrl = 'https://proxy.example.com/ehentai'

export const eurlEnum = {
  EH: import.meta.env.VITE_EH_URL || defaultEhUrl,
} as const

export type eurlEnum = (typeof eurlEnum)[keyof typeof eurlEnum]
