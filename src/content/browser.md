---
id: browser
name: 浏览器与性能
en: Rendering & Performance
icon: gauge
color: #ea8a00
order: 11
desc: 渲染流程、核心性能指标与优化手段，性能题是区分度最高的部分。
---

## 01 · 浏览器渲染流程：从 HTML 到屏幕像素经历了什么

@id
browser-render-pipeline

@level
高级

@freq
3

@tags
渲染流程 | 关键渲染路径 | 合成

@ask
你讲一下浏览器从输入一个 URL 拿到 HTML，到最终在屏幕上画出像素，中间经历了哪些步骤？特别是「关键渲染路径」你是怎么理解的？如果让你去优化首屏，你会盯住哪几个阶段？

@oral
**先说结论**：从 HTML 到像素，核心是一条「关键渲染路径（CRP）」——解析 HTML 生成 DOM，解析 CSS 生成 CSSOM，两者合成渲染树（Render Tree），再经过 Layout（布局/重排）算几何位置、Paint（绘制）生成绘制指令、最后 Composite（合成）交给 GPU 出像素。任何一个环节的阻塞都会拖慢首屏。

**再说原理**。HTML 解析是流式的，边下载边构建 DOM；遇到 CSS 会阻塞渲染（但不会阻塞 HTML 解析，因为 CSS 由单独线程处理样式）；遇到 `<script>` 默认会阻塞解析，因为 JS 可能改 DOM 和 CSSOM，所以通常把脚本放 body 末尾或加 `defer`/`async`。CSSOM 和 DOM 合并出渲染树，只含可见节点。Layout 算每个节点的位置和大小，Paint 把节点画到图层上，Composite 把多个图层按正确顺序合成——现代浏览器靠合成层（GPU）来避免重排重绘，比如 transform/opacity 动画走合成线程，不卡主线程。

**举个我真实踩过的坑**。有个列表页首屏要 4s，用 Performance 录制发现 Long Task 卡在「Parse HTML + Recalculate Style」上——根因是服务端吐了一个 8000 行的巨大 table，而且首屏 JS 同步执行了。我做了三件事：把非首屏列表改成虚拟滚动（DOM 节点从几千砍到几十）、首屏 JS 拆包 + `defer`、关键 CSS 内联其余走 preload，首屏压到 1.5s。

**边界取舍**要注意：不是所有东西都要首屏渲染，要分「关键路径」和「次要路径」；合成层不是越多越好，每层都吃显存，乱加 `will-change` 反而掉帧。

**收尾**：所以优化首屏本质是「让关键渲染路径最短」——减少阻塞、减少 DOM 规模、把能并行的并行、能合成的别走主线程。

@points
关键渲染路径五步：DOM → CSSOM → Render Tree → Layout → Paint → Composite
CSS 阻塞渲染、JS 默认阻塞解析，是首屏的两个主要卡点
Layout 算几何、Paint 生成绘制指令、Composite 由 GPU 负责合成图层
transform/opacity 走合成线程，不触发重排重绘，是动画性能的关键
首屏优化的本质是「缩短关键渲染路径」：减阻塞、减 DOM、并行、用合成

@steps
先说整体链路：HTML→DOM，CSS→CSSOM，合并成渲染树
讲阻塞点：CSS 阻塞渲染、script 阻塞解析，引出 defer/async
展开渲染树到像素：Layout 算位置、Paint 画图层、Composite 合成
点出合成层的价值：transform/opacity 走 GPU，避免主线程重排重绘
落到优化：减少 DOM、拆包、内联关键 CSS、虚拟滚动等真实手段

@followups
为什么 JS 会阻塞 HTML 解析？——因为 JS 能改 DOM/CSSOM，解析器必须等脚本执行完才能确定后续结构，故 script 默认阻塞
defer 和 async 区别？——defer 按顺序、在 DOMContentLoaded 前执行，async 下载完就执行、顺序不保
什么属性会触发重排？——改 width/height、top/left、display、font-size，以及读取 offsetTop 等几何信息会强制同步布局

@example
### 1. 用 Performance API 衡量关键渲染路径各阶段

```javascript
// 用 Navigation Timing 拿到 DNS / 连接 / 响应 / 渲染各阶段的耗时
const nav = performance.getEntriesByType('navigation')[0]
// DOM 开始解析到可交互的时间，反映 CRP 是否被脚本阻塞
console.log('DOM 解析耗时:', nav.domInteractive - nav.domLoading)
console.log('首屏资源响应:', nav.responseEnd - nav.requestStart)
console.log('DOM 就绪:', nav.domContentLoadedEventEnd)
// 标记业务自己的关键节点，方便在 Performance 面板里对照看
performance.mark('app-start')
// ... 业务初始化逻辑 ...
performance.mark('app-end')
performance.measure('init', 'app-start', 'app-end')
```

### 2. 减少阻塞：defer / async / preload 的正确姿势

```html
<!-- 普通 script 会阻塞 HTML 解析，放在 head 里尤其致命 -->
<!-- defer：下载不阻塞解析，DOM 就绪后、按出现顺序执行 -->
<script defer src="/app.js"></script>
<!-- async：下载完就执行，顺序不保证，适合独立统计脚本 -->
<script async src="/analytics.js"></script>
<!-- 关键 CSS 内联，非关键 CSS 用 preload 异步加载，避免阻塞首屏 -->
<link rel="preload" href="/non-critical.css" as="style" onload="this.rel='stylesheet'">
```

