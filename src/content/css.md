---
id: css
name: CSS
en: Layout & Style
icon: palette
color: #2965f1
order: 2
desc: 盒模型、BFC、Flex 与 Grid 布局、层叠规则，样式题几乎每轮都会问。
---

## 01 · 标准盒模型和 IE 盒模型的区别，box-sizing 该怎么选

@id
css-box-model

@level
基础

@freq
3

@tags
盒模型 | box-sizing | 布局

@ask
你先说说标准盒模型和 IE 盒模型到底差在哪？那现在项目里我该用哪种 box-sizing？为什么？

@oral
**先说结论**：标准盒模型（content-box）里你设的 `width` 只算内容区，padding 和 border 要额外往外加；IE 盒模型（border-box）里 `width` 把 content、padding、border 全包进去了。现在项目里几乎无脑用 `box-sizing: border-box`，这是 Normalize.css 和主流框架的共识。

**再说原理**：每个元素在排版时都会生成一个盒模型，由 margin / border / padding / content 四层组成。标准盒模型的宽度公式是「元素占用宽度 = width + padding + border + margin」，你写一个 `width: 100px; padding: 20px`，元素实际占 140px。IE 盒模型是 `width` 已经包含 padding 和 border，content 区被压缩到 60px。

**真实项目场景**：做商品卡片列表时第一版我用标准盒模型，给卡片设了 `width: 33.333%; padding: 16px`，结果加上 padding 之后一行三列放不下、换行错位。改成 border-box 后，padding 在宽度内部消化，三列稳稳排满。表单控件同理——input 设了 border 和 padding 还用 content-box，在 flex 容器里会被撑爆。

**边界与取舍**：全局 `*, *::before, *::after { box-sizing: border-box }` 是推荐写法，但要注意第三方组件库可能依赖 content-box；另外 margin 在任何盒模型下都不计入 width，它只影响外部间距，别指望 border-box 帮你收 margin。

**收尾**：一句话，border-box 让「我设多大就是多大」符合直觉，也是现代项目的默认选择，除非在维护老代码或对接特定规范才回退 content-box。

@points
标准盒模型 content-box：width 仅含内容区，padding/border 向外扩张
IE 盒模型 border-box：width 包含 content+padding+border，content 被压缩
现代项目默认全局 border-box，符合「设多大占多大」的直觉
margin 在两种模型下都不计入 width，只影响外部间距
老代码或特定组件库可能依赖 content-box，改造时需注意兼容

@steps
先讲四层结构：margin / border / padding / content 谁在内谁在外
对比两种模型的宽度公式，说清 padding 和 border 放在哪一侧
给一个真实翻车场景（如三列卡片被 padding 撑破）
抛出「现代默认 border-box」的行业共识，提 Normalize.css
提醒 margin 永远不进 width，以及第三方库兼容风险

@followups
为什么会出现两种盒模型？——历史原因，IE 早期把 width 当可视区，W3C 后来定为内容区，IE 怪异模式沿用旧算法
box-sizing 会继承吗？——不会自动继承，需要显式声明或用 * 通配或 inherit 关键字手动继承
border-box 下 content 区被压到负数怎么办？——padding+border 超过 width 时 content 计算为 0，内容溢出，应避免这种极端设定

@example
### 1. 两种盒模型的宽度差异

```css
/* 标准盒模型（默认）：width 只算内容区，padding/border 向外加 */
.box-content {
  box-sizing: content-box;
  width: 100px;
  padding: 20px;
  border: 5px solid #2965f1;
  /* 实际占用宽度 = 100 + 20*2 + 5*2 = 150px，content 仍是 100px */
}

/* IE 盒模型：width 包含 content + padding + border */
.box-border {
  box-sizing: border-box;
  width: 100px;
  padding: 20px;
  border: 5px solid #2965f1;
  /* 实际占用宽度 = 100px，content 被压缩为 100 - 40 - 10 = 50px */
}
```

### 2. 真实翻车：三列卡片被 padding 撑破

```css
/* 反例：content-box + 百分比宽度 + padding，三列永远超 100% 换行 */
.bad .card {
  box-sizing: content-box;
  width: 33.333%;
  padding: 16px;        /* 每行实际宽度 = 33.333% + 32px，三列相加 > 100% */
  border: 1px solid #eee;
}

/* 正例：border-box 让 padding 在宽度内消化，三列稳定排满 */
.good .card {
  box-sizing: border-box;
  width: 33.333%;
  padding: 16px;
  border: 1px solid #eee;  /* 33.333% 已经把 padding 和 border 算进去了 */
}
```

### 3. 全局重置的最佳实践

```css
/* 推荐写法：所有元素及伪元素统一 border-box */
*,
*::before,
*::after {
  box-sizing: border-box;
}

/* 如需局部回退，用 inherit 让子元素跟随父级，而不是写死 */
.child {
  box-sizing: inherit;
}
```

## 02 · BFC 是什么，能解决哪些实际问题

@id
css-bfc

@level
进阶

@freq
3

@tags
BFC | 外边距塌陷 | 浮动

@ask
你经常说 BFC，那它到底是什么？能解决哪些实际问题？除了清除浮动还有别的用处吗？

@oral
**先说结论**：BFC（Block Formatting Context，块级格式化上下文）是页面上的一块「独立渲染区域」，它内部的布局规则不受外界影响，也不影响外界。最常见的三个用途是：清除浮动、阻止外边距塌陷、实现自适应两栏。

**再说原理**：BFC 是一个隔离的容器，触发后它有一套自己的排版规则——内部块盒从顶部垂直排列；同一个 BFC 里相邻块级盒的上下 margin 会塌陷，但不同 BFC 之间不会；计算 BFC 高度时，浮动子元素也参与计算（这就是清浮动的原理）；BFC 区域不会和浮动元素重叠。

**真实项目场景**：第一，父容器包不住浮动的子元素导致高度塌陷，给父容器加 `overflow: hidden` 触发 BFC 就能把浮动子元素算进高度；第二，两个兄弟块上下 margin 各 20px，期望 40px 实际只剩 20px（塌陷），把它们分别放进不同 BFC 就能各算各的；第三，做左侧固定、右侧自适应的两栏，右侧设 `overflow: hidden` 触发 BFC 后就不会被左侧浮动盖住。

**边界与取舍**：触发 BFC 的方式很多——`overflow` 非 visible、`float` 非 none、`position: absolute/fixed`、`display: flex/grid/inline-block`、`display: flow-root`。最干净的现代解法是 `display: flow-root`，它专门为了触发 BFC 而生，不会像 `overflow: hidden` 那样把溢出内容裁掉。

**收尾**：BFC 不是新概念，它解释了大量「为什么样式这样生效」的底层行为，面试里能举出浮动、塌陷、自适应三例就很有说服力。

@points
BFC 是隔离的块级格式化上下文，内部布局不受外部影响也不影响外部
同一 BFC 内相邻块盒上下 margin 会塌陷，不同 BFC 之间不会
计算 BFC 高度时浮动子元素参与计算，这是清除浮动的本质
BFC 区域不与浮动元素重叠，可用于自适应两栏
现代推荐 display: flow-root 触发，副作用最小；overflow:hidden 会裁切溢出

