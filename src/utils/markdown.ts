/**
 * Markdown → HTML 渲染器
 * ------------------------------------------------------------------
 * 为什么要自己封装而不是直接 md.render()？
 * 1. 面试题里代码块非常多，需要语法高亮 + 语言标签 + 一键复制；
 * 2. markdown-it 默认的 fence（``` 代码块）只输出 <pre><code>，
 *    这里用自定义 renderer 把它换成带工具栏的结构；
 * 3. 只注册用得到的语言，避免把 highlight.js 全量打进包里。
 */
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/core'

// 按需注册语言：每个语言都是独立的 ESM 模块，支持 tree-shaking
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import diff from 'highlight.js/lib/languages/diff'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import http from 'highlight.js/lib/languages/http'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import less from 'highlight.js/lib/languages/less'
import markdown from 'highlight.js/lib/languages/markdown'
import nginx from 'highlight.js/lib/languages/nginx'
import plaintext from 'highlight.js/lib/languages/plaintext'
import python from 'highlight.js/lib/languages/python'
import scss from 'highlight.js/lib/languages/scss'
import shell from 'highlight.js/lib/languages/shell'
import sql from 'highlight.js/lib/languages/sql'
import swift from 'highlight.js/lib/languages/swift'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('css', css)
hljs.registerLanguage('diff', diff)
hljs.registerLanguage('dockerfile', dockerfile)
hljs.registerLanguage('http', http)
hljs.registerLanguage('java', java)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('less', less)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('nginx', nginx)
hljs.registerLanguage('plaintext', plaintext)
hljs.registerLanguage('python', python)
hljs.registerLanguage('scss', scss)
hljs.registerLanguage('shell', shell)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('swift', swift)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('yaml', yaml)

// 别名：代码块里写 ```vue / ```html / ```ts 都能正确高亮
hljs.registerAliases(['html', 'vue', 'svelte', 'svg'], { languageName: 'xml' })
hljs.registerAliases(['js', 'jsx', 'mjs', 'cjs'], { languageName: 'javascript' })
hljs.registerAliases(['ts', 'tsx'], { languageName: 'typescript' })
hljs.registerAliases(['sh', 'zsh', 'console'], { languageName: 'bash' })
hljs.registerAliases(['yml'], { languageName: 'yaml' })
hljs.registerAliases(['text', 'txt'], { languageName: 'plaintext' })
hljs.registerAliases(['md'], { languageName: 'markdown' })

/** 语言别名 → 代码块右上角显示的名字 */
const LANG_LABEL: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  xml: 'HTML / Vue',
  css: 'CSS',
  scss: 'SCSS',
  less: 'Less',
  json: 'JSON',
  bash: 'Shell',
  shell: 'Shell',
  python: 'Python',
  sql: 'SQL',
  yaml: 'YAML',
  markdown: 'Markdown',
  http: 'HTTP',
  nginx: 'Nginx',
  java: 'Java / Android',
  swift: 'Swift / iOS',
  dockerfile: 'Dockerfile',
  diff: 'Diff',
  plaintext: 'Text',
}

/** HTML 特殊字符转义，防止示例代码里的标签破坏页面 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 生成代码块的内部 HTML（高亮后的 token 序列） */
function highlightCode(code: string, lang: string): string {
  const resolved = hljs.getLanguage(lang) ? lang : 'plaintext'
  try {
    return hljs.highlight(code, { language: resolved, ignoreIllegals: true }).value
  } catch {
    return escapeHtml(code)
  }
}

const md = new MarkdownIt({
  html: false, // 关闭裸 HTML，防止内容里误写标签
  linkify: true,
  breaks: false,
  typographer: false,
  highlight: (code, lang) => highlightCode(code, lang || 'plaintext'),
})

// 自定义 fence 渲染器：输出「语言标签 + 复制按钮 + 代码区」
md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx]
  const info = (token.info || '').trim()
  const lang = info.split(/\s+/)[0].toLowerCase() || 'plaintext'
  const code = token.content
  const label = LANG_LABEL[lang] ?? lang.toUpperCase()
  const body = highlightCode(code, lang)

  // 注意：这里用 data-code 存原始代码，复制按钮读它，避免复制到高亮标签
  return `<div class="code-block">
  <div class="code-block__bar">
    <span class="code-block__lang">${escapeHtml(label)}</span>
    <button class="code-block__copy" type="button" data-code="${escapeHtml(code)}">复制</button>
  </div>
  <pre class="code-block__pre"><code class="hljs language-${escapeHtml(lang)}">${body}</code></pre>
</div>`
}

// 段落内联代码加个类，方便单独调样式
md.renderer.rules.code_inline = (tokens, idx) => {
  return `<code class="inline-code">${escapeHtml(tokens[idx].content)}</code>`
}

/** 渲染 markdown 文本 */
export function renderMarkdown(source: string): string {
  if (!source) return ''
  return md.render(source)
}

/** 简易纯文本提取：用于搜索与摘要 */
export function toPlainText(source: string, limit = 120): string {
  const text = source
    .replace(/```[\s\S]*?```/g, ' ') // 去掉代码块
    .replace(/[#>*`_\-|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > limit ? `${text.slice(0, limit)}...` : text
}