## 02 · 重排与重绘的触发条件与优化手段

@id
browser-reflow

@level
进阶

@freq
3

@tags
重排 | 重绘 | 合成层

@ask
重排和重绘你分得清吗？分别是什么触发的？你在项目里是怎么避免频繁重排的？比如要连续改一个元素的位置和颜色，你会怎么写？

@oral
**先说结论**：重排（Reflow/Layout）是浏览器重新计算元素几何位置和大小，代价最高；重绘（Repaint）是几何不变只改外观（颜色、背景、visibility），跳过布局直接画；合成（Composite）是只改 transform/opacity 这类「只走 GPU」的属性，连绘制都不触发，最便宜。

**再说原理**。现代浏览器把页面分成多个图层，重排会波及整棵受影响子树甚至全局（比如改 body 宽度），所以贵；重绘只重画像素但还好；合成由合成线程独立处理，完全不占主线程，所以动画优先用 transform/opacity。关键认知是「读写分离」：连续读 offsetTop 再写 style 会让浏览器被迫在每次写后强制同步布局（forced reflow），性能塌方。

**举个真实场景**。我们做拖拽排序，拖的时候每帧都改 `left/top`，结果一拖就卡。排查发现每帧都在重排，而且还在循环里读 `getBoundingClientRect` 触发强制同步布局。我改成：读一次性缓存、写合并到 rAF 里批量改 transform，把 left/top 改成 `transform: translate()`——直接走上合成层，主线程彻底解放，60fps 稳了。

**边界取舍**：不是所有动画都能用 transform 替代，比如高度从 0 到 auto 的展开，transform 没法直接做，这时候可以用 `will-change: height` 提前提升图层，但别滥用，图层吃显存。

**收尾**：记住优先级——能用合成（transform/opacity）就别重绘，能重绘就别重排；批量读写、用 rAF 合帧。

@points
重排改几何（最贵）> 重绘改外观 > 合成改 transform/opacity（最便宜）
连续「读几何属性」会触发强制同步布局（forced reflow），是隐形性能杀手
transform/opacity 走 GPU 合成线程，不占主线程，动画首选
读写分离 + rAF 合帧，避免一帧内反复重排
will-change 可提前提升图层，但滥用会吃显存、反而掉帧

@steps
先定义三者代价阶梯：重排 > 重绘 > 合成
讲原理：图层、合成线程、强制同步布局的成因
给反例：循环里读 offsetTop 又写 style 导致一帧多次重排
给正例：rAF 合帧 + transform 替代 left/top，走上合成层
点取舍：哪些动画 transform 做不了，will-change 的代价

@followups
哪些属性触发重排？——改 width/height、top/left、display、font-size，以及 offset* 读取都会
visibility:hidden 和 display:none 区别？——前者保留布局只不画（重绘），后者直接移除（重排）
will-change 怎么用才不翻车？——只在动画前加、动画后移除，别全局常驻以免图层泛滥

@example
### 1. 反例：读写交替触发强制同步布局（forced reflow）

```javascript
// 在循环里又读又写几何属性，浏览器被迫每次写后立刻重排
const boxes = document.querySelectorAll('.box')
boxes.forEach((box) => {
  // 读（触发布局计算）
  const width = box.offsetWidth
  // 写（浏览器为保证读到的 width 最新，会强制同步重排）
  box.style.width = width + 10 + 'px'
})
// 结果：N 个元素 = N 次重排，长列表直接卡死
```

### 2. 正例：读写分离 + rAF 合帧 + transform 走合成层

```javascript
// 第一步：一次性把所有几何值读出来，避免边读边写
const boxes = [...document.querySelectorAll('.box')]
const widths = boxes.map((box) => box.offsetWidth) // 只读一次，触发一次布局

// 第二步：用 rAF 把写操作合并到下一帧，且用 transform 替代 left/top
function update() {
  boxes.forEach((box, i) => {
    // transform 不触发重排/重绘，只走 GPU 合成，性能最优
    box.style.transform = `translateX(${widths[i] + 10}px)`
  })
}
requestAnimationFrame(update) // 一帧内批量完成，全程只重排一次
```

## 03 · 核心性能指标 FCP、LCP、CLS、INP 分别是什么

@id
browser-web-vitals

@level
进阶

@freq
3

@tags
Web Vitals | LCP | CLS

@ask
核心 Web Vitals 你了解哪些？FCP、LCP、CLS、INP 分别衡量什么？你们线上是怎么采集和监控这些指标的？给个及格线。

@oral
**先说结论**：Google 的核心 Web Vitals 现在是三件套——LCP（最大内容绘制，衡量加载）、CLS（累计布局偏移，衡量视觉稳定）、INP（交互到下一次绘制，衡量响应，已取代 FID）。FCP 虽不在核心三项里，但常一起看，表示首次有内容绘制。

**再说原理**。LCP 看「视口里最大那块内容（图片/视频/大文本块）」渲染完成的时间，及格线 2.5s、差于 4s 很差；CLS 衡量元素意外位移的累计分数，要求 < 0.1，常见元凶是图片没设宽高、字体闪烁（FOIT/FOUT）、异步插入的内容把下方顶开；INP 测用户交互（点击/输入）到浏览器能响应绘制的延迟，要求 < 200ms，反映主线程被 Long Task 占用程度。

