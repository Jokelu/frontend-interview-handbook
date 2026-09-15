---
id: html
name: HTML
en: Markup & Semantics
icon: file-code
color: #e34c26
order: 1
desc: 语义化标签、meta 与脚本加载策略，考察你对页面基础结构的理解深度。
---

## 01 · DOCTYPE 有什么作用，为什么 HTML5 只要写 `<!DOCTYPE html>`

@id
html-doctype

@level
基础

@freq
3

@tags
DOCTYPE | 标准模式 | 怪异模式

@ask
你先讲讲 DOCTYPE 是干嘛用的？为什么以前那些老页面要写一长串带链接的声明，现在一行 `<!DOCTYPE html>` 就完事了，这背后到底差在哪？

@oral
**先说结论**：DOCTYPE 不是 HTML 标签，它是一句「声明」，唯一作用就是告诉浏览器「用哪个文档模式来解析这一页」，写出来就能进**标准模式**，不写或写错就会掉进**怪异模式**。

**再说原理**。浏览器拿页面后要先决定渲染模式，DOCTYPE 就是那个开关。标准模式下，CSS 盒模型、尺寸计算、属性行为都按 W3C 规范来；怪异模式（Quirks Mode）是为了兼容 IE5 时代那些「不规范但已经上线」的老页面，浏览器会故意模拟旧行为。最典型的坑是**盒模型**：怪异模式里 `width` 把 `padding` 和 `border` 都算进去了（IE5 盒模型），标准模式下 `width` 只是内容区。还有 `margin` 折叠、`table` 字号继承、百分比高度计算这些，两边都不一样。

**举个真实场景**。我接手过一个老后台，表单输入框在 Chrome 比设计稿宽了几个像素，查了半天才发现页面顶部被一段服务端模板注释顶到了 DOCTYPE 前面，导致整页退化成怪异模式，输入框的 `width` 把内边距也算进去了。把注释挪走、保证 `<!DOCTYPE html>` 是文档第一行后，宽度立刻对齐。这类问题排查时我会先敲 `document.compatMode`，返回 `BackCompat` 就是怪异模式，`CSS1Compat` 才是标准模式。

**边界与取舍**。DOCTYPE 必须放在文档最前面，前面不能有任何字符（连 BOM 和换行都要小心）；它大小写不敏感但惯例全大写。HTML5 把声明简化成 `<!DOCTYPE html>`，是因为 HTML5 只有标准模式一种，不需要再用 DTD 链接区分严格/过渡——那些老声明本质是「引用某个 DTD」，浏览器其实从不真的去下载它，只是拿声明的「种类」判断模式而已，所以冗长链接纯粹是历史包袱。

**收尾一句**：它不渲染任何东西，却是整页正确性的开关，漏写一行，后面所有布局都可能以错误模式计算。

@points
DOCTYPE 是文档模式声明而非标签，决定浏览器走标准模式还是怪异模式
怪异模式会模拟 IE5 旧行为，最典型差异是盒模型 width 是否包含 padding/border
DOCTYPE 必须位于文档最顶端，前面有字符就会导致整页退化为怪异模式
可用 document.compatMode 区分：BackCompat 是怪异，CSS1Compat 是标准
HTML5 只需 `<!DOCTYPE html>`，因为不再需要 DTD 链接区分严格/过渡模式

@steps
先一句话点明 DOCTYPE 是「模式开关」而不是标签，让面试官知道你理解到位
讲清标准模式与怪异模式的本质差异，重点抛「盒模型」这个最容易踩的点
结合自身或见过的真实 bug 说明漏写 / 写错 DOCTYPE 的后果，体现排查经验
补一句排查手段：document.compatMode 快速定位当前模式
收尾解释 HTML5 简化声明的合理性，避免把它讲成「为了好看」

@followups
DOCTYPE 前面多了一个空格会怎样？——只要不是换行或 BOM，单空格通常仍判定为标准模式，但保险起见保持它绝对第一行
HTML5 的 DOCTYPE 为什么不区分 Strict / Transitional？——HTML5 只有标准模式，DTD 链接只是历史遗留，浏览器从不下载，仅用声明种类判定模式
怪异模式下还有哪些常见差异？——margin 不折叠、table 内字体不继承、行内元素尺寸计算方式不同，都是老 IE 兼容行为

@example
### 1. 用 document.compatMode 判断当前渲染模式

```javascript
// 在控制台打印当前文档的兼容模式
console.log(document.compatMode)
// 标准模式输出："CSS1Compat"
// 怪异模式输出："BackCompat"（通常是 DOCTYPE 前多字符或被注释顶掉了）

// 真实排查：封装一个快速断言，进页面就检查，避免默默退化
function assertStandardsMode() {
  if (document.compatMode !== 'CSS1Compat') {
    console.warn('[警告] 页面进入了怪异模式，请检查 DOCTYPE 是否在最前面')
  }
}
assertStandardsMode()
```

### 2. 怪异模式与标准模式的盒模型差异（同一段 CSS 两种结果）

```html
<!-- 下面这个盒子，在两种模式下渲染宽度完全不同 -->
<div class="box">宽度测试</div>

<style>
  /* 无论哪种模式，CSS 都写一样 */
  .box {
    width: 200px;      /* 期望内容区宽度 */
    padding: 20px;     /* 内边距 */
    border: 5px solid; /* 边框 */
  }
</style>
```

- 标准模式（CSS1Compat）：盒子实际占位 = 200 + 20×2 + 5×2 = **250px**（width 只算内容区）
- 怪异模式（BackCompat）：盒子实际占位 = **200px**（width 已把 padding、border 全包进去，内容区被压缩成 150px）
- 这就是为什么老页面「看起来更挤」——同样的 width，怪异模式里真正能放字的地方变小了

### 3. 历史包袱：旧式 DOCTYPE 为什么那么长

```html
<!-- HTML 4.01 严格型：引用外部 DTD，但其实浏览器从不真的去下载它 -->
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN"
  "http://www.w3.org/TR/html4/strict.dtd">

<!-- HTML 4.01 过渡型：允许一些废弃标签，同样只是「声明种类」 -->
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN"
  "http://www.w3.org/TR/html4/loose.dtd">

<!-- HTML5：只有标准模式，声明退化成一行，浏览器照常进标准模式 -->
<!DOCTYPE html>
```

实际项目里只要写最后这一行即可；带 DTD 链接的旧声明纯属兼容老规范的残留。

## 02 · 语义化标签到底有什么价值，你是怎么在项目里落地的

@id
html-semantic

@level
基础

@freq
3

@tags
语义化 | SEO | 可访问性

@ask
语义化标签到底有什么价值？你说你项目里用过，具体是怎么落地的，别光说「结构更清晰」这种空话。

