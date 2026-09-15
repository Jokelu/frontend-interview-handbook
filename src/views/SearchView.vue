<script setup lang="ts">
/**
 * 搜索页：/search?q=xxx
 * 直接复用 data 层导出的 searchQuestions（标题权重最高，正文最低）。
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, ArrowRight } from 'lucide-vue-next'
import CategoryIcon from '@/components/CategoryIcon.vue'
import FreqDots from '@/components/FreqDots.vue'
import { searchQuestions } from '@/data'
import { toPlainText } from '@/utils/markdown'

const route = useRoute()
const router = useRouter()

const keyword = ref(String(route.query.q ?? ''))
const results = computed(() => searchQuestions(keyword.value))

// 地址栏的 q 变化时（比如从侧边栏再次搜索）同步输入框
watch(
  () => route.query.q,
  (value) => {
    keyword.value = String(value ?? '')
  },
)

function submit(): void {
  const q = keyword.value.trim()
  router.replace({ name: 'search', query: q ? { q } : {} })
}
</script>

<template>
  <div class="search-view fade-up">
    <div class="search-box">
      <Search :size="16" class="search-box__icon" />
      <input
        v-model="keyword"
        type="search"
        placeholder="输入关键词，例如：闭包 / 事件循环 / 响应式 / 首屏优化"
        @keydown.enter="submit"
      />
      <button class="btn btn--primary" type="button" @click="submit">搜索</button>
    </div>

    <p v-if="keyword" class="search-count">
      找到 <b>{{ results.length }}</b> 道相关题目
    </p>

    <ul v-if="results.length" class="results">
      <li v-for="hit in results" :key="hit.question.id">
        <RouterLink :to="`/q/${hit.question.id}`" class="result" :style="{ '--cat-color': hit.category.color }">
          <span class="result__icon">
            <CategoryIcon :name="hit.category.icon" :size="15" :color="hit.category.color" />
          </span>
          <div class="result__body">
            <div class="result__title">{{ hit.question.title }}</div>
            <p class="result__desc">{{ toPlainText(hit.question.oral, 110) }}</p>
            <div class="result__meta">
              <span class="chip chip--plain">{{ hit.category.name }}</span>
              <span class="chip chip--plain">{{ hit.question.level }}</span>
              <FreqDots :freq="hit.question.freq" />
            </div>
          </div>
          <ArrowRight :size="15" class="result__arrow" />
        </RouterLink>
      </li>
    </ul>

    <div v-else class="empty">
      {{ keyword ? '没有找到匹配的题目，换个关键词试试' : '输入关键词开始搜索' }}
    </div>
  </div>
</template>

<style scoped>
.search-view {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.search-box {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px 8px 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-panel);
  box-shadow: var(--shadow-sm);
}
.search-box__icon {
  color: var(--text-muted);
  flex-shrink: 0;
}
.search-box input {
  flex: 1;
  min-width: 0;
  height: 32px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text);
  font-size: 14px;
}
.search-count {
  font-size: 13px;
  color: var(--text-muted);
}
.search-count b {
  color: var(--brand);
}
.results {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.result {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-panel);
  transition: all 0.15s ease;
}
.result:hover {
  border-color: var(--cat-color);
  box-shadow: var(--shadow-md);
  transform: translateX(2px);
}
.result__icon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: 9px;
  background: color-mix(in srgb, var(--cat-color) 12%, transparent);
}
.result__body {
  flex: 1;
  min-width: 0;
}
.result__title {
  font-size: 14px;
  font-weight: 550;
  color: var(--text);
}
.result__desc {
  margin: 3px 0 6px;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.result__meta {
  display: flex;
  align-items: center;
  gap: 6px;
}
.result__arrow {
  color: var(--border-strong);
  flex-shrink: 0;
}
.result:hover .result__arrow {
  color: var(--cat-color);
}
</style>
