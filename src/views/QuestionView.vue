<script setup lang="ts">
/**
 * 单题详情页 —— 整个手册的核心页面
 * ------------------------------------------------------------------
 * 一条题目被拆成两个视角，用 Tab 切换：
 *   1) 口述回答：面试官原话 + 能直接说出口的回答 + 采分点 + 追问
 *   2) 真实示例：实现过程拆解 + 带逐行注释的可运行代码
 * 底部还有「上一题 / 下一题」，方便按顺序刷。
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookMarked,
  Check,
  Circle,
  Code2,
  Copy,
  Lightbulb,
  ListChecks,
  MessageSquareQuote,
  Route,
} from 'lucide-vue-next'
import CategoryIcon from '@/components/CategoryIcon.vue'
import FreqDots from '@/components/FreqDots.vue'
import { getQuestion, getSiblings } from '@/data'
import { renderMarkdown, toPlainText } from '@/utils/markdown'
import { useProgress } from '@/composables/useProgress'
import { useReview } from '@/composables/useReview'

const props = defineProps<{ questionId: string }>()

const route = useRoute()
const router = useRouter()
const { isMastered, toggle } = useProgress()
const { isInReview, toggleReview } = useReview()

const hit = computed(() => getQuestion(props.questionId))
const question = computed(() => hit.value?.question)
const category = computed(() => hit.value?.category)
const siblings = computed(() => getSiblings(props.questionId))

/**
 * Tab 状态直接和 URL 查询参数绑定：?tab=code
 * 好处是「把代码示例那一页直接分享给别人」时对方打开就是同一个页签，
 * 刷新页面也不会跳回口述回答。
 */
const tab = computed<'oral' | 'code'>({
  get: () => (route.query.tab === 'code' ? 'code' : 'oral'),
  set: (value) => {
    router.replace({
      query: value === 'code' ? { ...route.query, tab: 'code' } : {},
    })
  },
})

const oralHtml = computed(() => renderMarkdown(question.value?.oral ?? ''))
const exampleHtml = computed(() => renderMarkdown(question.value?.example ?? ''))

/** 已掌握按钮的文案 */
const mastered = computed(() => (question.value ? isMastered(question.value.id) : false))

/** 复制口述回答（转成纯文本，方便丢进笔记） */
const copied = ref(false)
async function copyOral(): Promise<void> {
  if (!question.value) return
  const text = toPlainText(question.value.oral, 4000)
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    window.setTimeout(() => (copied.value = false), 1600)
  } catch {
    copied.value = false
  }
}

/** 分类内序号，显示成 03 / 12 这种 */
const positionText = computed(() => {
  if (!question.value || !category.value) return ''
  const idx = category.value.items.findIndex((item) => item.id === question.value?.id)
  return `${String(idx + 1).padStart(2, '0')} / ${String(category.value.items.length).padStart(2, '0')}`
})
</script>

