/**
 * 题库内容解析器
 * ==================================================================
 * 设计取舍：为什么内容不写在 .ts 里，而是单独放 .md？
 *
 * 每道题都包含大量 markdown 和代码块。如果直接写成 TS 的模板字符串，
 * 那么 ``` 、` 、${ } 全都要转义（\`\`\`、\${'${'}}），几百个代码块
 * 写下来极易出错，而且源码完全没法读。
 *
 * 所以这里把「结构」和「内容」分开：
 *   - 结构（id / 难度 / 频率 / 标签）→ 写在 markdown 的 @ 指令里
 *   - 内容（题干 / 口述回答 / 代码示例）→ 就是普通 markdown，原样书写
 * 解析器负责把它们变成类型安全的 Category 对象。
 *
 * 好处：新增一个技术栈 = 新建一个 .md 文件；改内容 = 改 markdown，
 * 不需要动任何 TS 代码，也不存在转义问题。
 * ==================================================================
 */
import type { Category, Freq, Level, Question } from '@/types'

/** 合法的难度值，写错时兜底为「进阶」 */
const LEVELS: Level[] = ['基础', '进阶', '高级', '手写题', '场景题']

/** 列表型字段 */
const LIST_KEYS = new Set(['points', 'steps', 'followups', 'refs'])

/** 每一道题正文里支持的 @ 指令 */
const BLOCK_KEYS = new Set([
  'id',
  'level',
  'freq',
  'tags',
  'ask',
  'oral',
  'points',
  'example',
  'steps',
  'followups',
  'refs',
])

/** 分类元信息（markdown 头部的 frontmatter） */
interface FileMeta {
  id: string
  name: string
  en: string
  icon: string
  color: string
  desc: string
  /** 侧边栏排序，越小越靠前 */
  order: number
  /** 同一技术栈拆成多个文件时的先后顺序，默认 1 */
  part: number
}

/** 解析结果：在 Category 基础上多带 order / part，供数据层排序合并 */
export interface ParsedCategory extends Category {
  order: number
  part: number
}

/** 解析 frontmatter：文件开头 `---` 包起来的一段 key: value */
function splitFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const normalized = raw.replace(/\r\n/g, '\n')
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(normalized)
  if (!match) return { meta: {}, body: normalized }

  const meta: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    // 注意：这里只在第一个冒号处切分，所以 color: #d6a400 里的 # 不会被当成 YAML 注释
    const value = line.slice(idx + 1).trim()
    if (key) meta[key] = value
  }
  return { meta, body: normalized.slice(match[0].length) }
}

/**
 * 把一个题目的正文拆成若干 @ 段
 * 例如：
 *   @ask
 *   你说说闭包是什么？
 *   @oral
 *   先说结论……
 */
function splitBlocks(questionBody: string): Record<string, string> {
  const result: Record<string, string> = {}
  let current: string | null = null
  const buffer: string[] = []

  const flush = () => {
    if (current) result[current] = buffer.join('\n').trim()
    buffer.length = 0
  }

  for (const line of questionBody.split('\n')) {
    const directive = /^@([a-z]+)\s*$/.exec(line.trim())
    if (directive && BLOCK_KEYS.has(directive[1])) {
      flush()
      current = directive[1]
      continue
    }
    if (current) buffer.push(line)
  }
  flush()
  return result
}

/** 把 markdown 列表转成字符串数组，支持 -、*、1. 三种写法 */
function toList(text: string | undefined): string[] {
  if (!text) return []
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*+]|\d+\.)\s*/, '').trim())
    .filter((line) => line.length > 0)
}

/** 标签支持用 | , ，、空格 分隔 */
function toTags(text: string | undefined): string[] {
  if (!text) return []
  return text
    .split(/[|,，、]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
}

/** 从标题生成兜底 id，避免漏写 @id 时页面崩掉 */
function slugify(title: string, index: number): string {
  const ascii = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return ascii || `question-${index + 1}`
}

/** 解析单个题目区块 */
function parseQuestion(title: string, body: string, index: number): Question {
  const blocks = splitBlocks(body)

  const rawLevel = blocks.level?.trim() as Level | undefined
  const level: Level = rawLevel && LEVELS.includes(rawLevel) ? rawLevel : '进阶'

  const rawFreq = Number.parseInt(blocks.freq ?? '', 10)
  const freq: Freq = (rawFreq >= 1 && rawFreq <= 3 ? rawFreq : 2) as Freq

  const points = toList(blocks.points)
  const steps = toList(blocks.steps)
  const followups = toList(blocks.followups)
  const refs = toList(blocks.refs)

  // 开发期提示：缺了关键内容时给出明确警告，方便自己补内容
  if (import.meta.env.DEV) {
    const missing = (['ask', 'oral', 'example'] as const).filter((key) => !blocks[key])
    if (missing.length) {
      console.warn(`[题库] 「${title}」缺少指令：${missing.map((k) => '@' + k).join('、')}`)
    }
  }

  return {
    id: blocks.id?.trim() || slugify(title, index),
    title,
    level,
    freq,
    tags: toTags(blocks.tags),
    ask: blocks.ask ?? title,
    oral: blocks.oral ?? '',
    points,
    example: blocks.example ?? '',
    steps,
    followups: followups.length ? followups : undefined,
    refs: refs.length ? refs : undefined,
  }
}

/**
 * 解析一个完整的 markdown 内容文件 → Category
 * @param filePath 用于报错提示的文件路径
 * @param raw 文件原始内容
 */
export function parseCategoryFile(filePath: string, raw: string): ParsedCategory {
  const { meta, body } = splitFrontmatter(raw)

  // 按 `## ` 切分题目；注意要求示例内部只能用 ### 及以下标题
  const chunks = body.split(/^##\s+/m).slice(1)

  const items = chunks
    .map((chunk, index) => {
      const lines = chunk.split('\n')
      // 去掉标题行里的序号前缀，例如「01 · 闭包是什么」
      const title = lines[0].replace(/^\d+\s*[·.\-、:：]\s*/, '').trim()
      return parseQuestion(title, lines.slice(1).join('\n'), index)
    })
    .filter((item) => item.title.length > 0)

  // id 重复会在路由里互相覆盖，这里提前拦下来
  if (import.meta.env.DEV) {
    const seen = new Set<string>()
    for (const item of items) {
      if (seen.has(item.id)) {
        console.warn(`[题库] ${filePath} 出现重复 id：${item.id}，会导致路由冲突`)
      }
      seen.add(item.id)
    }
    if (!items.length) {
      console.warn(`[题库] ${filePath} 没有解析出任何题目，请检查是否用了 "## 标题" 格式`)
    }
  }

  const metaFile: FileMeta = {
    id: meta.id || filePath.replace(/\.md$/, '').split('/').pop() || 'unknown',
    name: meta.name || meta.id || '未命名',
    en: meta.en || '',
    icon: meta.icon || 'file-code',
    color: meta.color || '#2f6bff',
    desc: meta.desc || '',
    order: Number.parseInt(meta.order ?? '99', 10) || 99,
    part: Number.parseInt(meta.part ?? '1', 10) || 1,
  }

  return { ...metaFile, items }
}
