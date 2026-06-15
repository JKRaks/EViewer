import { defineStore } from 'pinia'
export const useGlobalState = defineStore('globalConfig', {
  state: () => {
    return {
      // 系统主题，auto跟随系统，light浅色，dark深色
      theme: 'auto',
    }
  },
})