<template>
  <div v-if="question && category" :key="route.fullPath" class="q-view fade-up">
    <!-- ---- 面包屑 ---- -->
    <nav class="crumb">
      <RouterLink to="/">题库</RouterLink>
      <span>/</span>
      <RouterLink :to="`/c/${category.id}`">{{ category.name }}</RouterLink>
      <span>/</span>
      <em>{{ question.title }}</em>
    </nav>

    <!-- ---- 标题区 ---- -->
    <header class="q-head">
      <div class="q-head__badges">
        <span class="chip" :style="{ color: category.color }">
          <CategoryIcon :name="category.icon" :size="12" :color="category.color" />
          {{ category.name }}
        </span>
        <span class="chip">{{ question.level }}</span>
        <FreqDots :freq="question.freq" show-text />
        <span class="q-head__pos">{{ positionText }}</span>
      </div>

      <h1 class="q-head__title">{{ question.title }}</h1>

      <div class="q-head__tags">
        <span v-for="tag in question.tags" :key="tag" class="chip chip--plain">#{{ tag }}</span>
      </div>

      <div class="q-head__actions">
        <button
          class="btn"
          :class="{ 'btn--done': mastered }"
          type="button"
          @click="toggle(question.id)"
        >
          <Check v-if="mastered" :size="14" />
          <Circle v-else :size="14" />
          {{ mastered ? '已掌握' : '标记为已掌握' }}
        </button>
        <button
          class="btn"
          :class="{ 'btn--review': isInReview(question.id) }"
          type="button"
          :title="
            isInReview(question.id)
              ? '已在复习清单里，点击移出'
              : '加进复习清单，方便集中二刷'
          "
          @click="toggleReview(question.id)"
        >
          <BookMarked :size="14" />
          {{ isInReview(question.id) ? '已在复习清单' : '加入复习清单' }}
        </button>
      </div>
    </header>

    <!-- ---- Tab ---- -->
    <div class="tabs">
      <button
        class="tab"
        :class="{ 'tab--active': tab === 'oral' }"
        type="button"
        @click="tab = 'oral'"
      >
        <MessageSquareQuote :size="15" />
        口述回答
        <span class="tab__hint">面试现场怎么说</span>
      </button>
      <button
        class="tab"
        :class="{ 'tab--active': tab === 'code' }"
        type="button"
        @click="tab = 'code'"
      >
        <Code2 :size="15" />
        真实示例
        <span class="tab__hint">代码 + 实现过程</span>
      </button>
    </div>

    <!-- ================= 口述回答 ================= -->
    <div v-show="tab === 'oral'" class="pane">
      <!-- 面试官提问 -->
      <section class="block block--ask">
        <div class="section-title">
          <i class="section-title__bar" />
          面试官这样问
        </div>
        <p class="ask">{{ question.ask }}</p>
      </section>

      <!-- 口语化回答 -->
      <section class="block">
        <div class="section-title">
          <i class="section-title__bar" />
          我会这样回答
          <span class="section-title__hint">结论先行 · 原理跟上 · 举例收尾</span>
          <button class="btn copy-oral" type="button" @click="copyOral">
            <Copy :size="13" />
            {{ copied ? '已复制' : '复制这段回答' }}
          </button>
        </div>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="md-body" v-html="oralHtml" />
      </section>

      <!-- 采分点 -->
      <section v-if="question.points.length" class="block block--points">
        <div class="section-title">
          <i class="section-title__bar" />
          <ListChecks :size="15" />
          必须踩到的采分点
        </div>
        <ul class="points">
          <li v-for="(point, i) in question.points" :key="i">
            <span class="points__num">{{ i + 1 }}</span>
            <span>{{ point }}</span>
          </li>
        </ul>
      </section>

      <!-- 追问 -->
      <section v-if="question.followups?.length" class="block block--follow">
        <div class="section-title">
          <i class="section-title__bar" />
          <AlertTriangle :size="15" />
          面试官可能追问 / 常见的坑
        </div>
        <ul class="follows">
          <li v-for="(item, i) in question.followups" :key="i">{{ item }}</li>
        </ul>
      </section>
    </div>

    <!-- ================= 真实示例 ================= -->
    <div v-show="tab === 'code'" class="pane">
      <!-- 实现过程 -->
      <section v-if="question.steps.length" class="block">
        <div class="section-title">
          <i class="section-title__bar" />
          <Route :size="15" />
          实现过程
          <span class="section-title__hint">从思路到落地的顺序</span>
        </div>
        <ol class="steps">
          <li v-for="(step, i) in question.steps" :key="i">
            <span class="steps__dot">{{ i + 1 }}</span>
            <span class="steps__text">{{ step }}</span>
          </li>
        </ol>
      </section>

      <!-- 示例代码 -->
      <section class="block">
        <div class="section-title">
          <i class="section-title__bar" />
          <Lightbulb :size="15" />
          真实示例（含详细注释）
          <span class="section-title__hint">建议动手敲一遍</span>
        </div>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="md-body" v-html="exampleHtml" />
      </section>

      <!-- 延伸阅读 -->
      <section v-if="question.refs?.length" class="block">
        <div class="section-title"><i class="section-title__bar" />延伸阅读</div>
        <ul class="follows">
          <li v-for="(ref, i) in question.refs" :key="i">{{ ref }}</li>
        </ul>
      </section>
    </div>

    <!-- ---- 上一题 / 下一题 ---- -->
    <nav class="pager">
      <RouterLink v-if="siblings.prev" :to="`/q/${siblings.prev.question.id}`" class="pager__item">
        <ArrowLeft :size="15" />
        <span class="pager__text">
          <i>上一题</i>
          <b>{{ siblings.prev.question.title }}</b>
        </span>
      </RouterLink>
      <span v-else class="pager__item pager__item--disabled">
        <ArrowLeft :size="15" />
        <span class="pager__text"><i>已经是第一题</i></span>
      </span>

      <RouterLink v-if="siblings.next" :to="`/q/${siblings.next.question.id}`" class="pager__item pager__item--next">
        <span class="pager__text">
          <i>下一题</i>
          <b>{{ siblings.next.question.title }}</b>
        </span>
        <ArrowRight :size="15" />
      </RouterLink>
      <span v-else class="pager__item pager__item--next pager__item--disabled">
        <span class="pager__text"><i>已经是最后一题</i></span>
        <ArrowRight :size="15" />
      </span>
    </nav>
  </div>

  <div v-else class="empty">
    没有找到这道题
    <p><RouterLink to="/" class="crumb-link">返回题库首页</RouterLink></p>
  </div>
