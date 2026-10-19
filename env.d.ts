/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EH_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

type AppLaunchPhase =
  | 'opening'
  | 'interface'
  | 'content'
  | 'account'
  | 'history'
  | 'battle'
  | 'layout'

interface Window {
  __eviewerLaunch?: {
    localize(translate: (message: string) => string): void
    phase(value: AppLaunchPhase): void
    usable(): void
    fail(): void
    dispose(): void
  }
}