@steps
先定义 BFC：一块独立的渲染区域，有自己的排版规则
讲清塌陷规则：同 BFC 才塌陷，跨 BFC 不塌陷
场景一：清浮动——BFC 高度计算包含浮动子元素
场景二：防塌陷——把两个块放进各自 BFC
场景三：自适应两栏——右侧 BFC 不被左侧浮动覆盖
给最优解：display: flow-root 无副作用，替代 overflow:hidden

@followups
怎么触发 BFC？——overflow 非 visible、float 非 none、position 为 absolute/fixed、display 为 flex/grid/inline-block/flow-root 等
display: flow-root 和 overflow: hidden 区别？——前者专为触发 BFC 而生不裁切内容，后者会裁掉溢出部分，可能影响下拉菜单等
BFC 能解决行内元素重叠吗？——BFC 只管块级盒，行内/浮动重叠要靠别的手段，BFC 主要解决块级布局隔离

@example
### 1. 清除浮动：父容器塌陷

```html
<!-- 父容器没有高度，因为子元素都浮动了，父容器包不住它们 -->
<div class="parent clearfix-demo">
  <div class="float-left">左侧浮动的菜单</div>
  <div class="float-right">右侧浮动的按钮</div>
</div>
```

```css
.float-left  { float: left;  width: 120px; height: 60px; background: #e8f0fe; }
.float-right { float: right; width: 120px; height: 60px; background: #e8f0fe; }

/* 反例：父容器高度塌成 0，后面的元素会顶上来重叠 */
.parent { border: 2px dashed #2965f1; }
.parent::after { content: ''; display: block; clear: both; } /* 经典 clearfix */

/* 正例：触发 BFC，高度计算包含浮动子元素 */
.parent { display: flow-root; border: 2px dashed #2965f1; }
```

### 2. 阻止相邻 margin 塌陷

```css
/* 反例：两个块级盒上下 margin 各 20px，实际间距只有 20px（塌陷了） */
.sibling-a { margin-bottom: 20px; }
.sibling-b { margin-top: 20px; }   /* 期望 40px，实际 20px */

/* 正例：给其中一个套一层 BFC 容器，两者不再同处一个 BFC，各算各的 */
.bfc-wrap { display: flow-root; }  /* 包住 sibling-b，间距变成 40px */
```

### 3. 自适应两栏布局

```css
/* 左侧固定宽度浮动，右侧自适应，且不希望被左侧盖住 */
.aside { float: left; width: 200px; }
.main  { overflow: hidden; } /* 触发 BFC，不与左浮动重叠，自动占满剩余宽度 */

/* 现代更稳的写法：直接 flex 即可，不必纠结 BFC */
.layout { display: flex; }
.layout .aside { width: 200px; flex: none; }
.layout .main  { flex: 1; }
```

## 03 · 选择器权重怎么算，为什么你的样式就是不生效

@id
css-specificity

@level
进阶

@freq
3

@tags
权重 | 优先级 | 层叠

@ask
你写了一条样式死活不生效，你怎么排查？选择器权重到底怎么算的？!important 能乱用吗？

@oral
**先说结论**：样式不生效，九成是「被更高权重的规则盖掉了」，剩下的是「没命中元素」或「被继承/默认值」坑了。权重按 (a,b,c,d) 计算：行内 1000、id 100、class/属性/伪类 10、元素/伪元素 1，比较时从左往右比。

**再说原理**：CSS 层叠（cascade）决定最终值，优先级顺序是：来源（!important > 作者样式 > 浏览器默认）> 权重 > 书写顺序（后者覆盖前者）。权重具体算法是统计四条：行内 style 记 a、id 选择器数量记 b、class/属性/伪类记 c、元素和伪元素记 d，得到四元组 (a,b,c,d)，谁的元组在字典序上更大谁赢。比如 `#nav .item a` 是 (0,1,1,1)，`.nav a` 是 (0,0,1,2)，前者胜。

**真实项目场景**：我曾经改一个老组件，`.btn.active` 写的蓝色怎么都盖不过 `.btn`，后来发现全局有个 `#app .btn`(0,1,1,0) 权重更高，我用 `.btn.active`(0,0,2,0) 自然打不过。解决要么加一个 id 级前缀（不优雅），要么把规则改成同级权重靠后书写，最好是用 BEM 之类约定避免 id 进场。另一个常见坑：用 `a` 元素选择器(0,0,0,1) 给链接设色，结果被 `:visited` 这种伪类(0,0,1,1) 盖了——其实是因为浏览器对 :visited 有安全限制，颜色压根不让你改。

**边界与取舍**：!important 能强行翻盘，但它破坏层叠、难以覆盖、让调试进入地狱，只在覆盖第三方库或临时救火时用一次。真正的解法是「权重对齐 + 靠后书写」或用 CSS 变量/设计 token 收口。

**收尾**：排查套路就是——先看 Elements 面板 Computed 里这条属性被哪条规则划掉，对比权重和来源，再决定是提权重还是调顺序。

@points
权重用四元组 (行内, id, class/属性/伪类, 元素/伪元素) 表示，字典序比较大小
层叠顺序：!important > 作者样式 > 浏览器默认；同来源再比权重，再比书写顺序
!important 破坏层叠、难覆盖、调试痛苦，只在救火或覆盖三方库时谨慎用
被 :visited / :link 等伪类限制的属性（如 color）是浏览器安全策略，改不动
排查用 DevTools 的 Computed 面板，看属性被哪条规则划掉

@steps
先确认选择器真的命中了目标元素（拼写、层级、动态 class）
打开 DevTools Computed，找到不生效的属性，看被哪条规则划掉
对比两条规则的来源和权重四元组，判断谁更高
决定提权重（加 class 前缀）还是调书写顺序，避免直接上 !important
若是 :visited 等受限制属性，认清是浏览器安全限制，换方案

@followups
内联 style 和 !important 谁高？——带 !important 的内联最高，但带 !important 的作者样式 > 不带的内联
:not() 里的选择器算权重吗？——算，:not() 本身不计入，但括号里的选择器正常参加权重计算
通配符 * 权重是多少？——0，但 :where() 里所有选择器权重也强制为 0，常用于「零权重重置」

@example
### 1. 权重四元组实战对比

```css
/* (0,0,0,1) 一个元素选择器 */
a { color: blue; }

/* (0,0,1,1) 一个 class + 一个元素，权重更高 */
.nav a { color: red; }   /* 链接最终是红色 */

/* (0,1,1,1) 一个 id + class + 元素，再胜一筹 */
#app .nav a { color: green; } /* 最终绿色，覆盖了前两条 */
```

### 2. 死活不生效的经典场景

```css
/* 我想让激活态变蓝，但永远盖不过全局规则 */
.btn { color: #333; }          /* (0,0,1,0) */
.btn.active { color: #2965f1; } /* (0,0,2,0)，本应更胜 */

/* 但全局有个 id 级规则先写了 */
#app .btn { color: #999; }     /* (0,1,1,0)，权重碾压上面两条 */

/* 反例：随手 !important 救火，后期没法覆盖 */
.btn.active { color: #2965f1 !important; }

/* 正例：去掉 id 前缀污染，让 .btn.active 在同来源里靠后胜出 */
.btn.active { color: #2965f1; } /* 配合去掉 #app 前缀或改用 CSS 变量 */
```

### 3. :where() 与 :not() 的权重陷阱

