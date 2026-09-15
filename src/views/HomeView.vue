<script setup lang="ts">
/**
 * 首页：题库总览
 * 1. 顶部 Hero：题目总数 / 技术栈数量 / 已掌握进度 / 随机一题
 * 2. 分类卡片：点进去看该技术栈的所有题目
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, Shuffle, BookOpen, Layers, Target, Play, BookMarked } from 'lucide-vue-next'
import CategoryIcon from '@/components/CategoryIcon.vue'
import { categoryStats, allQuestions, totalQuestions, totalCategories } from '@/data'
import { useProgress } from '@/composables/useProgress'
import { useReview } from '@/composables/useReview'

const router = useRouter()
const { masteredCount } = useProgress()
const { reviewCount } = useReview()

const percent = computed(() =>
  totalQuestions ? Math.round((masteredCount.value / totalQuestions) * 100) : 0,
)

/** 随机抽一题，模拟真实面试的「随机提问」 */
function randomQuestion(): void {
  const hit = allQuestions[Math.floor(Math.random() * allQuestions.length)]
  if (hit) router.push(`/q/${hit.question.id}`)
}
</script>

<template>
  <div class="home fade-up">
    <!-- ---- Hero ---- -->
    <section class="hero">
      <h1 class="hero__title">前端高频面试题 · 实战手册</h1>
      <p class="hero__desc">
        每一道题都配齐三样东西：<b>能直接说出口的口语化回答</b>、<b>带逐行注释的真实示例</b>、<b>完整的实现过程拆解</b>。
        按技术栈分好组，刷到哪算哪，进度自动保存。
      </p>

      <div class="hero__stats">
        <div class="stat">
          <BookOpen :size="16" />
          <div>
            <b>{{ totalQuestions }}</b>
            <span>道高频题</span>
          </div>
        </div>
        <div class="stat">
          <Layers :size="16" />
          <div>
            <b>{{ totalCategories }}</b>
            <span>个技术栈</span>
          </div>
        </div>
        <div class="stat">
          <Target :size="16" />
          <div>
            <b>{{ percent }}%</b>
            <span>已掌握进度</span>
          </div>
        </div>
        <button class="btn btn--primary hero__start" type="button" @click="router.push('/mock')">
          <Play :size="15" />
          开始模拟面试
        </button>
        <button class="btn" type="button" @click="randomQuestion">
          <Shuffle :size="15" />
          随机抽一题
        </button>
      </div>

      <RouterLink v-if="reviewCount" to="/review" class="hero__review">
        <BookMarked :size="14" />
        复习清单里还有 {{ reviewCount }} 道没答上来的题
        <ArrowRight :size="13" />
      </RouterLink>
    </section>

    <!-- ---- 分类 ---- -->
    <section class="cats">
      <div class="section-title">
        <i class="section-title__bar" />
        按技术栈浏览
        <span class="section-title__hint">点卡片进入该分类的题目列表</span>
      </div>

      <div class="cats__grid">
        <RouterLink
          v-for="cat in categoryStats"
          :key="cat.id"
          :to="`/c/${cat.id}`"
          class="cat"
          :style="{ '--cat-color': cat.color }"
        >
          <div class="cat__top">
            <span class="cat__icon">
              <CategoryIcon :name="cat.icon" :size="17" :color="cat.color" />
            </span>
            <span class="cat__count">{{ cat.count }}</span>
          </div>
          <b class="cat__name">{{ cat.name }}</b>
          <i class="cat__en">{{ cat.en }}</i>
          <p class="cat__desc">{{ cat.desc }}</p>
          <span class="cat__more">查看题目 <ArrowRight :size="13" /></span>
        </RouterLink>
      </div>
    </section>

    <!-- ---- 使用说明 ---- -->
    <section class="guide card">
      <div class="section-title"><i class="section-title__bar" />怎么用这份手册</div>
      <ol class="guide__list">
        <li><b>先看「口述回答」</b>：这是面试现场能直接说出口的话，注意它的结构（结论 → 原理 → 举例 → 边界）。</li>
        <li><b>再看「真实示例」</b>：每段代码都有逐行注释，动手敲一遍，把注释改成自己的理解。</li>
        <li><b>最后看「追问」</b>：面试官顺着答案往下挖的点，往往才是真正决定评级的地方。</li>
        <li><b>点右侧频率点</b>：三星标红的题属于必问题，时间不够就优先刷这些。</li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

/* ---- Hero ---- */
.hero {
  padding: 26px 24px;
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, var(--bg-panel) 0%, var(--brand-soft) 130%);
  border: 1px solid var(--border);
}
.hero__title {
  font-size: 24px;
  letter-spacing: -0.01em;
  color: var(--text);
}
.hero__desc {
  max-width: 620px;
  margin: 10px 0 20px;
  font-size: 13.5px;
  line-height: 1.85;
  color: var(--text-secondary);
}
.hero__desc b {
  color: var(--brand);
  font-weight: 600;
}
.hero__stats {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px 26px;
}
.stat {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--brand);
}
.stat div {
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.stat b {
  font-size: 19px;
  color: var(--text);
}
.stat span {
  font-size: 12px;
  color: var(--text-muted);
}
.hero__start {
  margin-left: auto;
}
.hero__review {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 14px;
  padding: 6px 11px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--orange) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--orange) 30%, transparent);
  color: var(--orange);
  font-size: 12.5px;
  font-weight: 550;
}
.hero__review:hover {
  background: color-mix(in srgb, var(--orange) 18%, transparent);
}

/* ---- 分类网格 ---- */
.cats__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(214px, 1fr));
  gap: 12px;
}
.cat {
  display: flex;
  flex-direction: column;
  padding: 14px 15px 12px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-panel);
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
}
.cat:hover {
  transform: translateY(-2px);
  border-color: var(--cat-color);
  box-shadow: var(--shadow-md);
}
.cat__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.cat__icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: color-mix(in srgb, var(--cat-color) 12%, transparent);
}
.cat__count {
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.cat__name {
  font-size: 14.5px;
  color: var(--text);
}
.cat__en {
  font-size: 11px;
  font-style: normal;
  color: var(--text-muted);
  letter-spacing: 0.02em;
}
.cat__desc {
  flex: 1;
  margin: 8px 0 10px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.cat__more {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--cat-color);
  font-weight: 500;
}

/* ---- 说明 ---- */
.guide {
  padding: 18px 20px;
}
.guide__list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.95;
  color: var(--text-secondary);
}
.guide__list b {
  color: var(--text);
  font-weight: 600;
}

@media (max-width: 900px) {
  .hero__start {
    margin-left: 0;
  }
  .hero__title {
    font-size: 20px;
  }
}
</style>