@oral
**先说结论**：语义化就是用「对的标签表达对的意图」，让机器（爬虫、读屏）和人（接手的同事）都能一眼读懂结构，而不是满屏 `div` 配 class 猜含义。

**再说原理**。语义化的价值分三层。第一，**SEO**：爬虫没有眼睛，它靠标签权重理解页面，`<h1>` 是主标题、`<nav>` 是导航、`<article>` 是独立内容、`<time>` 带机器可读时间，这些都会提升结构化理解。第二，**可访问性（a11y）**：读屏软件按 landmark（`header`/`nav`/`main`/`footer`）帮视障用户快速跳转，比「第 13 个 div」友好太多。第三，**可维护性**：语义标签自带默认角色和少量样式，少写 class、少写 JS，团队协作时意图自解释。

**举个真实场景**。我们后台之前是 `<div class="header">`、`<div class="nav">`、`<div class="content">` 这种 div soup。我接手后按角色改成 `<header>`/`<nav>`/`<main>`/`<article>`/`<aside>`/`<footer>`，文章页配 `<article>` 加 `<time datetime="2024-03-12">` 给搜索引擎喂结构化发布时间；商品卡用 `<section>` 配正确的 `h2` 标题层级。改动后读屏的「 landmarks 列表」能直接列出导航和正文，新同事也不用再翻 CSS 猜哪块是侧边栏。

**边界与取舍**。别为语义而语义：过度嵌套 `<section>` 反而让大纲混乱，`section` 应该至少有一个 heading。语义标签**不等于布局工具**，横向排列、间距这些还是交给 class 和 flex。另外老浏览器（IE8 及以下）不认识这些标签，需要 `html5shiv`；现在现代浏览器已无此问题，但自定义元素样式前仍建议先 `display: block`。

**收尾一句**：语义化省的是「长期沟通成本」——对机器更友好，对半年后改你代码的同事也更友好。

@points
语义化 = 用对的标签表达对的意图，价值在 SEO、可访问性、可维护性三层
爬虫靠标签权重理解页面，time/datetime 能喂结构化数据给搜索引擎
读屏按 landmark 导航，比让视障用户数 div 友好得多
落地靠把 div soup 换成 header/nav/main/article/aside/footer 并配正确标题层级
语义标签不是布局工具，别过度嵌套 section，老 IE 需 html5shiv

@steps
先点出语义化是「意图自解释」，不是单纯好看，区分于 div + class
讲清 SEO、a11y、可维护性三层价值，每层举一句话例子
拿自己项目的 div soup 改造成语义结构的真实经历，说明解决了什么
补边界：section 要带 heading、语义标签不替代布局、老浏览器兼容
收尾强调它降低长期沟通成本，体现工程视角

@followups
section 和 div 到底怎么选？——只要这段内容在文档大纲里「有且只有一个主题 + 标题」，就用 section；纯样式容器用 div
article 和 section 的区别？——article 是可独立分发/转载的完整内容（如一篇博文），section 是主题分组，article 里常套 section
HTML5 标签在 IE8 怎么兼容？——引入 html5shiv 让它创建未知元素，再补 display:block，现代项目已无需

@example
### 1. 改造前：典型的 div soup（机器读不懂结构）

```html
<!-- 反例：全用 div，爬虫和读屏只能靠 class 名猜意图 -->
<div class="header">
  <div class="nav">
    <div class="item">首页</div>
    <div class="item">商品</div>
  </div>
</div>
<div class="content">
  <div class="post-title">一周前端复盘</div>
  <div class="post-date">2024-03-12</div>
  <div class="post-body">……正文……</div>
</div>
```

### 2. 改造后：语义结构一眼可读，且对机器友好

```html
<!-- 正例：用 landmark 与语义标签，结构自解释 -->
<header>
  <nav>
    <a href="/">首页</a>
    <a href="/goods">商品</a>
  </nav>
</header>

<main>
  <!-- article 表示一篇可独立转载的内容 -->
  <article>
    <h1>一周前端复盘</h1>
    <!-- time 的 datetime 给搜索引擎喂机器可读的时间 -->
    <time datetime="2024-03-12">2024-03-12</time>
    <p>……正文……</p>
  </article>

  <!-- aside 表示与主内容弱相关的侧边信息 -->
  <aside>
    <h2>相关推荐</h2>
    <ul><li>……</li></ul>
  </aside>
</main>

<footer>© 2024 我的博客</footer>
```

读屏的 landmarks 列表会直接出现「导航 / 主要内容 / 补充内容 / 页脚」，视障用户可一键跳转。

### 3. 容易被忽略但很值的细节：figure 与 figcaption

```html
<!-- 图片 + 说明文字用 figure，说明会自动关联图片 -->
<figure>
  <img src="arch.png" alt="系统架构图">
  <figcaption>图 1：前端微前端拆分后的运行时架构</figcaption>
</figure>
```

`figcaption` 会被读屏作为图片的正式说明，比单独一个 `<div>` 文案靠谱，也利于 SEO 理解图片上下文。

## 03 · script 的 async 和 defer 有什么区别，页面脚本该怎么放

@id
html-script-async-defer

@level
进阶

@freq
3

@tags
async | defer | 阻塞

@ask
script 标签的 async 和 defer 到底差在哪？你页面里的脚本一般怎么放，为什么这么放？

@oral
**先说结论**：不带属性的 `<script>` 会**边下载边阻塞 HTML 解析**；`defer` 是「下载不阻塞、等文档解析完再按序执行」；`async` 是「下载不阻塞、但一下载完就立刻执行、顺序不保证」。三者核心区别就在「何时下载、何时执行、保不保证顺序」。

**再说原理**。经典 `<script src>` 浏览器要等它下载并执行完才继续往下解析 DOM，所以放 `<head>` 会拖慢首屏。加了 `defer`：脚本在后台下载，解析照常进行，等 `DOMContentLoaded` 触发前，按**出现顺序**依次执行——所以它既能拿到完整 DOM，又不阻塞渲染。`async` 也是后台下载，但一旦下载完**马上插队执行**，哪个先下完哪个先跑，彼此顺序打乱，所以它拿到的 DOM 状态不确定。

**举个真实场景**。我们站点把业务主逻辑放 `defer`（等价于放 `</body>` 前但更稳），保证执行时 DOM 已就绪且不卡首屏；第三方统计、广告 SDK 用 `async`，因为它们彼此独立、也不依赖我们的 DOM，早跑晚跑无所谓，关键是绝不能拖慢主流程。还有个坑：内联 `<script>` 加 `async`/`defer` 是**无效的**，它照样同步阻塞，因为没东西可「异步下载」。

