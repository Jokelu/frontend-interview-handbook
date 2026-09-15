<script setup lang="ts">
/**
 * 左侧菜单
 * ------------------------------------------------------------------
 * 结构：技术栈分组（可折叠）→ 该分组下的题目
 * 交互：搜索框实时过滤；当前路由所在分组自动展开；已掌握的题目打勾。
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronRight, Search, Check, X, Play, BookMarked } from 'lucide-vue-next'
import CategoryIcon from './CategoryIcon.vue'
import FreqDots from './FreqDots.vue'
import { categories, getQuestion, totalQuestions } from '@/data'
import { useProgress } from '@/composables/useProgress'
import { useReview } from '@/composables/useReview'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const route = useRoute()
const router = useRouter()
const { isMastered, toggle, masteredCount } = useProgress()
const { reviewCount, isInReview } = useReview()

/** 顶部两个快捷入口是否处于激活状态 */
const isMockRoute = computed(() => route.name === 'mock')
const isReviewRoute = computed(() => route.name === 'review')

/** 搜索关键词 */
const keyword = ref('')

/**
 * 展开状态用对象存（而不是数组），
 * 因为「手动折叠」和「默认展开」需要区分：默认所有分组展开。
 */
const collapsed = ref<Record<string, boolean>>({})

/** 当前高亮的题目 id */
const activeQuestionId = computed(() => (route.name === 'question' ? String(route.params.questionId) : ''))

/** 当前分类 id（题目详情页需要反查） */
const activeCategoryId = computed(() => {
  if (route.name === 'category') return String(route.params.categoryId)
  if (route.name === 'question' && activeQuestionId.value) {
    return getQuestion(activeQuestionId.value)?.category.id ?? ''
  }
  return ''
})

/** 进入某个分类的题目时，确保该分组是展开的 */
watch(
  activeCategoryId,
  (id) => {
    if (id) collapsed.value = { ...collapsed.value, [id]: false }
  },
  { immediate: true },
)

/** 按关键词过滤后的分组数据 */
const filteredCategories = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return categories
  return categories
    .map((category) => ({
      ...category,
      items: category.items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.tags.some((tag) => tag.toLowerCase().includes(q)),
      ),
    }))
    .filter((category) => category.items.length > 0)
})

const matchCount = computed(() =>
  filteredCategories.value.reduce((sum, category) => sum + category.items.length, 0),
)

function toggleGroup(id: string): void {
  collapsed.value = { ...collapsed.value, [id]: !collapsed.value[id] }
}

function onSearchConfirm(): void {
  const q = keyword.value.trim()
  if (!q) return
  router.push({ name: 'search', query: { q } })
  emit('close')
}

function clearKeyword(): void {
  keyword.value = ''
}
</script>

<template>
  <aside class="sidebar" :class="{ 'sidebar--open': props.open }">
    <!-- 顶部品牌区 -->
    <div class="sidebar__head">
      <RouterLink to="/" class="brand" @click="emit('close')">
        <span class="brand__mark">FE</span>
        <span class="brand__text">
          <b>前端高频面试题</b>
          <i>{{ totalQuestions }} 道题 · {{ categories.length }} 个技术栈</i>
        </span>
      </RouterLink>
      <button class="icon-btn sidebar__close" type="button" @click="emit('close')">
        <X :size="16" />
      </button>
    </div>

    <!-- 搜索 -->
    <div class="sidebar__search">
      <Search :size="14" class="sidebar__search-icon" />
      <input
        v-model="keyword"
        type="text"
        placeholder="搜索题目 / 关键词..."
        @keydown.enter="onSearchConfirm"
      />
      <button v-if="keyword" class="sidebar__search-clear" type="button" @click="clearKeyword">
        <X :size="13" />
      </button>
    </div>

    <!-- 快捷入口：模拟面试 / 复习清单 -->
    <div class="quick">
      <RouterLink
        to="/mock"
        class="quick__item"
        :class="{ 'quick__item--on': isMockRoute }"
        @click="emit('close')"
      >
        <Play :size="13" />
        模拟面试
      </RouterLink>
      <RouterLink
        to="/review"
        class="quick__item"
        :class="{ 'quick__item--on': isReviewRoute }"
        @click="emit('close')"
      >
        <BookMarked :size="13" />
        复习清单
        <span v-if="reviewCount" class="quick__badge">{{ reviewCount }}</span>
      </RouterLink>
    </div>

    <!-- 分组菜单 -->
    <nav class="sidebar__nav">
      <template v-if="filteredCategories.length">
        <div v-for="category in filteredCategories" :key="category.id" class="group">
          <button class="group__head" type="button" @click="toggleGroup(category.id)">
            <ChevronRight
              :size="13"
              class="group__arrow"
              :class="{ 'group__arrow--open': !collapsed[category.id] }"
            />
            <CategoryIcon :name="category.icon" :size="14" :color="category.color" />
            <span class="group__name" :class="{ 'group__name--active': activeCategoryId === category.id }">
              {{ category.name }}
            </span>
            <span class="group__count">{{ category.items.length }}</span>
          </button>

          <ul v-show="!collapsed[category.id]" class="group__list">
            <!-- 分类概览入口 -->
            <li>
              <RouterLink
                :to="`/c/${category.id}`"
                class="item item--overview"
                @click="emit('close')"
              >
                分类总览
              </RouterLink>
            </li>
            <li v-for="item in category.items" :key="item.id">
              <RouterLink
                :to="`/q/${item.id}`"
                class="item"
                :class="{ 'item--active': activeQuestionId === item.id }"
                @click="emit('close')"
              >
                <span class="item__title">{{ item.title }}</span>
                <span class="item__right">
                  <BookMarked v-if="isInReview(item.id)" :size="12" class="item__marked" />
                  <Check v-else-if="isMastered(item.id)" :size="12" class="item__done" />
                  <FreqDots v-else :freq="item.freq" />
                </span>
              </RouterLink>
            </li>
          </ul>
        </div>
      </template>
      <p v-else class="empty">没找到匹配的题目</p>
    </nav>

    <!-- 底部进度 -->
    <div class="sidebar__foot">
      <div class="progress">
        <div class="progress__bar">
          <span
            class="progress__fill"
            :style="{ width: `${totalQuestions ? (masteredCount / totalQuestions) * 100 : 0}%` }"
          />
        </div>
        <span class="progress__text">已掌握 {{ masteredCount }} / {{ totalQuestions }}</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  width: var(--sidebar-w);
  height: 100%;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border);
}

