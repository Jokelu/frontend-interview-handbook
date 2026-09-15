<script setup lang="ts">
/**
 * 复习清单
 * ------------------------------------------------------------------
 * 模拟面试里「没答上来」的题会自动进这里。
 * 支持按技术栈分组浏览、标记已掌握（顺手从清单里移除）、一键清空。
 */
import { computed } from 'vue'
import { ArrowRight, Check, Play, Trash2 } from 'lucide-vue-next'
import CategoryIcon from '@/components/CategoryIcon.vue'
import FreqDots from '@/components/FreqDots.vue'
import { allQuestions, type SearchHit } from '@/data'
import { useReview } from '@/composables/useReview'
import { useProgress } from '@/composables/useProgress'

const { reviewIds, reviewCount, removeFromReview, clearReview } = useReview()
const { isMastered, markMastered } = useProgress()

/** 按分类分组，方便按技术栈集中突破 */
const groups = computed(() => {
  const map = new Map<string, { name: string; color: string; icon: string; items: SearchHit[] }>()
  for (const id of reviewIds.value) {
    const hit = allQuestions.find((row) => row.question.id === id)
    if (!hit) continue // 题目被删掉时不会白屏
    const entry = map.get(hit.category.id) ?? {
      name: hit.category.name,
      color: hit.category.color,
      icon: hit.category.icon,
      items: [],
    }
    entry.items.push(hit)
    map.set(hit.category.id, entry)
  }
  // 题多的分类排前面，优先攻克大头
  return [...map.entries()].map(([id, value]) => ({ id, ...value })).sort((a, b) => b.items.length - a.items.length)
})

/** 标记已掌握并顺手移出复习清单，一步到位 */
function finish(hit: SearchHit): void {
  if (!isMastered(hit.question.id)) markMastered(hit.question.id)
  removeFromReview(hit.question.id)
}
</script>

<template>
  <div class="review fade-up">
    <header class="rv-head">
      <h1 class="rv-head__title">复习清单</h1>
      <p class="rv-head__desc">
        模拟面试里没答上来的题会自动收到这里。二刷之后点「已掌握」，就会从清单里移走。
      </p>
    </header>

    <div v-if="reviewCount" class="rv-bar">
      <span class="rv-bar__count">共 {{ reviewCount }} 道待复习</span>
      <button class="mini-btn" type="button" @click="clearReview">
        <Trash2 :size="12" />
        清空清单
      </button>
    </div>

    <template v-if="reviewCount">
      <section v-for="group in groups" :key="group.id" class="card group">
        <div class="group__head">
          <CategoryIcon :name="group.icon" :size="15" :color="group.color" />
          <b :style="{ color: group.color }">{{ group.name }}</b>
          <span class="group__n">{{ group.items.length }} 题</span>
          <RouterLink :to="`/c/${group.id}`" class="group__more">
            去该分类 <ArrowRight :size="12" />
          </RouterLink>
        </div>
        <ul class="group__list">
          <li v-for="hit in group.items" :key="hit.question.id" class="row">
            <RouterLink :to="`/q/${hit.question.id}`" class="row__main">
              <span class="row__title">{{ hit.question.title }}</span>
              <span class="row__meta">
                <span class="chip chip--plain">{{ hit.question.level }}</span>
                <FreqDots :freq="hit.question.freq" />
              </span>
            </RouterLink>
            <div class="row__ops">
              <button class="mini-btn mini-btn--ok" type="button" @click="finish(hit)">
                <Check :size="12" />
                已掌握
              </button>
              <button class="mini-btn" type="button" @click="removeFromReview(hit.question.id)">
                移出
              </button>
            </div>
          </li>
        </ul>
      </section>
    </template>

    <div v-else class="empty card">
      <p>清单是空的。</p>
      <p class="empty__tip">去「模拟面试」答一轮，没答上来的题会自动收集到这里。</p>
      <RouterLink to="/mock" class="btn btn--primary">
        <Play :size="15" />
        开始模拟面试
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.review {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.rv-head__title {
  font-size: 22px;
  color: var(--text);
}
.rv-head__desc {
  margin: 8px 0 0;
  font-size: 13.5px;
  line-height: 1.85;
  color: var(--text-secondary);
  max-width: 620px;
}
.rv-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-radius: var(--radius);
  border: 1px solid color-mix(in srgb, var(--orange) 30%, var(--border));
  background: color-mix(in srgb, var(--orange) 8%, transparent);
}
.rv-bar__count {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}
.mini-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-panel);
  color: var(--text-secondary);
  font-size: 12px;
  transition: all 0.14s ease;
}
.mini-btn:hover {
  border-color: var(--brand);
  color: var(--brand);
}
.mini-btn--ok:hover {
  border-color: var(--green);
  color: var(--green);
  background: color-mix(in srgb, var(--green) 10%, transparent);
}

.group {
  padding: 14px 16px;
}
.group__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 10px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.group__head b {
  font-size: 13.5px;
}
.group__n {
  font-size: 11.5px;
  color: var(--text-muted);
}
.group__more {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11.5px;
  color: var(--text-muted);
}
.group__more:hover {
  color: var(--brand);
}
.group__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  border-bottom: 1px dashed var(--border);
}
.row:last-child {
  border-bottom: none;
}
.row__main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}
.row__title {
  flex: 1;
  font-size: 13.5px;
  color: var(--text);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.row__main:hover .row__title {
  color: var(--brand);
}
.row__meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.row__ops {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.empty {
  padding: 48px 20px;
  text-align: center;
}
.empty p {
  font-size: 13.5px;
  color: var(--text-secondary);
}
.empty__tip {
  margin-bottom: 16px !important;
  font-size: 12.5px !important;
  color: var(--text-muted) !important;
}

@media (max-width: 700px) {
  .row {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
  .row__ops {
    align-self: flex-end;
  }
}
</style>
