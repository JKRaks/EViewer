<script lang="ts" setup>
import { reactive } from 'vue'
import { useRoute } from 'vue-router'
import { bookInfoOutput } from '@/core/model/book/bookInfoOutput'
import { bookImageBusi } from '@/core/busi/bookImgBusi'
import type { bookImgOutput } from '@/core/model/book/bookImgOutput'
import { bookImgInput } from '@/core/model/book/bookImgInput'
import { bookInfoBusi } from '@/core/busi/bookInfoBusi'
import { bookInfoInput } from '@/core/model/book/bookInfoInput'

const route = useRoute()
const bookInfo = JSON.parse(route.params.bookInfo as string) as bookInfoOutput

const pageData = reactive({
  loading: true,
  pageIndex: 0,
})
const bookImages = reactive<string[]>([])

if (bookInfo) {
  for await (const img of loadCurrentPage(bookInfo)) {
    if (img.isSuccess && img.dataOrDefault) {
      bookImages.push(img.dataOrDefault)
    }
  }
} else {
  console.error('没有书籍信息')
}

/**
 * 加载更多图片
 */
async function loadMorePic() {
  try {
    const current = await loadNextPage()
    if (current.isSuccess && current.dataOrDefault) {
      for await (const img of loadCurrentPage(current)) {
        if (img.isSuccess && img.dataOrDefault) {
          bookImages.push(img.dataOrDefault)
        }
      }
    } else {
      console.warn('没有更多图片了')
    }
  } catch (error) {
    console.error('加载更多图片失败:', error)
  }
}

/**
 * 加载当前页图片
 * @param current 当前页信息
 */
async function* loadCurrentPage(current: bookInfoOutput): AsyncGenerator<bookImgOutput> {
  const imageBusi = new bookImageBusi()
  for (let i = 0; i < (current.dataOrDefault.length ?? 0); i++) {
    const input = new bookImgInput()
    input.imageId = current.dataOrDefault[i] ?? ''
    yield await imageBusi.getBookImage(input)
  }
}

/**
 * 加载下一页图片
 */
async function loadNextPage(): Promise<bookInfoOutput> {
  if (!bookInfo)
    return {
      isSuccess: false,
      msg: '没有书籍信息',
    } as bookInfoOutput
  if (bookInfo.lastPageIndex <= pageData.pageIndex)
    return {
      isSuccess: false,
      msg: '没有下一页了',
    } as bookInfoOutput
  const bookBusi = new bookInfoBusi()
  const nextPageInput = new bookInfoInput()
  nextPageInput.bookId = bookInfo.bookId
  nextPageInput.page = pageData.pageIndex + 1
  const nextPageInfo = await bookBusi.getBookInfo(nextPageInput)
  if (nextPageInfo.isSuccess && nextPageInfo.dataOrDefault) {
    pageData.pageIndex++
  }
  return nextPageInfo
}
</script>

<template>
  <!-- 图片阅读区 -->
  <el-scrollbar height="400px" @end-reached="loadMorePic">
    <el-image v-for="url in bookImages" style="width: 100%" :key="url" :src="url" lazy />
  </el-scrollbar>
</template>

<style scoped></style>
