---
id: mobile
name: 移动端与跨端
en: Mobile & Cross-platform
icon: smartphone
color: #db2777
order: 15
part: 1
desc: 移动端适配、交互细节与跨端方案选型，H5 与混合开发岗位的必考项。
---

## 01 · 移动端 1px 边框为什么变粗，解决方案有哪些

@id
mobile-1px-border

@level
进阶

@freq
3

@tags
1px边框 | DPR | 物理像素

@ask
我在 iPhone 上写 `border: 1px`，明显比设计稿粗一圈，设计稿上那就是一根很细的分割线。你解释下为什么会变粗？你们项目里 1px 边框实际是怎么做的？中间踩过什么坑？

@oral
**先说结论**：不是边框「变粗」了，而是设计稿里那根 1px 指的是**1 个物理像素**，我们在 CSS 里写的 1px 是**1 个 CSS 像素**。在 DPR=2 的 iPhone 上，1 个 CSS 像素由 2×2 个物理像素填满，线自然就粗了一倍；DPR=3 的 Pro 机型上粗三倍。所以要还原设计稿，本质是让浏览器画出「小于 1 个 CSS 像素」的线。

**再说原理**。CSS 像素是布局用的逻辑单位，物理像素是屏幕真实的发光单元，两者之间的比值就是 `window.devicePixelRatio`。浏览器渲染时会把 CSS 像素乘以 DPR 映射到物理像素上，不足一个物理像素的线条会按规则取整——大概率被向上取整成 1 个物理像素，但你的 1px 已经被放成 2 个或 3 个物理像素了，所以视觉上偏粗。这也是为什么安卓上更混乱：DPR 有 1.5、2.75 这种非整数，同一根线在不同机型上表现都不一样。

**我们项目里的做法**是伪元素 + `transform: scaleY()`。外层容器 `position: relative`，`::after` 绝对定位贴在下边，`height: 1px`，再根据 DPR 缩放 0.5 或 0.333，缩放原点设在底边避免线跑偏。用 `transform` 而不是直接改 `height`，是因为缩放走的是合成层，不触发布局重排，长列表里几百条分割线的性能差别很明显。后来 DPR 直接用 CSS 变量统一算，`scaleY(calc(1 / var(--dpr)))`，就不用堆一堆 media query 了。

**踩过的坑说两个**。一是 `transform-origin` 忘了写，线整体偏移了半个像素，看着发虚发灰；二是伪元素挡住了卡片的点击事件，加上 `pointer-events: none` 才解决。另外网上常说的「直接写 0.5px」在 iOS 上确实可行，但部分安卓内核会把 0.5px 四舍五入成 0，整条线直接消失，所以我在项目里只把它当作降低成本的备选，主力方案还是缩放。

**收尾一句**：1px 问题的本质是 CSS 像素和物理像素的换算，只要记住「设计稿的 1px = 1 个物理像素 = 1/DPR 个 CSS 像素」，方案怎么写都能推导出来。

@points
设计稿的 1px 指物理像素，CSS 的 1px 是逻辑像素，中间差一个 devicePixelRatio 的倍数
DPR=2 时 1px 线占 2 个物理像素，DPR=3 时占 3 个，所以视觉上变粗
主流方案是伪元素 + transform: scaleY(1/DPR)，缩放走合成层不触发重排
0.5px 直接在部分安卓内核会被取整为 0，导致整条线消失
别忘了 transform-origin 对齐与 pointer-events: none，否则线发虚或挡点击

@steps
先纠正认知：区分物理像素和 CSS 像素，点出 devicePixelRatio 这个换算系数
推导原因：把 1px 乘以 DPR，说明线被放大到 2 个或 3 个物理像素
给主方案：::after 绝对定位 + height: 1px + transform: scaleY(1/DPR)
补充 DPR 适配：media query 或 CSS 变量连除，覆盖非整数 DPR 的安卓机型
讲踩坑：transform-origin 偏移、遮挡点击、0.5px 在安卓上消失
最后给取舍：缩放方案成本略高但最稳，适合长列表和电商项目

@followups
为什么用 transform 缩放，不直接把 height 写成 0.5px？——0.5px 在部分安卓内核会被取整为 0 导致线消失，transform 是渲染层的变换，精度更可靠且不触发重排
四条边都要画怎么办？——用一个伪元素只画一条边，或两个伪元素配合 border 组合，也可以直接给元素加 border 再用整体 transform scale 缩放，但要注意内容会被一起缩放
圆角卡片上这条线会露出来吗？——会，缩放后的线在圆角外侧会溢出，需要用 overflow: hidden 裁剪或改用 background-image + 圆角掩码
有没有一次算好所有机型的写法？——把 DPR 写成根节点的 CSS 变量，样式里用 calc(1 / var(--dpr))，省掉逐级 media query

@example
### 1. 反例：直接写 1px 会发生什么

```css
/* 反例：这条线在 DPR=2 的屏幕上会占 2 个物理像素，在 DPR=3 上占 3 个 */
.divider-bad {
  border-bottom: 1px solid #ebedf0; /* 真机上肉眼可见地比设计稿粗 */
}

/* 更要命的是，同一个页面在安卓 DPR=1.5 的机型上又是另一种粗细，
   设计走查的时候会被逐个机型揪出来 */
```

### 2. 正例：伪元素 + transform 缩放画出真 1px

```css
/* 外层容器：只负责提供定位参照 */
.hairline {
  position: relative; /* 漏了这行，伪元素会飞到页面左上角 */
}

/* 用伪元素画线，这样不会影响容器自身的盒模型 */
.hairline::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0; /* 画下边框；换成 top / left / right 就能画另外三条边 */
  height: 1px; /* 先老老实实声明 1 个 CSS 像素 */
  background-color: #ebedf0;
  transform: scaleY(0.5); /* DPR=2 时缩一半，正好落回 1 个物理像素 */
  transform-origin: 0 100%; /* 从底边开始缩，避免线整体下移 */
  pointer-events: none; /* 不抢走卡片的点击事件，长列表里必加 */
}
```

### 3. 用 CSS 变量统一适配各种 DPR

```css
/* 按设备像素比分别缩放，必须写在第 2 段之后，顺序反了不生效 */
@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 2dppx) {
  .hairline::after {
    transform: scaleY(0.5);
  }
}

@media (-webkit-min-device-pixel-ratio: 3), (min-resolution: 3dppx) {
  .hairline::after {
    transform: scaleY(0.3333); /* 1/3，缩完是 1 个物理像素 */
  }
}

/* 更省事的写法：把 DPR 存成变量，一套公式吃下所有机型 */
.hairline-fluid::after {
  transform: scaleY(calc(1 / var(--dpr, 1))); /* 安卓 1.5 / 2.75 也能算对 */
  transform-origin: 0 100%;
}
```

