<script setup lang="ts">
import { ref, onActivated, onDeactivated } from 'vue'
import { bookListBusi } from '@/core/busi/bookListBusi'
import { bookInput } from '@/core/model/book/bookInput'
import { bookOutput } from '@/core/model/book/bookOutput'
import { categoryEnum } from '@/core/common/enum/categoryEnum'
import BookItem from '@/components/BookItem.vue'
import { Search, ArrowDown, ArrowUp, Filter } from '@element-plus/icons-vue'

const bookInputs = ref<bookInput>(new bookInput())
const bookOutputs = ref<bookOutput>()
const showAdvanced = ref(false)
const loading = ref(false)

// 分类选项
const categoryOptions = [
  { label: '全部', value: categoryEnum.All },
  { label: '同人志', value: categoryEnum.Doujinshi },
  { label: '漫画', value: categoryEnum.Manga },
  { label: '艺术家CG', value: categoryEnum.ArtistCG },
  { label: '游戏CG', value: categoryEnum.GameCG },
  { label: '西方', value: categoryEnum.Western },
  { label: '非H', value: categoryEnum.NonH },
  { label: '图像集', value: categoryEnum.ImageSet },
  { label: 'Cosplay', value: categoryEnum.Cosplay },
  { label: '亚洲色情', value: categoryEnum.AsianPorn },
  { label: '杂项', value: categoryEnum.Misc },
]

// 评分选项
const ratingOptions = [
  { label: '不限', value: undefined },
  { label: '2星及以上', value: 2 },
  { label: '3星及以上', value: 3 },
  { label: '4星及以上', value: 4 },
  { label: '5星', value: 5 },
]

async function fetchBookList() {
  loading.value = true
  try {
    const busi = new bookListBusi()
    const result = await busi.getBookPageList(bookInputs.value)
    bookOutputs.value = result
  } catch (error) {
    console.error('获取书籍列表失败:', error)
  } finally {
    loading.value = false
  }
}

// 切换高级搜索
const toggleAdvanced = () => {
  showAdvanced.value = !showAdvanced.value
}

// 定义组件名称(用于 KeepAlive)
defineOptions({
  name: 'BookList',
})

const scrollPosition = ref(0)

// 组件被激活时调用(从缓存中恢复)
onActivated(() => {
  // 恢复滚动位置
  if (scrollPosition.value > 0) {
    window.scrollTo(0, scrollPosition.value)
  }
})

// 组件被停用时调用(进入缓存)
onDeactivated(() => {
  // 保存滚动位置
  scrollPosition.value = window.scrollY
})
</script>

<template>
  <div class="booklist-view">
    <!-- 搜索区域 -->
    <div class="search-container">
      <!-- 基础搜索 -->
      <div class="search-basic">
        <el-input
          v-model="bookInputs.keyword"
          placeholder="搜索关键词..."
          class="search-input"
          clearable
          @keyup.enter="fetchBookList"
        >
          <template #prefix>
            <el-icon>
              <Search />
            </el-icon>
          </template>
        </el-input>

        <el-button type="primary" :loading="loading" @click="fetchBookList"> 搜索 </el-button>

        <el-button :icon="showAdvanced ? ArrowUp : ArrowDown" @click="toggleAdvanced" text>
          {{ showAdvanced ? '收起' : '高级' }}
        </el-button>
      </div>

      <!-- 高级搜索(折叠) -->
      <el-collapse-transition>
        <div v-show="showAdvanced" class="search-advanced">
          <el-form :model="bookInputs" label-position="top" class="advanced-form">
            <!-- 分类 -->
            <el-form-item label="分类">
              <el-select v-model="bookInputs.category" placeholder="选择分类" class="form-select">
                <el-option
                  v-for="item in categoryOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>

            <!-- 最低评分 -->
            <el-form-item label="最低评分">
              <el-select
                v-model="bookInputs.minRating"
                placeholder="选择评分"
                class="form-select"
                clearable
              >
                <el-option
                  v-for="item in ratingOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>

            <!-- 显示已移除 -->
            <el-form-item label="显示选项">
              <el-switch
                v-model="bookInputs.showHide"
                active-text="显示已移除"
                inactive-text="隐藏已移除"
              />
            </el-form-item>
          </el-form>
        </div>
      </el-collapse-transition>
    </div>

    <!-- 结果统计 -->
    <div v-if="bookOutputs?.data" class="result-info">
      <el-icon>
        <Filter />
      </el-icon>
      <span>找到 {{ bookOutputs.totalCount }} 个结果</span>
    </div>

    <!-- 书籍列表 -->
    <div class="book-list" v-loading="loading">
      <BookItem
        v-for="book in bookOutputs?.data"
        :key="book.bookId"
        :book="book"
        class="book-item"
      />
    </div>
    <el-backtop :bottom="100" />
    <!-- 空状态 -->
    <el-empty
      v-if="!loading && (!bookOutputs?.data || bookOutputs.data.length === 0)"
      description="暂无数据"
    />
  </div>
</template>

<style scoped>
.booklist-view {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0;
}

/* 搜索容器 */
.search-container {
  background-color: var(--el-bg-color);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

/* 基础搜索 */
.search-basic {
  display: flex;
  gap: 12px;
  align-items: center;
}

.search-input {
  flex: 1;
  max-width: 600px;
}

/* 高级搜索 */
.search-advanced {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-light);
}

.advanced-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.form-select {
  width: 100%;
}

/* 结果信息 */
.result-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: var(--el-fill-color-light);
  border-radius: 6px;
  margin-bottom: 16px;
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.result-info .el-icon {
  color: var(--el-color-primary);
}

/* 书籍列表 */
.book-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.book-item {
  transition: all 0.3s;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .search-container {
    padding: 12px;
    margin-bottom: 16px;
  }

  .search-basic {
    flex-direction: column;
    gap: 10px;
  }

  .search-input {
    max-width: 100%;
  }

  .search-basic .el-button {
    width: 100%;
  }

  .advanced-form {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .book-list {
    gap: 10px;
  }
}

@media (max-width: 480px) {
  .search-container {
    padding: 10px;
    margin-bottom: 12px;
    border-radius: 6px;
  }

  .search-basic {
    gap: 8px;
  }

  .advanced-form {
    gap: 10px;
  }

  .result-info {
    padding: 6px 10px;
    font-size: 13px;
    margin-bottom: 12px;
  }

  .book-list {
    gap: 8px;
  }
}

/* 深色模式适配 */
@media (prefers-color-scheme: dark) {
  .search-container {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }
}
</style>