</template>

<style scoped>
.q-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ---- 面包屑 ---- */
.crumb {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--text-muted);
}
.crumb a:hover {
  color: var(--brand);
}
.crumb em {
  font-style: normal;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 320px;
}
.crumb-link {
  color: var(--brand);
}

/* ---- 标题 ---- */
.q-head {
  padding-bottom: 4px;
}
.q-head__badges {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.q-head__pos {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}
.q-head__title {
  margin: 10px 0 8px;
  font-size: 22px;
  line-height: 1.45;
  letter-spacing: -0.01em;
  color: var(--text);
}
.q-head__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.q-head__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.btn--done {
  border-color: var(--green);
  color: var(--green);
  background: color-mix(in srgb, var(--green) 10%, transparent);
}
.btn--review {
  border-color: var(--orange);
  color: var(--orange);
  background: color-mix(in srgb, var(--orange) 10%, transparent);
}

/* ---- Tab ---- */
.tabs {
  display: flex;
  gap: 6px;
  padding: 4px;
  border-radius: 10px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
}
.tab {
  display: flex;
  align-items: center;
  gap: 7px;
  flex: 1;
  height: 38px;
  padding: 0 12px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 550;
  transition: all 0.15s ease;
}
.tab:hover {
  color: var(--text);
}
.tab--active {
  background: var(--bg-panel);
  color: var(--brand);
  box-shadow: var(--shadow-sm);
}
.tab__hint {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-muted);
}

/* ---- 区块 ---- */
.pane {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.block {
  padding: 18px 20px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-panel);
}
.block--ask {
  background: linear-gradient(135deg, var(--bg-panel), var(--brand-soft));
  border-color: color-mix(in srgb, var(--brand) 25%, var(--border));
}
.ask {
  margin: 0;
  font-size: 15px;
  line-height: 1.8;
  color: var(--text);
  font-weight: 500;
}
.copy-oral {
  margin-left: auto;
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
}

/* ---- 采分点 ---- */
.points {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.points li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13.5px;
  line-height: 1.75;
  color: var(--text-secondary);
}
.points__num {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  margin-top: 2px;
  border-radius: 6px;
  background: var(--brand-soft);
  color: var(--brand);
  font-size: 11px;
  font-weight: 700;
}

/* ---- 追问 ---- */
.follows {
  margin: 0;
  padding-left: 18px;
  font-size: 13.5px;
  line-height: 1.8;
  color: var(--text-secondary);
}
.follows li {
  margin-bottom: 7px;
}
.follows li::marker {
  color: var(--orange);
}

/* ---- 步骤 ---- */
.steps {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
}
.steps li {
  position: relative;
  display: flex;
  gap: 12px;
  padding-bottom: 14px;
}
.steps li:last-child {
  padding-bottom: 0;
}
.steps li::before {
  content: '';
  position: absolute;
  top: 22px;
  left: 10px;
  bottom: 0;
  width: 1px;
  background: var(--border);
}
.steps li:last-child::before {
  display: none;
}
.steps__dot {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 21px;
  height: 21px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--brand-soft);
  border: 1px solid color-mix(in srgb, var(--brand) 35%, transparent);
  color: var(--brand);
  font-size: 11px;
  font-weight: 700;
}
.steps__text {
  padding-top: 1px;
  font-size: 13.5px;
  line-height: 1.75;
  color: var(--text-secondary);
}

/* ---- 上下题 ---- */
.pager {
  display: flex;
  gap: 10px;
  margin-top: 6px;
}
.pager__item {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
  padding: 12px 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-panel);
  color: var(--text-secondary);
  transition: all 0.15s ease;
}
.pager__item:hover {
  border-color: var(--brand);
  color: var(--brand);
}
.pager__item--next {
  justify-content: flex-end;
  text-align: right;
}
.pager__item--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.pager__item--disabled:hover {
  border-color: var(--border);
  color: var(--text-muted);
}
.pager__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.pager__text i {
  font-size: 11px;
  font-style: normal;
  color: var(--text-muted);
}
.pager__text b {
  font-size: 13px;
  font-weight: 550;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

@media (max-width: 700px) {
  .q-head__title {
    font-size: 18px;
  }
  .tab__hint {
    display: none;
  }
  .pager {
    flex-direction: column;
  }
  .block {
    padding: 14px;
  }
}
</style>
