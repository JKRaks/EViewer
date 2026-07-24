import { ref } from 'vue'

/** 登录用户收藏数据的本地变更版本，用于刷新 KeepAlive 收藏页。 */
export const favoriteDataRevision = ref(0)

export function markFavoriteDataChanged() {
  favoriteDataRevision.value += 1
}