**边界与取舍**。现代推荐用 ES Module——`<script type="module">` 默认就是 `defer` 行为，还自带严格模式和 CORS，几乎不用再手写 `defer`。但要记得 `defer`/`module` 脚本都在 `DOMContentLoaded` 之前执行，若你监听的是 `load` 事件则它们早已跑完。另外 `async` 脚本可能在 `DOMContentLoaded` 之前或之后执行，依赖 DOM 的初始化逻辑别放 async。

**收尾一句**：普通脚本别裸放 head；业务脚本用 defer/module，第三方无依赖脚本用 async，这是最稳的默认策略。

@points
经典 script 下载+执行都会阻塞 HTML 解析，裸放 head 拖慢首屏
defer：下载不阻塞、文档解析完后按出现顺序执行，能拿到完整 DOM
async：下载不阻塞、下完立即执行，顺序不保，不适合依赖 DOM 或彼此依赖的脚本
type="module" 默认就是 defer 行为，还带严格模式与 CORS
内联 script 的 async/defer 无效，仍同步阻塞，需异步请改用外部文件

@steps
先点出三者差异的维度：下载时机、执行时机、是否保序
讲经典 script 的阻塞问题，解释为什么不能裸放 head
对比 defer（保序、DOM 就绪后）与 async（乱序、下完就跑）的取舍
结合项目：业务脚本 defer/module，第三方统计 async
补边界：内联脚本 async 无效、module 默认 defer、别把依赖 DOM 的逻辑放 async

@followups
defer 脚本一定能拿到 DOM 吗？——能，因为它等文档解析完才执行，早于 DOMContentLoaded
async 脚本会触发 DOMContentLoaded 吗？——会，但执行时机不确定，可能在其前也可能在其后，依赖 DOM 的初始化别放 async
type="module" 和 defer 是一回事吗？——module 默认具备 defer 语义，且额外有严格模式、CORS 与按需 import，比手写 defer 更现代

@example
### 1. 三种 script 的加载时序对比（注释说明行为）

```html
<!-- 经典：下载+执行都阻塞解析，下面的 DOM 要等它跑完 -->
<script src="/blocking.js"></script>

<!-- defer：下载并行，解析继续，DOM 就绪后按书写顺序执行 -->
<script defer src="/main.js"></script>
<script defer src="/util.js"></script>
<!-- 执行顺序固定为 main.js → util.js，且都在 DOMContentLoaded 前 -->

<!-- async：下载并行，谁先下完谁先执行，顺序不可控 -->
<script async src="/analytics.js"></script>
<script async src="/ads.js"></script>
<!-- analytics 与 ads 谁先跑不确定，彼此不能依赖 -->

<!-- module：默认 defer 行为，还带严格模式与 CORS -->
<script type="module" src="/app.js"></script>
```

### 2. 内联脚本的陷阱：async/defer 对它无效

```html
<!-- 反例：内联脚本没有「可异步下载」的过程，async/defer 被忽略 -->
<script async>
  // 这段仍然同步执行并阻塞解析，async 形同虚设
  console.log('我还是阻塞的')
</script>

<!-- 正例：想异步就拆成外部文件再用 async -->
<script async src="/inline-extracted.js"></script>
```

### 3. 真实落地的放置策略

```html
<head>
  <!-- 关键样式先上，脚本后置 -->
  <link rel="stylesheet" href="/app.css">
  <!-- 业务主逻辑：defer，不阻塞首屏且 DOM 就绪 -->
  <script defer src="/app.js"></script>
  <!-- 第三方统计：async，独立、不依赖我们的 DOM -->
  <script async src="https://cdn.stats.com/sdk.js"></script>
</head>
<body>
  <!-- 页面内容先到，用户更快看到东西 -->
  <div id="app">……</div>
</body>
```

`</body>` 前放脚本是老办法，现在用 `defer` 写在 head 里效果等价且更靠前、更稳。

## 04 · img 的 srcset 和 sizes 怎么用，怎么做好响应式图片

@id
html-responsive-image

@level
进阶

@freq
2

@tags
srcset | 响应式图片 | 性能

@ask
img 的 srcset 和 sizes 怎么配合用？光给 width:100% 算不算响应式图片，为什么？

@oral
**先说结论**：`srcset` + `sizes` 是让浏览器按「设备像素比 + 图片实际显示宽度」**自动挑选最合适那张图**的机制，核心是省流量、提清晰度；只写 `width:100%` 只是让图「缩放显示」，下载的仍是同一张大图，根本没解决性能。

**再说原理**。`srcset` 有两种写法。**x 描述符**适合固定显示尺寸的场景，比如 `srcset="a.png 1x, a@2x.png 2x"`，浏览器按设备 DPR 选；**w 描述符**适合图片会随布局变宽的场景，它告诉浏览器「每张图的固有宽度」，再配合 `sizes` 告诉浏览器「这张图在不同断点下会显示多大」。浏览器用「显示宽度 × DPR」去 `srcset` 里挑最接近的一张。注意 `sizes` 是给浏览器算数用的，**不是** CSS——CSS 里的真实宽度另算。

**举个真实场景**。商品列表缩略图在手机上占半屏、在桌面只占 200px，我会写 `sizes="(max-width: 600px) 50vw, 200px"`，`srcset` 给 `200w/400w/800w` 三档，手机高 DPR 自动拿 400w 那张、桌面拿 200w，既不糊也不浪费。详情大图用 `sizes="(max-width: 1000px) 100vw, 1000px"`。

**边界与取舍**。第一，`srcset` 只决定「下哪张图」，图片仍会随容器拉伸，必须配 `max-width:100%; height:auto` 防止溢出。第二，DPR 自适应 ≠ 艺术指导（不同裁切），后者要用 `<picture>` + `<source media>`。第三，浏览器有自己启发式，最终选哪张不 100% 可控，但方向一定更优。第四，别忘了 `src` 作为不支持 `srcset` 的老浏览器兜底。

**收尾一句**：响应式图片 = 让对的设备下对的图，srcset/sizes 管「选图」，CSS 管「显示」，二者配合才是完整方案。

@points
srcset + sizes 让浏览器按 DPR 与显示宽度自动选图，核心是省流量提清晰度
x 描述符按设备像素比选（1x/2x），w 描述符 + sizes 按布局宽度选
sizes 是给浏览器算数用的显示宽度，不是 CSS，决定挑哪张 w
只写 width:100% 只是缩放显示，下载的还是同一张大图，没解决性能
需要不同裁切用 picture + source media（艺术指导），src 始终作老浏览器兜底

@steps
先点明 srcset/sizes 解决「下哪张图」而非「怎么显示」
讲清 x 描述符（固定尺寸/DPR）与 w 描述符（可变宽度）两种用法
解释 sizes 如何把「媒体条件 → 显示宽度」映射给浏览器做选择
结合商品列表/详情页给出真实断点与 w 档位
补边界：CSS 仍要 max-width:100%、艺术指导用 picture、src 兜底

