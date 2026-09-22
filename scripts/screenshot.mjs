/**
 * 无头截图（沙箱变通版）
 * ------------------------------------------------------------------
 * 背景：直接调 chrome.exe --screenshot 拿不到文件。原因是 Chrome 在
 * Windows 上会 fork 出真正的浏览器进程、启动器立即退出；而本环境的
 * 沙箱会在单次工具调用结束时清理整棵进程树，浏览器还没写完截图就被杀了
 * （表现：profile 目录有文件、但截图 0 字节、stdout 全空）。
 *
 * 变通：由 Node 持续等待输出文件出现，让工具调用保持存活，
 * 浏览器进程就不会被回收。等到文件就绪或超时为止。
 *
 * 用法：node scripts/screenshot.mjs <url> <输出文件名> [宽] [高]
 */
import { spawn } from 'node:child_process'
import { existsSync, statSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

if (!CHROME) {
  console.error('找不到可用的浏览器')
  process.exit(1)
}

const [url, filename, w = '1500', h = '1200'] = process.argv.slice(2)
if (!url || !filename) {
  console.error('用法：node scripts/screenshot.mjs <url> <输出文件名> [宽] [高]')
  process.exit(1)
}

const out = join(ROOT, 'docs', filename)
mkdirSync(dirname(out), { recursive: true })

const child = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--hide-scrollbars',
    `--user-data-dir=${join(ROOT, '.chrome-profile')}`,
    `--window-size=${w},${h}`,
    '--virtual-time-budget=12000',
    `--screenshot=${out}`,
    url,
  ],
  { stdio: 'ignore', windowsHide: true },
)

const deadline = Date.now() + 60_000
const timer = setInterval(() => {
  if (existsSync(out) && statSync(out).size > 1024) {
    clearInterval(timer)
    child.kill()
    console.log(`✓ 已生成 docs/${filename}  (${(statSync(out).size / 1024).toFixed(1)} KB)`)
    process.exit(0)
  }
  if (Date.now() > deadline) {
    clearInterval(timer)
    child.kill()
    console.log('✗ 超时：浏览器没能产出截图（沙箱可能仍禁止 GUI 进程）')
    process.exit(1)
  }
}, 400)