```javascript
// 页面启动时把真实 DPR 挂到根节点，CSS 里直接用变量读取
const dpr = window.devicePixelRatio || 1
document.documentElement.style.setProperty('--dpr', String(dpr))

// 注意：浏览器缩放、外接显示器切换都可能改变 DPR，
// 桌面端调试时可以用监听兜住，H5 场景里通常在启动时读一次就够了
window.addEventListener('resize', () => {
  document.documentElement.style.setProperty('--dpr', String(window.devicePixelRatio || 1))
})
```

### 4. 几个容易忽略的边界

```css
/* 边界一：圆角卡片上用缩放线，线会从圆角外侧露出来，需要裁剪 */
.rounded-card {
  position: relative;
  border-radius: 8px;
  overflow: hidden; /* 把溢出的那条线裁掉；但要注意会顺带裁掉做左上角角标的元素 */
}

/* 边界二：一个伪元素只能画一条边，四条边要么用两个伪元素配合，
   要么直接给元素加 border 后整体 transform: scale(0.5) 并把宽高按 2 倍补偿 */
.cell-all-border {
  position: relative;
}

.cell-all-border::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 200%; /* 放大 2 倍铺满 */
  height: 200%;
  border: 1px solid #ebedf0;
  box-sizing: border-box;
  transform: scale(0.5); /* 再缩回一半，四条边同时变成 0.5px */
  transform-origin: 0 0;
  pointer-events: none;
}
```

## 02 · 300ms 点击延迟是怎么来的，现在还需要处理吗

@id
mobile-click-delay

@level
进阶

@freq
2

@tags
点击延迟 | touch | viewport

@ask
以前面试总说移动端要处理 300ms 点击延迟，要引 FastClick，现在还需要吗？你先说说这 300ms 到底是怎么来的，再讲讲现在该怎么处理。

@oral
**先说结论**：延迟来自浏览器的**双击缩放判定**——用户在手机上快速点两下是放大页面，浏览器没法预知第二下会不会来，所以收到 `touchend` 之后要等一段时间，确认没有第二次触摸才补发 `click`。这个等待窗口早期就是 300ms 左右。现在结论是：**只要 viewport 设置正确，主流浏览器已经不再等这 300ms 了**，FastClick 这类库基本可以退场，我自己从 2019 年之后的项目就没再引过。

**原理上说清两点**。第一，这个延迟只发生在页面允许缩放的时候，浏览器为了区分「单击」和「双击缩放」才需要等待。第二，浏览器厂商给出了一条明确的退出通道：只要 `meta viewport` 里写了 `width=device-width`，就说明这个页面是响应式的、布局视口宽度等于设备宽度，浏览器判定双击缩放意义不大，直接取消等待。Chrome for Android 从 32 开始、iOS Safari 从 9.3 开始都做了这个优化。

**工程上的标准做法**是两步：viewport 里必须有 `width=device-width`，再给可点击元素加 `touch-action: manipulation`。后者的作用是告诉浏览器「这个元素不参与双击缩放的手势判定」，既消除了延迟，又保留了双指缩放，不影响无障碍体验。我们做商城列表页时，`touch-action` 是直接挂在 `a` 和按钮上的，点击响应从体感上就能感觉到跟手了。

**但有些场景还是得兜**。第一，页面跑在 App 内嵌的 WebView 里，宿主可能覆盖或忽略你的 viewport，这时延迟依旧存在；第二，第三方广告位、iframe 内容、老安卓机（比如 4.x 内核）上，行为不完全一致。这种时候才考虑 FastClick 那种「自己监听 touchend，用 DOM 操作模拟 click」的方案。

**不过要注意它的代价**：FastClick 会把原生 click 换成模拟事件，带来点击穿透、input 聚焦失焦、长按选中失效、和滚动冲突等一堆问题——这也是我后来宁愿不加的原因。**收尾**：先保证 viewport 正确，再补 `touch-action: manipulation`，剩下只在特殊容器里做定向兜底，不要全局引库。

@points
300ms 延迟来自浏览器的双击缩放判定，收到 touchend 后要等一个观察窗口
viewport 声明 width=device-width 会让浏览器取消这段等待，Chrome 32 / iOS 9.3 起生效
touch-action: manipulation 可声明该元素不参与双击缩放手势，属于现在的标准做法
FastClick 用模拟 click 替代原生事件，会带来穿透、聚焦、长按选中等一串副作用
只在宿主覆盖 viewport 的 WebView、第三方 iframe 等场景做定向兜底

@steps
先说清延迟的成因：为了区分单击和双击缩放，浏览器必须等一个观察窗口
给退出条件：viewport 的 width=device-width 是浏览器取消等待的判据
给出现在的标准配置：viewport + touch-action: manipulation 两步走
说明适用边界：老安卓、宿主 WebView、第三方 iframe 可能依然有延迟
解释为什么不再全局引 FastClick：模拟事件会让事件模型割裂，副作用大于收益
收尾给出项目里的实际取舍：默认不处理，只在特殊容器内定向补丁

@followups
touch-action: manipulation 会影响双指缩放吗？——不会，它只关闭双击缩放的手势判定，双指缩放和滚动都保持原生行为
为什么现在的做法是取消延迟而不是用 FastClick 补偿？——补偿方案制造了两套事件模型，会引出穿透和聚焦问题，而取消延迟是从根源上解决
如果页面故意允许缩放，怎么兼顾点击响应？——可以把缩放限制在特定容器上用 pinch 手势自己实现，或者接受延迟，只在核心按钮上用 touch 事件做即时反馈
怎么验证线上是否还有延迟？——在真机上打开 Chrome 的 Rendering 面板看输入延迟，或用 Performance 录制一段点击，看 touchend 到 click 的间隔

@example
### 1. 反例：viewport 没写对，延迟照旧

```html
<!-- 反例：没有 width=device-width，浏览器仍然按桌面宽度排版并保留双击缩放，
     点击延迟依然存在，而且页面还会被整体缩小 -->
<meta name="viewport" content="initial-scale=1" />

<!-- 反例：老项目里常见的一刀切写法，用 user-scalable=no 换响应速度 -->
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
<!-- user-scalable=no 在 iOS 10 之后已经被忽略，而且违反无障碍规范，别再用了 -->
```

### 2. 正例：viewport 加 touch-action，两行解决

```html
<!-- 正例：width=device-width 是取消延迟的前提条件，必须有 -->
<meta
  name="viewport"
  content="width=device-width, initial-scale=1, viewport-fit=cover"
/>
```

