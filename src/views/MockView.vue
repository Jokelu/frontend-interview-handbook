<script setup lang="ts">
/**
 * 模拟面试
 * ------------------------------------------------------------------
 * 三个阶段：
 *   setup   → 选范围（哪些技术栈）、题量、每题限时
 *   running → 只给题干，不显示答案；自己先讲一遍，再揭晓对照
 *   report  → 统计用时、掌握率、按技术栈找弱项，错题自动进复习清单
 *
 * 为什么只给题干不给选项？真实的面试就是这样：先让你说，再深挖。
 * 「先口述、后对照」这个顺序，才是真正练表达的方式。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  ArrowRight,
  Check,
  Clock,
  ListChecks,
  Play,
  RotateCcw,
  Send,
  Target,
  TriangleAlert,
  X,
} from 'lucide-vue-next'
import CategoryIcon from '@/components/CategoryIcon.vue'
import FreqDots from '@/components/FreqDots.vue'
import { allQuestions, categories, type SearchHit } from '@/data'
import { renderMarkdown } from '@/utils/markdown'
import { useReview } from '@/composables/useReview'

type Phase = 'setup' | 'running' | 'report'

const { addToReview, reviewCount } = useReview()
const route = useRoute()

// ---------------- 配置 ----------------
const phase = ref<Phase>('setup')

/** 默认全选，但保留「只挑几个技术栈专项突击」的能力 */
const selectedCategories = ref<string[]>(categories.map((item) => item.id))

const COUNT_OPTIONS = [5, 8, 12, 20]
const questionCount = ref(8)

/** 每题限时（秒），0 = 不限时 */
const TIME_OPTIONS = [
  { label: '不限时', value: 0 },
  { label: '1 分钟', value: 60 },
  { label: '2 分钟', value: 120 },
  { label: '3 分钟', value: 180 },
]
const timeLimit = ref(0)

const availableCount = computed(() =>
  allQuestions.filter((hit) => selectedCategories.value.includes(hit.category.id)).length,
)

function toggleCategory(id: string): void {
  selectedCategories.value = selectedCategories.value.includes(id)
    ? selectedCategories.value.filter((item) => item !== id)
    : [...selectedCategories.value, id]
}

// ---------------- 运行时状态 ----------------
const queue = ref<SearchHit[]>([])
const cursor = ref(0)
const revealed = ref(false)
const results = ref<{ id: string; ok: boolean }[]>([])
const elapsed = ref(0)
const remain = ref(0)
const startedAt = ref(0)

let timer: number | undefined

const current = computed(() => queue.value[cursor.value])
const oralHtml = computed(() => renderMarkdown(current.value?.question.oral ?? ''))