```css
/* :where() 内部权重强制为 0，适合做「零权重」基础重置 */
:where(button, input, select) {
  margin: 0;  /* 权重 0，任何一条业务规则都能轻松覆盖它 */
}

/* :not() 本身不计入，但括号里的选择器正常算权重 */
a:not(.disabled) { color: blue; } /* 权重 = (0,0,2,1)：伪类 :not + class + 元素 a */
```

## 04 · Flex 布局的核心属性与经典场景（居中、等分、圣杯）

@id
css-flex

@level
基础

@freq
3

@tags
Flex | 弹性布局 | 居中

@ask
Flex 你肯定用过，那它的核心属性你都清楚吗？居中、等分、还有你说的圣杯布局，怎么用 flex 一套搞定？

@oral
**先说结论**：Flex 是「一维」弹性布局，掌握容器六属性和项目两属性就能覆盖绝大多数场景；居中一句 `justify-content + align-items` 双 center，等分靠 `flex: 1`，圣杯布局用「头部/底部固定 + 中间 flex:1 列方向」组合。

**再说原理**：Flex 容器（`display: flex`）有两个轴——主轴（默认横向，由 `flex-direction` 决定）和交叉轴。容器属性控制整体：`flex-direction` 定方向、`flex-wrap` 是否换行、`justify-content` 主轴对齐、`align-items` 交叉轴对齐、`align-content` 多行对齐、`gap` 间距。项目属性覆盖自身：`flex-grow` 放大比例、`flex-shrink` 缩小比例、`flex-basis` 初始基准尺寸，`flex` 是这三者的缩写。

**真实项目场景**：导航栏两端对齐用 `justify-content: space-between`；商品列表自动换行用 `flex-wrap: wrap` + 每项 `flex: 1 1 200px` 做弹性卡。最经典的「圣杯」：外层 `display: flex; flex-direction: column; height: 100vh`，header/footer 固定高度，中间 main 设 `flex: 1` 自适应填满，main 内部再 `display: flex` 让左中右三栏，左/右固定宽、center `flex:1`。

**边界与取舍**：`flex: 1` 其实是 `flex: 1 1 0%`，basis 为 0 意味着所有可用空间按 grow 比例平分，这是等分的正确写法；别写成 `flex: auto`（basis 是 auto，会保留内容固有宽度）。`align-items: stretch`（默认）会让子项拉满交叉轴，想按内容高度就改 `flex-start`。还有 `flex` 子项默认 `min-width: auto`，内容过长会撑破容器，必要时设 `min-width: 0`。

**收尾**：Flex 解决 90% 的「一排/一列」问题，记牢「容器管对齐、项目管伸缩」这句话就够用了。

@points
Flex 是一维布局，容器管整体对齐（justify/align），项目管自身伸缩（flex-grow/shrink/basis）
水平垂直居中：容器 display:flex + justify-content:center + align-items:center
等分用 flex: 1（即 1 1 0%，按 grow 平分可用空间）
圣杯：外层 column + 中间 flex:1，内层再 flex 排三栏
flex 子项默认 min-width:auto 会被内容撑破，必要时设 min-width:0

@steps
确定布局方向：flex-direction 决定主轴是横还是竖
容器对齐：justify-content 管主轴、align-items 管交叉轴
子项伸缩：用 flex: 1 等分，或固定 flex-basis 设定基准
处理换行与间距：flex-wrap + gap 替代 margin hack
组合成圣杯：外层 column 固定头尾、中间 flex:1，内部再 flex 分栏

@followups
flex: 1 和 flex: auto 区别？——flex:1 是 1 1 0%（忽略内容固有宽等分），flex:auto 是 1 1 auto（保留内容宽再分剩余）
align-content 和 align-items 区别？——align-items 管单行交叉轴对齐，align-content 管多行（换行后）整体的分布
为什么 flex 子项内容会撑破容器？——默认 min-width:auto 不允许小于内容，设 min-width:0 即可允许收缩

@example
### 1. 一行搞定水平垂直居中

```css
.center-box {
  display: flex;
  justify-content: center; /* 主轴（横）居中 */
  align-items: center;     /* 交叉轴（竖）居中 */
  height: 300px;
}
```

```html
<div class="center-box">
  <div class="card">我永远在正中</div>
</div>
```

### 2. 等分的弹性卡片列表

```css
.list {
  display: flex;
  flex-wrap: wrap;   /* 空间不够时换行 */
  gap: 16px;         /* 不用 margin，gap 更干净 */
}
.list .item {
  flex: 1 1 200px;   /* grow:1 可放大 / shrink:1 可收缩 / basis:200px 基准宽 */
  /* 三列时各占 1/3；窄屏自动换行并重新等分 */
  background: #e8f0fe;
  padding: 16px;
}
```

### 3. Flex 版圣杯布局

```css
.page {
  display: flex;
  flex-direction: column; /* 主轴变纵向 */
  height: 100vh;
}
.page .header,
.page .footer { height: 60px; flex: none; } /* 头尾固定，不伸缩 */
.page .body {
  flex: 1;                /* 占满中间剩余高度 */
  display: flex;          /* 内部再横向分三栏 */
}
.page .body .side { width: 200px; flex: none; }
.page .body .content { flex: 1; min-width: 0; } /* 中间自适应，min-width:0 防撑破 */
```

## 05 · Grid 和 Flex 分别适合什么场景，Grid 的关键概念

@id
css-grid

@level
进阶

@freq
2

@tags
Grid | 网格布局 | 二维布局

@ask
Flex 和 Grid 你都用了，那它们到底怎么选？Grid 那套 fr、repeat 这些你讲讲，什么时候非用 Grid 不可？

@oral
**先说结论**：Flex 是「一维」、沿单轴排；Grid 是「二维」、同时管行和列。凡是只有一排或一列（导航、卡片流），Flex 最顺手；凡是需要规整行列网格（后台表格、仪表盘、相册），Grid 才是正解。

**再说原理**：Grid 用 `grid-template-columns` / `grid-template-rows` 显式画出轨道。核心单位 `fr`（fraction）表示「剩余可用空间的一份」，像弹性百分比但更智能；`repeat(3, 1fr)` 是三等分；`repeat(auto-fill, minmax(200px, 1fr))` 能响应式自动排列数。子项用 `grid-column: 1 / 3`（从线 1 到线 3，跨两列）、`grid-row: span 2` 控制占位。还有 `gap` 直接设行列间距，不用算 margin。

**真实项目场景**：商品管理后台的卡片墙，用 `grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))` 一句就实现「宽屏多列、窄屏少列」的自适应，完全不用媒体查询。再比如经典「跨行侧栏 + 顶栏贯穿」的 dashboard 布局，Grid 用 `grid-template-areas` 把区域命名后像拼图一样摆，可读性是 Flex 远达不到的。

**边界与取舍**：别用 Grid 做「一行里几个标签靠右」这种简单一维对齐，杀鸡用牛刀且 Flex 对「内容驱动换行」更自然。反过来，用 Flex 硬凑二维网格会遇到「行高对不齐、跨列麻烦」的痛点。另外 Grid 的 `1fr` 默认 `min-width: auto`，内容过长会爆，配 `minmax(0, 1fr)` 更稳。兼容性上 Grid 现代浏览器全支持，老旧 IE 仍需 `-ms-` 前缀，已非主流考量。

