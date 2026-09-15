/**
 * 内容自检脚本
 * ------------------------------------------------------------------
 * 在构建前把 markdown 内容扫一遍，提前发现会让解析器出错的问题：
 *   1. 代码块围栏没闭合（会导致后续内容全部错位）
 *   2. 代码块内部出现 `## ` 开头的行（会被解析器误判成新题目）
 *   3. 题目缺少必需的 @ 指令
 *   4. 题目 id 重复（会导致路由互相覆盖）
 *   5. level / freq 取值非法
 *
 * 用法：node scripts/validate-content.mjs
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const contentDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'content')

const REQUIRED = ['id', 'level', 'freq', 'ask', 'oral', 'example']
const LEVELS = ['基础', '进阶', '高级', '手写题', '场景题']

const files = readdirSync(contentDir).filter((f) => f.endsWith('.md') && !f.startsWith('_'))

let totalQuestions = 0
const errors = []
const allIds = new Map()

for (const file of files) {
  const raw = readFileSync(join(contentDir, file), 'utf8').replace(/\r\n/g, '\n')
  const lines = raw.split('\n')

  // ---- 1 & 2：围栏配对 + 围栏内不得出现 `## ` ----
  let inFence = false
  let fenceLang = ''
  let fenceLines = 0
  lines.forEach((line, i) => {
    const fence = /^\s*(```|~~~)/.exec(line)
    if (fence) {
      fenceLines += 1
      if (!inFence) {
        inFence = true
        fenceLang = line.trim().slice(3)
      } else {
        inFence = false
      }
      return
    }
    if (inFence && /^##\s/.test(line)) {
      errors.push(`${file}:${i + 1} 代码块（${fenceLang}）内部出现 "## " 开头的行，会被误判成新题目`)
    }
  })
  if (inFence) errors.push(`${file} 代码块围栏没有闭合（缺少结尾的 \`\`\`）`)
  if (fenceLines % 2 !== 0) errors.push(`${file} 代码块围栏行数为奇数（${fenceLines}），有未闭合的代码块`)

  // ---- 3 & 4 & 5：逐题检查 ----
  const blocks = raw.split(/^##\s+/m).slice(1)
  blocks.forEach((block, index) => {
    const [titleLine, ...rest] = block.split('\n')
    const title = titleLine.trim()
    const body = rest.join('\n')
    totalQuestions += 1

    for (const key of REQUIRED) {
      if (!new RegExp(`^@${key}\\s*$`, 'm').test(body)) {
        errors.push(`${file} 「${title}」缺少 @${key}`)
      }
    }

    const id = /^@id\s*\n\s*(.+)$/m.exec(body)?.[1]?.trim()
    if (!id) {
      errors.push(`${file} 「${title}」@id 为空`)
    } else if (allIds.has(id)) {
      errors.push(`题目 id 重复：${id}（${allIds.get(id)} 与 ${file}）`)
    } else {
      allIds.set(id, file)
    }

    const level = /^@level\s*\n\s*(.+)$/m.exec(body)?.[1]?.trim()
    if (level && !LEVELS.includes(level)) {
      errors.push(`${file} 「${title}」@level 取值非法：${level}`)
    }

    const freq = /^@freq\s*\n\s*(.+)$/m.exec(body)?.[1]?.trim()
    if (freq && !['1', '2', '3'].includes(freq)) {
      errors.push(`${file} 「${title}」@freq 取值非法：${freq}`)
    }

    const oral = /(?:^|\n)@oral[ \t]*\n([\s\S]*?)(?=\n@[a-z]+[ \t]*\n|$)/.exec(body)?.[1]?.trim() ?? ''
    if (oral.length < 150) {
      errors.push(`${file} 「${title}」@oral 内容过短（${oral.length} 字），不像口语化回答`)
    }
    if (index === 0 && !/^---/.test(raw)) {
      errors.push(`${file} 缺少 frontmatter`)
    }
  })
}

console.log(`\n内容自检：${files.length} 个文件 / ${totalQuestions} 道题`)
if (errors.length) {
  console.log(`\n发现 ${errors.length} 个问题：`)
  for (const err of errors) console.log('  ✗ ' + err)
  process.exitCode = 1
} else {
  console.log('全部通过 ✓')
}