**真实项目做法**。我们前端用 `web-vitals` 库上报，接 PerformanceObserver 采集，按会话采样 10% 用户、看 p75 分位。LCP 差就查 LCP 元素是不是被 JS 阻塞、图片有没有用响应式 + preload；CLS 差就给所有图片/广告位预留宽高、字体用 `font-display: swap` 并 `size-adjust` 防抖动；INP 差就拆 Long Task、用 rAF/Web Worker 搬运算。

**边界取舍**：指标要分位数看，平均数会掩盖长尾；移动端和弱网下的 LCP 往往比桌面差 3 倍，要分别设阈值。

**收尾**：监控不是目的，要能定位到具体元素（LCP 元素、导致 CLS 的节点），才有优化抓手。

@points
核心三件套：LCP（加载）<2.5s、CLS（稳定）<0.1、INP（响应）<200ms
FCP 表示首次内容绘制，常作辅助指标
LCP 看视口最大内容块；CLS 防意外位移；INP 取代 FID 测交互延迟
用 web-vitals + PerformanceObserver 采集，看 p75 分位、按端分别设阈
优化要能定位到具体元素（LCP 元素 / CLS 节点）才有抓手

@steps
先报三件套及及格线，点出 FCP 是辅助
逐个解释：LCP 衡量加载、CLS 衡量稳定、INP 衡量响应
说常见坑：图片无宽高、字体抖动、Long Task 拖 INP
讲采集方案：web-vitals 库 + PerformanceObserver + p75 采样上报
讲定位：LCP 元素、CLS 位移节点，分端看分位数

@followups
FID 和 INP 区别？——FID 只测首次交互延迟、易低估，INP 覆盖整个生命周期的所有交互取最差
CLS 为什么要求是累计值？——单次小偏移不可怕，累计反映整体体验，0.1 是「几乎无感」阈值
LCP 元素怎么找？——Performance 面板 Timings 里标 LCP 的那块，或在代码里用 PerformanceObserver 拿 element

@example
### 1. 用 PerformanceObserver 采集 LCP 和 CLS

```javascript
// LCP：监听最大内容绘制，取最新一次报告的值
new PerformanceObserver((list) => {
  const entries = list.getEntries()
  const last = entries[entries.length - 1]
  console.log('LCP:', last.startTime, '元素:', last.element)
}).observe({ type: 'largest-contentful-paint', buffered: true })

// CLS：累计布局偏移，过滤掉用户主动交互后的偏移（不计入评分）
let cls = 0
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (!entry.hadRecentInput) cls += entry.value
  }
  console.log('CLS:', cls)
}).observe({ type: 'layout-shift', buffered: true })
```

### 2. 用 web-vitals 库上报到监控（生产常用）

```typescript
// 引入官方库，三个回调分别拿到核心指标，再上报到自己后端
import { onLCP, onCLS, onINP } from 'web-vitals'

function report(metric: { name: string; value: number; id: string }) {
  // 实际项目里发到埋点服务，注意按 p75 分位聚合、采样 10% 用户
  navigator.sendBeacon('/log', JSON.stringify(metric))
}

onLCP(report)
onCLS(report)
onINP(report)
```

## 04 · 首屏加载优化清单，你实际做过哪些

@id
browser-first-screen

@level
场景题

@freq
3

@tags
首屏优化 | 资源加载 | 骨架屏

@ask
给你一个首屏很慢的项目，你怎么系统地做优化？把你实际做过的手段按「网络、渲染、资源、缓存」几层讲一遍，最好有数据。

@oral
**先说结论**：首屏优化我按四层打——网络层减请求/压体积、渲染层缩短关键路径、资源层按需加载、缓存层复用。我手上最典型的案例是把一个列表页从 4s 压到 1.5s。

**再说原理 + 我的真实做法**。网络层：HTTP2 多路复用 + 域名收敛减少握手；图片用 WebP/AVIF + `srcset` 响应式，首屏外图片 `loading="lazy"`。渲染层：关键 CSS 内联、首屏 JS 用 `defer` 拆包（用 Vite 的 manualChunks 把 vendor 和业务拆开、首屏只加载必需 chunk），非首屏内容虚拟滚动。资源层：路由级懒加载、组件按需 import、长列表虚拟滚动把 DOM 从几千砍到几十。缓存层：静态资源 contenthash + 强缓存（Cache-Control 一年）+ Service Worker 兜底；接口数据用 stale-while-revalidate 策略。

**具体数据**：那个页面原本 4s 是因为服务端吐 8000 行 table + 首屏同步执行 600KB JS。我做了虚拟滚动（DOM 几十节点）、JS 拆包 + defer（首屏 JS 从 600KB 降到 90KB）、图片懒加载 + WebP、骨架屏消除「白屏焦虑」，首屏 LCP 从 4s → 1.5s，CLS 从 0.25 → 0.02。

**边界取舍**：骨架屏别做太复杂，它本身也是成本；强缓存要配合 contenthash 才能安全长缓存，否则发版不更新；Service Worker 更新有「等待激活」的坑，要处理 skipWaiting。

**收尾**：优化要基于度量，先用 Lighthouse/Performance 找到瓶颈再动手，别盲目上手段。

@points
四层框架：网络（减请求/压体积）、渲染（缩短 CRP）、资源（按需/虚拟滚动）、缓存（强缓存+SW）
关键手段：HTTP2/图片压缩/defer 拆包/路由懒加载/虚拟滚动/contenthash 缓存
骨架屏缓解白屏焦虑，但自身也有成本，别过度设计
强缓存必须配 contenthash，否则发版不更新
一切基于度量：先用 Lighthouse/Performance 定位瓶颈再优化