**收尾**：一句话——Flex 管「流的排列」，Grid 管「空间的切割」，两者经常组合（Grid 套 Grid、Grid 里塞 Flex 子项）而非二选一。

@points
Flex 一维（单轴流式）、Grid 二维（行列同时管），按是否需要规整网格选择
fr 是「剩余空间的一份」，repeat() 和 minmax() 实现响应式轨道
grid-template-areas 用命名区域拼布局，可读性远超 Flex 嵌套
Grid 的 1fr 默认 min-width:auto 会被内容撑破，用 minmax(0,1fr)
两者常组合：Grid 切大结构，Flex 排内部一维内容

@steps
判断维度：一排一列 → Flex；规整行列 → Grid
用 grid-template-columns/rows 定义轨道，优先 repeat + fr
用 minmax + auto-fill 做无媒体查询的响应式列数
需要跨区/跨行用 grid-column/grid-row 或 grid-template-areas
内容可能溢出时把 1fr 写成 minmax(0, 1fr)

@followups
Grid 和 Flex 能混用吗？——能，常见 Grid 切大布局、内部某格用 Flex 排一维内容
repeat(auto-fill) 和 auto-fit 区别？——auto-fill 保留空轨道占位，auto-fit 把空轨道折叠让已有项拉伸占满
grid 的线编号从 1 开始，那 -1 是什么？——-1 表示最后一条网格线，可用于「跨到最右/最底」

@example
### 1. 响应式卡片墙（无需媒体查询）

```css
.wall {
  display: grid;
  /* 每列最小 200px，放得下几个就几个，剩余空间平分给各列 */
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}
.wall .card { background: #e8f0fe; padding: 16px; }
```

### 2. grid-template-areas 拼 dashboard

```css
.dashboard {
  display: grid;
  grid-template-columns: 200px 1fr;
  grid-template-rows: 60px 1fr 60px;
  grid-template-areas:
    "header header"
    "sidebar main"
    "footer footer";
  height: 100vh;
}
.dashboard .header  { grid-area: header; }  /* 直接按名字落位，可读极强 */
.dashboard .sidebar { grid-area: sidebar; }
.dashboard .main    { grid-area: main; min-width: 0; }
.dashboard .footer  { grid-area: footer; }
```

### 3. 子项跨列与 minmax 防撑破

```css
.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); /* 1:2 两列，且都允许收缩 */
  gap: 12px;
}
.grid .banner { grid-column: 1 / 3; } /* 从第 1 条线跨到第 3 条线，占满整行 */
```

## 06 · 水平垂直居中的全部方案与取舍

@id
css-center

@level
基础

@freq
3

@tags
居中 | transform | flex

@ask
居中对齐有多少种写法？你说一个我觉得不够，把所有方案都列出来，再告诉我怎么选。

@oral
**先说结论**：居中能分「已知尺寸 / 未知尺寸 / 行内内容」三类场景，现代首选 Flex 三件套，万能兜底用 `position + transform`，老项目还能用 `margin: auto` 和 table 系。没有「唯一正确解」，看约束选。

**再说原理**：行内/文本居中靠 `text-align: center`（水平）+ `line-height` 或 `vertical-align`（垂直）；块级元素水平居中靠定宽 + `margin: 0 auto`；绝对定位居中靠 `top/left: 50%` + `translate(-50%,-50%)` 把自身一半拉回来，这个不依赖尺寸所以万能；Flex/Grid 居中靠对齐属性；还有一种 `display: table-cell` + `vertical-align: middle` 兼容老 IE。

**真实项目场景**：弹窗组件我统一用 `position: fixed; inset: 0` 的遮罩 + 内层 `display: flex; align-items:center; justify-content:center`，子内容多高多宽都能居中，且不抖动。图片在容器里居中、且容器高度不定，用 `object-fit: contain` 配 flex 居中最稳。遇到过老后台要兼容 IE9，那就 `table-cell` 方案，Flex 在 IE9 不支持。

**边界与取舍**：`margin: auto` 水平好使，但垂直居中需要父级是 flex/grid 或绝对定位 `top/bottom:0` + `height` 固定才灵；`translate` 方案在元素会被频繁重排动画时，注意 `transform` 会创建层叠上下文、可能影响 `z-index` 和 `fixed` 子元素。Grid 居中其实更短：父 `display:grid; place-items:center` 一行搞定。

**收尾**：面试里我建议按「是否定宽、是否兼容老浏览器、是否在 flex 容器里」三个条件反问自己，然后挑 Flex（首选）、transform（兜底）、margin auto（简单块）之一。

@points
现代首选 Flex：align-items + justify-content 双 center，未知尺寸也好用
万能兜底：position + top/left 50% + translate(-50%,-50%)，不依赖尺寸
定宽块级水平居中：width + margin: 0 auto；垂直需 flex/grid 或绝对定位
一行流式文本：text-align:center + line-height 或 vertical-align
Grid 最短：place-items: center 一行居中；table-cell 用于兼容老 IE

@steps
先判断：内容尺寸已知还是未知？要不要兼容老浏览器？
在 flex/grid 容器里 → 直接 align/justify 或 place-items 居中
不在弹性容器、尺寸未知 → 绝对定位 + transform 兜底
定宽块级只要水平 → margin: 0 auto
行内文本 → text-align + line-height；老 IE 用 table-cell

@followups
translate(-50%,-50%) 里的 % 相对于谁？——相对于元素自身宽高，所以能精准拉回一半，不依赖外部尺寸
place-items: center 是什么？——同时设置 align-items 和 justify-items 为 center 的简写，Grid 一行文居中
margin: auto 为什么垂直不灵？——普通流里垂直方向没有「剩余空间」概念，只有 flex/grid 或绝对定位给了高度剩余时才生效

@example
### 1. Flex 三件套（首选，未知尺寸）

```css
.modal-mask {
  display: flex;
  justify-content: center; /* 水平 */
  align-items: center;     /* 垂直 */
  position: fixed;
  inset: 0;                /* 铺满视口 */
}
.modal {
  /* 不需要知道宽高，内容多高都居中 */
  width: 480px;
  padding: 24px;
}
```

### 2. 万能兜底：绝对定位 + transform

```css
.center-transform {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%); /* % 基于自身尺寸，拉回一半，尺寸未知也能用 */
}
```

### 3. 定宽块水平居中 + Grid 一行居中

```css
/* 定宽块级，只水平居中 */
.block { width: 300px; margin: 0 auto; }

/* Grid 最短写法 */
.grid-center {
  display: grid;
  place-items: center; /* align-items + justify-items 同时 center */
  height: 100vh;
}
```

### 4. 行内文本与图片居中

```css
.text { text-align: center; line-height: 40px; } /* 单行文字垂直靠 line-height */

.img-box {
  display: flex;
  align-items: center;
  justify-content: center;
}
.img-box img { object-fit: contain; max-width: 100%; } /* 图片在框内居中且不溢出 */
```

## 07 · 层叠上下文是什么，z-index 为什么会失效

@id
css-stacking-context

@level
进阶

@freq
3

@tags
层叠上下文 | z-index | 定位

@ask
你设了 z-index: 999 还是被别的盖住了，怎么回事？层叠上下文到底是个啥，z-index 为什么有时候不灵？