```css
/* 给可点击元素声明不参与双击缩放手势，浏览器就不再等那个观察窗口 */
.btn,
.tab-item,
.list-item a {
  touch-action: manipulation; /* 滚动、双指缩放全部保留，只去掉双击缩放的等待 */
  -webkit-tap-highlight-color: transparent; /* 顺手去掉安卓/iOS 的灰色点击高亮 */
}

/* 反例：为了消灭延迟直接禁掉所有手势，属于用大炮打蚊子 */
.page-bad {
  touch-action: pan-y; /* 用户连双指缩放都被禁了，图片预览、地图页面会很难受 */
}
```

### 3. FastClick 的核心原理（理解它，但别轻易引）

```javascript
// 这是 FastClick 类方案的核心思路：自己监听 touchend，然后立刻补一个 click 出来
// 也就是说，原始 click 被「抢跑」了，用户感知不到延迟
element.addEventListener(
  'touchend',
  (e) => {
    // 用当前坐标找出手指下面的元素，手动派发一次 click
    const target = document.elementFromPoint(
      e.changedTouches[0].clientX,
      e.changedTouches[0].clientY,
    )
    target?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  },
  { passive: true },
)

// 代价清单（真实踩过的）：
// 1. 模拟 click 在 touchend 时立刻触发，被隐藏的元素下面的兄弟节点会被顺带点到 → 点击穿透
// 2. input 的聚焦时机被打乱，iOS 上输入框会闪一下弹出再收起
// 3. 长按选中、拖拽选择文本失效，列表里想复制订单号复制不了
// 4. 和第三方组件库自己的 touch 逻辑打架，排查成本极高

// 所以现在的做法是：不做全局补偿，只在宿主 WebView 覆盖了 viewport 时做定向兜底
```

### 4. 延迟还在时的兜底写法：手势反馈自己做

```javascript
// 只有当延迟确实存在、又需要即时反馈时，才用 touch 事件做「视觉反馈」，
// 真正的业务逻辑仍然走 click —— 这样不会割裂事件模型
const button = document.querySelector('.buy-btn')

// 按下时立刻给视觉反馈，用户感觉「秒响应」
button.addEventListener('touchstart', () => {
  button.classList.add('is-pressed')
})

// 手指滑动或抬起时清掉状态，避免留下按下的残影
button.addEventListener('touchcancel', () => button.classList.remove('is-pressed'))
button.addEventListener('touchend', () => {
  // 延迟一小会儿再移除，让按下态肉眼可见
  setTimeout(() => button.classList.remove('is-pressed'), 80)
})

// 业务逻辑只在这里执行一次，不混用 touch 事件，从根上避开穿透
button.addEventListener('click', () => {
  submitOrder()
})
```

## 03 · 点击穿透是怎么产生的，怎么解决

@id
mobile-click-through

@level
进阶

@freq
3

@tags
点击穿透 | touchend | 遮罩

@ask
点击穿透你应该遇到过吧？说清楚它产生的过程。我们之前有个 bug，关掉筛选浮层之后直接跳进商品详情页了，这种问题你们怎么根治？

@oral
**先说结论**：点击穿透的本质是**一次触摸被浏览器解释成了两次命中**——`touchstart` / `touchend` 是你自己的逻辑先处理掉的，几百毫秒之后浏览器又补发了一次 `click`，而这时遮罩已经被你隐藏了，这次补发的 `click` 就落到了下面那层元素上。所以不是「穿透」了 DOM，是**同一根手指在时间轴上被消费了两次**。

**把过程拆开说**。用户点关闭按钮，链路是这样的：`touchstart` → `touchend`，我们的代码在 `touchend` 里把遮罩 `display: none` 掉，遮罩瞬间从命中测试中消失；然后浏览器延迟一小段时间补发 `click`，这个 `click` 的坐标是手指抬起的位置，此时该坐标下最顶层的元素已经换成了被遮住的商品卡片或链接，于是跳转发生了。之所以有这段延迟，就是上一题说的双击缩放观察窗口——**穿透和 300ms 延迟其实是同一个原因的两个表现**。

**我踩过的真实场景**是下拉筛选浮层：浮层里的「确定」按钮我用了 `touchend` 触发，收起浮层之后，浮层下面正好是一次商品列表的 `a` 标签，结果用户点确定会直接跳进商品详情页，客诉还以为是「点错了」。后来排查发现是穿透，因为只有浮层收起的位置上恰好在列表项上才会复现，肉眼看着像偶发。

**解决方案按优先级排三层**。第一层也是我现在的首选：**不要混用事件模型**，触发和收尾统一用 `click`，让浏览器自己保证「一次触摸一次 click」，从根上没有穿透。第二层，如果手势必须跟手（比如浮层下拉关闭），那就把隐藏动作延后到 `transitionend` / `animationend` 之后，或者立刻给遮罩加 `pointer-events: none`——它虽然还在 DOM 里，但已经退出命中测试，补发的 click 打不到它，也打不到下面（因为还有一层没被移除）。第三层才是老方案：在 `touchend` 里 `preventDefault()` 阻止后续 click 生成，或者干脆延迟 300ms 再隐藏。

**边界要说清**：`preventDefault` 是有一连串副作用的，它会连带阻止滚动和原生点击行为，在滚动容器里乱用会导致页面划不动；延迟隐藏则牺牲了关闭动画的即时感。所以我的取舍是——能用统一的 click 事件模型就绝不做补偿，补偿方案只留给确实需要手势跟手的交互。

@points
穿透的本质是一次触摸被消费两次：先由 touchend 处理，之后浏览器补发的 click 落到下层元素
成因和 300ms 延迟同源，都是双击缩放观察窗口带来的 click 延迟派发
首选方案是统一事件模型，触发与收尾都用 click，不做任何补偿
手势必须跟手时，用 pointer-events: none 或 transitionend 收尾，让补发的 click 打不到目标
touchend 里 preventDefault 副作用大，会连带影响滚动和原生点击，属于最后手段

@steps
先还原时间轴：touchstart / touchend 先执行 → 遮罩被隐藏 → 约 300ms 后补发 click → 落到下层元素
点明它与 300ms 延迟同源，说明为什么「等一等」反而是解决方案
讲一个自己项目里能稳定复现的场景，证明不是玄学而是坐标命中问题
把方案分层：统一事件模型 → pointer-events 与动画收尾 → preventDefault 和延迟隐藏
说清每层的代价，给出项目里的取舍而不是罗列所有方案