@steps
先建框架：网络/渲染/资源/缓存四层
网络层：HTTP2、图片 WebP+srcset、懒加载
渲染层：关键 CSS 内联、JS defer 拆包、减少首屏 DOM
资源层：路由懒加载、虚拟滚动、按需 import
缓存层：contenthash 强缓存、Service Worker、SWR 接口策略

@followups
虚拟滚动为什么能提速？——首屏只渲染视口内几十个节点，DOM 规模从几千降到几十，重排/内存都下来
contenthash 强缓存怎么避免发版不更新？——文件名带 hash，内容变 hash 变、URL 变，旧缓存自动失效
骨架屏算首屏时间吗？——骨架屏是占位，LCP 通常落在真实内容绘制时，骨架屏本身不计入但改善了感知性能

@example
### 1. Vite 拆包：首屏只加载必需 chunk

```javascript
// vite.config.ts：把体积大的第三方库单独拆出，首屏按需加载
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // 图表库很重，单独成包，首屏不用的页面才加载它
          echarts: ['echarts'],
          vendor: ['vue', 'vue-router'],
        },
      },
    },
  },
}
```

### 2. 路由懒加载 + 图片响应式 + 首屏外懒加载

```html
<!-- 图片用 srcset 给不同屏密度，首屏外的图懒加载 -->
<img
  src="hero-1x.webp"
  srcset="hero-1x.webp 1x, hero-2x.webp 2x"
  loading="lazy"
  width="800" height="450"
  alt="首屏主图"
/>
```

```javascript
// 路由级懒加载，只有进入该页才下载对应 chunk
const List = () => import('./views/List.vue')
const router = createRouter({
  routes: [{ path: '/list', component: List }],
})
```

## 05 · 事件机制：捕获、冒泡与事件委托

@id
browser-event

@level
基础

@freq
3

@tags
事件流 | 冒泡 | 事件委托

@ask
你讲讲浏览器的事件流，捕获和冒泡是什么？事件委托为什么性能好？给你一个动态列表，你怎么绑事件？

@oral
**先说结论**：事件流分三阶段——捕获（从 window 往下到目标）、目标（到达实际触发的元素）、冒泡（从目标往上回 window）。`addEventListener` 默认在冒泡阶段触发，第三个参数传 `true` 就改成捕获阶段。事件委托就是「把子元素的监听挂到共同的父节点上」，靠冒泡把事件冒上来统一处理。

**再说原理**。DOM 树是层级结构，点一个按钮，浏览器其实是从根往叶子找、再从叶子回根各走一遍。委托能生效，是因为事件会冒泡到父节点，父节点拿 `event.target` 就能知道真正点的是哪个子元素。好处一：动态增删的子元素不用逐个重新绑，新增的天然生效；好处二：1 万个列表项只需 1 个监听器，省内存、避免频繁绑定解绑导致的性能问题。

**真实场景**。我们做可无限滚动的评论列表，曾经每个 item 都绑点击，列表到几千条时绑定开销和内存都扛不住，还出现过解绑不干净的内存泄漏。改成在容器上挂一个委托监听，用 `event.target.closest('[data-id]')` 取数据 id，新增/删除 item 完全不用管事件，内存稳了，滚动也不卡了。

**边界取舍**：不是所有事件都能委托——`focus`/`blur` 不冒泡（用 `focusin`/`focusout` 代替），`mouseenter`/`mouseleave` 也不冒泡（用 `mouseover`/`mouseout`）；另外委托层级别太深，target 匹配要稳。

**收尾**：事件委托是「用空间（一个监听）换时间（省去 N 次绑定）」和动态性的经典方案，列表和动态内容首选。

@points
事件流三阶段：捕获（window→目标）→ 目标 → 冒泡（目标→window）
addEventListener 默认冒泡阶段，第三参 true 切捕获
事件委托 = 把子元素监听挂到父节点，靠冒泡 + event.target 识别来源
委托两大优点：动态子元素天然生效、N 个监听合并成 1 个省内存
注意不冒泡的事件：focus/blur、mouseenter/leave，要用 in/out 或捕获

@steps
先画事件流：捕获→目标→冒泡
解释 addEventListener 第三参控制阶段
讲委托原理：冒泡到父 + event.target 定位
给真实案例：长列表从逐个绑改成容器委托，解决内存和滚动卡顿
点边界：哪些事件不冒泡、target 匹配要稳

@followups
为什么事件委托省内存？——N 个子元素只挂 1 个监听器，避免每个节点都建监听对象，尤其万级列表差异巨大
event.target 和 currentTarget 区别？——target 是真正触发的元素，currentTarget 是绑定监听的那个（这里是父容器）
focus 不冒泡怎么办委托？——用 focusin/focusout（可冒泡版本），或在捕获阶段监听 focus

@example
### 1. 事件委托：一个监听搞定整个动态列表

```javascript
// 在容器上挂一个监听，靠冒泡 + event.target 识别点的哪个子项
const list = document.querySelector('#comment-list')
list.addEventListener('click', (e) => {
  // closest 从 target 向上找最近的带 data-id 的祖先，动态新增的也能命中
  const item = e.target.closest('[data-id]')
  if (!item) return
  const id = item.dataset.id
  console.log('点击了评论:', id)
})
// 新增/删除评论项完全不用重新绑事件，内存稳定
```

### 2. 不冒泡事件的替代方案