@followups
sizes 写错了会怎样？——浏览器按错误的显示宽度选图，可能下太大或太小的图，但页面不会崩，只是不最优
srcset 和 CSS background-image 响应式是一回事吗？——不是，CSS 用 image-set() 做类似事，但 img 的 srcset 对 SEO/可访问性更友好
为什么还要写 src 兜底？——老浏览器不认识 srcset 时退化到 src，且 srcset 失效时也能保证有图可显示

@example
### 1. 推荐写法：w 描述符 + sizes 自适应布局宽度

```html
<!-- srcset 给三档固有宽度；sizes 告诉浏览器「这图会显示多大」 -->
<img
  src="goods-200w.jpg"
  srcset="goods-200w.jpg 200w,
          goods-400w.jpg 400w,
          goods-800w.jpg 800w"
  sizes="(max-width: 600px) 50vw, 200px"
  alt="商品缩略图"
>
```

- 手机（屏宽 375，DPR 2，显示 50vw≈188px → 需求 375px 图）：浏览器挑 `goods-400w.jpg`
- 桌面（显示 200px，DPR 1 → 需求 200px 图）：浏览器挑 `goods-200w.jpg`
- 结果：手机不糊、桌面不浪费流量

### 2. 固定尺寸场景：x 描述符按 DPR 选

```html
<!-- 头像始终 48px 显示，按设备像素比给图 -->
<img
  src="avatar-1x.png"
  srcset="avatar-1x.png 1x, avatar-2x.png 2x, avatar-3x.png 3x"
  alt="用户头像"
>
```

普通屏下 1x，Retina/高分屏下 2x/3x，避免头像发虚。

### 3. 反例：只 width:100% 并不「响应式」

```html
<!-- 反例：下载的还是这一张 1200px 大图，手机照样拉满流量 -->
<img src="huge-1200w.jpg" style="width:100%">

<!-- 正例：下载按设备降级，显示仍 100% 自适应 -->
<img
  src="huge-1200w.jpg"
  srcset="huge-400w.jpg 400w, huge-800w.jpg 800w, huge-1200w.jpg 1200w"
  sizes="100vw"
  style="max-width:100%; height:auto"
  alt="宽幅配图"
>
```

`max-width:100%; height:auto` 防止图片溢出容器，srcset 才真正省流量。

## 05 · 图片懒加载怎么实现，IntersectionObserver 怎么用

@id
html-lazy-load

@level
进阶

@freq
3

@tags
懒加载 | IntersectionObserver | 性能

@ask
图片懒加载怎么实现？原生 loading="lazy" 够用吗，什么时候必须上 IntersectionObserver？

@oral
**先说结论**：懒加载就是「视口外的图片先不下载，滚到附近再加载」，首屏流量和请求数直接降下来。现代优先用原生 `loading="lazy"`，但**长列表、瀑布流、要占位/淡入/预加载距离**这类复杂场景，必须自己用 `IntersectionObserver` 接管。

**再说原理**。原生 `loading="lazy"` 是浏览器内置能力，你只要写一个属性，它自己判断元素离视口多远时开始下载，零 JS、零依赖。但它可控性差：什么时候加载由浏览器决定，你没法做「进入前 200px 就预加载」或「加载完做模糊淡入」。`IntersectionObserver` 是标准的「交叉观察器」API：你告诉它观察哪些元素、以哪个根（默认视口）和多大 `rootMargin` 为边界，元素进入边界时回调里把 `data-src` 换成 `src`，再 `unobserve` 取消观察，避免重复触发。

**举个真实场景**。我们做商品瀑布流，先用一张低清 base64 或纯色块占位（定好高度防 CLS 抖动），`IntersectionObserver` 设 `rootMargin: '200px'` 提前预加载，回调里把高清图地址赋给 `src`，`onload` 后做透明度淡入。相比老办法 `scroll` 事件里狂算 `getBoundingClientRect`，IO 由浏览器在合成线程批量处理，不阻塞主线程，列表频繁增删也稳。

**边界与取舍**。第一，原生 `loading="lazy"` 对**首屏之上**或 LCP 关键图别用，会拖慢最大内容绘制。第二，IO 有兼容性下限（IE 不支持），要做 fallback：不支持就直接全部加载，或退化为 `scroll` + 节流。第三，换图后务必 `unobserve`，否则滚动会反复触发。第四，占位高度一定要先定好，否则图片加载后撑开布局，CLS 指标难看。

**收尾一句**：简单页面 `loading="lazy"` 一行搞定；要体验、要预加载、要可控，就上 IntersectionObserver。

@points
懒加载 = 视口外图片延迟下载，直接降首屏流量与请求数
原生 loading="lazy" 零 JS 但不可控，复杂体验场景不够用
IntersectionObserver 在元素进入视口边界时回调，换 src 后必须 unobserve
IO 用 rootMargin 可提前预加载，比 scroll + getBoundingClientRect 更省主线程
兜底：首屏关键图别懒加载（伤 LCP），不支持 IO 时降级为全加载或 scroll 节流

@steps
先点出懒加载价值：省首屏流量与请求，再区分原生与 IO 的适用边界
讲原生 loading="lazy" 的原理与局限（不可控、伤 LCP 时不适用）
讲 IntersectionObserver 机制：观察元素、rootMargin 边界、回调换 src
结合瀑布流给真实实现：占位定高 + rootMargin 预加载 + onload 淡入 + unobserve
补边界：兼容性 fallback、首屏关键图不懒加载、防 CLS 抖动

@followups
IntersectionObserver 的回调会触发几次？——元素每次进出边界都会触发，所以换完图要 unobserve，否则反复执行
rootMargin 是干嘛的？——在视口外扩/内缩一段距离，比如 '200px' 表示提前 200px 预加载，避免滚动到才闪
loading="lazy" 万一不支持怎么办？——图片正常当作普通 img 加载（等价于不懒加载），不会裂图，所以它能安全渐进增强

@example
### 1. 最简单：原生懒加载（零 JS）

```html
<!-- 只要一个属性，浏览器自己决定何时下载 -->
<img src="banner.jpg" loading="lazy" alt="横幅">

<!-- 注意：首屏之上、LCP 关键图不要用，会拖慢最大内容绘制 -->
<img src="hero.jpg" alt="首屏主图"><!-- 这里不写 loading="lazy" -->
```

### 2. 进阶：用 IntersectionObserver 接管瀑布流（占位 + 预加载 + 淡入）

