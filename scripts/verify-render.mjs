/**
 * 渲染冒烟测试
 * ==================================================================
 * 为什么需要它：本项目的验证环境里浏览器无法启动（沙箱会话禁止），
 * 没法用截图确认「内容真的渲染出来了」。所以退一步，用 Node 侧
 * 走一遍和线上完全相同的渲染管线，把「渲染层坏掉」这类问题拦住。
 *
 * 它检查的是 validate-content.mjs 管不到的那一层：
 *   - validate-content 管「一眼就会崩」的解析错（重复 id、围栏不闭合）
 *   - 这个脚本管「能解析但渲染不对」的问题：
 *     ① 表格语法写坏 → 退化成裸管道符
 *     ② markdown-it 渲染出的标签不闭合
 *     ③ @ 指令名漏成正文（说明解析器没识别到）
 *     ④ 高亮语言没注册 → 代码块变成无高亮的灰文本
 *
 * 用法：node scripts/verify-render.mjs
 * ==================================================================
 */
import { createRequire } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONTENT = join(ROOT, 'src/content')
const require = createRequire(join(ROOT, 'package.json'))

const MarkdownIt = require('markdown-it')
const hljs = require('highlight.js/lib/core')

// 与 src/utils/markdown.ts 保持一致的注册列表。
// 两边不一致时这里会报「未注册语言」，等于一个防漂移的看门哨。
const LANGS = [
  'bash', 'css', 'diff', 'dockerfile', 'http', 'java', 'javascript', 'json',
  'less', 'markdown', 'nginx', 'plaintext', 'python', 'scss', 'shell', 'sql',
  'swift', 'typescript', 'xml', 'yaml',
]
const ALIASES = {
  html: 'xml', vue: 'xml', svelte: 'xml', svg: 'xml',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  sh: 'bash', zsh: 'bash', console: 'bash',
  yml: 'yaml', text: 'plaintext', txt: 'plaintext', md: 'markdown',
}

for (const name of LANGS) hljs.registerLanguage(name, require(`highlight.js/lib/languages/${name}`))
for (const [alias, target] of Object.entries(ALIASES)) {
  hljs.registerAliases([alias], { languageName: target })
}

/** 与 src/utils/markdown.ts 同一套配置 */
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  typographer: false,
})

const problems = []
const stats = { files: 0, questions: 0, fences: 0, tables: 0, langsUsed: new Set() }

for (const file of readdirSync(CONTENT).filter((f) => f.endsWith('.md') && !f.startsWith('_'))) {
  stats.files++
  const raw = readFileSync(join(CONTENT, file), 'utf8').replace(/\r\n/g, '\n')

  for (const chunk of raw.split(/^##\s+/m).slice(1)) {
    stats.questions++
    const title = chunk.split('\n')[0].trim()

    // 取出所有指令段的内容（@xxx 到下一个 @ 之间的正文）
    const body = chunk.replace(/^.*\n/, '')
    const segments = body.split(/^@[a-z]+\s*$/m).slice(1)
    const rendered = segments.map((s) => md.render(s)).join('\n')

    // ① 表格退化：原文里有表格分隔行，渲染后却没有 <table>
    if (/\|\s*-{2,}/.test(body) && !/<table>/.test(rendered)) {
      problems.push(`${file} 「${title}」：写出的是表格语法，但没渲染成 <table>（可能缺表头分隔行）`)
    }

    // ② 标签闭合
    for (const tag of ['pre', 'table', 'code']) {
      const open = (rendered.match(new RegExp(`<${tag}[ >]`, 'g')) || []).length
      const close = (rendered.match(new RegExp(`</${tag}>`, 'g')) || []).length
      // code 标签：<pre><code> 是成对的，行内 code 也是成对的
      if (open !== close) {
        problems.push(`${file} 「${title}」：<${tag}> 标签不闭合（开 ${open} / 闭 ${close}）`)
      }
    }

    // ③ @ 指令名漏进正文（说明这一行没被当成指令，会原样显示给用户）
    for (const leak of rendered.matchAll(/@(ask|oral|points|steps|followups|example|id|level|freq|tags)\b/g)) {
      problems.push(`${file} 「${title}」：正文里裸露了指令名 @${leak[1]}，会被当成普通文字渲染出来`)
    }

    // ④ 统计表格与围栏
    stats.tables += (rendered.match(/<table>/g) || []).length

    // ⑤ 代码块语言是否注册
    for (const m of body.matchAll(/^\s*```([a-zA-Z0-9+#-]*)/gm)) {
      const lang = m[1].toLowerCase()
      if (!lang) continue
      stats.langsUsed.add(lang)
      stats.fences++
      if (!hljs.getLanguage(lang)) {
        problems.push(`${file} 「${title}」：代码块语言 ${lang} 未在 highlight.js 注册，会退化成无高亮文本`)
      }
    }
  }
}

console.log(`渲染冒烟测试：${stats.files} 个文件 / ${stats.questions} 道题`)
console.log(`  代码块 ${stats.fences} 个，用到 ${stats.langsUsed.size} 种语言：${[...stats.langsUsed].sort().join(', ')}`)
console.log(`  markdown 表格 ${stats.tables} 个`)
console.log('')

if (problems.length) {
  console.log(`发现 ${problems.length} 个渲染问题：`)
  for (const p of problems) console.log('  ✗ ' + p)
  process.exit(1)
} else {
  console.log('全部通过 ✓')
}