```javascript
// focus/blur 不冒泡，委托要用 focusin/focusout（可冒泡版本）
const form = document.querySelector('#form')
form.addEventListener('focusin', (e) => {
  e.target.classList.add('focused') // 哪个输入框获得焦点都能捕获
})
form.addEventListener('focusout', (e) => {
  e.target.classList.remove('focused')
})
```

## 06 · 浏览器多进程架构与各进程的职责

@id
browser-process

@level
进阶

@freq
2

@tags
多进程 | 渲染进程 | 沙箱

@ask
浏览器是多进程架构吗？都有哪些进程，各自干嘛？为什么一个标签页崩了不会影响其他标签页？沙箱有什么用？

@oral
**先说结论**：现代浏览器（Chrome 系）是多进程架构，主要有浏览器主进程、渲染进程、GPU 进程、网络进程、插件进程。一个标签页崩了不影响其他页，是因为「每个标签页（或同站若干标签）跑在独立的渲染进程里」，进程间靠 IPC 通信、故障被隔离。

**再说原理**。浏览器主进程负责 UI、地址栏、管理其他进程、协调导航；渲染进程负责把 HTML/CSS/JS 变成页面（Blink 排版 + V8 执行 JS），每个标签页默认一个（同源策略下有时会合并）；GPU 进程负责图形合成、3D；网络进程管网络请求（从主进程拆出来，避免一个请求卡死拖垮全局）；插件进程隔离 Flash 等插件。沙箱（Sandbox）给渲染进程最低权限，不能直接读写磁盘/系统，所有敏感操作都要通过主进程 IPC 代理，这样即使页面被 XSS 注入了恶意脚本，破坏范围也被锁在沙箱里。

**真实关联**。我们做 Electron 桌面应用时，把不同业务窗口开不同渲染进程，一个重要报表页因为第三方图表库 OOM 崩了，但主进程和其他窗口都还好，没整体退出——这就是进程隔离的价值。我们也因此把重计算丢 Web Worker，避免渲染进程主线程被拖垮。

**边界取舍**：进程多了内存开销大（每个进程都有基础内存），所以浏览器会用「站点隔离（Site Isolation）」策略平衡——同站多标签可能共享进程，跨站才隔离；移动端更激进地合并进程省内存。

**收尾**：多进程 + 沙箱是「稳定性」和「安全性」的基石，理解它有助于排查卡顿（哪个进程 CPU 高）和安全边界。

@points
主进程（UI/导航/协调）、渲染进程（Blink+V8 出页面）、GPU 进程、网络进程、插件进程
标签页崩溃不传染，靠「独立渲染进程 + IPC 隔离」
沙箱给渲染进程最小权限，敏感操作走主进程 IPC 代理，限制 XSS 破坏范围
网络进程从主进程拆出，避免单请求卡死拖垮全局
代价是内存开销，故用站点隔离平衡：同站可能共享、跨站才隔离

@steps
先列五大进程及职责
讲为什么一页崩不影响其他：独立渲染进程 + IPC
讲沙箱：最小权限 + 主进程代理敏感操作
举真实案例：Electron 多进程隔离崩溃、Web Worker 搬重算
点取舍：进程内存开销 vs 隔离收益，站点隔离策略

@followups
为什么要把网络请求单独拆进程？——防止一个慢/挂的请求阻塞主进程，导致整个浏览器无响应
渲染进程崩溃用户会看到什么？——标签页显示「哇哦，崩溃了」之类提示，但浏览器和其他标签正常
站点隔离（Site Isolation）是什么？——每个跨站 iframe 也跑独立进程，防 Spectre 类侧信道攻击跨站读内存

@example
### 1. 把重计算丢进 Web Worker，避免渲染进程主线程卡顿

```javascript
// main.js：渲染进程主线程，把耗时计算交给 Worker
const worker = new Worker('./compute.worker.js')
worker.postMessage({ type: 'sort', data: hugeArray })
worker.onmessage = (e) => {
  console.log('排序完成，主线程全程没卡:', e.data)
}

// compute.worker.js：独立线程，OOM/崩了也不影响页面渲染
self.onmessage = (e) => {
  const sorted = e.data.data.sort((a, b) => a - b)
  self.postMessage(sorted)
}
```

### 2. 用 Chrome 任务管理器定位是哪个进程在吃 CPU

```bash
# 打开 Chrome 自带的任务管理器，能看到每个标签/进程的内存与 CPU
# 路径：右上角菜单 → 更多工具 → 任务管理器（快捷键 Shift+Esc）
# 排查卡顿时按 CPU 列排序，找到异常的标签页进程即可定位
echo "在任务管理器里按 CPU 列排序，找到异常的标签页进程"
```

## 07 · 本地存储方案对比：Cookie、localStorage、IndexedDB

@id
browser-storage

@level
进阶

@freq
3

@tags
本地存储 | IndexedDB | 容量

@ask
Cookie、localStorage、sessionStorage、IndexedDB 你都怎么选？各自容量、生命周期、能否跨标签页、有没有安全坑？大体积结构化数据你存哪？

@oral
**先说结论**：按数据规模和场景选——小体量、要随请求带的服务端状态用 Cookie；简单键值、跨标签页共享用 localStorage；仅会话内用 sessionStorage；大体积、结构化、要索引查询的用 IndexedDB。容量从小到大：Cookie 4KB、localStorage 约 5MB、IndexedDB 几百 MB 甚至上 G（按域配额）。