@oral
**先说结论**：`z-index` 不是全局比大小，它只在「同一个层叠上下文」里比。你设的 999 被盖住，多半是因为你的元素和对手根本不在同一个上下文里——对手的父级创建了更高的上下文，整层把你压在下面。

**再说原理**：层叠上下文（Stacking Context）是页面上的三维堆叠单位。根元素天然一个；满足特定条件会新建一个：定位元素 + `z-index` 非 auto、`opacity<1`、`transform`/`filter`/`will-change` 非 none、`position: fixed`、`flex/grid` 子项带 `z-index` 等。比较规则是：先比上下文的层级（谁的上下文在更上面，里面的子元素整体在上面），同一上下文内才按 `z-index` 和 DOM 顺序排。

**真实项目场景**：我做过一个带 `transform: translateZ(0)` 做 GPU 加速的弹窗容器，里面子菜单 `z-index: 9999` 想盖住外层一个 `z-index: 10` 的下拉，结果怎么都不行——因为那个 `transform` 把弹窗变成了一个独立上下文，它的层级取决于父级在那个上下文里的地位，内部 9999 出不了这个「房间」。另一个坑：给某个列表项加 `opacity: 0.9` 做 hover 动画，结果它整体浮到兄弟之上盖住了别的，因为 opacity 新建了上下文。

**边界与取舍**：想让 z-index 生效，先确认两个元素在同一个上下文；跨上下文时只能提升「上下文的父级」层级，而不是拼命加大子元素数值。日常开发我尽量只在一个统一的根上下文里用 z-index，并建一套分级（如 弹窗 1000、下拉 500、遮罩 900），避免到处加数字。

**收尾**：面试记住一句话——z-index 比的是「同屋的人」，屋子不同比不了，先找是谁建了新屋子。

@points
z-index 只在同一个层叠上下文内比较，跨上下文比的是上下文本身层级
新建上下文的条件：定位+z-index、transform/filter/opacity<1、fixed、flex/grid 子项带 z-index 等
transform/opacity 等「顺手」属性常无意中创建上下文，导致 z-index 失效
跨上下文时只能提升父级上下文层级，加大子元素数值无效
工程上用统一 z-index 分级（遮罩/弹窗/下拉），避免数值乱飞

@steps
确认两个元素是否在同一层叠上下文（向上找最近的已建上下文祖先）
若不在同一上下文，比较的是各自上下文的层级，不是子元素 z-index
检查是否 transform/opacity/filter/position+z-index 无意建了新上下文
跨上下文时改为提升「父级上下文」的层级
建立项目内 z-index 分级规范，减少排查成本

@followups
哪些属性会创建层叠上下文？——position+z-index 非 auto、transform/filter/perspective 非 none、opacity<1、will-change 含上述、mix-blend-mode 非 normal、fixed 等
根元素有上下文吗？——有，根元素天然一个根层叠上下文，所有其他上下文都是它的后代
为什么有时候 z-index 设了等于没设？——元素没定位（static）时 z-index 不生效，且元素可能不在你以为的上下文里

@example
### 1. 无意中被 transform 关进新上下文

```html
<div class="overlay">外层下拉 z-index:10</div>
<div class="modal">     <!-- 加了 transform，新建了层叠上下文 -->
  <div class="menu">内部菜单 z-index:9999</div>
</div>
```

```css
.overlay { position: relative; z-index: 10; }
.modal   { position: relative; transform: translateZ(0); } /* 新建上下文！ */
.menu    { position: relative; z-index: 9999; }

/* 结果：modal 这个上下文整体层级由父级决定，内部 9999 出不了「房间」，
   若 modal 父级上下文低于 overlay，菜单永远盖不住 overlay */
```

### 2. 统一 z-index 分级（推荐规范）

```css
:root {
  --z-dropdown: 500;
  --z-modal-mask: 900;
  --z-modal: 1000;
  --z-toast: 1100;
}
.dropdown { z-index: var(--z-dropdown); }
.modal-mask { z-index: var(--z-modal-mask); }
.modal { z-index: var(--z-modal); }
.toast { z-index: var(--z-toast); }
/* 同一根上下文内按这套数字排，绝不乱加 99999 */
```

### 3. 定位但 z-index 不生效的坑

```css
/* 反例：static 定位下 z-index 完全无效 */
.box { position: static; z-index: 999; } /* 不起作用 */

/* 正例：至少要 relative/absolute/fixed 之一 */
.box { position: relative; z-index: 999; }
```

## 08 · 重排和重绘的区别，怎么写不触发重排的动画

@id
css-reflow-repaint

@level
进阶

@freq
3

@tags
重排 | 重绘 | 性能

@ask
重排和重绘你分得清吗？怎么写动画才能不卡？为什么我用 transform 做动画就比改 left 流畅？

@oral
**先说结论**：重排（reflow）是改了几何属性、浏览器要重新算布局和绘制，最贵；重绘（repaint）只改颜色等外观、不用重新布局，次贵；而 `transform` / `opacity` 走合成层、连重绘都省了，直接 GPU 合成，所以最丝滑。

**再说原理**：渲染流水线分三步——JS 改样式 → 样式计算 → 布局（重排，算每个盒的位置尺寸）→ 绘制（重绘，填像素到图层）→ 合成（把图层合到屏幕）。凡是动宽高、位置（top/left）、字体、增删节点，都会触发重排，重排必然连带重绘。改 `color`、`background` 只重绘。而 `transform`、`opacity`、`filter` 在支持的浏览器里会提升为独立合成层，由 GPU 直接变换，跳过布局和绘制，只做合成，所以 60fps 稳。

**真实项目场景**：商品列表 hover 时我早年用 `left` 做滑入动画，低端机明显卡顿；改成 `transform: translateX()` 后直接上合成层，丝滑。还做过一个「无限滚动加载更多」，在 `scroll` 里同步读 `offsetHeight`（强制同步布局），导致每次滚动都重排，卡成 PPT；改成用 `IntersectionObserver` 异步探测后，完全不碰布局，流畅度回来。

**边界与取舍**：不是所有属性都能合成，改 `width`/`top` 永远逃不开重排。想动画丝滑就只用 `transform` 和 `opacity`，必要时 `will-change: transform` 提前提示浏览器建层（但别滥用，每层都吃内存）。另外读写布局属性要分离——批量写、避免「写后读」触发强制同步布局。

**收尾**：性能口诀——能用 transform/opacity 就别碰 left/top/width，能批量改就别穿插读，动画基本就稳了。

@points
重排改几何（宽高/位置）要重新布局，最贵且必带重绘；重绘只改外观
transform/opacity 走合成层，跳过布局与绘制，仅 GPU 合成，最流畅
动画优先用 transform 和 opacity，避免 left/top/width 触发重排
读写布局属性穿插会触发「强制同步布局」，应批量读写分离
will-change 可提前建合成层，但滥用会吃内存

@steps
分清三类操作代价：重排 > 重绘 > 合成
动画只用 transform / opacity，让浏览器提升到合成层
避免「写样式后立即读 offsetHeight」这类强制同步布局
批量 DOM 改动用 documentFragment 或读写分离
必要时 will-change 提示建层，但用后及时移除

@followups
哪些属性会触发重排？——几何相关：width/height/top/left/margin/padding/font-size/display，以及增删节点、读取布局属性
will-change 能乱用吗？——不能，每层占用 GPU 内存，过多反而卡，用完应移除
为什么 scroll 里读 offsetTop 会卡？——读布局属性强制浏览器先完成待处理的重排（强制同步布局），滚动高频触发就卡