```html
<!-- 占位用低清图，data-src 存高清地址，先定宽高防 CLS 抖动 -->
<img class="lazy" data-src="goods-800w.jpg" src="placeholder.jpg"
     width="400" height="300" alt="商品图">
```

```javascript
// 不支持 IO 时直接全部加载，保证不裂图（渐进增强兜底）
function loadAllFallback() {
  document.querySelectorAll('img.lazy').forEach((img) => {
    img.src = img.dataset.src
  })
}

if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      // isIntersecting 为 true 表示进入了视口边界
      if (!entry.isIntersecting) return
      const img = entry.target
      // 把高清地址赋给 src，浏览器开始下载
      img.src = img.dataset.src
      // 加载完成后做淡入，体验更顺滑
      img.addEventListener('load', () => img.classList.add('loaded'), { once: true })
      // 关键：加载一次就取消观察，避免滚动反复触发
      observer.unobserve(img)
    })
  }, {
    // 视口外扩 200px，提前预加载，滚动到时不闪
    rootMargin: '200px 0px',
    threshold: 0,
  })

  document.querySelectorAll('img.lazy').forEach((img) => io.observe(img))
} else {
  loadAllFallback()
}
```

```css
/* 占位淡入：默认半透明，loaded 后变清晰 */
.lazy { opacity: 0.4; transition: opacity 0.3s; }
.lazy.loaded { opacity: 1; }
```

### 3. 反例：老办法 scroll 监听的代价

```javascript
// 反例：每次滚动都同步计算位置，列表长时严重卡主线程
window.addEventListener('scroll', () => {
  document.querySelectorAll('img.lazy').forEach((img) => {
    const rect = img.getBoundingClientRect() // 强制回流
    if (rect.top < window.innerHeight + 200) {
      img.src = img.dataset.src
    }
  })
})
// 即便加节流，也比 IO 在合成线程批量处理更重，且容易漏算
```

## 06 · meta viewport 里每个参数是什么意思，移动端怎么配

@id
html-meta-viewport

@level
基础

@freq
2

@tags
viewport | 移动端 | 适配

@ask
meta viewport 里每个参数都什么意思？你移动端页面一般怎么配，刘海屏又怎么处理？

@oral
**先说结论**：`<meta name="viewport">` 控制移动端「布局视口」的宽度与缩放行为，没它手机会把页面当成约 980px 的桌面版整体缩小显示，所有 px 设计稿全错位。

**再说原理**。核心参数是 `width`：设成 `device-width` 表示布局视口等于设备 CSS 像素宽度（iPhone 一般是 390 左右），这样 1px 才是真的 1px。`initial-scale=1` 是初始不缩放。`maximum-scale` / `minimum-scale` / `user-scalable` 控制用户能否双指缩放。还有一个关键参数 `viewport-fit=cover`，它让页面延伸到刘海/圆角的安全区之外，配合 `env(safe-area-inset-*)` 才能做真正的沉浸式全屏。

**举个真实场景**。我们 H5 后台统一用 `width=device-width, initial-scale=1`。做全屏活动页时额外加 `viewport-fit=cover`，顶部导航用 `padding-top: env(safe-area-inset-top)` 避开刘海，底部按钮加 `env(safe-area-inset-bottom)` 避开 Home 指示条。还有个 iOS 经典坑：输入框聚焦时若 `font-size < 16px`，Safari 会自动放大整个页面，所以表单字号我一律 ≥16px 来关掉这个行为。

**边界与取舍**。别写 `user-scalable=no`（或 `maximum-scale=1`）——这虽能防止误触缩放，但严重伤害可访问性，WCAG 明确不建议禁用，而且部分安卓机型禁用后反而出 bug。写多个 viewport 标签时浏览器以最后一个为准。另外 viewport 只管「视口」，真正的高清 1px 边框还得靠 transform 缩放或 0.5px 方案，跟它无关。

**收尾一句**：viewport 是移动端正确显示的地基，配错一步，后面所有适配都是建立在错误的底子上。

@points
viewport 控制布局视口宽度与缩放，没它手机会按 ~980px 桌面版缩小显示
width=device-width 让 1px 等于真实 CSS 像素，initial-scale=1 初始不缩放
viewport-fit=cover 配合 env(safe-area-inset-*) 才能做刘海屏沉浸式适配
禁用缩放（user-scalable=no）伤 a11y，WCAG 不建议，且部分机型有 bug
iOS 输入框 font-size<16px 聚焦会自动放大，表单字号建议 >=16px

@steps
先点出 viewport 解决「手机按桌面版缩放下」的根本问题
逐个解释 width/initial-scale 与 maximum/minimum-scale、user-scalable
讲 viewport-fit=cover + env() 解决刘海/圆角安全区适配
结合项目给出一个标准配置与全屏活动页的实际写法
补边界：别禁用缩放、多标签以最后一个为准、高清 1px 边框另想办法

@followups
为什么有时候页面还是被缩小了？——多半是漏写 width=device-width，或某个元素宽度超出视口导致浏览器放大布局视口
env(safe-area-inset-*) 不生效怎么办？——必须配合 viewport-fit=cover，否则安全区距离全是 0
user-scalable=no 真能提升体验吗？——短期防误触，但牺牲缩放 accessibility，且 iOS 某些版本会忽略，得不偿失

@example
### 1. 标准移动端配置

```html
<!-- 布局视口 = 设备宽度，初始不缩放：绝大多数 H5 的基线 -->
<meta name="viewport"
      content="width=device-width, initial-scale=1">

<!-- 沉浸式全屏（刘海屏）：让页面延伸到安全区之外 -->
<meta name="viewport"
      content="width=device-width, initial-scale=1, viewport-fit=cover">
```

### 2. 刘海屏安全区适配

```css
/* 用 env() 读取系统预留的安全距离，第二个值是兜底 */
.safe-header {
  /* 顶部避开刘海 / 状态栏 */
  padding-top: env(safe-area-inset-top, 0px);
}
.safe-footer {
  /* 底部避开 Home 指示条 */
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.safe-left  { padding-left:  env(safe-area-inset-left, 0px); }
.safe-right { padding-right: env(safe-area-inset-right, 0px); }
```

### 3. 两个反例

```html
<!-- 反例：禁用缩放伤 a11y，WCAG 不建议 -->
<meta name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">

<!-- iOS 输入框聚焦自动放大：font-size < 16px 会触发，正例用 >=16px -->
<input type="text" style="font-size:14px">
<input type="text" style="font-size:16px">
```

## 07 · 行内元素、块级元素、行内块元素的区别与常见坑

@id
html-display

@level
基础

@freq
2

@tags
display | 行内元素 | 布局

@ask
行内元素、块级元素、行内块元素到底有什么区别？你踩过哪些相关的坑？