**再说原理**。Cookie 每次 HTTP 请求自动带（可限定 path/domain），有过期时间，最大约 4KB，且能被 JS 读（除非 `HttpOnly`），所以是 XSS 偷数据的重灾区，敏感票据务必 `HttpOnly+Secure+SameSite`。localStorage 是同步 API、同域共享、持久化、无过期（要自己实现 TTL），容量约 5MB，同步读写大数据会阻塞主线程。sessionStorage 同标签页、关页即清。IndexedDB 是异步的事务型数据库，存结构化数据、支持索引和游标查询，容量大、不阻塞主线程，但 API 偏底层、写起来啰嗦。

**真实项目**。我们做离线草稿：用户填的长表单（带图片 base64、富文本）明显超 localStorage 上限，改用 IndexedDB 存草稿，按需读、异步不卡界面；登录 token 放 Cookie 并 `HttpOnly` 防 XSS，顺手用 `SameSite=Lax` 挡 CSRF。localStorage 只放「主题、语言」这类小偏好。

**边界取舍**：别往 localStorage 塞大 JSON，同步解析会卡；Cookie 别放大对象，每次请求都带、浪费带宽还拖慢首字节；IndexedDB 写操作要包事务，异常要回滚。

**收尾**：选存储先看「多大、要不要随请求、要不要跨标签、要不要查询」，再定方案。

@points
Cookie ~4KB、随请求自动带、有 HttpOnly/Secure/SameSite 防盗
localStorage ~5MB、同步、跨标签持久、无 TTL 要自实现
sessionStorage 仅会话、关页清、不跨标签
IndexedDB 异步事务库、容量大、支持索引查询、不阻塞主线程
选型看：体积、是否随请求、是否跨标签、是否需查询

@steps
先给容量阶梯：Cookie 4KB < localStorage 5MB < IndexedDB 数百 MB
讲 Cookie 的自动携带与安全属性（HttpOnly/Secure/SameSite）
讲 localStorage 同步陷阱与 TTL 自实现
讲 sessionStorage 会话级边界
讲 IndexedDB 适用场景与异步事务

@followups
为什么 Cookie 容易被 XSS 偷？——没设 HttpOnly 时 JS 能读，XSS 注入脚本 document.cookie 就全拿走，故敏感票务必 HttpOnly
localStorage 同步读写大数据会怎样？——主线程被阻塞，界面卡顿，甚至触发 Long Task
IndexedDB 和 localStorage 能不能跨标签页通信？——都能；localStorage 还触发 storage 事件，IndexedDB 需自己轮询或配合 BroadcastChannel

@example
### 1. 带 TTL 的 localStorage 封装

```javascript
// localStorage 本身没有过期机制，自己给每条加 expire 时间戳
function setWithTTL(key: string, value: unknown, ttlMs: number) {
  const payload = JSON.stringify({ value, expire: Date.now() + ttlMs })
  localStorage.setItem(key, payload)
}

function getWithTTL(key: string) {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  const { value, expire } = JSON.parse(raw)
  if (Date.now() > expire) {
    localStorage.removeItem(key) // 过期自动清，避免脏数据堆积
    return null
  }
  return value
}
```

### 2. 用 IndexedDB 存大体积草稿（异步、不阻塞主线程）

```javascript
// 打开数据库，版本号变化会触发 upgrade（建表/加索引）
const db = await new Promise<IDBDatabase>((resolve) => {
  const req = indexedDB.open('draft-db', 1)
  req.onupgradeneeded = () => {
    req.result.createObjectStore('drafts', { keyPath: 'id' })
  }
  req.onsuccess = () => resolve(req.result)
})

// 存草稿：事务包起来，异步写入，大 JSON 也不卡界面
const tx = db.transaction('drafts', 'readwrite')
tx.objectStore('drafts').put({ id: 'post-1', content: bigHtml })
```

## 08 · Service Worker 与离线缓存、PWA 怎么落地

@id
browser-service-worker

@level
进阶

@freq
2

@tags
ServiceWorker | 离线 | PWA

@ask
Service Worker 是什么？怎么用它做离线缓存和 PWA？你在项目里落地过吗？有哪些坑？

@oral
**先说结论**：Service Worker（SW）是跑在浏览器背后的独立线程脚本，能拦截页面网络请求、做缓存和消息推送，是 PWA 离线和「类原生」体验的核心。它不走页面主线程，靠 `fetch` 事件拦截请求、用 Cache API 缓存资源，配合 manifest 实现可安装、可离线。

**再说原理**。生命周期：注册（register）→ 安装（install，预缓存静态资源）→ 激活（activate，清理旧缓存）→ 运行中拦截 fetch。经典策略是「缓存优先（Cache First）给静态资源、网络优先（Network First）给接口、Stale-While-Revalidate 给可容忍旧数据的接口」。SW 必须用 HTTPS（localhost 调试例外），作用域受注册路径限制，且默认不马上接管页面，要等下次导航或 `skipWaiting` + `clients.claim` 才生效——这就是著名的「更新延迟坑」。

**真实落地**。我们给内部工具做了 PWA：注册 SW 预缓存壳资源（HTML/JS/CSS），首次访问后断网也能打开；接口用 SWR 策略，弱网下先返缓存再用网络更新。manifest 配了图标和 `display: standalone`，员工能「添加到主屏幕」像 App 一样用。结果弱网/地铁里照样能用，留存明显提升。

**边界取舍**：SW 缓存要设版本号并清理旧缓存，否则发版后用户一直拿旧资源；调试麻烦，DevTools 要手动「Update on reload」；不要缓存带用户态的接口，否则串号。