@followups
为什么用 preventDefault 能挡住，但我不建议当主方案？——它能阻止 touchend 生成后续 click，但同时会阻止滚动和原生行为，在可滚动容器里会把手势一起干掉
pointer-events: none 之后遮罩还在页面上，为什么不会穿透？——补发的 click 做命中测试时该元素已被排除，顶层是遮罩的父容器，不会落到下层列表项
如果遮罩下面也是个滚动区域呢？——除了防穿透还要防滚动穿透，需要配合滚动锁或 overscroll-behavior: contain，两件事要一起做
事件委托能避免穿透吗？——不能，委托只是改变了监听位置，补发的 click 依然会在那个坐标上做命中测试并冒泡到根节点

@example
### 1. 反例：touchend 里立刻隐藏遮罩，必然穿透

```html
<!-- 反例：遮罩下面直接就是可跳转的列表项 -->
<div class="filter-mask" id="mask"></div>
<ul class="goods-list">
  <li><a href="/detail/1001">iPhone 保护壳</a></li>
  <li><a href="/detail/1002">蓝牙耳机</a></li>
</ul>

<script>
  const mask = document.getElementById('mask')

  mask.addEventListener('touchend', () => {
    mask.style.display = 'none' // 手指抬起的瞬间遮罩就消失了
    // 浏览器还要等约 300ms 才补发 click，
    // 这次 click 的坐标下最顶层元素已经变成 <a> → 直接跳详情页
  })
</script>
```

### 2. 正例一（推荐）：统一事件模型，全程只用 click

```javascript
// 触发和收尾都用 click，浏览器保证「一次触摸一次 click」，从结构上避免穿透
mask.addEventListener('click', () => {
  // 只改类名，隐藏交给 CSS 动画，逻辑里不出现 display: none 的瞬间切换
  mask.classList.add('is-leaving')
})

// 等动画真正结束再把它从文档流里拿掉
mask.addEventListener(
  'transitionend',
  () => {
    mask.style.display = 'none'
  },
  { once: true }, // 只监听一次，避免子元素的过渡事件反复冒泡触发
)
```

### 3. 正例二：手势必须跟手时，用 pointer-events 断掉命中测试

```javascript
// 下拉关闭筛选浮层这类交互必须跟手，就不能等 click 了，改在 touchend 里收尾
panel.addEventListener('touchend', () => {
  mask.classList.add('is-leaving')

  // 关键一行：元素还在页面上、动画还在播，但已经退出命中测试，
  // 补发的 click 找不到它，也不会穿过它落到下面的列表项上
  mask.style.pointerEvents = 'none'

  // 动画播完再真正移除
  mask.addEventListener(
    'transitionend',
    () => {
      mask.style.display = 'none'
    },
    { once: true },
  )
})
```

```css
/* 配合上面的方案，给遮罩加一个淡出动画，隐藏动作延后到动画结束 */
.filter-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  opacity: 1;
  transition: opacity 0.2s ease-out;
}

.filter-mask.is-leaving {
  opacity: 0; /* 视觉上已经开始消失，但 DOM 还在，命中测试已经关掉 */
}

/* 反例：用 visibility: hidden 试图「隐藏但保留占位」，它同样会退出命中测试，
   但配合 touchend 使用依然救不了穿透，因为原来的问题不是「谁在上面」，
   而是补发的 click 本来就在找新的顶层元素 */
```

### 4. 正例三：延迟隐藏（老项目的兜底，现在较少用）

```javascript
// 兜底方案：老老实实等浏览器把 click 派发完，再隐藏遮罩
// 代价是关闭动作要慢 300ms 左右，用户会觉得「点了没反应」
mask.addEventListener('touchend', () => {
  mask.style.opacity = '0' // 先做视觉反馈，让用户知道点击生效了

  setTimeout(() => {
    mask.style.display = 'none'
    mask.style.pointerEvents = '' // 复位，下次打开还能正常点击
  }, 320) // 比 300 稍长一点，覆盖慢速设备上延迟的波动
})

// 另一个老套路是在 touchend 里直接 preventDefault。
// 它能阻止本次触摸生成 click，但会连带干掉滚动和原生点击行为，
// 在可滚动容器里会造成「页面划不动」，所以我只在确定没有滚动的区域用
```

## 04 · iOS 安全区与刘海屏适配怎么做

@id
mobile-safe-area

@level
进阶

@freq
3

@tags
安全区 | safe-area | 刘海屏

@ask
现在 iPhone 有灵动岛、底部还有小白条，底部 tabbar 经常被盖住一截。你们安全区是怎么适配的？为什么有人写了 env() 一点效果都没有？

@oral
**先说结论**：安全区适配就两步——**viewport 里加 `viewport-fit=cover`**，然后所有贴边的容器用 `env(safe-area-inset-*)` 把安全区留出来。绝大多数「写了 env() 没效果」的问题，都是漏了第一步：没声明 `viewport-fit=cover` 时，页面根本不会铺满整屏，浏览器也不会给你安全区数值，四个 `env()` 读出来全是 0。

**原理上解释一下**。iPhone X 之后屏幕有圆角、刘海和底部指示条，这些区域不适合放可交互内容。默认情况下 `viewport-fit=auto`，浏览器会把网页内容限制在一个矩形安全区域内，所以你不会看到内容被遮挡，代价是两侧会留黑边。加上 `cover` 之后就变成铺满整屏，同时浏览器开始通过 `env(safe-area-inset-top/right/bottom/left)` 把四个方向的安全距离暴露给你，让你自己决定谁要避让、谁要延伸过去。

**项目里的落地方式**，我们底部 tabbar 是这样写的：`position: fixed; bottom: 0`，`padding-bottom: max(env(safe-area-inset-bottom), 16px)`。用 `max()` 是为了照顾安卓——安卓没有安全区概念，`env()` 会返回 0，`max` 保证至少还留 16px 的视觉间距，不至于让图标贴着屏幕下沿。顶部导航同理，用 `env(safe-area-inset-top)` 做 `padding-top`，但要注意导航的**背景色要一起延伸上去**，否则状态栏那一条会露出白底，这是最常见的视觉 bug。

**踩过的坑有三个**。一是兼容写法的顺序：iOS 11.0 到 11.2 只认 `constant()`，之后才换成 `env()`，所以两条声明要依次写，`constant` 在前、`env` 在后，浏览器不认识的那条会自然被丢弃。二是以为写了就万事大吉——在不支持 `env()` 的低版本内核里，整条 `padding-bottom` 声明会被判为无效值直接丢掉，所以要先给一个确定能生效的兜底值，再用 `@supports` 覆盖。三是横屏：刘海屏横屏之后左右两侧也会被挖掉，全屏页面（视频、canvas 画布）必须把 `safe-area-inset-left/right` 也留出来。