@oral
**先说结论**：inline、block、inline-block 三者决定了元素「怎么排、能不能设宽高、怎么对齐」，九成布局坑都出在 inline 的不可控和 inline-block 的间隙上。

**再说原理**。**block** 独占一行、默认撑满父级宽度、可设 `width/height`、上下 `margin` 生效，典型是 `div`/`p`/`ul`。**inline** 与其他行内内容排同一行、受文字流影响、设 `width/height` 无效、上下 `margin` 无效（左右有效）、垂直对齐看 `vertical-align`，典型是 `span`/`a`/`em`。**inline-block** 兼具两者：像 inline 一样同行排列，又像 block 一样可设宽高、上下 margin 生效，典型是 `button`/`img`（默认就是）。

**举个真实场景**。我做横向导航菜单时常用 `inline-block` 让 `li` 并排且能设宽高，但立刻踩到「元素间莫名其妙有空隙」——那是 HTML 标签之间的空白字符被当成文字空格渲染了。解决办法有几种：父级 `font-size:0` 再给子级恢复字号、用负 `margin`、或干脆改 `flex`。还有图标+文字垂直不对齐，我靠 `vertical-align: middle` 修正而不是瞎调 `line-height`。

**边界与取舍**。inline 元素里不能放 block 元素（HTML5 虽允许 `a` 包 `div`，但语义和渲染要谨慎，容易出怪问题）。`margin` 塌陷是 block 之间的事，inline-block 之间不会塌陷但会有那个空白缝。`vertical-align` 只对行内/表格单元格生效，对 block 没用。现在布局多用 flex/grid，设了它们后子元素的 `display` 行为会被覆盖（比如 flex item 实际按 flex 规则排版），别再用老一套理解。

**收尾一句**：理解三者差异，你才知道「为什么这个宽高设不上去、为什么这两个元素之间总有缝」。

@points
block 独占一行可设宽高，inline 同行排列且宽高/上下 margin 无效
inline-block 兼具两者：同行排列又能设宽高，但元素间会有空白缝隙
inline-block 间隙来自标签间空白字符，可用 font-size:0 或 flex 消除
vertical-align 只对行内/表格单元格生效，图标+文字对齐常用 middle
flex/grid 容器内的子项 display 行为被覆盖，别再用 block/inline 老思路

@steps
先点出三者差异的维度：排列方式、能否设宽高、对齐方式
分别讲 block / inline / inline-block 的特征与典型标签
结合导航菜单讲 inline-block 间隙这个最常见坑及其解法
讲 vertical-align 与「inline 不能包 block」等边界
补一句现代布局用 flex/grid 后 display 语义被覆盖，思路要更新

@followups
img 默认是 inline 还是 block？——默认 inline-block（严格说是 replaced inline），所以底部常有几像素缝隙，用 display:block 或 vertical-align 修
margin 塌陷和 inline-block 缝隙是一回事吗？——不是，塌陷是 block 相邻 margin 合并，缝隙是行内空白字符，成因完全不同
为什么用了 flex 之后子元素 display 像失效了？——flex item 的排版由 flex 规则接管，display 的计算值会按 flex 调整，不是真的失效

@example
### 1. 三种 display 的直观差异

```html
<!-- 行内：两个 span 同行，设宽高无效 -->
<span class="inline">行内</span>
<span class="inline">行内</span>

<!-- 块级：两个 div 各占一行，可设宽高 -->
<div class="block">块级</div>
<div class="block">块级</div>

<!-- 行内块：同行排列，又能设宽高 -->
<button class="ib">行内块</button>
<button class="ib">行内块</button>
```

```css
.inline { width: 200px; height: 50px; } /* 无效：行内元素忽略宽高 */
.block  { width: 200px; height: 50px; } /* 有效 */
.ib     { width: 200px; height: 50px; } /* 有效：行内块 */
```

### 2. inline-block 间隙的成因与修复

```css
/* 反例：inline-block 元素间的空白字符被渲染成缝隙 */
.nav li { display: inline-block; }

/* 正例 1：父级 font-size:0，子级恢复字号 */
.nav { font-size: 0; }
.nav li { display: inline-block; font-size: 14px; }

/* 正例 2（更现代）：直接上 flex，根本没有缝隙问题 */
.nav { display: flex; gap: 8px; }
```

### 3. vertical-align 对齐图标与文字

```css
/* 图标 + 文字垂直不对齐，用 vertical-align 修正而不是调 line-height */
.icon {
  vertical-align: middle; /* 与父级中线对齐，常用且稳 */
  width: 16px;
  height: 16px;
}

/* img 底部默认有几像素缝隙（行内基线留白），转 block 即可消除 */
.img-block { display: block; }
```

## 08 · HTML5 新增了哪些实用的能力，你项目里真正用过什么

@id
html5-features

@level
进阶

@freq
2

@tags
HTML5 | 新特性 | 实战

@ask
HTML5 新增了哪些实用的能力？你说你项目里用过，具体用过哪些、怎么用的？

@oral
**先说结论**：HTML5 新能力我真正高频用的是 web storage、fetch、dataset、表单新类型、`<details>`/`<dialog>`、history API 和 Canvas/WebSocket——关键不是罗列，而是按场景选型，别为了用而用。

**再说原理**。这些本质是浏览器原生能力，用来减少库依赖、提升可控性。localStorage/sessionStorage 做本地缓存；fetch 替代 XHR 且配 AbortController 取消；`dataset` 读 `data-*` 避免 attr 拼接；`<details>/<summary>` 做折叠零 JS；`<dialog>` 做弹窗自带焦点陷阱和 `::backdrop`；history.pushState 做 SPA 路由不刷新；Canvas/WebSocket 做可视化与实时。

**举个真实场景**。搜索框我封装了一个带前缀和 JSON 序列化的 localStorage 工具，缓存用户最近搜索和草稿，刷新不丢；提交前用 `AbortController` 在组件卸载或重复提交时取消旧请求。后台表格的展开行直接用 `<details>` 加 `<summary>`，零 JS 还天然可访问。图片裁剪预览用 Canvas 把 `<input type=file>` 读进来画到画布上。SPA 路由切换用 `history.pushState` 不刷新整页。

**边界与取舍**。localStorage 是**同步**的、同源、约 5MB，别存大对象或敏感信息（明文、可被 XSS 读），高频写入会卡主线程，真要大存储考虑 IndexedDB。`<dialog>` 老浏览器需要 polyfill。`<details>` 默认样式简陋要自己美化。WebSocket 要做心跳和重连。Canvas 画高清屏必须乘 `devicePixelRatio` 否则发虚。

**收尾一句**：新特性是工具箱，先问「这个场景它合不合适、兼容性够不够」，再决定用不用，而不是见到就用。