**收尾**：SW 价值在「可靠（离线）+ 快（缓存）」，但要管好缓存版本和激活时机，否则上线比不上有坑。

@points
SW 是独立后台线程，拦截 fetch、做缓存/推送，PWA 核心
生命周期：register→install(预缓存)→activate(清旧)→运行拦截
缓存策略：静态 Cache First、接口 Network First、可旧数据 SWR
更新坑：默认下次导航才生效，需 skipWaiting+clients.claim 才即时
必须 HTTPS（localhost 例外），缓存要带版本并清理防串号

@steps
先定义 SW：后台线程、拦截请求、PWA 核心
讲生命周期四阶段与每阶段做什么
讲三类缓存策略及适用资源
讲真实落地：预缓存壳 + manifest + SWR 接口
点坑：更新延迟、版本清理、不缓存用户态接口

@followups
SW 为什么能离线？——install 时把壳资源塞进 Cache，断网后 fetch 被拦截返回缓存，页面照常打开
skipWaiting 和 clients.claim 干嘛？——让新 SW 跳过等待立即激活并控制所有页面，解决「更新不生效」坑
SW 和 localStorage 谁优先？——不同层；SW 管网络/资源缓存（离线），localStorage 管小键值，二者互补不冲突

@example
### 1. 注册 Service Worker 并在 install 预缓存壳资源

```javascript
// main.js：注册 SW，作用域默认是脚本所在目录
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(() => {
    console.log('SW 注册成功，下次导航开始接管请求')
  })
}
```

### 2. sw.js：安装预缓存 + 运行时拦截请求

```javascript
// sw.js：安装阶段把壳资源塞进 Cache，断网也能打开页面
const CACHE = 'v1-shell'
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(['/', '/app.js', '/style.css']))
  )
  self.skipWaiting() // 跳过等待，新 SW 立即激活
})

// 运行阶段拦截请求：静态资源缓存优先，接口网络优先
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (url.pathname.startsWith('/api/')) {
    // 接口：先网络，失败再返缓存（离线兜底）
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)))
  } else {
    // 静态：缓存优先，没有再走网络
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)))
  }
})
```

## 09 · 跨标签页通信有哪几种方案

@id
browser-cross-tab

@level
进阶

@freq
2

@tags
跨标签页 | BroadcastChannel | storage

@ask
多个标签页之间怎么通信？你都知道哪些方案？各自适用什么场景？

@oral
**先说结论**：跨标签页通信常用五招——BroadcastChannel（同源广播，最现代）、localStorage 的 `storage` 事件（改值触发其他标签）、SharedWorker（同源共享线程）、`postMessage` + `window.opener`（父-子窗口）、以及 storage 轮询兜底。同源是前提，跨域要走 `postMessage` 带 targetOrigin。

**再说原理**。BroadcastChannel 是同域网内最干净的方案：建一个同名 channel，一个页 `postMessage`、其他页 `onmessage` 收到，零轮询、语义清晰。localStorage 的 `storage` 事件在「其他」标签页修改时触发（当前页不触发），用它做轻量通知很方便，但只能传字符串、且要序列化。SharedWorker 适合需要共享状态/长连接的场景，但兼容性和调试成本高。传统的 `window.open` 拿到 `opener` 互发 `postMessage` 适合「父-子」窗口。

**真实项目**。我们做「多标签登录互踢」：用户在 A 标签退出登录，要通知所有其他标签跳登录页。用 BroadcastChannel 广播一个 `{type:'logout'}` 消息，各标签监听后清本地态并跳转；同时后端撤销 token 双保险。比轮询接口省流量、比 storage 事件语义清晰。另有个场景用 storage 事件同步「主题切换」，改 localStorage 后所有标签即时换肤。

**边界取舍**：BroadcastChannel 不支持老浏览器（IE 没戏），要降级到 storage 事件；跨域通信必须用 `postMessage` 且校验 `event.origin`，否则有安全风险；SharedWorker 在 Firefox 隐私模式有坑。

**收尾**：优先 BroadcastChannel，要兼容就降级 localStorage storage 事件，跨域用 postMessage 并校验来源。

@points
BroadcastChannel：同源码内广播，语义最清晰、零轮询（首选）
localStorage storage 事件：其他标签改值才触发，当前页不触发，只能传字符串
SharedWorker：同源共享线程，适合长连接/共享态，但兼容性调试成本高
postMessage + opener：适合父-子窗口，跨域须校验 event.origin
选型：同源优先 BroadcastChannel，兼容降级 storage，跨域用 postMessage

@steps
先列方案：BroadcastChannel / storage 事件 / SharedWorker / postMessage
讲 BroadcastChannel 原理与用法
讲 storage 事件触发条件（其他标签）与限制
讲真实案例：登出互踢、主题同步
点边界：兼容性降级、跨域校验 origin

@followups
storage 事件当前页会触发吗？——不会，只在「其他」同源标签修改时触发，常被人误用
BroadcastChannel 和 postMessage 区别？——前者同源广播一对多、自动路由；后者点对点、可跨域但要指定 targetOrigin
SharedWorker 有什么特别坑？——Firefox 隐私窗口不支持，且一个 Worker 共享所有标签状态，调试要靠 about:debugging

@example
### 1. BroadcastChannel：同源多标签广播（首选）

