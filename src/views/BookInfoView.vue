<script lang="ts" setup>
import { bookImageBusi } from '@/core/busi/bookImgBusi'
import { bookInfoBusi } from '@/core/busi/bookInfoBusi'
import { bookAllInfoOutput } from '@/core/model/book/bookAllInfoOutput'
import { bookImgListInput } from '@/core/model/book/bookImgListInput'
import type { bookImgListOutput } from '@/core/model/book/bookImgListOutput'
import { bookInfoInput } from '@/core/model/book/bookInfoInput'
import { bookInfoOutput } from '@/core/model/book/bookInfoOutput'
import { ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const bookInfo = ref<bookInfoOutput>()
const bookQueryInfo = ref<bookInfoInput>()

const bookAllData = ref<bookAllInfoOutput>()
const imageUrls = ref<bookImgListOutput>()

await fetchBookInfo()

async function fetchBookInfo() {
  const infoBusi = new bookInfoBusi()
  if (!bookQueryInfo.value) {
    bookQueryInfo.value = new bookInfoInput()
  }
  if (!bookQueryInfo.value.bookId) {
    bookQueryInfo.value.bookId = route.query.bookId as string
  }
  bookQueryInfo.value.bookId = bookQueryInfo.value.bookId.replace('-', '/')
  bookInfo.value = await infoBusi.getBookInfo(bookQueryInfo.value)
  console.log(bookInfo.value)
}

async function toRead(bookQueryInfo: bookInfoInput) {
  const infoBusi = new bookInfoBusi()
  bookAllData.value = await infoBusi.getAllBookInfo(bookQueryInfo)
  showAllImages(bookAllData.value.allImgIds)
  console.log(bookAllData.value)
}

async function showAllImages(imageIds: string[]) {
  const imgBusi = new bookImageBusi()
  const input = new bookImgListInput()
  input.imageIds = imageIds
  imageUrls.value = await imgBusi.getBookImages(input)
  console.log(imageUrls.value)
}
</script>

<template>
  <div class="bookinfo">
    <h2>{{ bookInfo?.bookName }}</h2>
    <p><img :src="bookInfo?.coverImage" /></p>
    <p>Uploader: {{ bookInfo?.uploader }}</p>
    <p>Category: {{ bookInfo?.category }}</p>
    <p>Published Date: {{ bookInfo?.publishDate }}</p>
    <p>Rating: {{ bookInfo?.rating }}</p>
    <p>
      Tags:
      <span class="tag" v-for="tag in bookInfo?.tags" :key="tag">{{ tag }} </span>
    </p>
  </div>
  <button @click="toRead(bookQueryInfo!)">开始阅读</button>
  <div class="bookimages" v-if="imageUrls">
    <div v-for="imgUrl in imageUrls?.data" :key="imgUrl.index">
      <p><img :src="imgUrl.data" /></p>
    </div>
  </div>
</template>

<style scoped>
.tag {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  margin: 0.2rem;
  background-color: #f0f0f0;
  border-radius: 4px;
}
</style>