@example
### 1. 丝滑 vs 卡顿：transform 对比 left

```css
/* 反例：改 left 触发重排 + 重绘，低端机掉帧 */
.box-left {
  position: absolute;
  left: 0;
  transition: left 0.3s;
}
.box-left:hover { left: 100px; } /* 每帧重新布局 */

/* 正例：transform 走合成层，只 GPU 合成，丝滑 */
.box-transform {
  transform: translateX(0);
  transition: transform 0.3s;
}
.box-transform:hover { transform: translateX(100px); } /* 跳过布局与绘制 */
```

### 2. 强制同步布局（反例）与修复

```javascript
// 反例：循环里「写后读」，每次读都强制浏览器先重排，巨慢
function bad() {
  const els = document.querySelectorAll('.item')
  for (const el of els) {
    el.style.width = '100px'          // 写
    console.log(el.offsetWidth)       // 读 → 强制同步布局，触发重排
  }
}

// 正例：先批量读，再批量写，重排只发生一次
function good() {
  const els = [...document.querySelectorAll('.item')]
  const widths = els.map((el) => el.offsetWidth) // 先全读
  els.forEach((el, i) => { el.style.width = widths[i] + 20 + 'px' }) // 再全写
}
```

### 3. 用 IntersectionObserver 替代 scroll 读布局

```javascript
// 反例：scroll 里读 getBoundingClientRect 强制布局，滚动卡顿
window.addEventListener('scroll', () => {
  const rect = sentinel.getBoundingClientRect() // 每帧重排
  if (rect.top < window.innerHeight) loadMore()
})

// 正例：异步观察，不碰布局
const io = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting) loadMore()
})
io.observe(sentinel)
```

## 09 · 移动端适配方案：rem、vw、viewport 缩放该怎么选

@id
css-mobile-adapt

@level
进阶

@freq
3

@tags
移动端 | rem | vw | 适配

@ask
移动端适配你怎么做？rem、vw、还有那个 viewport 缩放，到底该用哪个？你说清楚各自的取舍。

@oral
**先说结论**：移动端适配的本质是「让设计稿上的 px 在不同屏宽上等比缩放」。现在最干净的是 **vw 方案**（1vw = 视口宽 1%，纯 CSS 无 JS）；rem 方案要配一段 `document.documentElement.style.fontSize` 的 JS 动态根字号，历史项目多；viewport 缩放（理想视口 + 物理像素比）是前提而不是二选一。

**再说原理**：设计稿通常按 375px 宽出，要等比还原就引入「相对单位」。rem 是相对根字号 `html` 的 `font-size`，经典做法是把屏幕宽分成 10 份或 100 份，JS 监听 `resize` 设 `html { font-size: 屏宽/10 }`，那么 `1rem = 屏宽/10`，写样式时 `px / (设计稿宽/10)` 即得 rem。vw 更直接：`1vw = 屏宽 1%`，设计稿 375 下 `1px = 100/375 vw ≈ 0.2667vw`，配合 `postcss-px-to-viewport` 自动换算。viewport 的 `<meta name="viewport" content="width=device-width, initial-scale=1">` 让布局视口等于设备宽，是上述两方案生效的前提。

**真实项目场景**：我新项目全用 vw + postcss 自动转，写代码就按设计稿 px 写，构建时自动变 vw，大屏自动放大、小屏自动缩小，且不用跑 JS。但遇到要「限制最大宽度」的 H5（比如 iPad 上不希望拉太开），vw 会无限放大，这时我加 `max-width: 750px; margin: 0 auto` 给容器兜底。老项目（用 lib-flexible 那套）仍是 rem，迁移成本低就保留。

**边界与取舍**：rem 有「JS 依赖、字体受根字号影响需额外处理」的缺点；vw 在超宽屏会过度放大、且 `1px` 边框用 vw 会变成小数发虚，边框仍建议用 `1px` 或 `transform: scale`。另外记得 `initial-scale` 按 `devicePixelRatio` 处理高清屏，但现代已经靠 vw/rem 自适应，不靠整体缩放了。

**收尾**：一句话，新项目无脑 vw + 自动转换插件，老项目沿用 rem，viewport meta 永远要写，三者是「前提 + 主方案」的关系。

@points
viewport meta 是适配前提（布局视口=设备宽），与 rem/vw 不冲突
vw 纯 CSS、无 JS，1vw=视口宽1%，配 postcss 自动转 px 最干净
rem 靠 JS 动态根字号实现等比，历史项目（lib-flexible）常见
vw 超宽屏会过度放大，需容器 max-width 兜底；1px 边框别用 vw
新项目首选 vw，老项目保留 rem，三者互补而非互斥

@steps
写全 viewport meta（width=device-width, initial-scale=1）作为前提
新项目：引入 postcss-px-to-viewport，按设计稿宽写 px 自动转 vw
老项目：保留 lib-flexible 式 rem，根字号由 JS 按屏宽算
给页面容器加 max-width 兜底，避免大屏/横屏过度拉伸
1px 边框、细线用 transform: scale 或 border 1px，不交给 vw/rem

@followups
rem 的根字号一般设多少？——常见把设计稿宽分 10 份，html font-size = 屏宽/10，如 375 屏下 37.5px，写 75px 元素即 2rem
vw 在 PC 大屏会怎样？——会随视口无限放大，所以 H5 容器常加 max-width 限制
为什么 1px 边框用 vw 会发虚？——vw 算出来可能是 0.5px，浏览器四舍五入导致虚边，宜用 1px 或 scale 缩放

@example
### 1. vw 方案 + postcss 自动转换

```css
/* 设计稿 375 宽，元素宽 75px → 直接写 px，构建时插件转成 vw */
.banner { width: 75px; }  /* 编译后约等于 width: 20vw（75/375*100） */

/* 容器兜底：大屏不无限放大 */
.page {
  max-width: 750px; /* 约 10 倍设计稿，iPad 上不再拉太开 */
  margin: 0 auto;
}
```

```html
<!-- 必备：让布局视口等于设备宽度，rem/vw 才能正确生效 -->
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
```

### 2. rem 方案核心 JS（历史项目）

```javascript
// 经典 flexible 思路：把屏宽分 10 份作为 1rem 的基准
function setRootFontSize() {
  const width = document.documentElement.clientWidth
  // 设计稿 375 → 1rem = 37.5px；元素 75px → 写 2rem
  document.documentElement.style.fontSize = width / 10 + 'px'
}
setRootFontSize()
window.addEventListener('resize', setRootFontSize)
window.addEventListener('orientationchange', setRootFontSize)
```

```css
/* 配合上面：设计稿 75px 的元素 */
.card { width: 2rem; } /* 375 屏下 = 75px，其他屏宽等比缩放 */
```

### 3. 1px 边框的正确姿势

```css
/* 反例：用 vw 表示 1px 会算成小数，发虚 */
.bad-border { border: 1px solid #eee; transform: none; }

/* 正例：用伪元素 + scale 画高清 1px */
.hairline {
  position: relative;
}
.hairline::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid #eee;
  transform: scale(0.5);   /* 二倍屏下缩成真 1px，清晰 */
  transform-origin: 0 0;
  pointer-events: none;
}
```