@points
真正高频的有 web storage、fetch、dataset、details/dialog、history API、Canvas
fetch + AbortController 可在卸载/重复提交时取消请求，比 XHR 清爽
dataset 读 data-* 避免手动 attr 拼接，连字符自动转驼峰
details/summary 零 JS 折叠，dialog 原生弹窗带焦点陷阱与 backdrop
localStorage 同步同源约 5MB，别存敏感/大对象，高清 canvas 要乘 dpr

@steps
先点明「按场景选型」比罗列更重要，避免为用而用
挑几个真正落地过的：storage 缓存、fetch 取消、dataset 取值
讲 details/dialog 零 JS 交互与 history 路由这类「少写代码」的收益
补边界：storage 同步上限与安全隐患、dialog 兼容、canvas dpr
收尾强调选型看兼容与场景，而不是堆特性

@followups
localStorage 和 sessionStorage 区别？——前者关页还在、同源共享、约 5MB；后者仅当前标签页会话，关页即清
dialog 的 show() 和 showModal() 差在哪？——showModal() 是模态，带背景遮罩和焦点陷阱，Esc 关闭；show() 非模态
history.pushState 和 location.href 区别？——pushState 改 URL 不刷新、不发请求，适合 SPA；后者会整页跳转

@example
### 1. 带前缀 + JSON 的 localStorage 封装

```javascript
// 封装后刷新不丢、且防止隐私模式/XSS 解析崩溃时整页挂掉
const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem('app:' + key)
      return raw ? JSON.parse(raw) : fallback
    } catch {
      return fallback // 解析失败或隐私模式禁用时兜底
    }
  },
  set(key, value) {
    try {
      localStorage.setItem('app:' + key, JSON.stringify(value))
    } catch {
      /* 配额满或禁用时静默失败，不阻塞主流程 */
    }
  },
}
store.set('draft', { title: '未发送草稿' })
console.log(store.get('draft')) // { title: '未发送草稿' }
```

### 2. dataset 读 data-*，省掉 attr 拼接

```html
<!-- data-id / data-type 通过 dataset 直接读 -->
<button data-id="1024" data-type="goods">查看</button>

<script>
  const btn = document.querySelector('button')
  // 连字符自动转驼峰：data-id -> dataset.id
  console.log(btn.dataset.id)   // "1024"
  console.log(btn.dataset.type) // "goods"
</script>
```

### 3. details / dialog：零 JS 或原生弹窗

```html
<!-- details/summary：零 JS 折叠，天然可访问 -->
<details>
  <summary>展开筛选条件</summary>
  <p>品牌、价格区间、颜色……</p>
</details>

<!-- dialog：原生弹窗，自带焦点陷阱与 ::backdrop 遮罩 -->
<dialog id="dlg">
  <p>确认删除该商品？</p>
  <button onclick="dlg.close()">取消</button>
</dialog>
<button onclick="dlg.showModal()">删除</button>
```

## 09 · canvas 和 svg 该怎么选，各自适合什么场景

@id
html-canvas-svg

@level
进阶

@freq
2

@tags
canvas | svg | 可视化

@ask
canvas 和 svg 该怎么选？什么场景用哪个，为什么？

@oral
**先说结论**：canvas 和 svg 怎么选，看两个维度——**元素数量**和**要不要交互/无限缩放**：海量图形或逐帧动画用 canvas，少量图形、要矢量清晰或可交互用 svg。

**再说原理**。**canvas** 是位图、立即模式：你调一次 API 画一笔，结果就成像素，画完浏览器不保留「图形对象」，所以没有 DOM 事件，想点某个图形得自己写命中测试。它适合游戏、粒子、大批量数据的图表重绘，性能稳。**svg** 是矢量、保留模式：每个圆/路径都是 DOM 节点，可用 CSS 改色、绑事件、无损缩放到任意尺寸，适合图标、地图、流程图，但元素上万时 DOM 太重会卡。

**举个真实场景**。我们数据看板里，几十个数据点的折线图用 svg，鼠标 hover 直接给对应 `<path>` 绑 tooltip，改颜色一行 CSS 搞定；而实时股票 Tick 每秒重绘上千个点，就用 canvas，否则 svg 的 DOM 更新扛不住。公司 logo、状态图标全用 svg 内联，清爽还能随主题换色。

**边界与取舍**。svg 元素上千就开始吃力，canvas 则放大会糊且难做单元素事件。两者都要注意高清屏：canvas 必须按 `devicePixelRatio` 放大画布再 `scale` 回来，否则 Retina 下发虚；svg 天然矢量无所谓。还要考虑「要不要被读屏/SEO 理解」——svg 里的文字是真实文本，canvas 里画字对无障碍不友好，必要时得额外加 `aria-label`。

**收尾一句**：元素少、要交互、要缩放清晰选 svg；元素多、要性能、要逐帧选 canvas，这是最常用的判断线。

@points
canvas 位图+立即模式，画完即像素、无 DOM 事件，适合游戏/海量重绘
svg 矢量+保留模式，每图形是 DOM，可 CSS 改色/绑事件/无限缩放
元素少且要交互/SEO/缩放 → svg；元素上千或逐帧 → canvas
canvas 高清屏必须乘 devicePixelRatio 再 scale，否则 Retina 发虚
svg 元素上万 DOM 会卡，canvas 做单元素点击要自己命中测试

@steps
先点出判断维度：元素数量 + 是否要交互/无限缩放
讲 canvas 立即模式、无 DOM、适合性能敏感场景的原理
讲 svg 保留模式、可访问可交互、适合少量图形的原理
结合看板折线图(svg)与实时 Tick(canvas) 给真实对比
补边界：高清屏 dpr、svg 数量上限、可访问性取舍

@followups
canvas 怎么给某个图形绑点击事件？——没有 DOM 可绑，需在 click 里用坐标做命中测试（isPointInPath 等）
svg 太多元素卡顿怎么破？——减少节点、合并路径，或换成 canvas 渲染
为什么 Retina 下 canvas 发虚？——画布物理像素没乘 dpr，按 CSS 尺寸画的，放大后插值模糊

@example
### 1. canvas：立即模式，注意 devicePixelRatio

```javascript
// 取设备像素比，Retina 通常是 2 或 3
const dpr = window.devicePixelRatio || 1
const canvas = document.querySelector('#chart')
const ctx = canvas.getContext('2d')

// 关键：画布物理像素 = CSS 尺寸 × dpr，否则高清屏发虚
canvas.width = 400 * dpr
canvas.height = 300 * dpr
canvas.style.width = '400px'
canvas.style.height = '300px'

// 把坐标系缩放回 CSS 像素，之后按 400×300 画即可
ctx.scale(dpr, dpr)

// 立即模式：画一笔就成像素，画完不保留可点 DOM 节点
ctx.fillStyle = '#e34c26'
ctx.fillRect(20, 20, 120, 80) // 在 (20,20) 画 120×80 矩形
ctx.fillStyle = '#2f6bff'
ctx.beginPath()
ctx.arc(260, 80, 40, 0, Math.PI * 2) // 画一个圆
ctx.fill()
console.log('canvas 画完即像素，没有可点 DOM 节点')
```