/** 只显示本题所属分类里最后一张卡片，避免一开始就翻到答案 */
const progressPercent = computed(() =>
  queue.value.length ? ((cursor.value + (revealed.value ? 1 : 0)) / queue.value.length) * 100 : 0,
)

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m} 分 ${String(s).padStart(2, '0')} 秒` : `${s} 秒`
}

function startTimer(): void {
  stopTimer()
  timer = window.setInterval(() => {
    elapsed.value += 1
    if (startedAt.value && elapsed.value >= 3 * 3600) stopTimer() // 兜底，防止开着页面忘了关
    if (timeLimit.value > 0 && !revealed.value) {
      remain.value -= 1
      if (remain.value <= 0) {
        remain.value = 0
        revealed.value = true // 到点自动揭晓，但不算答对
      }
    }
  }, 1000)
}

function stopTimer(): void {
  if (timer !== undefined) {
    window.clearInterval(timer)
    timer = undefined
  }
}

// ---------------- 流程控制 ----------------
function start(): void {
  const pool = allQuestions.filter((hit) => selectedCategories.value.includes(hit.category.id))
  if (!pool.length) return

  // Fisher–Yates 洗牌，比 sort(() => Math.random() - 0.5) 均匀
  const shuffled = [...pool]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  queue.value = shuffled.slice(0, Math.min(questionCount.value, shuffled.length))
  cursor.value = 0
  revealed.value = false
  results.value = []
  elapsed.value = 0
  remain.value = timeLimit.value
  startedAt.value = Date.now()
  phase.value = 'running'
  startTimer()
}

function reveal(): void {
  revealed.value = true
  if (timeLimit.value > 0) remain.value = 0
}

function answer(ok: boolean): void {
  const hit = current.value
  if (!hit) return

  results.value = [...results.value, { id: hit.question.id, ok }]
  // 没答上来的直接进复习清单，不用手动记
  if (!ok) addToReview(hit.question.id)

  if (cursor.value >= queue.value.length - 1) {
    stopTimer()
    phase.value = 'report'
    return
  }
  cursor.value += 1
  revealed.value = false
  remain.value = timeLimit.value
}

function restart(): void {
  stopTimer()
  phase.value = 'setup'
  results.value = []
  queue.value = []
  cursor.value = 0
}

/**
 * 支持用链接直接配置并开始一场模拟面试，方便存成书签做专项突击：
 *   /mock?cats=vue,react&count=8&limit=120&start=1
 *   cats  = 技术栈 id，逗号分隔
 *   count = 题量（必须是预设的档位）
 *   limit = 每题限时秒数，0 表示不限时
 *   start = 1 表示打开后立刻开始
 */
onMounted(() => {
  const query = route.query

  if (typeof query.cats === 'string' && query.cats.trim()) {
    const ids = query.cats
      .split(',')
      .map((id) => id.trim())
      .filter((id) => categories.some((category) => category.id === id))
    if (ids.length) selectedCategories.value = ids
  }

  const count = Number(query.count)
  if (COUNT_OPTIONS.includes(count)) questionCount.value = count

  const limit = Number(query.limit)
  if (TIME_OPTIONS.some((option) => option.value === limit)) timeLimit.value = limit

  if (query.start === '1' && availableCount.value) start()
})

onBeforeUnmount(stopTimer)

// ---------------- 报告 ----------------
const okCount = computed(() => results.value.filter((item) => item.ok).length)
const accuracy = computed(() =>
  results.value.length ? Math.round((okCount.value / results.value.length) * 100) : 0,
)

/** 按技术栈统计没答上来的题，找出真正的弱项 */
const weakCategories = computed(() => {
  const map = new Map<string, { name: string; color: string; icon: string; total: number; failed: number }>()
  for (const item of results.value) {
    const hit = allQuestions.find((row) => row.question.id === item.id)
    if (!hit) continue
    const entry = map.get(hit.category.id) ?? {
      name: hit.category.name,
      color: hit.category.color,
      icon: hit.category.icon,
      total: 0,
      failed: 0,
    }
    entry.total += 1
    if (!item.ok) entry.failed += 1
    map.set(hit.category.id, entry)
  }
  return [...map.entries()]
    .map(([id, value]) => ({ id, ...value }))
    .filter((entry) => entry.failed > 0)
    .sort((a, b) => b.failed / b.total - a.failed / a.total)
})

const failedQuestions = computed(() =>
  results.value
    .filter((item) => !item.ok)
    .map((item) => allQuestions.find((row) => row.question.id === item.id))
    .filter((hit): hit is SearchHit => Boolean(hit)),
)
</script>

<template>
  <div class="mock fade-up">
    <!-- ================= 配置 ================= -->
    <template v-if="phase === 'setup'">
      <header class="mock-head">
        <h1 class="mock-head__title">模拟面试</h1>
        <p class="mock-head__desc">
          只给题干、不给答案。先自己开口讲一遍，再揭晓对照 —— 这才是面试现场真正的顺序。
          到点自动揭晓，没答上来的题目会直接进复习清单。
        </p>
      </header>

      <section class="card panel">
        <div class="section-title">
          <i class="section-title__bar" />
          面试范围
          <span class="section-title__hint">已选 {{ selectedCategories.length }} 个技术栈 / {{ availableCount }} 道题</span>
          <div class="panel__actions">
            <button class="mini-btn" type="button" @click="selectedCategories = categories.map((c) => c.id)">
              全选
            </button>
            <button class="mini-btn" type="button" @click="selectedCategories = []">清空</button>
          </div>
        </div>
        <div class="cats">
          <button
            v-for="cat in categories"
            :key="cat.id"
            class="cat"
            :class="{ 'cat--on': selectedCategories.includes(cat.id) }"
            :style="{ '--cat-color': cat.color }"
            type="button"
            @click="toggleCategory(cat.id)"
          >
            <CategoryIcon :name="cat.icon" :size="14" :color="selectedCategories.includes(cat.id) ? cat.color : 'currentColor'" />
            {{ cat.name }}
            <span class="cat__n">{{ cat.items.length }}</span>
          </button>
        </div>
      </section>

      <div class="panel-row">
        <section class="card panel">
          <div class="section-title"><i class="section-title__bar" />题量</div>
          <div class="radios">
            <button
              v-for="n in COUNT_OPTIONS"
              :key="n"
              class="radio"
              :class="{ 'radio--on': questionCount === n }"
              type="button"
              @click="questionCount = n"
            >
              {{ n }} 题
            </button>
          </div>
        </section>

        <section class="card panel">
          <div class="section-title"><i class="section-title__bar" />每题限时</div>
          <div class="radios">
            <button
              v-for="opt in TIME_OPTIONS"
              :key="opt.value"
              class="radio"
              :class="{ 'radio--on': timeLimit === opt.value }"
              type="button"
              @click="timeLimit = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </section>
      </div>

      <div class="start-row">
        <button class="btn btn--primary start-btn" type="button" :disabled="!availableCount" @click="start">
          <Play :size="16" />
          开始模拟面试
        </button>
        <span v-if="!availableCount" class="start-row__tip">至少选择一个技术栈</span>
        <RouterLink v-else-if="reviewCount" to="/review" class="start-row__link">
          复习清单里还有 {{ reviewCount }} 道题 <ArrowRight :size="13" />
        </RouterLink>
      </div>
    </template>

    <!-- ================= 答题中 ================= -->
    <template v-else-if="phase === 'running' && current">
      <div class="runner">
        <div class="runner__bar">
          <span class="runner__step">第 {{ cursor + 1 }} / {{ queue.length }} 题</span>
          <div class="runner__track"><span class="runner__fill" :style="{ width: `${progressPercent}%` }" /></div>
          <span class="runner__clock" :class="{ 'runner__clock--warn': timeLimit > 0 && remain <= 15 }">
            <Clock :size="13" />
            {{ timeLimit > 0 ? formatTime(remain) : formatTime(elapsed) }}
          </span>
        </div>

        <section class="card q-card">
          <div class="q-card__meta">
            <span class="chip" :style="{ color: current.category.color }">
              <CategoryIcon :name="current.category.icon" :size="12" :color="current.category.color" />
              {{ current.category.name }}
            </span>
            <span class="chip">{{ current.question.level }}</span>
            <FreqDots :freq="current.question.freq" />
          </div>

          <p class="q-card__ask">{{ current.question.ask }}</p>

          <div v-if="!revealed" class="q-card__hint">
            先别看答案，把回答默念或说出来一遍（结论 → 原理 → 例子 → 边界），再点揭晓。
          </div>
        </section>

        <div v-if="!revealed" class="actions">
          <button class="btn" type="button" @click="reveal">
            <ListChecks :size="15" />
            揭晓答案
          </button>
          <button class="btn" type="button" @click="answer(true)">
            <Check :size="15" />
            我答上来了
          </button>
          <button class="btn" type="button" @click="answer(false)">
            <X :size="15" />
            没答上来
          </button>
        </div>

        <template v-else>
          <section class="card answer">
            <div class="section-title"><i class="section-title__bar" />参考答案</div>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div class="md-body" v-html="oralHtml" />
          </section>

          <section v-if="current.question.points.length" class="card answer">
            <div class="section-title"><i class="section-title__bar" />采分点</div>
            <ul class="points">
              <li v-for="(point, i) in current.question.points" :key="i">
                <span class="points__num">{{ i + 1 }}</span>{{ point }}
              </li>
            </ul>
          </section>

          <section v-if="current.question.followups?.length" class="card answer">
            <div class="section-title"><i class="section-title__bar" />可能被追问</div>
            <ul class="follows">
              <li v-for="(item, i) in current.question.followups" :key="i">{{ item }}</li>
            </ul>
          </section>

          <div class="actions">
            <RouterLink :to="`/q/${current.question.id}`" class="btn">
              看代码示例
              <ArrowRight :size="14" />
            </RouterLink>
            <button class="btn" type="button" @click="answer(true)">
              <Check :size="15" />
              我讲清楚了
            </button>
            <button class="btn" type="button" @click="answer(false)">
              <X :size="15" />
              还没完全会
            </button>
          </div>
        </template>
      </div>
    </template>

    <!-- ================= 报告 ================= -->
    <template v-else-if="phase === 'report'">
      <header class="mock-head">
        <h1 class="mock-head__title">本轮复盘</h1>
        <p class="mock-head__desc">答不上来的题已经放进复习清单了，建议 24 小时内再刷一遍。</p>
      </header>

      <section class="card stats">
        <div class="stat">
          <Target :size="16" />
          <div><b>{{ okCount }} / {{ results.length }}</b><span>讲清楚了</span></div>
        </div>
        <div class="stat">
          <Check :size="16" />
          <div><b>{{ accuracy }}%</b><span>掌握率</span></div>
        </div>
        <div class="stat">
          <Clock :size="16" />
          <div><b>{{ formatTime(elapsed) }}</b><span>总用时</span></div>
        </div>
        <div class="stat">
          <TriangleAlert :size="16" />
          <div><b>{{ failedQuestions.length }}</b><span>进了复习清单</span></div>
        </div>
      </section>

      <section v-if="weakCategories.length" class="card panel">
        <div class="section-title">
          <i class="section-title__bar" />
          弱项分布
          <span class="section-title__hint">按没答上来的比例排序</span>
        </div>
        <ul class="weak">
          <li v-for="entry in weakCategories" :key="entry.id">
            <span class="weak__name">
              <CategoryIcon :name="entry.icon" :size="14" :color="entry.color" />
              {{ entry.name }}
            </span>
            <span class="weak__track">
              <span
                class="weak__fill"
                :style="{ width: `${(entry.failed / entry.total) * 100}%`, background: entry.color }"
              />
            </span>
            <span class="weak__num">{{ entry.failed }} / {{ entry.total }}</span>
          </li>
        </ul>
      </section>

      <section v-if="failedQuestions.length" class="card panel">
        <div class="section-title"><i class="section-title__bar" />这一轮没答上来的题</div>
        <ul class="failed">
          <li v-for="hit in failedQuestions" :key="hit.question.id">
            <RouterLink :to="`/q/${hit.question.id}`" class="failed__item">
              <span class="chip" :style="{ color: hit.category.color }">{{ hit.category.name }}</span>
              <span class="failed__title">{{ hit.question.title }}</span>
              <ArrowRight :size="14" class="failed__arrow" />
            </RouterLink>
          </li>
        </ul>
      </section>

      <p v-else class="all-clear">
        这一轮全部讲清楚了，可以直接去刷别的技术栈了。
      </p>

      <div class="actions">
        <button class="btn btn--primary" type="button" @click="start">
          <RotateCcw :size="15" />
          再来一轮
        </button>
        <button class="btn" type="button" @click="restart">重新配置</button>
        <RouterLink to="/review" class="btn">
          <Send :size="14" />
          去复习清单（{{ reviewCount }}）
        </RouterLink>
      </div>
    </template>
  </div>
</template>

<style scoped>
.mock {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.mock-head__title {
  font-size: 22px;
  color: var(--text);
}
.mock-head__desc {
  margin: 8px 0 0;
  font-size: 13.5px;
  line-height: 1.85;
  color: var(--text-secondary);
  max-width: 640px;
}

/* ---- 配置 ---- */
.panel {
  padding: 16px 18px;
}
.panel__actions {
  margin-left: auto;
  display: flex;
  gap: 6px;
}
.mini-btn {
  height: 24px;
  padding: 0 9px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-panel);
  color: var(--text-secondary);
  font-size: 11.5px;
}
.mini-btn:hover {
  border-color: var(--brand);
  color: var(--brand);
}
.cats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.cat {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 11px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-subtle);
  color: var(--text-secondary);
  font-size: 12.5px;
  transition: all 0.14s ease;
}
.cat:hover {
  border-color: var(--cat-color);
}
.cat--on {
  border-color: var(--cat-color);
  background: color-mix(in srgb, var(--cat-color) 11%, transparent);
  color: var(--text);
  font-weight: 600;
}
.cat__n {
  font-size: 10.5px;
  color: var(--text-muted);
}
.panel-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.radios {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.radio {
  height: 30px;
  padding: 0 12px;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: var(--bg-subtle);
  color: var(--text-secondary);
  font-size: 12.5px;
  transition: all 0.14s ease;
}
.radio:hover {
  border-color: var(--brand);
}
.radio--on {
  border-color: var(--brand);
  background: var(--brand-soft);
  color: var(--brand);
  font-weight: 600;
}
.start-row {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.start-btn {
  height: 40px;
  padding: 0 22px;
  font-size: 14px;
}
.start-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.start-row__tip {
  font-size: 12.5px;
  color: var(--red);
}
.start-row__link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12.5px;
  color: var(--text-muted);
}
.start-row__link:hover {
  color: var(--brand);
}

/* ---- 答题 ---- */
.runner {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.runner__bar {
  display: flex;
  align-items: center;
  gap: 12px;
}
.runner__step {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
}
.runner__track {
  flex: 1;
  height: 4px;
  border-radius: 4px;
  background: var(--border);
  overflow: hidden;
}
.runner__fill {
  display: block;
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--brand), #7c5cff);
  transition: width 0.28s ease;
}
.runner__clock {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  color: var(--text-secondary);
  white-space: nowrap;
}
.runner__clock--warn {
  color: var(--red);
  font-weight: 700;
}
.q-card {
  padding: 24px 22px;
  background: linear-gradient(135deg, var(--bg-panel), var(--brand-soft));
  border-color: color-mix(in srgb, var(--brand) 22%, var(--border));
}
.q-card__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}
.q-card__ask {
  margin: 0;
  font-size: 17px;
  line-height: 1.8;
  font-weight: 550;
  color: var(--text);
}
.q-card__hint {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px dashed color-mix(in srgb, var(--brand) 30%, transparent);
  font-size: 12.5px;
  color: var(--text-muted);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.answer {
  padding: 18px 20px;
}
.points {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.points li {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  font-size: 13.5px;
  line-height: 1.75;
  color: var(--text-secondary);
}
.points__num {
  display: grid;
  place-items: center;
  width: 19px;
  height: 19px;
  flex-shrink: 0;
  margin-top: 2px;
  border-radius: 6px;
  background: var(--brand-soft);
  color: var(--brand);
  font-size: 10.5px;
  font-weight: 700;
}
.follows {
  margin: 0;
  padding-left: 18px;
  font-size: 13.5px;
  line-height: 1.8;
  color: var(--text-secondary);
}

/* ---- 报告 ---- */
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 14px;
  padding: 16px 18px;
}
.stat {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--brand);
}
.stat div {
  display: flex;
  flex-direction: column;
}
.stat b {
  font-size: 17px;
  color: var(--text);
  line-height: 1.3;
}
.stat span {
  font-size: 11.5px;
  color: var(--text-muted);
}
.weak {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.weak li {
  display: flex;
  align-items: center;
  gap: 12px;
}
.weak__name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 150px;
  flex-shrink: 0;
  font-size: 12.5px;
  color: var(--text-secondary);
}
.weak__track {
  flex: 1;
  height: 6px;
  border-radius: 6px;
  background: var(--bg-subtle);
  overflow: hidden;
}
.weak__fill {
  display: block;
  height: 100%;
  border-radius: 6px;
  opacity: 0.85;
}
.weak__num {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--text-muted);
  width: 46px;
  text-align: right;
}
.failed {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.failed__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 11px;
  border-radius: 8px;
  border: 1px solid var(--border);
  transition: all 0.14s ease;
}
.failed__item:hover {
  border-color: var(--brand);
  background: var(--brand-soft);
}
.failed__title {
  flex: 1;
  font-size: 13px;
  color: var(--text);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.failed__arrow {
  color: var(--border-strong);
  flex-shrink: 0;
}
.all-clear {
  padding: 16px 18px;
  border-radius: var(--radius);
  border: 1px solid color-mix(in srgb, var(--green) 35%, var(--border));
  background: color-mix(in srgb, var(--green) 8%, transparent);
  font-size: 13px;
  color: var(--text-secondary);
}

@media (max-width: 760px) {
  .panel-row {
    grid-template-columns: 1fr;
  }
  .q-card__ask {
    font-size: 15.5px;
  }
  .weak__name {
    width: 110px;
  }
}
</style>