## 10 · 为什么以前要清除浮动，现在的标准做法是什么

@id
css-clearfix

@level
基础

@freq
2

@tags
浮动 | clearfix | BFC

@ask
以前老代码里到处是 clearfix，现在还需要吗？为什么会出现「要清除浮动」这回事？现在的标准做法是什么？

@oral
**先说结论**：要清除浮动，是因为浮动元素脱离了文档流、撑不开父容器高度（高度塌陷），后面的内容会钻上来重叠。现在的「标准做法」已经不是手写 clearfix，而是**根本不用浮动做布局**——用 Flex/Grid，浮动只在图文环绕这种真正场景留着。

**再说原理**：浮动（`float: left/right`）原本是为实现「文字绕图」设计的，元素浮起后脱离普通流，父容器在算高度时看不见它，于是高度塌成 0。老办法两类：一是在浮动元素后放一个空 `<div style="clear:both">` 占高度（结构污染）；二是 `::after` 伪元素 + `clear: both` 的 clearfix 套路，不污染 HTML。

**真实项目场景**：我维护过一个十年前的后台，满屏 `float` 做两栏，每个容器后面都得跟 clearfix，改一处样式牵一发动全身，调试极其痛苦。现在重写直接用 `display: flex` 两栏，浮动塌陷问题从根上消失。不过「文字环绕图片」这种需求浮动仍是唯一简答方案，这时才用 `float`，且图片容器本身若需包住，再用 `display: flow-root` 兜底 BFC。

**边界与取舍**：如果你确实还要用浮动（比如某些富文本里的图片左浮），现代最干净的清除方式是给父容器 `display: flow-root`——它触发 BFC，高度计算包含浮动子元素，无副作用，胜过 `overflow: hidden`（会裁切）和伪元素 hack。clearfix 这套就作为「读老代码」的常识保留即可。

**收尾**：面试里这题考的是「理解浮动本意 + 知道现代替代」，而不是让你默写 clearfix 代码。能说出「浮动塌陷原因 + Flex/Grid 替代 + flow-root 兜底」就很到位。

@points
浮动脱离文档流，父容器算高度时看不见它，导致高度塌陷、后续内容重叠
老方案：clear:both 空标签（污染结构）或 ::after + clear:both 的 clearfix
现代标准：不用浮动做布局，改用 Flex/Grid，从根上消除塌陷
仍需浮动时，父容器用 display: flow-root 触发 BFC 兜底，无副作用
浮动本意是「文字绕图」，该场景仍可保留 float

@steps
解释浮动塌陷根因：元素浮起脱离流，父容器高度塌 0
说老办法：空标签 clear / 伪元素 clearfix，点出结构或 hack 成本
抛现代解法：布局用 Flex/Grid，不再依赖浮动
真要用浮动的场景（图文环绕），用 display: flow-root 兜底
总结：考的是理解而非默写，能讲清原因和替代即可

@followups
clearfix 的原理是什么？——利用 ::after 伪元素设 clear:both，在浮动元素后插入一个清除浮动的块，把父容器高度撑开
display: flow-root 比 overflow:hidden 好在哪？——flow-root 专为触发 BFC，不裁切溢出内容；overflow:hidden 会把下拉菜单等溢出部分切掉
浮动元素会脱离文档流吗？——会，所以它不参与父容器高度计算，但这不影响它仍属于 DOM 树

@example
### 1. 高度塌陷的反例

```html
<div class="parent">
  <div class="child" style="float:left;width:100px;height:60px">浮动的我</div>
</div>
<p>我是后面的段落，会钻到上面那块的区域里</p>
```

```css
.parent { border: 2px dashed #2965f1; } /* 高度塌成 0，边框贴在一起 */
.child  { float: left; }
/* 没有清除浮动 → parent 包不住 child，p 元素上移重叠 */
```

### 2. 经典 clearfix（读老代码要认识）

```css
/* 老项目常见写法：用 ::after 撑开父容器，不污染 HTML 结构 */
.clearfix::after {
  content: '';
  display: block;
  clear: both; /* 关键：清除左右浮动，让父容器高度包含浮动子元素 */
}
.clearfix { *zoom: 1; } /* 早期 IE 触发 hasLayout 的兼容补丁 */
```

### 3. 现代标准做法

```css
/* 做法一：布局根本不用浮动，直接 Flex，塌陷消失 */
.row { display: flex; }
.row .col { flex: 1; }

/* 做法二：确实要用浮动（如图文环绕）时，父容器 flow-root 兜底 */
.float-wrap { display: flow-root; } /* 触发 BFC，高度自动包含浮动子元素 */
.float-wrap img { float: left; margin-right: 12px; } /* 文字自然绕图 */
```

## 11 · CSS 变量（自定义属性）与主题切换怎么实现

@id
css-variables

@level
进阶

@freq
2

@tags
CSS变量 | 主题 | 设计系统

@ask
你们设计系统怎么做主题切换？CSS 变量你用过吧，它和普通 Sass 变量区别在哪？怎么做到不刷新就换肤？

@oral
**先说结论**：主题切换的现在答案基本是 **CSS 自定义属性（CSS Variables）**——把颜色、间距等抽成 `--var`，切换时改根元素上的变量值即可，无需刷新、无需重新编译。它和 Sass 变量本质不同：Sass 变量是编译期常量，CSS 变量是运行期真实存在的属性，能被 JS 读改、能继承和级联。

**再说原理**：定义用 `--name: value`，使用用 `var(--name,  fallback)`。CSS 变量是**继承 + 级联**的：在 `:root` 定义就全局可用，在某元素上覆盖就只影响该子树；还能用 `var()` 嵌套、用 `calc()` 运算。关键优势——它是真正的 DOM 属性，所以 `element.style.setProperty('--bg', '#fff')` 能在运行时改，浏览器实时重绘。Sass `$c: red` 在构建时就替换成字面量，改了要重新编译，做不到运行时换肤。

**真实项目场景**：我做的中台有「浅色/深色/高对比」三套主题，做法是在 `:root` 定义全套 token：`--color-primary`、`--bg-surface`、`--space-md` 等，所有组件只引用变量不写死值。切换主题时，给 `<html>` 加 `data-theme="dark"` 类，在 `[data-theme="dark"]` 选择器里重新赋值这些变量，整站瞬间换肤、零刷新。还能把用户选择存 `localStorage`，下次进入读回。

**边界与取舍**：CSS 变量有兼容下限（IE 不支持，但已淘汰）；`@property` 还能给变量加类型做过渡动画。注意变量值里别写需要级联计算的复杂表达式以免难维护，建议集中在一个 `:root` 或主题类里管理。另外 `var()` 的 fallback 只在前一个值无效时兜底，不是「多值」。

**收尾**：一句话，主题用 CSS 变量 + `data-theme` 切换，组件只消费 token，这是现代设计系统的标准姿势。

@points
CSS 变量是运行期真实的 DOM 属性，可被 JS 读改、能继承级联；Sass 变量是编译期常量
定义 --name，使用 var(--name, fallback)，支持继承与 calc 运算
主题切换：:root 定义 token，[data-theme] 覆盖，加 class 即换肤零刷新
用户选择可存 localStorage，下次进入读回，体验连续
集中管理 token，避免散落；IE 不支持但已非主流考量