**最后一句取舍**：安全区是「贴边元素」才需要关心的事，别给每个容器都加一遍，容易造成间距层层叠加；统一在布局壳层（导航、tabbar、全屏容器）处理一次就够了。

@points
viewport-fit=cover 是前提，不加它 env() 四个值全部返回 0，页面也不会铺满全屏
底部固定栏用 padding-bottom: max(env(safe-area-inset-bottom), 设计间距) 兼顾安卓
constant() 与 env() 要按顺序各写一条，兼容 iOS 11.0~11.2 与 11.2 之后
先给固定兜底值再用 @supports 覆盖，避免不支持 env() 的内核丢掉整条声明
安全区只处理贴边容器，顶部导航还要注意背景色同步延伸，横屏需补左右方向

@steps
先给结论与前提：viewport-fit=cover 是 env() 能读到值的必要条件
解释默认行为：viewport-fit=auto 会把内容限制在矩形安全区内，所以看出不来问题
给底部 tabbar 的标准写法，说明 max() 在安卓机型上的价值
讲兼容顺序：constant 在前 env 在后，以及 @supports 覆盖与固定值兜底
补充顶部与横屏两个容易漏的方向，提醒背景色要跟着延伸
收尾给取舍：只在布局壳层统一处理，避免多层 padding 叠加

@followups
为什么加了 env() 但取到的值一直是 0？——大概率漏了 viewport-fit=cover，另外在桌面浏览器和非全面屏设备上返回 0 本身也是正常行为
constant() 和 env() 能同时写吗？——可以，必须 constant 在前、env 在后，因为不认识的声明会被丢弃，后写的生效才能在不同 iOS 版本上都拿到值
底部键盘弹起时 safe-area 还要不要留？——键盘弹起时底部安全区已经被键盘覆盖，此时应当把 padding 换成跟随键盘的高度，两者不要叠加，否则输入栏会被顶高一大截
iPad 上有安全区吗？——有，多任务分屏和圆角边框都会产生安全区，左右方向的 inset 更明显，横屏布局要一起考虑

@example
### 1. 前提：viewport 必须加 viewport-fit=cover

```html
<!-- 反例：没有 viewport-fit=cover，页面不会铺满整屏，
     四个 env(safe-area-inset-*) 全部返回 0，后面的 CSS 白写 -->
<meta name="viewport" content="width=device-width, initial-scale=1" />

<!-- 正例：cover 表示内容铺满整屏，浏览器才会把安全区数值暴露出来 -->
<meta
  name="viewport"
  content="width=device-width, initial-scale=1, viewport-fit=cover"
/>
```

### 2. 底部 tabbar：max() 兼顾 iOS 安全区与安卓间距

```css
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 50px; /* 内容区高度，不含安全区 */

  /* 核心一行：iOS 上有小白条时留出安全距离，安卓上 env 返回 0；
     max() 保证至少保留 16px，避免图标贴到屏幕最下沿 */
  padding-bottom: max(env(safe-area-inset-bottom), 16px);

  /* 关键细节：不加 border-box，padding 会把 50px 撑大，图标会被顶出可视区 */
  box-sizing: border-box;
  background: #fff;
  border-top: 1px solid #ebedf0;
}

/* 页面主体要同步让出 tabbar 的空间，否则最后一条内容会被挡住 */
.page-content {
  padding-bottom: calc(50px + max(env(safe-area-inset-bottom), 16px));
}
```

### 3. 兼容顺序：constant 在前，env 在后，并做兜底

```css
/* 兼容写法：iOS 11.0~11.2 只认 constant()，11.2 之后才支持 env()。
   顺序不能反 —— 后写的会覆盖前面的，老系统读到 constant 才拿得到正确值 */
.safe-bottom-compat {
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
}

/* 反例：不写兜底值，在不支持 env() 的内核里这条声明会被整体判为无效，
     底部栏直接贴到屏幕最底部，被小白条盖掉一半 */
.safe-bottom-bad {
  padding-bottom: env(safe-area-inset-bottom); /* 老内核直接丢弃这一行 */
}

/* 正例：先给一个所有机型都能生效的值，支持 env 时再用 @supports 覆盖 */
.safe-bottom-good {
  padding-bottom: 16px; /* 兜底：任何浏览器都不会丢 */
}

@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .safe-bottom-good {
    padding-bottom: calc(16px + env(safe-area-inset-bottom));
  }
}
```

### 4. 顶部导航与横屏：别只盯着底部

```css
/* 顶部导航要留出状态栏 + 灵动岛/刘海的高度 */
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: calc(44px + env(safe-area-inset-top));
  padding-top: env(safe-area-inset-top); /* 内容下推，背景色自然延伸上去 */
  box-sizing: border-box;
  background: #fff; /* 背景必须跟着铺上去，否则状态栏那一条会露出白底 */
}

/* 反例：更常见的做法是先给固定的 20px 再靠 env 覆盖，
   但忘了给背景色延伸，结果状态栏区域是透明的，滚动时内容从下面穿过去 */

/* 横屏时刘海屏左右两侧也会被挖掉，全屏页面三个方向都要留 */
.page-fullscreen {
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  /* 竖屏下左右 unsafe 通常是 0，所以这段写在基础样式里也没副作用 */
}

/* 视频 / canvas 这类需要真正铺满的区域，用 cover 布局但把控制条放在安全区内 */
.video-fullscreen {
  position: fixed;
  inset: 0; /* 画面铺满整屏 */
  background: #000;
}

.video-fullscreen .controls {
  position: absolute;
  bottom: calc(12px + env(safe-area-inset-bottom)); /* 控制条避让小白条 */
  left: calc(16px + env(safe-area-inset-left));
  right: calc(16px + env(safe-area-inset-right));
}
```

## 05 · 移动端滚动问题：滚动穿透与惯性滚动怎么处理

@id
mobile-scroll

@level
进阶

@freq
3

@tags
滚动穿透 | 惯性滚动 | 滚动锁

@ask
弹窗打开之后，背景页面还能跟着手指滚，这个怎么解？还有 iOS 的惯性滚动，你们是怎么开的，开了之后又出过什么问题？

@oral
**先说结论**：滚动穿透分两种——**事件型**和**视觉型**。事件型是手指在弹窗上滑动，`touchmove` 冒泡到文档上导致背景跟着滚；视觉型是弹窗本身没拦住滚动链，滚到底之后手势「接力」传给外层。惯性滚动则是另一件事，指的是 iOS 那种松手后还继续滑一段的物理效果，早期安卓没有，需要手动开。

**事件型穿透的解法**有三个层次。最省事的是给遮罩加 `touchmove` 拦截，但这里有个大坑：Chrome 56 之后 `touchmove` 默认是 `passive: true` 的，你在里面写 `preventDefault()` **完全不生效**，控制台只会给个黄色警告。所以必须显式传 `{ passive: false }`，这行代码我见过太多人漏掉，然后怀疑是自己监听位置不对。

