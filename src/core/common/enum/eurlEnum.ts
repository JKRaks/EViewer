const defaultEhUrl = 'https://eproxy.jkraks.workers.dev/ehentai'

export const eurlEnum = {
  EH: import.meta.env.VITE_EH_URL || defaultEhUrl,
} as const

export type eurlEnum = (typeof eurlEnum)[keyof typeof eurlEnum]