@steps
在 :root 抽离全套设计 token（颜色/间距/圆角）为 --变量
所有组件只引用 var(--token)，不写死字面量
定义 [data-theme="dark"] 等主题类，覆盖对应变量值
切换时给 html 加/换 data-theme 属性，浏览器实时重绘
把用户选择存 localStorage，初始化时读回应用

@followups
CSS 变量和 Sass 变量能混用吗？——能，Sass 负责构建期计算，CSS 变量负责运行期切换，常见组合
为什么 var() 的 fallback 不是多值？——fallback 只在主值无效（未定义/非法）时生效，不是「依次尝试」
@property 有什么用？——给 CSS 变量声明类型和初值，使其可参与 transition 做变量动画

@example
### 1. 定义 token 与组件消费

```css
/* 在根定义全套设计 token */
:root {
  --color-primary: #2965f1;
  --bg-surface: #ffffff;
  --text-main: #1f2329;
  --space-md: 16px;
  --radius: 8px;
}

/* 组件只引用变量，绝不写死 */
.btn {
  background: var(--color-primary);
  color: #fff;
  padding: var(--space-md);
  border-radius: var(--radius);
}
.card {
  background: var(--bg-surface);
  color: var(--text-main);
  padding: var(--space-md);
}
```

### 2. 主题切换（零刷新）

```css
/* 深色主题：只覆盖变量值，所有组件自动跟随 */
[data-theme="dark"] {
  --color-primary: #5b8cff;
  --bg-surface: #1f2329;
  --text-main: #e8eaed;
}
```

```javascript
// 切换时改 html 上的属性，浏览器实时重绘，无需刷新
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('theme', theme) // 记住用户选择
}

// 初始化：读回上次选择
const saved = localStorage.getItem('theme')
if (saved) document.documentElement.setAttribute('data-theme', saved)
```

### 3. 级联与 calc 实战

```css
.panel {
  --local-accent: #ff7043;        /* 只在该子树生效，体现继承/级联 */
  border-left: 4px solid var(--local-accent, var(--color-primary));
}
.panel .title {
  font-size: calc(var(--space-md) * 1.25); /* 变量参与运算 */
}
```

## 12 · 伪类和伪元素的区别，::before 有哪些实用场景

@id
css-pseudo

@level
基础

@freq
2

@tags
伪类 | 伪元素 | 选择器

@ask
伪类和伪元素你能分清吗？单冒号和双冒号有啥讲究？::before 你平时都拿来干啥？

@oral
**先说结论**：伪类（`:hover`、`:nth-child`）是「选中处于某种状态的元素」，是选择器的一部分；伪元素（`::before`、`::after`）是「创建一个不在 DOM 里的虚拟元素」来装饰。单冒号 `:` 用于伪类、也兼容老伪元素写法，双冒号 `::` 是 CSS3 起专门区分伪元素的规范写法。

**再说原理**：伪类本质上给已有元素加「条件挂钩」——`:hover` 鼠标悬停、`:focus` 获得焦点、`:nth-child(2n)` 选中偶数项、`:not()` 排除，它不改变元素数量。伪元素则是凭空在元素内部（前/后）插入一个匿名盒子，默认是 `display: inline`、`content` 必填（哪怕是 `content: ''`），它像是真实子节点但不在 DOM 里、不可被 JS 选中、SEO 也读不到。

**真实项目场景**：::before / ::after 我最常用的几处——一是「清除浮动」的 clearfix（::after + clear:both），前面题讲过；二是画小红点和角标，比如购物车数量角标 `::after { content: attr(data-count); }` 直接读 HTML 属性，省一个 DOM 节点；三是图标/装饰线，比如列表项前的小圆点、分割线；四是配合 `position` 做遮罩层。还有 `:nth-child` 做斑马纹表格、`:empty` 显示空状态占位，都是高频。

**边界与取舍**：伪元素 `content` 是必填的，忘了写它就完全不渲染；它默认 `inline`，要设宽高得 `display: block/flex`。伪元素生成的内容不在 DOM，所以**不要用它放真实语义内容**（屏幕阅读器、爬虫读不到），只放装饰。`::before` 在元素内容前、`::after` 在内容后，且受 `direction` 影响。现代规范建议伪元素统一双冒号，伪类单冒号。

**收尾**：记一句——伪类是「选状态」，伪元素是「造节点」，单冒号选、双冒号造，用途边界就清楚了。

@points
伪类 : 选中某种状态的元素（:hover/:nth-child），是选择器的一部分
伪元素 :: 创建不在 DOM 的虚拟盒子（::before/::after），用于装饰
单冒号用于伪类，双冒号是 CSS3 区分伪元素的规范写法（老浏览器 :: 需降级）
伪元素 content 必填、默认 inline，需宽高要 display:block
伪元素内容不被屏幕阅读器/爬虫读取，只放装饰不放语义内容

@steps
区分两者：伪类管「状态选择」，伪元素管「生成装饰节点」
点明语法：伪类单冒号、伪元素双冒号（CSS3 规范）
讲 ::before/::after 机制：content 必填、默认 inline、在 DOM 外
举实用场景：clearfix、角标计数、装饰线/图标、遮罩
提醒边界：不放语义内容、需宽高要 display、ie 兼容用单冒号

@followups
content 能不写吗？——不能，省略 content 伪元素完全不生成；可写 content:'' 空字符串
伪元素能在 DOM 里被 JS 选中吗？——不能，它是匿名盒子，querySelector 选不到，也不在 DOM 树
:nth-child 和 :nth-of-type 区别？——前者按「所有兄弟中的位置」计数，后者只按「同标签类型」计数

@example
### 1. 伪类：状态与位置选择

```css
/* :hover 悬停态、:focus 聚焦态——选「状态」 */
.btn:hover { background: #1b4fd6; }
.input:focus { border-color: var(--color-primary); }

/* :nth-child 按位置选——斑马纹表格 */
tr:nth-child(2n) { background: #f5f7fa; }

/* :not() 排除、:empty 空状态 */
.item:not(.disabled) { cursor: pointer; }
.empty:empty::after { content: '暂无数据'; color: #999; }
```

### 2. ::before / ::after 实用：角标与装饰

```css
/* 购物车角标：直接读 HTML 属性，省一个 DOM 节点 */
.cart { position: relative; }
.cart::after {
  content: attr(data-count);  /* 读元素上的 data-count，动态显示数量 */
  position: absolute;
  top: -6px; right: -6px;
  min-width: 16px; height: 16px;
  background: #f5222d; color: #fff;
  border-radius: 8px;
  font-size: 12px; text-align: center; line-height: 16px;
}

/* 列表项前的小圆点装饰（不进 DOM，纯样式） */
.dot-list li::before {
  content: '';
  display: inline-block;
  width: 6px; height: 6px;
  margin-right: 8px;
  border-radius: 50%;
  background: var(--color-primary);
}
```

### 3. 用伪元素做遮罩层

```css
/* 给卡片加一层半透明遮罩，hover 时显现，无需额外 DOM */
.card { position: relative; overflow: hidden; }
.card::after {
  content: '';
  position: absolute;
  inset: 0;                 /* 铺满卡片 */
  background: rgba(0,0,0,0.4);
  opacity: 0;
  transition: opacity 0.2s;
}
.card:hover::after { opacity: 1; } /* 纯装饰，语义内容放真实 DOM */
```
