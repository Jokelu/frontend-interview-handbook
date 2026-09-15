<script setup lang="ts">
/**
 * 分类页：展示某个技术栈下的全部题目
 * 顶部显示分类介绍与难度分布，下面按「必问 → 常问 → 偶尔」排序列出题目卡片。
 */
import { computed } from 'vue'
import { ArrowLeft, ArrowRight, Check } from 'lucide-vue-next'
import CategoryIcon from '@/components/CategoryIcon.vue'
import FreqDots from '@/components/FreqDots.vue'
import { getCategory } from '@/data'
import { useProgress } from '@/composables/useProgress'

const props = defineProps<{ categoryId: string }>()

const { isMastered } = useProgress()

const category = computed(() => getCategory(props.categoryId))

/** 频率高的排前面，同频率保持原有顺序（稳定排序） */
const sortedItems = computed(() =>
  [...(category.value?.items ?? [])].sort((a, b) => b.freq - a.freq),
)

const masteredInCategory = computed(
  () => (category.value?.items ?? []).filter((item) => isMastered(item.id)).length,
)

/** 难度分布，用来快速判断这个分类的深浅 */
const levelStats = computed(() => {
  const map = new Map<string, number>()
  for (const item of category.value?.items ?? []) {
    map.set(item.level, (map.get(item.level) ?? 0) + 1)
  }
  return [...map.entries()].map(([level, count]) => ({ level, count }))
})
</script>

<template>
  <div v-if="category" class="cat-view fade-up">
    <RouterLink to="/" class="back"><ArrowLeft :size="14" /> 返回题库首页</RouterLink>

    <!-- 分类头部 -->
    <header class="cat-head" :style="{ '--cat-color': category.color }">
      <span class="cat-head__icon">
        <CategoryIcon :name="category.icon" :size="22" :color="category.color" />
      </span>
      <div class="cat-head__main">
        <h1 class="cat-head__title">
          {{ category.name }}
          <i>{{ category.en }}</i>
        </h1>
        <p class="cat-head__desc">{{ category.desc }}</p>
        <div class="cat-head__meta">
          <span class="chip chip--plain">共 {{ category.items.length }} 题</span>
          <span class="chip chip--plain">已掌握 {{ masteredInCategory }}</span>
          <span v-for="s in levelStats" :key="s.level" class="chip chip--plain">
            {{ s.level }} {{ s.count }}
          </span>
        </div>
      </div>
    </header>

    <!-- 题目列表 -->
    <div class="section-title">
      <i class="section-title__bar" />
      题目列表
      <span class="section-title__hint">按面试出现频率排序</span>
    </div>

    <ul class="q-list">
      <li v-for="(item, index) in sortedItems" :key="item.id">
        <RouterLink :to="`/q/${item.id}`" class="q-item" :class="{ 'q-item--done': isMastered(item.id) }">
          <span class="q-item__index">{{ String(index + 1).padStart(2, '0') }}</span>
          <div class="q-item__body">
            <div class="q-item__title">
              <Check v-if="isMastered(item.id)" :size="13" class="q-item__check" />
              {{ item.title }}
            </div>
            <div class="q-item__tags">
              <span class="chip">{{ item.level }}</span>
              <FreqDots :freq="item.freq" show-text />
              <span v-for="tag in item.tags.slice(0, 3)" :key="tag" class="chip chip--plain">
                #{{ tag }}
              </span>
            </div>
          </div>
          <ArrowRight :size="15" class="q-item__arrow" />
        </RouterLink>
      </li>
    </ul>
  </div>

  <div v-else class="empty">
    没有找到这个分类
    <p><RouterLink to="/" class="back">返回首页</RouterLink></p>
  </div>
</template>

<style scoped>
.cat-view {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.back {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  color: var(--text-muted);
  width: fit-content;
}
.back:hover {
  color: var(--brand);
}

/* ---- 头部 ---- */
.cat-head {
  display: flex;
  gap: 14px;
  padding: 20px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: linear-gradient(
    135deg,
    var(--bg-panel) 0%,
    color-mix(in srgb, var(--cat-color) 9%, var(--bg-panel)) 100%
  );
}
.cat-head__icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 13px;
  background: color-mix(in srgb, var(--cat-color) 14%, transparent);
  flex-shrink: 0;
}
.cat-head__main {
  min-width: 0;
}
.cat-head__title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 20px;
  color: var(--text);
}
.cat-head__title i {
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  color: var(--text-muted);
}
.cat-head__desc {
  margin: 6px 0 10px;
  font-size: 13px;
  line-height: 1.8;
  color: var(--text-secondary);
}
.cat-head__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* ---- 列表 ---- */
.q-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.q-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-panel);
  transition: all 0.15s ease;
}
.q-item:hover {
  border-color: var(--brand);
  box-shadow: var(--shadow-md);
  transform: translateX(2px);
}
.q-item--done {
  border-left: 3px solid var(--green);
}
.q-item__index {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
}
.q-item__body {
  flex: 1;
  min-width: 0;
}
.q-item__title {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 14px;
  font-weight: 550;
  color: var(--text);
}
.q-item__check {
  color: var(--green);
  flex-shrink: 0;
}
.q-item__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}
.q-item__arrow {
  color: var(--border-strong);
  flex-shrink: 0;
}
.q-item:hover .q-item__arrow {
  color: var(--brand);
}
</style>
