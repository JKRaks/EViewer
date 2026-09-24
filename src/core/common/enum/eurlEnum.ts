const defaultEhUrl =
  typeof window !== 'undefined' && window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:3000/ehentai'
    : 'http://localhost:3000/ehentai'

export const eurlEnum = {
  EH: import.meta.env.VITE_EH_URL || defaultEhUrl,
} as const

export type eurlEnum = (typeof eurlEnum)[keyof typeof eurlEnum]