```javascript
// 每个标签页建一个同名 channel，互相收发消息
const channel = new BroadcastChannel('app-sync')

// 标签页 A：用户退出登录，广播通知所有其他标签
channel.postMessage({ type: 'logout', at: Date.now() })

// 标签页 B/C：监听后清本地态并跳转登录页
channel.onmessage = (e) => {
  if (e.data.type === 'logout') {
    localStorage.clear()
    location.href = '/login'
  }
}
```

### 2. localStorage 的 storage 事件兜底（兼容老浏览器）

```javascript
// 注意：storage 事件只在「其他」同源标签修改时触发，当前页不触发
window.addEventListener('storage', (e) => {
  if (e.key === 'theme') {
    // e.newValue 是别的标签写入的新值，拿到即同步换肤
    document.documentElement.dataset.theme = e.newValue
  }
})

// 写入方只需正常改 localStorage，其他标签的 storage 事件会自动响应
localStorage.setItem('theme', 'dark')
```

## 10 · requestAnimationFrame 与流畅动画、长任务切片

@id
browser-raf

@level
进阶

@freq
2

@tags
rAF | 长任务 | 动画

@ask
requestAnimationFrame 是什么？和 setTimeout 做动画比有什么优势？长任务怎么切片不卡界面？

@oral
**先说结论**：`requestAnimationFrame`（rAF）是浏览器在下一次重绘前调用的回调，专为动画而生；相比 `setTimeout(fn,16)` 做动画，它能和浏览器刷新率对齐、页面隐藏时自动暂停、且不易掉帧。长任务切片则是把大计算拆成小块，每帧用 rAF 或 `setTimeout(0)` 让出主线程，避免界面冻结。

**再说原理**。显示器按固定频率（通常 60Hz，每帧 ~16.7ms）刷新。rAF 回调在每次重绘前执行，时机和刷新对齐，动画最顺；而 `setTimeout` 最小延迟 4ms、且不在渲染管线里、后台标签页仍跑、容易堆积导致丢帧和电量浪费。rAF 在页面切到后台（visibilityState hidden）时浏览器会暂停调用，省 CPU。长任务（>50ms）会阻塞渲染造成卡顿，切片思路是「把活拆成 N 段，每段做完让出主线程」，用 rAF 串起下一段，或用 `scheduler.yield()`（新 API）主动让出。

**真实场景**。我们做万条数据导出/格式化，一次性循环处理直接卡死界面好几秒。我改成用 rAF 切片：每帧处理 200 条，处理完 `requestAnimationFrame(nextChunk)`，期间用户还能滚动、点按钮；也用 `IntersectionObserver` 配合 rAF 做无限滚动的节流。动画方面，把 `left/top` 的 `setTimeout` 改 `transform` + rAF，FPS 从 30 拉回 60。

**边界取舍**：rAF 不适合做「精确计时」（后台会暂停，累计时间要自己算）；切片粒度要调，太细（每帧太少）总时长变长、太粗（每帧太多）仍卡，一般按「每帧 < 8ms」来切；`scheduler.yield` 兼容性还不全，生产要降级 rAF。

**收尾**：动画用 rAF 对齐刷新率，计算用切片让出主线程，两者都围绕「别霸占主线程」这一条。

@points
rAF 在重绘前调用、对齐刷新率，比 setTimeout 动画更顺、后台自动暂停
setTimeout 最小 4ms、不在渲染管线、后台仍跑，易丢帧费电
长任务 >50ms 阻塞渲染，切片用 rAF 每帧让出主线程
切片粒度按「每帧 < 8ms」调，太细慢、太粗仍卡
scheduler.yield() 可主动让出，但兼容性不全，生产降级 rAF

@steps
先定义 rAF：重绘前回调、专为动画
对比 setTimeout：对齐刷新率 vs 最小延迟/后台仍跑
讲后台暂停省 CPU、适合动画不适合精确计时
讲长任务切片：拆段 + rAF 串下一段让出主线程
讲真实案例：大数据导出切片、IntersectionObserver 节流、transform 提 FPS

@followups
rAF 后台标签页还执行吗？——不执行（visibilityState hidden 时浏览器暂停），故不能用它做精确计时
长任务标准是多少？——>50ms 即算 Long Task，会卡渲染、拉高 INP
scheduler.yield 干嘛？——在长任务中主动让出主线程、让浏览器处理输入/渲染，避免卡 UI，是新标准可降级 rAF

@example
### 1. 用 rAF 做对齐刷新率的动画

```javascript
// 对比 setTimeout：rAF 在重绘前执行，自动对齐 60Hz，后台标签暂停
let x = 0
function animate() {
  x += 2
  // 用 transform 走合成层，不触发重排，60fps 稳定
  box.style.transform = `translateX(${x}px)`
  if (x < 300) requestAnimationFrame(animate)
}
requestAnimationFrame(animate)
```

### 2. 长任务切片：每帧让出主线程，界面不冻结

```javascript
// 要处理 10000 条数据，一次性循环会卡死界面好几秒
const data = new Array(10000).fill(0).map((_, i) => i)
let cursor = 0

function processChunk() {
  // 每帧只处理 200 条，控制在 ~8ms 内，处理完让出主线程
  const end = Math.min(cursor + 200, data.length)
  for (; cursor < end; cursor++) {
    data[cursor] = heavyTransform(data[cursor]) // 耗时计算
  }
  if (cursor < data.length) {
    // 用 rAF 串起下一段，期间用户仍能滚动、点击
    requestAnimationFrame(processChunk)
  } else {
    console.log('全部处理完，界面全程没卡')
  }
}
requestAnimationFrame(processChunk)
```