**更稳的是直接锁 body**。`overflow: hidden` 在桌面管用，iOS 上基本无效，所以工程里通用的做法是：把 body 改成 `position: fixed`，并用负的 `top` 把视觉位置撑回原处。这里最关键的是**必须记录并还原 `scrollY`**，否则关闭弹窗后页面会直接跳回顶部——这是最容易被投诉的体验问题。我们商品详情页打开规格选择弹窗时用的就是这套锁，恢复的时候精确回到打开前的滚动位置。

**滚动链的解法更简单**：给弹窗内部的滚动区加 `overscroll-behavior: contain`，滚到底之后手势不会传给外层。不过要留意兼容性——iOS 16 才支持，iOS 15 及以下还得靠 JS 兜底做边界判断。我们做双十一活动页的时候因为这个吃过亏：测试机都是新系统一切正常，线上 iOS 14 用户反馈「滚到底部整个页面跟着跳」。

**惯性滚动**这块，`-webkit-overflow-scrolling: touch` 在 iOS 13 之后已经默认开启，现在基本属于历史遗留写法；安卓早期不支持，长列表滚动会明显发涩。另一个常用手段是给滚动容器加 `transform: translate3d(0, 0, 0)` 强制提升为合成层，滚动明显更顺。**但它的副作用很致命**：会创建新的层叠上下文和包含块，导致内部的 `position: fixed` 变成相对它定位，弹窗里的固定按钮直接错位；同时和 `position: fixed` 的祖先一起用还可能引起 iOS 的渲染闪烁。

**收尾**：我的原则是——能用 `overscroll-behavior: contain` 就从 CSS 层解决，只在旧系统兜底时才动 JS 锁；`translate3d` 只在滚动确实卡顿时加，加完必须回归验证 fixed 定位的元素。

@points
滚动穿透分事件型与滚动链两型，前者靠 touchmove 拦截或锁 body，后者靠 overscroll-behavior
Chrome 56 起 touchmove 默认 passive，preventDefault 必须配合 { passive: false } 才生效
iOS 上 overflow: hidden 锁不住滚动，需改用 position: fixed 并记录还原 scrollY
overscroll-behavior: contain 是 CSS 级解法的首选，但 iOS 16 才开始支持，旧系统需兜底
translate3d 提升合成层能改善滚动，但会创建包含块导致内部 fixed 元素错位

@steps
先把穿透分成事件型和滚动链两种，说明症状不同、解法也不同
讲事件型的三层方案：touchmove 拦截（注意 passive）、锁 body、锁定时记录 scrollY
讲滚动链：overscroll-behavior: contain 优先，旧 iOS 用 JS 做边界判断兜底
单独说惯性滚动：-webkit-overflow-scrolling 已是历史写法，translate3d 提性能
重点说明 translate3d 的副作用，以及为什么加完必须回归验证 fixed 元素
收尾给原则：CSS 能解决就不上 JS，动 JS 就一定要处理恢复逻辑

@followups
为什么 iOS 上给 body 加 overflow: hidden 没用？——iOS 的文档滚动由 UIWebView/WKWebView 的原生滚动视图接管，CSS 溢出裁剪管不到它，只能用 position: fixed 把文档脱离滚动容器
touchmove 里 preventDefault 没生效是怎么回事？——Chrome 56 起对 document 级别监听默认 passive: true，必须显式传 { passive: false } 才能阻止滚动
overscroll-behavior: contain 和 none 有什么区别？——contain 只阻止滚动链传递给祖先，本元素仍可滚；none 在阻止传递之外还会禁用本元素的边界回弹效果
锁 body 用 position: fixed 之后弹窗内部的输入框还能正常聚焦吗？——可以，但要注意聚焦时 iOS 会尝试滚动 body 让输入框可见，而 body 已经被固定，需要在弹窗内部做容器级滚动

@example
### 1. 反例：touchmove 里 preventDefault 却没生效

```javascript
// 反例：最常见的写法，但它在 Chrome 56+ 上完全不起作用
document.addEventListener('touchmove', (e) => {
  e.preventDefault() // 只会在控制台看到 "Unable to preventDefault inside passive event listener"
})

// 现象：弹窗打开后背景照样跟着滚，于是开发者误以为是监听位置不对，
// 换成 document / body / 遮罩逐个试，其实真正的原因是 passive 默认值

// -------------------- 分隔 --------------------

// 正例：显式关掉 passive，拦截才能生效
document.addEventListener(
  'touchmove',
  (e) => {
    e.preventDefault()
  },
  { passive: false }, // 不加这个参数，preventDefault 会被静默忽略
)

// 更精细的做法：只拦遮罩自身，弹窗内部的可滚动区域放行
mask.addEventListener(
  'touchmove',
  (e) => {
    // closest 判断手势起点是否落在弹窗内部，
    // 注意要用 touchstart 时记录的起点，touchmove 的 target 会随手指移动变化
    if (!e.target.closest('.dialog-scrollable')) {
      e.preventDefault()
    }
  },
  { passive: false },
)
```

### 2. 正例：position: fixed 锁滚动，并精确还原位置

```javascript
// 这是组件库里最通用的滚动锁实现，核心是「记住位置 → 固定 → 还原」
let lockedScrollY = 0

function lockScroll() {
  lockedScrollY = window.scrollY // 打开弹窗前先记住滚到哪了
  const { style } = document.body

  style.position = 'fixed' // 让文档脱离滚动容器，iOS 上这才能真正锁住
  style.top = `-${lockedScrollY}px` // 用负偏移补偿，视觉上停在原处不跳顶
  style.left = '0'
  style.right = '0'
  style.width = '100%' // 固定定位会丢失宽度，必须补回来，否则页面会横向塌陷
  style.overflow = 'hidden' // 桌面端和部分安卓内核靠它兜一层
}

function unlockScroll() {
  const { style } = document.body

  style.position = ''
  style.top = ''
  style.left = ''
  style.right = ''
  style.width = ''
  style.overflow = ''

  // 关键：还原到打开前的位置。漏了这行，关掉弹窗页面会跳回顶部
  window.scrollTo(0, lockedScrollY)
}

// 使用时要保证成对调用，并且处理连续打开两个弹窗的计数问题，
// 我们项目里是包成一个 useScrollLock 的计数器实现，避免 unlock 被提前调用
```

### 3. 正例：overscroll-behavior 阻断滚动链

