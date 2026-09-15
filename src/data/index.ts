/**
 * 题库数据总入口
 * ==================================================================
 * 所有内容都在 src/content/*.md 里，这里用 Vite 的 import.meta.glob
 * 一次性把 markdown 原文读进来（编译期静态分析，会被打进产物），
 * 再交给 parseCategoryFile 解析成类型安全的对象。
 *
 * 新增技术栈的完整步骤：
 *   1. 在 src/content/ 下新建 xxx.md，写好 frontmatter 和题目；
 *   2. 什么都不用改，刷新页面就出现了。
 * ==================================================================
 */
import type { Category, Question, SearchHit } from '@/types'
import { parseCategoryFile, type ParsedCategory } from '@/utils/contentParser'

/**
 * 读取 content 目录下所有 markdown
 * query: '?raw'    → 拿到原始文本而不是编译后的模块
 * import: 'default' → 直接取文件内容字符串
 * eager: true      → 同步导入，页面初始化即可用
 * 下划线开头的文件（如 _template.md）是写作样板，不参与渲染。
 *
 * 支持「一个技术栈拆成多个文件」：只要 frontmatter 里的 id 相同，
 * 就会按 part 字段的顺序合并到同一个菜单分组下，
 * 这样单文件内容过多时可以分开维护。
 */
const modules = import.meta.glob('../content/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** 先按 (order, part) 排序，再按 id 合并 */
const parsedFiles: ParsedCategory[] = Object.entries(modules)
  .filter(([path]) => !/(^|\/)_/.test(path))
  .map(([path, raw]) => parseCategoryFile(path, raw))
  .sort((a, b) => a.order - b.order || a.part - b.part)

const groupedCategories = new Map<string, Category>()

for (const file of parsedFiles) {
  const existing = groupedCategories.get(file.id)
  if (existing) {
    // 同一技术栈的后续分片：只追加题目，元信息沿用第一个文件
    existing.items = [...existing.items, ...file.items]
  } else {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { order, part, ...category } = file
    groupedCategories.set(file.id, category)
  }
}

/** 全部技术栈，顺序即侧边栏顺序 */
export const categories: Category[] = [...groupedCategories.values()]

/** 扁平化的题目列表，带所属分类信息，用于搜索与统计 */
export const allQuestions: SearchHit[] = categories.flatMap((category) =>
  category.items.map((question) => ({ question, category })),
)

/** 题目总数 */
export const totalQuestions = allQuestions.length

/** 分类总数 */
export const totalCategories = categories.length

/** 题目 id → 索引，O(1) 查询 */
const questionIndex = new Map<string, SearchHit>(
  allQuestions.map((hit) => [hit.question.id, hit]),
)

/** 按 id 找分类 */
export function getCategory(categoryId: string): Category | undefined {
  return categories.find((category) => category.id === categoryId)
}

/** 按 id 找题目（含所属分类） */
export function getQuestion(questionId: string): SearchHit | undefined {
  return questionIndex.get(questionId)
}

/** 取上一题 / 下一题，用于详情页底部导航 */
export function getSiblings(questionId: string): {
  prev?: SearchHit
  next?: SearchHit
  position: number
} {
  const position = allQuestions.findIndex((hit) => hit.question.id === questionId)
  if (position === -1) return { position: -1 }
  return {
    prev: position > 0 ? allQuestions[position - 1] : undefined,
    next: position < allQuestions.length - 1 ? allQuestions[position + 1] : undefined,
    position: position + 1,
  }
}

/** 关键词搜索：标题权重最高，正文最低 */
export function searchQuestions(keyword: string): SearchHit[] {
  const q = keyword.trim().toLowerCase()
  if (!q) return []

  return allQuestions
    .map((hit) => {
      const { question, category } = hit
      let score = 0
      if (question.title.toLowerCase().includes(q)) score += 100
      if (question.tags.some((tag) => tag.toLowerCase().includes(q))) score += 60
      if (category.name.toLowerCase().includes(q)) score += 40
      if (question.ask.toLowerCase().includes(q)) score += 30
      if (question.oral.toLowerCase().includes(q)) score += 10
      if (question.example.toLowerCase().includes(q)) score += 5
      return { hit, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.hit)
}

/** 首页统计用的分类概览 */
export const categoryStats = categories.map((category) => ({
  id: category.id,
  name: category.name,
  en: category.en,
  desc: category.desc,
  color: category.color,
  icon: category.icon,
  count: category.items.length,
}))

export type { Category, Question, SearchHit }
