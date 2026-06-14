const defaultEhUrl = 'http://localhost:3000/ehentai'

export const eurlEnum = {
  EH: import.meta.env.VITE_EH_URL || defaultEhUrl,
} as const

export type eurlEnum = (typeof eurlEnum)[keyof typeof eurlEnum]