/* ---- 品牌 ---- */
.sidebar__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 12px 10px;
}
.brand {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.brand__mark {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: linear-gradient(135deg, var(--brand), #7c5cff);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  flex-shrink: 0;
}
.brand__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.brand__text b {
  font-size: 14px;
  color: var(--text);
  white-space: nowrap;
}
.brand__text i {
  font-size: 11px;
  font-style: normal;
  color: var(--text-muted);
}
.sidebar__close {
  display: none;
}

/* ---- 搜索 ---- */
.sidebar__search {
  position: relative;
  display: flex;
  align-items: center;
  margin: 0 12px 10px;
  padding: 0 10px;
  height: 34px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-subtle);
  transition: border-color 0.15s ease;
}
.sidebar__search:focus-within {
  border-color: var(--brand);
  background: var(--bg-panel);
}
.sidebar__search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}
.sidebar__search input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 6px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text);
  font-size: 13px;
}
.sidebar__search input::placeholder {
  color: var(--text-muted);
}
.sidebar__search-clear {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  background: var(--border);
  color: var(--text-secondary);
}

/* ---- 快捷入口 ---- */
.quick {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 0 12px 8px;
  margin-bottom: 6px;
  border-bottom: 1px solid var(--border);
}
.quick__item {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 30px;
  padding: 0 9px;
  border-radius: 7px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 550;
  transition: all 0.14s ease;
}
.quick__item:hover {
  background: var(--bg-hover);
  color: var(--text);
}
.quick__item--on {
  background: var(--brand-soft);
  color: var(--brand);
}
.quick__badge {
  margin-left: auto;
  min-width: 18px;
  height: 17px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--orange);
  color: #fff;
  font-size: 10.5px;
  font-weight: 700;
  line-height: 17px;
  text-align: center;
}

/* ---- 导航 ---- */
.sidebar__nav {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 12px;
}
.group {
  margin-bottom: 2px;
}
.group__head {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  height: 32px;
  padding: 0 8px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  text-align: left;
}
.group__head:hover {
  background: var(--bg-hover);
}
.group__arrow {
  color: var(--text-muted);
  transition: transform 0.18s ease;
  flex-shrink: 0;
}
.group__arrow--open {
  transform: rotate(90deg);
}
.group__name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.group__name--active {
  color: var(--brand);
}
.group__count {
  padding: 0 5px;
  height: 16px;
  line-height: 16px;
  border-radius: 5px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 500;
}

.group__list {
  margin: 1px 0 4px;
  padding: 0 0 0 14px;
  list-style: none;
  border-left: 1px solid var(--border);
  margin-left: 14px;
}
.item {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 8px;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 12.5px;
  transition: background-color 0.12s ease, color 0.12s ease;
}
.item:hover {
  background: var(--bg-hover);
  color: var(--text);
}
.item--overview {
  color: var(--text-muted);
  font-size: 12px;
}
.item--active {
  background: var(--brand-soft);
  color: var(--brand);
  font-weight: 600;
}
.item__title {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.item__right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  opacity: 0.9;
}
.item__done {
  color: var(--green);
}
.item__marked {
  color: var(--orange);
}

/* ---- 底部进度 ---- */
.sidebar__foot {
  padding: 10px 14px 14px;
  border-top: 1px solid var(--border);
}
.progress__bar {
  height: 4px;
  border-radius: 4px;
  background: var(--bg-subtle);
  overflow: hidden;
}
.progress__fill {
  display: block;
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--brand), #7c5cff);
  transition: width 0.3s ease;
}
.progress__text {
  display: block;
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-muted);
}

/* ---- 移动端抽屉 ---- */
@media (max-width: 900px) {
  .sidebar {
    transform: translateX(-100%);
    transition: transform 0.24s ease;
    box-shadow: var(--shadow-lg);
    width: 82vw;
    max-width: 320px;
  }
  .sidebar--open {
    transform: translateX(0);
  }
  .sidebar__close {
    display: inline-flex;
  }
}
</style>
