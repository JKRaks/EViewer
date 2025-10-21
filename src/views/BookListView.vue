<script setup lang="ts">
import { ref } from 'vue'
import { bookListBusi } from '@/core/busi/bookListBusi'
import { bookInput } from '@/core/model/book/bookInput'
import { bookOutput } from '@/core/model/book/bookOutput'

const bookInputs = ref<bookInput>(new bookInput())
const bookOutputs = ref<bookOutput>()

async function fetchBookList() {
  const busi = new bookListBusi()
  const result = await busi.getBookPageList(bookInputs.value)
  bookOutputs.value = result
}
</script>

<template>
  <div class="booklist">
    <div class="search">
      <div>
        <span>Keyword:</span>
        <input
          type="text"
          placeholder="Search for books..."
          id="keyword"
          name="keyword"
          :value="bookInputs.keyword"
        />
        <input type="button" value="Search" v-on:click="fetchBookList" />
      </div>
    </div>
    <div class="bookList">
      <div v-for="book in bookOutputs?.data" class="bookItem" :key="book.bookId">
        <h3>
          <router-link :to="{ path: '/bookinfo', query: { bookId: book.bookId } }">
            {{ book.bookTitle }}
          </router-link>
        </h3>
        <p><img class="bookImage" :src="book.thumbnailUrl" /></p>
        <p>Uploader: {{ book.uploader }}</p>
        <p>Category: {{ book.category }}</p>
        <p>Published Date: {{ book.publishDate }}</p>
        <p>URL: {{ book.bookUrl }}</p>
      </div>
    </div>
  </div>
</template>

<style>
@media (min-width: 1024px) {
  .booklist {
    min-height: 100vh;
    display: flex;
    align-items: center;
    flex-direction: column;
    justify-content: center;
  }
  .search {
    width: 100%;
    text-align: center;
  }
  .bookItem {
    border: 1px solid var(--color-border);
    padding: 1rem;
    margin: 1rem;
  }
  .bookImage {
    max-width: 200px;
    height: auto;
  }
}
</style>