### 2. svg：矢量 DOM，可 CSS 改色、可绑事件

```html
<!-- 矢量：无损缩放，每个图形是 DOM，可 CSS 改色、可绑事件 -->
<svg viewBox="0 0 24 24" width="24" height="24" class="icon" aria-label="三角形">
  <path d="M12 2 L2 22 L22 22 Z" fill="currentColor"></path>
</svg>

<style>
  .icon { color: #e34c26; cursor: pointer; }
  .icon:hover { color: #2f6bff; } /* 一行 CSS 改色，无需重绘 */
</style>

<script>
  // svg 里每个节点都能直接绑事件，这是 canvas 做不到的
  document.querySelector('.icon').addEventListener('click', () => {
    console.log('点到了这个三角形')
  })
</script>
```

### 3. 选型速记

```javascript
// 取舍速记：
// - 元素 < 几百、要交互/SEO/无限缩放 → svg（DOM 轻、可直接事件）
// - 元素上千、逐帧重绘（游戏/实时图表） → canvas（无 DOM 开销，但事件要自己命中测试）
// - 两者高清屏都要注意：canvas 乘 devicePixelRatio，svg 天然矢量
```

## 10 · 表单体验怎么做：原生校验、input 类型与可访问性

@id
html-form-a11y

@level
进阶

@freq
2

@tags
表单 | 校验 | a11y

@ask
表单体验你怎么做的？原生校验、input 类型、可访问性这几块你怎么兼顾？

@oral
**先说结论**：表单体验是「原生校验减负 + input 类型提效 + 可访问性兜底」三件一起做，只堆 JS 校验不算专业，漏了 a11y 更是硬伤。

**再说原理**。原生校验用 `required`、`pattern`、`min/max/step`、`type=email/url/number/tel/date` 让浏览器先拦一层，还顺带唤起合适的移动端键盘。`<label for>` 把文字和控件关联，读屏念得清；`aria-describedby` 关联错误提示文本；`fieldset`+`legend` 给一组输入起名字；CSS `:invalid`/`:user-invalid` 做视觉反馈；想自己接管就给 form 加 `novalidate` 再调 `reportValidity()`。

**举个真实场景**。注册表单里手机号用 `<input type="tel" pattern="^1[3-9]\d{9}$" required>`，邮箱用 `type="email"`，错误提示放在 `aria-live="polite"` 的区域，读屏会主动播报。密码强度提示我不弹 alert，而是实时更新一段 `aria-live` 文本。提交前调 `form.reportValidity()` 统一校验，失败自动聚焦第一个错误项。

**边界与取舍**。原生校验只是第一道门槛，**后端必须再校验**，前端拦不住恶意请求也防不了绕过。自定义校验用 `setCustomValidity('')` 清空、传消息设红。千万别用 `placeholder` 替代 `label`——placeholder 聚焦/填充后消失，读屏很多时候不读它，可访问性直接不及格。还有 `user-scalable` 别禁，否则表单聚焦缩放被关掉体验更差。

**收尾一句**：好表单 = 浏览器帮你拦大部分错 + 类型唤起对键盘 + 读屏用户也能顺畅填完。

@points
原生校验 required/pattern/type 先拦一层，还顺带唤起合适移动端键盘
label for 关联控件，aria-describedby 关联错误文本，fieldset/legend 分组
:invalid / :user-invalid 做视觉反馈，novalidate 时调 reportValidity()
后端必须再校验，前端校验挡不住恶意请求与绕过
别用 placeholder 替代 label，读屏不读它；自定义错误用 setCustomValidity

@steps
先点出表单体验 = 原生校验 + 类型提效 + a11y 兜底三件一体
讲原生校验属性与 input 类型如何减负并唤起对键盘
讲 label/aria-describedby/fieldset 这套可访问性关联
结合注册表单给 reportValidity + aria-live 的真实实现
补边界：后端再校验、setCustomValidity 用法、placeholder 非 label

@followups
pattern 校验失败但没提示文案怎么办？——用 setCustomValidity('手机号格式不对') 设红，清空传空串恢复
为什么不能用 placeholder 当 label？——聚焦/填充后消失，读屏通常不读，可访问性直接不及格
reportValidity 和 checkValidity 区别？——都返回布尔，但 reportValidity 会弹出原生气泡并聚焦首个错误项

@example
### 1. 带 label 关联与 aria 播报的表单

```html
<!-- label for 关联控件 id；aria-describedby 关联错误文本 -->
<form id="signup" novalidate>
  <div>
    <label for="phone">手机号</label>
    <input
      id="phone"
      name="phone"
      type="tel"
      required
      pattern="^1[3-9]\d{9}$"
      aria-describedby="phone-err"
    >
    <!-- 错误提示区域：aria-live 让读屏主动播报 -->
    <p id="phone-err" role="alert" aria-live="polite" class="err"></p>
  </div>

  <div>
    <label for="email">邮箱</label>
    <input id="email" name="email" type="email" required>
  </div>

  <fieldset>
    <legend>性别</legend>
    <label><input type="radio" name="sex" value="m"> 男</label>
    <label><input type="radio" name="sex" value="f"> 女</label>
  </fieldset>

  <button type="submit">提交</button>
</form>
```

### 2. 自定义校验与统一提交

```javascript
// 提交时统一检查，失败聚焦第一个错误项
const form = document.querySelector('#signup')
form.addEventListener('submit', (e) => {
  e.preventDefault()
  if (!form.reportValidity()) return // 原生气泡 + 自动聚焦
  // 之后发请求……（后端仍要再校验）
})

// 动态设置自定义错误（比如「用户名已存在」）
function setError(input, msg) {
  input.setCustomValidity(msg) // 非空即视为无效
  input.reportValidity()
}
function clearError(input) {
  input.setCustomValidity('') // 清空才能恢复有效态
}
```

### 3. 视觉反馈：:invalid 与错误文案预留高度

```css
/* 用户交互后再标红，避免一进页面全红 */
input:user-invalid {
  border-color: #e34c26;
}
input:invalid {
  /* 仅作兜底视觉，不代替原生校验逻辑 */
  outline: 1px solid #e34c26;
}
.err {
  color: #e34c26;
  font-size: 12px;
  min-height: 16px; /* 预留高度，防提示出现时布局抖动 */
}
```