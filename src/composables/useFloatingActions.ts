import { shallowRef } from 'vue'
import type { Component } from 'vue'

/**
 * 单个悬浮按钮配置项。
 */
export interface FloatingActionItem {
  /** 按钮唯一键，用于更新/删除。 */
  key: string
  /** 按钮图标组件。 */
  icon: Component
  /** 按钮点击回调。 */
  onClick: () => void
  /** 是否显示，默认显示。 */
  show?: boolean
  /** 是否高亮。 */
  active?: boolean
  /** 排序值，值越小越靠前。 */
  order?: number
  /** 额外样式类名。 */
  className?: string
}

/**
 * 当前页面注册的悬浮按钮列表（全局共享）。
 */
const pageFloatingActions = shallowRef<FloatingActionItem[]>([])

/**
 * 悬浮按钮注册 API。
 * 建议在页面挂载时注册，在页面卸载时清理，避免按钮残留到其他页面。
 */
export function useFloatingActions() {
  /** 覆盖设置当前页全部悬浮按钮。 */
  const setFloatingActions = (actions: FloatingActionItem[]) => {
    pageFloatingActions.value = [...actions]
  }

  /** 新增按钮；若 key 已存在则更新该按钮。 */
  const addFloatingAction = (action: FloatingActionItem) => {
    const index = pageFloatingActions.value.findIndex((item) => item.key === action.key)
    if (index >= 0) {
      pageFloatingActions.value[index] = action
      pageFloatingActions.value = [...pageFloatingActions.value]
      return
    }
    pageFloatingActions.value = [...pageFloatingActions.value, action]
  }

  /** 按 key 删除单个按钮。 */
  const removeFloatingAction = (key: string) => {
    pageFloatingActions.value = pageFloatingActions.value.filter((item) => item.key !== key)
  }

  /** 清空当前页所有按钮。 */
  const clearFloatingActions = () => {
    pageFloatingActions.value = []
  }

  return {
    pageFloatingActions,
    setFloatingActions,
    addFloatingAction,
    removeFloatingAction,
    clearFloatingActions,
  }
}