```css
/* 弹窗内部的滚动区域：滚到底之后不要把滚动链传给外层页面 */
.dialog-body {
  overflow-y: auto;
  max-height: 60vh; /* 别写固定 px，小屏机型上会直接溢出屏幕 */
  -webkit-overflow-scrolling: touch; /* iOS 13 之前靠它开惯性滚动，现在已是默认行为 */

  /* 首选解：contain 表示滚动到边界后不再传递给祖先元素。
     Chrome 63+ / iOS 16+ 支持，iOS 15 及以下还得用 JS 做边界兜底 */
  overscroll-behavior: contain;
}

/* 长列表容器同理，避免下拉时触发整页刷新或出现橡皮筋效果 */
.goods-scroll {
  overflow-y: auto;
  overscroll-behavior-y: contain;
}
```

```javascript
// 旧 iOS 的兜底：手动判断是否已经滚到边界，到了就拦掉继续同向的手势
const scroller = document.querySelector('.dialog-body')
let startY = 0

scroller.addEventListener('touchstart', (e) => {
  startY = e.touches[0].clientY
})

scroller.addEventListener(
  'touchmove',
  (e) => {
    const deltaY = e.touches[0].clientY - startY
    const atTop = scroller.scrollTop === 0
    const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight

    // 已经在顶部还继续往下拉、或者到底了还继续往上推，就拦掉
    if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
      e.preventDefault() // 依然需要 passive: false 才生效
    }
  },
  { passive: false },
)
```

### 4. 惯性滚动的代价：translate3d 会让 fixed 失效

```css
/* 反例：给弹窗整体加 translate3d 想提升滚动性能，结果关闭按钮跑偏了 */
.dialog-bad {
  transform: translate3d(0, 0, 0); /* 这一行让 .dialog-bad 成为内部 fixed 元素的包含块 */
}

.dialog-bad .close-btn {
  position: fixed; /* 本来想固定在视口右上角，现在变成相对 .dialog-bad 定位 */
  top: 16px;
  right: 16px;
}

/* -------------------- 分隔 -------------------- */

/* 正例：只给真正需要滚动的列表加合成层，别套在外层容器上 */
.goods-scroll {
  overflow-y: auto;
  height: 100%;
  /* 提升为合成层，滚动更顺滑，副作用只影响这个滚动容器内部 */
  transform: translate3d(0, 0, 0);
  -webkit-overflow-scrolling: touch; /* 老 iOS 上开惯性滚动，新系统忽略 */
  will-change: transform; /* 提示浏览器提前准备合成层，注意别加在大量元素上，会吃内存 */
}

/* 关闭按钮放在滚动容器之外，避免被合成层圈进去 */
.dialog {
  position: relative; /* 只做普通定位参照，不创建包含块 */
}

.dialog .close-btn {
  position: absolute; /* 相对 .dialog 定位，不受内部合成层影响 */
  top: 16px;
  right: 16px;
}
```

## 06 · 移动端键盘弹起导致布局错乱、fixed 失效怎么解决

@id
mobile-keyboard

@level
场景题

@freq
3

@tags
键盘遮挡 | fixed | visualViewport

@ask
我们这个聊天页，底部输入框在 iOS 上被键盘盖住，在安卓上倒是能顶上去，但页面整体被压扁了，`100vh` 也跟着变小。你先说说为什么会这样，再说说你们最后是怎么解决的。

@oral
**先说结论**：键盘弹起改变的是**可视视口（visual viewport）**，不是**布局视口（layout viewport）**。iOS 和安卓的处理方式还不一样——iOS 上布局视口不变，只是可视区域被键盘盖住了一块，所以 `position: fixed; bottom: 0` 的输入栏会被压在键盘下面看不见；安卓默认是 `adjustResize`，整个 WebView 被重设尺寸，`100vh` 跟着缩水，页面内容被压扁。所以这不是一个「写个 CSS 就能治」的问题，得先分清平台行为。

**说下我踩过的具体现象**。我们聊天页第一版底部输入栏用的是 `position: fixed; bottom: 0`，iOS 上点输入框，键盘盖上来，输入栏直接看不见了；安卓上输入栏倒是跟着键盘上去了，但 `height: 100vh` 的聊天区被压成一条窄缝，历史消息全乱了。更麻烦的是 iOS 还有个经典 bug——键盘收起之后页面停在半空中，底部露出一块白，用户得手动划一下才能恢复。

**我们的最终方案是拥抱 `visualViewport`**。这个 API 暴露键盘弹起后的真实可视区域：`visualViewport.height` 是可视高度，`window.innerHeight - visualViewport.height` 就是键盘高度；`visualViewport.offsetTop` 反映页面被顶上去的偏移量。我们在它的 `resize` 和 `scroll` 事件里把这两个值写成根节点的 CSS 变量，输入栏的 `bottom` 直接读变量——键盘收起时变量是 0，自然贴底；弹起时自动抬高一个键盘高度，视觉上就是「贴在键盘上方」。同样思路也用在安卓上，两个平台一套代码。

**细节上补三点**。第一，`visualViewport` 的事件监听里必须同时监听 `resize` 和 `scroll`，因为 iOS 上键盘弹起有时只触发 `scroll`，只监听 `resize` 会漏掉。第二，高度别写 `100vh`，用 `100dvh`（iOS 15.4+ / Chrome 108+ 支持），它会把浏览器 UI 和键盘的影响算进去，前面留一条 `100vh` 做兜底就行。第三，iOS 那个「键盘收起页面悬空」的 bug，在输入框 `blur` 之后延迟一点执行 `window.scrollTo(0, 0)` 就能修复，注意要延迟，因为键盘收起是异步的。

**边界与取舍**：`visualViewport` 在 iOS 13+ / Chrome 61+ 都支持，老 WebView 需要降级——降级做法是聚焦时把输入栏改成 `position: absolute` 并滚动到可视区，或者退回到「点击输入框时用 `scrollIntoView` 把内容顶上来」的老办法。另外键盘弹起时的过渡不要用 `transition` 拉太长，我用的是 0.2s 缓出，太长会明显滞后于键盘动画，反而更别扭。

@points
键盘改变的是 visual viewport，不是 layout viewport，iOS 不缩放布局视口、安卓默认 adjustResize 重设尺寸
iOS 上键盘盖住 fixed 底栏，安卓上 100vh 缩水导致内容被压扁，两者要区别对待
visualViewport 的 height 与 offsetTop 可算出键盘高度和页面偏移，写成 CSS 变量驱动底栏跟随
必须同时监听 visualViewport 的 resize 与 scroll，iOS 上键盘弹起可能只触发 scroll
高度优先用 100dvh，iOS 键盘收起后页面悬空需在 blur 后延迟 scrollTo 修复

@steps
先区分两个视口概念，并说明 iOS 与安卓平台行为的差异
描述自己项目里的两个现象，把「被盖住」和「被压扁」分开说
给出主方案：visualViewport 监听 + CSS 变量驱动底部输入栏
补充细节：同时监听 resize 与 scroll、用 dvh 替代 vh、blur 后延迟回弹
讲降级方案：老 WebView 用 scrollIntoView 或临时改定位，保证能输入
收尾给取舍：过渡时长要跟着键盘动画走，别让用户觉得界面滞后

@followups
为什么安卓上需要调整 windowSoftInputMode？——安卓默认 adjustResize 会重设 WebView 尺寸让 100vh 缩水，改成 adjustPan 或由前端统一用 visualViewport 接管，可以避免两种行为混在一起
visualViewport 在 iOS 上有哪些坑？——键盘弹起有时只触发 scroll 不触发 resize，且 offsetTop 会随页面滚动变化，所以两个事件要一起监听并做去重
输入框聚焦时怎么保证它在可视区里？——用 scrollIntoView({ block: 'center' }) 并且延迟一帧执行，因为 iOS 键盘弹出是异步的，立即计算位置会拿到错误结果
fixed 底栏加 transition 有什么风险？——过渡时长超过键盘动画会让界面明显滞后，另外过渡期间如果用户又切了输入框，会出现来回抖动的现象

@example
### 1. 反例：100vh + 固定底栏，两个平台都出问题

```css
/* 反例：这两个写法组合起来就是经典的键盘遮挡 */
.chat-page-bad {
  height: 100vh; /* 安卓上键盘弹起时 100vh 会缩水，聊天区被压成一条缝 */
}

.chat-input-bad {
  position: fixed;
  bottom: 0; /* iOS 上键盘盖上来，这一栏直接消失在键盘下面 */
  left: 0;
  right: 0;
  height: 48px;
}

/* 还有用 100% 的写法，依赖父级链上有确定高度，一旦某一层没设就整页塌掉 */
.chat-page-bad-2 {
  height: 100%; /* 父级没有显式高度时等于 auto，页面会随着内容无限长 */
}
```

### 2. 正例：visualViewport 算出键盘高度，写成 CSS 变量

```javascript
// 键盘弹起改变的是 visual viewport（可视视口），
// 而 layout viewport（布局视口）在 iOS 上保持不变，这就是 fixed 失效的根源
const vv = window.visualViewport
const root = document.documentElement

function syncViewport() {
  if (!vv) return

  // 键盘高度 ≈ 布局视口高度 - 当前可视视口高度
  const keyboardHeight = window.innerHeight - vv.height

  // 写进根节点变量，CSS 里直接用，避免每帧操作 DOM 样式
  root.style.setProperty('--keyboard-height', `${Math.max(keyboardHeight, 0)}px`)

  // iOS 键盘弹起时整个页面会被向上顶，offsetTop 就是这个偏移量，
  // 需要它来抵消，否则页面看着会「跳」一下
  root.style.setProperty('--viewport-offset', `${vv.offsetTop}px`)
}

// 必须同时监听 resize 和 scroll：iOS 上键盘弹起有时只触发 scroll，
// 只监听 resize 会漏掉一部分机型，导致底栏位置不对
vv?.addEventListener('resize', syncViewport)
vv?.addEventListener('scroll', syncViewport)
```

```css
/* 输入栏跟着键盘走：不是简单贴底，而是抬高一个键盘高度 */
.chat-input {
  position: fixed;
  left: 0;
  right: 0;
  bottom: var(--keyboard-height, 0); /* 键盘收起时变量为 0，自然贴底 */
  padding-bottom: max(env(safe-area-inset-bottom), 8px); /* 顺便避让底部小白条 */
  background: #fff;
  transition: bottom 0.2s ease-out; /* 跟手过渡，太长会明显滞后于键盘动画 */
  box-sizing: border-box;
}

/* 页面高度用 dvh：它会把浏览器 UI 和键盘的影响一起算进去 */
.chat-page {
  height: 100vh; /* 兜底：老内核不认 dvh 时也不会白屏或塌陷 */
  height: 100dvh; /* iOS 15.4+ / Chrome 108+ 支持，键盘弹起时动态变小 */
}

/* 消息列表占满剩余空间，输入栏用 fixed，所以这里要给它预留位置 */
.chat-list {
  height: calc(100dvh - 48px - var(--keyboard-height, 0px));
  overflow-y: auto;
  overscroll-behavior: contain; /* 滚到底不要带动外层页面 */
}
```

### 3. 聚焦与失焦：解决 iOS 的顶起和悬空

```javascript
// 输入框聚焦时确保它自己在可视区里，比直接 window.scrollTo 更稳
input.addEventListener('focus', () => {
  // iOS 键盘弹出是异步的，等一帧多一点再算位置，
  // 立刻执行会拿到键盘还没弹起时的高度，滚动目标就是错的
  setTimeout(() => {
    input.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, 300)
})

// iOS 的经典 bug：键盘收起后页面停在半空中，底部露出一块白
input.addEventListener('blur', () => {
  // 同样要延迟：键盘收起动画期间 scrollTo 会被系统再次顶上去
  setTimeout(() => {
    window.scrollTo(0, 0) // 多输入框场景下应还原到聚焦前记录的 scrollY
  }, 100)
})

// 体验细节：键盘弹起时列表要自动滚到底部，让用户看到最新一条消息
vv?.addEventListener('resize', () => {
  const list = document.querySelector('.chat-list')
  if (list) list.scrollTop = list.scrollHeight
})
```

### 4. 降级：老 WebView 没有 visualViewport 时的兜底

```javascript
// 降级方案一：聚焦时把输入栏临时改成绝对定位，配合滚动把它顶到可视区
if (!window.visualViewport) {
  input.addEventListener('focus', () => {
    const bar = document.querySelector('.chat-input')
    if (!bar) return

    bar.style.position = 'absolute' // 脱离 fixed，跟随文档流一起被顶上去
    bar.style.bottom = 'auto'
    // 用 setTimeout 给键盘留出弹出时间，再滚到页面底部
    setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 300)
  })

  input.addEventListener('blur', () => {
    const bar = document.querySelector('.chat-input')
    if (!bar) return

    bar.style.position = '' // 复原成 fixed 贴底
    bar.style.bottom = ''
    window.scrollTo(0, 0)
  })
}

// 降级方案二（混合开发里更省心）：由原生容器接管键盘，
// Android 侧把 windowSoftInputMode 设成 adjustResize 并让 WebView 高度跟随，
// iOS 侧监听键盘通知把 WebView 的 frame 抬高 —— 前端就只需要处理内容滚动
```
