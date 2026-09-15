---
id: vite
name: Vite
en: Next-gen Build Tool
icon: zap
color: #646cff
order: 9
desc: 原生 ESM 开发、依赖预构建与 HMR 原理，新一代构建工具的标准答案。
---

## 01 · Vite 为什么比 Webpack 快，No-bundle 的原理是什么

@id
vite-why-fast

@level
进阶

@freq
3

@tags
No-bundle | ESM | esbuild

@ask
你先说说 Vite 为什么比 Webpack 快？No-bundle 到底是什么意思，它是不是就完全不编译了，首屏那么多模块请求不会慢吗？

@oral
**先说结论**：Vite 在开发环境快，核心是因为它走的是「No-bundle（不打包）」路线——现代浏览器原生支持 ESM，Vite 直接把源码当 ESM 文件托管给浏览器，浏览器用到哪个模块就按需请求哪个，启动只做「必要的最少工作」，不像 Webpack 一上来先把整个项目递归打包成 bundle 再起服务。

**再说原理**。Webpack 的冷启动是「全量打包」：从入口把所有依赖图都构建出来，项目越大、模块越多，bundle 越大、启动越慢，改一个文件热更也得重新走一遍依赖图的一部分。Vite 反过来：启动时**不打包应用代码**，只用一个轻量 dev server 把文件托管出去；你请求 `/src/main.ts`，它就实时用 esbuild 把 TS/JSX 转成浏览器能跑的 JS 再返回。依赖（node_modules）则提前用 esbuild 预构建成 ESM 缓存起来。所以冷启动耗时只跟「入口链路上的文件数」有关，跟项目总规模几乎无关。

**真实项目的体感**。我之前接手一个 200+ 页面的中后台，Webpack 冷启动要 30 秒以上，改一行等热更也按秒算；切到 Vite 后冷启动基本 1 秒以内，HMR 毫秒级、只刷新改动的那个模块。但注意：No-bundle 不是「零编译」，浏览器发多少请求 Vite 就转多少文件，如果首屏一口气引了上千个模块，第一次加载会有请求瀑布——这时候依赖预构建（把 lodash-es 这种碎片 ESM 合并）和路由级懒加载就非常关键。

**边界与取舍**。生产构建 Vite 仍然用 Rollup 打包（见第 04 题），因为「开发快」和「产物优」是两件事：开发期靠按需编译 + esbuild 提速，生产期靠 Rollup 的 tree-shaking 和代码分割产出血优化包。No-bundle 的代价就是首屏请求数可能偏多，要靠预构建、分包、懒加载来补。

**收尾**：一句话，Vite 快在「把打包这个最重的活从开发期挪走了」，按需编译 + esbuild 提速，这是它和 Webpack 本质上的架构差异。

@points
No-bundle = 启动时不打包应用代码，由浏览器按需请求原生 ESM 模块
冷启动耗时只跟入口链路文件数有关，与项目总规模基本解耦
esbuild 负责 TS/JSX 实时转译，比 tsc/babel 快一个数量级
首屏请求瀑布是代价，靠依赖预构建 + 路由懒加载缓解
生产仍用 Rollup 打包，开发快 ≠ 产物优

@steps
先点明「No-bundle / 原生 ESM」是核心差异，别一上来就堆名词
对比 Webpack 全量打包的冷启动瓶颈，突出依赖图规模的影响
讲清 dev server 的按需转译链路：请求 → esbuild 转译 → 返回
补一句预构建如何把碎片依赖合并，避免首屏请求爆炸
说明生产仍走 Rollup，收在「开发快和产物优是两件事」上

@followups
No-bundle 是不是完全不编译？——不是，应用源码仍由 esbuild 实时转译，只是不做整包打包，依赖预构建也是编译
首屏上千个模块请求不会慢吗？——靠依赖预构建合并碎片包 + 路由懒加载按需加载，避免一次性瀑布
Vite 和 Webpack 热更新的本质区别？——Vite 是模块级 ESM HMR 只换一个模块，Webpack 通常要重建受影响 chunk

@example
### 1. No-bundle：浏览器按需请求原生 ESM

```html
<!-- index.html 里只引一个入口，浏览器顺着 import 链自己去拉模块 -->
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <!-- 关键：type="module" 开启浏览器原生 ESM，Vite 不在这里塞 bundle -->
    <script type="module" src="/src/main.ts"></script>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
```

```typescript
// src/main.ts：浏览器用到哪个模块才发请求拉哪个，Vite 实时转译后返回
import { createApp } from 'vue'            // 依赖走预构建后的缓存
import App from './App.vue'                // 应用源码走原生 ESM 按需加载
import router from './router'              // 只有被 import 的才会被请求

createApp(App).use(router).mount('#app')
```

### 2. Webpack 与 Vite 冷启动思路对比

```javascript
// Webpack：启动先递归打包整张依赖图，项目越大越慢（伪流程示意）
// 入口 → 解析所有 import → 合并成 bundle.js → 起 dev server
// 改一行也要重新走「受影响 chunk」的重建，热更按秒计

// Vite：启动只起一个 server，不碰依赖图；请求来了才转译单个文件
// 启动耗时 ≈ 起 server 的时间，与源码总量无关，HMR 只换一个模块
```

### 3. 用 esbuild 做开发期转译（Vite 内部思路）

```javascript
// Vite 用 esbuild 把 TS/JSX 实时转成 JS，速度比 babel/tsc 快 10~100 倍
import { transform } from 'esbuild'

// 浏览器请求 /src/comp.tsx 时，Vite 在中间件里同步转译再返回
const result = transform(
  `export const x: number = 1`, // 源码：带 TS 类型
  { loader: 'ts' }              // esbuild 去掉类型、产出纯 JS
)
// result.code 就是浏览器能直接执行的 ESM，类型信息在开发期被丢弃
```

## 02 · 依赖预构建解决了什么问题，为什么用 esbuild

@id
vite-dep-pre-bundling

@level
高级

@freq
3

@tags
预构建 | optimizeDeps | 缓存

@ask
你讲讲依赖预构建到底解决了哪几个具体问题？为什么 Vite 选 esbuild 而不是用 Rollup 或者 Webpack 去做这件事，缓存又是怎么管理的？

@oral
**先说结论**：依赖预构建（Dependency Pre-bundling）是 Vite 为了「让浏览器能直接吃 node_modules 里的第三方包」而做的一层编译缓存，它同时解决了三个问题：裸模块路径解析、CommonJS/UMD 转 ESM、以及碎片 ESM 的请求爆炸。

**再说原理，三个痛点逐一对应**。第一，我们在代码里写 `import React from 'react'`，这是「裸模块说明符」，浏览器不认识，必须被重写成指向实际文件的路径，预构建负责把这层映射做好。第二，大量 npm 包（尤其老包）还是 CommonJS 或 UMD，浏览器只认 ESM，预构建用 esbuild 把它们转成 ESM。第三，像 `lodash-es` 这种包导出了几百个小函数文件，如果原样发浏览器，首屏会触发几百个请求形成瀑布，预构建把它们合并成一个文件，请求数断崖式下降。

**为什么是 esbuild 而不是 Rollup/Webpack**。预构建的核心诉求是「快」和「能处理 CJS→ESM」，esbuild 用 Go 写、多核并行，打包速度比 Rollup（JS 单线程）快几十到上百倍，冷启动体验直接拉满；而 Rollup 的优势在「产物优化、tree-shaking、代码分割」，那是生产构建才需要的，预构建不需要那么精细，要的就是快。所以用 esbuild 是「场景匹配」的选择。

**真实项目里的排查**。最常见两类：一是加了个新依赖却没生效/报 `Missing ... export`，多半是它没进预构建白名单，要在 `optimizeDeps.include` 里补；二是升级依赖后行为异常，缓存哈希没刷新，清掉 `node_modules/.vite` 重新跑即可。Vite 5 还会在依赖变动时自动重新预构建并触发全页刷新。

**缓存管理**。预构建产物落在 `node_modules/.vite/deps`，文件名带内容哈希，哈希由「lockfile（package-lock/pnpm-lock）+ vite 配置 + vite 版本」共同决定，命中就直接读磁盘缓存，不重算；`optimizeDeps.entries` 还能指定只扫描哪些入口来缩小范围、提速。

**收尾**：预构建 = 用 esbuild 把第三方依赖一次性编译成「浏览器友好的 ESM 缓存」，解决路径、格式、请求数三件事，是 No-bundle 能成立的地基。

@points
解决裸模块路径解析：import 'react' 必须重写成可请求的文件路径
解决格式兼容：把 CJS/UMD 第三方包转成浏览器认的 ESM
解决请求爆炸：把 lodash-es 这类碎片 ESM 合并成单文件
选 esbuild 是因为要「快」，比 Rollup 快几十倍且原生支持 CJS→ESM
缓存哈希由 lockfile + 配置 + vite 版本决定，落在 node_modules/.vite

@steps
先抛出「浏览器不认识裸模块、不认 CJS、怕碎片请求」三个痛点
逐个对应预构建怎么解：重写路径、转 ESM、合并碎片
解释为什么是 esbuild：速度优先，CJS→ESM 是刚需，Rollup 在这用不上劲
讲缓存落点和哈希来源，顺带说清升级依赖后要清 .vite
落到排查：include 补依赖、清缓存解决「不生效/异常」

@followups
预构建产物放哪、缓存怎么失效？——落在 node_modules/.vite/deps，哈希由 lockfile+配置+vite 版本算出，改依赖或配置即失效
为什么不直接用 Rollup 做预构建？——预构建要快和 CJS 兼容，esbuild 快几十倍且原生支持，Rollup 优势在产物优化用不上
加的新包没被预构建怎么办？——在 optimizeDeps.include 显式声明，或触发重新预构建

@example
### 1. 裸模块被重写成预构建后的路径

```typescript
// 你写的源码：裸模块说明符，浏览器无法直接解析
import React from 'react'
import { debounce } from 'lodash-es'

// Vite 预构建后，实际发给浏览器的是带版本哈希的缓存文件
// import React from '/node_modules/.vite/deps/react.js?v=3f2a1b'
// import { debounce } from '/node_modules/.vite/deps/lodash-es.js?v=9c4d7e'
// 浏览器只发 2 个请求，而不是 lodash-es 的几百个小文件
```

### 2. node_modules/.vite 的目录结构

```bash
# 预构建产物与元信息都在这，删掉它 Vite 会重新生成
node_modules/.vite/
├── deps/                      # 预构建后的依赖 ESM
│   ├── react.js               # react 被编译成 ESM，带内容哈希查询参数
│   ├── react.js.map
│   ├── lodash-es.js           # 几百个碎片模块被合并成这一个文件
│   └── vue.js
├── _metadata.json            # 记录每个依赖的哈希、扫描到的入口等
└── .vite-cache-timestamp     # 用于判断是否需要重新预构建

# 排查「依赖改了但不生效」时，最粗暴有效的办法：
rm -rf node_modules/.vite && npm run dev
```

### 3. optimizeDeps 配置示例

```typescript
import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: {
    // 强制把某些包纳入预构建（某些 CJS 包 Vite 扫描不到时用）
    include: ['some-cjs-lib', 'lodash-es'],
    // 排除不需要预构建的（比如已经是 ESM 且不想被合并的）
    exclude: ['@vitejs/plugin-vue'],
    // 只扫描这些入口来找依赖，缩小范围、提速冷启动
    entries: ['index.html', 'src/main.ts'],
    // 透传给底层 esbuild 的选项，比如指定目标语法
    esbuildOptions: {
      target: 'es2020',
    },
  },
})
```

## 03 · Vite 的 HMR 是怎么实现的

@id
vite-hmr

@level
高级

@freq
3

@tags
HMR | WebSocket | 模块图

@ask
HMR 你是天天用，但你说得清它底层怎么实现的吗？Vite 改一个文件，浏览器是怎么做到不刷新整页只更新那一块的，和 Webpack 的热更新有什么不同？

@oral
**先说结论**：Vite 的 HMR 建立在「浏览器原生 ESM + WebSocket 推送 + 客户端模块图」三件套上：文件一改，dev server 通过 WebSocket 告诉浏览器「哪个模块变了」，浏览器只重新拉取那个模块并用 `import.meta.hot` 把它替换进运行时的模块图，而不刷新整页。

**再说原理，端到端链路**。第一步，Vite 启动时在页面注入 HMR 客户端运行时，并和 dev server 建立一条 WebSocket 长连接。第二步，你保存文件，文件系统监听（chokidar）触发，Vite 重新转译这个模块、算出它的内容哈希。第三步，server 通过 WebSocket 推一条 `{ type: 'update', updates: [{ path, timestamp }] }` 消息。第四步，客户端运行时收到后，按 `import.meta.hot.accept` 声明的「接受边界」去 fetch 新模块，执行新代码、 disposing 旧模块的导出，完成局部替换。

**为什么能做到「只更新一块」**。关键在于「接受边界（accept boundary）」：一个模块如果自己处理了 `import.meta.hot.accept`，它就自己热替换；如果没处理，热更新会沿依赖图向上冒泡到最近的接受者（比如 Vue 组件由 plugin-vue 注入的边界接住，只重渲染那个组件，不丢页面状态）。这和 Webpack 很像，但 Vite 因为本身就是 ESM，模块边界天然清晰，替换粒度更细、更稳。

**真实项目的坑与排查**。最常见的「热更新失效、一改就整页刷新」，多半是某个模块没正确声明 accept 边界，或者被 `import.meta.hot` 自己的 dispose 逻辑没清理副作用（比如手动加的全局事件监听、定时器）。排查时看终端里是不是打印了 `[vite] page reload`，是 reload 就不是 HMR。我一般会在自定义逻辑里用 `import.meta.hot.dispose` 显式清理副作用，避免状态残留。

**边界与取舍**。HMR 是开发期能力，生产构建里这些 API 会被 tree-shake 掉，不影响产物。另外 Vite 5 起用内容哈希判断变更，比早期只看 mtime 更准，能避免「文件没变内容却被误判更新」。

**收尾**：HMR = WebSocket 通知 + 按需拉新模块 + accept 边界局部替换，ESM 让边界天然清晰，所以比 Webpack 更轻更准。

@points
基于原生 ESM + WebSocket 长连接，server 主动推送变更
文件变更 → 重转译 → 算哈希 → WS 推 {path, timestamp}
import.meta.hot.accept 定义「接受边界」，只替换受影响模块
无 accept 的模块沿依赖图向上冒泡到最近边界（如 Vue 组件边界）
dispose 负责清理副作用（监听/定时器），避免热更后状态残留

@steps
先说三件套：原生 ESM + WebSocket + 客户端模块图
走通链路：保存 → 监听 → 重转译 → 哈希 → WS 推送
讲 accept 边界如何让更新「只落在一块」，对比整页刷新
补充 plugin（vue/react）如何自动注入边界，只重渲染组件
给排查：page reload 不是 HMR，用 dispose 清副作用防残留

@followups
HMR 和整页刷新怎么区分？——看终端日志，[vite] page reload 是整页刷新，[vite] hmr update 才是模块级热更
accept 边界找不到会怎样？——沿依赖图向上冒泡，直到最近的可接受模块，否则退化为整页刷新
生产环境 HMR 代码还在吗？——不在，import.meta.hot 相关代码在构建期被 tree-shake 剔除

@example
### 1. 在模块里自己声明 HMR 接受边界

```typescript
// counter.ts：自己处理热更新，替换后还能保留调用方引用
import { createHotContext } from 'vite'

// import.meta.hot 是 Vite 注入的 HMR API，构建期会被剔除
if (import.meta.hot) {
  // 声明「这个模块可以自己热替换」
  import.meta.hot.accept((newModule) => {
    // newModule 是重新拉取后的新模块，可在这里接管新导出
    console.log('counter 模块已热替换', newModule)
  })

  // dispose：模块被替换前清理副作用，防止定时器/监听堆积
  import.meta.hot.dispose(() => {
    console.log('counter 旧模块即将被丢弃，清理工作在这里做')
  })
}

export let count = 0
export function inc() {
  count += 1
  return count
}
```

### 2. WebSocket 推送的变更消息结构

```json
{
  "type": "update",
  "updates": [
    {
      "type": "js-update",
      "path": "/src/counter.ts",
      "timestamp": 1726300000000,
      "explicit": false
    }
  ]
}
```

### 3. Vue 组件的热更新由 plugin-vue 注入边界

```typescript
// 你写的单文件组件，plugin-vue 编译后会自动注入类似下面的边界
// 所以改 <template> 只重渲染组件，组件内的响应式状态不丢
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
app.mount('#app')

// 组件级 HMR 由 @vitejs/plugin-vue 在编译阶段处理，
// 开发者通常无需手写 accept，改组件即局部刷新
if (import.meta.hot) {
  import.meta.hot.accept('./App.vue', (mod) => {
    // plugin-vue 用新的组件定义替换旧实例的 render，状态保留
  })
}
```

## 04 · 开发用 esbuild、生产用 Rollup，为什么这么设计

@id
vite-dev-vs-build

@level
高级

@freq
2

@tags
esbuild | Rollup | 双引擎

@ask
很多候选人知道 Vite 开发用 esbuild、生产用 Rollup，但说不清为什么。你给我讲讲为什么要搞双引擎，为什么不统一用一个，Rollup 不够快为什么不直接全用 esbuild？

@oral
**先说结论**：Vite 用「双引擎」是「各取所长」——开发期要的是「快」，所以用 esbuild 做转译、用浏览器原生 ESM 做按需加载，跳过打包；生产期要的是「产物质量」，所以用 Rollup 做打包、tree-shaking 和代码分割，产出体积小、加载快的 bundle。两者目标不同，强行统一反而会两头不讨好。

**再说原理，把两个阶段的诉求拆开**。开发阶段的核心矛盾是「冷启动和 HMR 要快」，而打包恰恰是最慢的一步。esbuild 用 Go 写、多核并行，TS/JSX 转译比 JS 系的 babel/tsc 快一个数量级，但它不负责「整包打包」——开发期 Vite 根本不打包应用代码，只让 esbuild 做单文件转译，速度自然拉满。生产阶段不需要「即时」，需要的是「最优产物」：更小的体积、按需加载、稳定的 chunk 划分，这正是 Rollup 的强项。

**为什么不全用 esbuild 打包**。esbuild 的打包能力其实可用，也很快，但它在「产物优化」上不如 Rollup 成熟：Rollup 的 tree-shaking 更彻底（基于 ESM 的静态分析）、代码分割（dynamic import 出来的 chunk、vendor 分包）更可控、插件生态（几千个社区插件）更完善，产出对浏览器更友好。Vite 官方判断「生产产物的质量比那几秒构建时间更重要」，所以生产打包交给 Rollup。

**真实项目里的配置点**。Vite 5 里生产最小化的默认执行者其实是 esbuild（minify: 'esbuild'），也就是「Rollup 负责打包结构，esbuild 负责压缩」，两者结合；如果你要更极限的体积也可以切 terser，但速度更慢。我做过一个大型后台，把 `minify` 从 terser 换成 esbuild，构建时间砍掉近一半，体积只大了零点几个点，性价比很高。

**边界与取舍**。esbuild 现在也补齐了不少能力，社区一直有「用 esbuild/rolldown 统一双引擎」的讨论（Vite 团队也在推 Rolldown），但当下稳定方案仍是 esbuild(转译/压缩) + Rollup(打包)。理解这点，面试时被问「为什么不一律 esbuild」就能答到痛处。

**收尾**：不是技术选型犹豫，而是「开发要快、生产要优」两个目标分别匹配了两个最合适的引擎。

@points
开发期目标 = 快，esbuild 转译 + 原生 ESM 按需加载，跳过最慢的打包
生产期目标 = 优，Rollup 的 tree-shaking/分包产出更小更友好的 bundle
esbuild 打包不成熟：tree-shaking 不如 Rollup 彻底、代码分割不够可控
Rollup 插件生态几千个，生产期兼容性与可定制性更稳
现状：Rollup 打包 + esbuild 压缩（minify），可切 terser 换体积

@steps
先点明「双引擎 = 各取所长」，目标是开发快 / 生产优两个不同诉求
拆开发期：esbuild 转译快、不打包是提速关键
拆生产期：Rollup 的 tree-shaking、分包、插件生态是产物质量保障
解释为何不全用 esbuild：打包优化成熟度不足
补现状配置与趋势（Rolldown），收在「目标匹配」上

@followups
能不能全用 esbuild 打包？——可以但产物质量（tree-shaking/分包）不如 Rollup，官方优选 Rollup
Vite 生产压缩用谁？——默认 esbuild 做 minify，可切 terser 换更极致体积
双引擎未来会合并吗？——Vite 团队在推 Rolldown（Rust 版 Rollup）尝试统一，当前仍是 esbuild+Rollup

@example
### 1. 开发期：esbuild 只做单文件转译，不打包

```typescript
// 开发服务器对 /src/main.ts 的处理（思路示意）
// 1) 收到请求 → 2) esbuild.transform 去掉 TS/JSX → 3) 原样返回 ESM
// 不做整包打包，所以启动与 HMR 都极快
import { transform } from 'esbuild'

await transform(sourceCode, {
  loader: 'tsx',   // 按 tsx 处理，速度远快于 babel/tsc
  target: 'es2020',
})
```

### 2. 生产构建：Rollup 打包 + esbuild 压缩

```typescript
import { defineConfig } from 'vite'

export default defineConfig({
  // 开发期：esbuild 负责转译，浏览器原生 ESM 按需加载（不打包）
  // 生产期：交给 Rollup 打包，下面这段只在 build 时生效
  build: {
    // 默认就是 'esbuild'，打包结构由 Rollup 出，压缩由 esbuild 做
    minify: 'esbuild',
    // 想要更极致体积可切 'terser'，但构建更慢（需额外装 terser）
    // minify: 'terser',
    target: 'es2020',           // 决定 esbuild 转译/压缩的目标语法
    sourcemap: true,            // 生产也留 sourcemap 方便排查
    chunkSizeWarningLimit: 1500, // 超过该体积才告警，按项目调
  },
})
```

### 3. Rollup 的手动分包（生产优化核心）

```typescript
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // 把体积大、变动少的第三方库单独拆成 vendor chunk
        // 利用浏览器长缓存，业务代码更新不影响 vendor 缓存
        manualChunks: {
          vue: ['vue', 'vue-router', 'pinia'],
          editor: ['monaco-editor'],
        },
      },
    },
  },
})
```

## 05 · Vite 插件机制与常用钩子，怎么迁移 Webpack 插件

@id
vite-plugin

@level
进阶

@freq
3

@tags
插件 | 钩子 | 迁移

@ask
你做过 Vite 插件或者从 Webpack 迁过来吗？讲讲 Vite 的插件机制、常用的钩子，如果要把一个 Webpack loader/插件迁到 Vite，你大概会怎么下手？

@oral
**先说结论**：Vite 插件本质上就是「Rollup 插件 + 一组 Vite 专属钩子」。Rollup 的 `resolveId / load / transform` 负责模块解析与代码转换，Vite 又补了 `config / configureServer / transformIndexHtml / handleHotUpdate` 等只在 Vite 里有的钩子，覆盖配置期、dev server 中间件、HTML 注入和热更新。迁移 Webpack 时，loader 基本对应 `transform` 钩子，plugin 按它做的事挑对应钩子落地。

**再说原理，钩子分两类**。一类是 Rollup 通用钩子：`resolveId` 决定「模块路径怎么解析」，`load` 决定「某路径的内容从哪来」（虚拟模块常用），`transform` 决定「读到的代码怎么改」（这是最常用、对应 Webpack loader 的钩子）。另一类是 Vite 专属：`config` 可改/合并最终配置，`configResolved` 能拿到解析后的配置，`configureServer` 让你往 dev server 挂中间件（等价于 Webpack 的 devServer.before / 自定义 server 插件），`transformIndexHtml` 注入 script/link，`handleHotUpdate` 自定义热更行为。

**迁移 Webpack 的实际打法**。我迁过一个「自动按路由生成骨架屏」的 Webpack 插件：它在 Webpack 里靠 compiler/compilation 钩子 + loader 处理模板。到 Vite 后，loader 部分直接变成 `transform` 钩子里匹配 `.vue`/`.html` 做字符串替换；中间件部分用 `configureServer` 挂一个处理 `/__skeleton` 的路由；HTML 注入用 `transformIndexHtml`。核心差异：Webpack 是「一套 compiler 大对象 + 几十个钩子」，Vite 是「Rollup 钩子 + 少量 Vite 钩子」，迁移时先想清楚原插件「在每个阶段做了什么」，再映射到最近的钩子。

**边界与取舍**。Vite 插件没有 Webpack 那种全局 `compiler` 对象，不能随便拦截整个编译；它的粒度更偏「模块」和「server」。如果原 Webpack 插件重度依赖 compilation 资源清单，迁移时要接受「换思路」而不是硬套。另外插件最好写成工厂函数返回对象、用 `name` 字段标识，方便调试和排序。

**收尾**：理解「Rollup 钩子管模块、Vite 钩子管服务与 HTML」，迁移就是给 Webpack 的每段逻辑找最近钩子，loader→transform，server 逻辑→configureServer。

@points
Vite 插件 = Rollup 插件 + Vite 专属钩子，钩子函数返回带 name 的对象
resolveId/load/transform 是 Rollup 三大件：解析、取内容、改代码
transform 等价于 Webpack loader，是迁移 loader 的主战场
configureServer 挂 dev 中间件，transformIndexHtml 注入 HTML
迁移先拆「原插件各阶段做了啥」，再映射到最近钩子，别硬套 compiler

@steps
先说插件本质：Rollup 插件 + Vite 专属钩子，工厂函数返回对象
讲 Rollup 三件套：resolveId/load/transform 各自职责
讲 Vite 专属：config/configureServer/transformIndexHtml/handleHotUpdate
给迁移映射：loader→transform，server 逻辑→configureServer，HTML→transformIndexHtml
提醒边界：Vite 无全局 compiler，粒度偏模块/server，思路要换

@followups
Vite 插件和 Rollup 插件能通用吗？——大部分能，Vite 兼容 Rollup 插件接口，Vite 专属钩子只在 dev/build 里额外触发
Webpack loader 怎么迁？——loader 就是「读代码→改代码」，直接落到 transform 钩子
configureServer 和 Webpack devServer.before 等价吗？——基本等价，都是往 dev server 注入自定义中间件

@example
### 1. 一个完整的自定义 Vite 插件（给产物加 banner）

```typescript
import type { Plugin } from 'vite'

// 插件写成工厂函数，返回一个带 name 的 Plugin 对象，方便排序与调试
export function myBannerPlugin(banner: string): Plugin {
  return {
    name: 'my-banner-plugin', // 必填：插件名，报错时靠它定位

    // Vite 专属：在解析配置前修改/合并配置
    config(config) {
      // 比如强制关掉 sourcemap，等价于在 defineConfig 里写
      config.build = config.build || {}
      // return 的对象会和用户配置深度合并
    },

    // Rollup 钩子：遇到虚拟模块前缀时，自己提供文件内容
    resolveId(id) {
      if (id === 'virtual:hello') return '\0virtual:hello' // \0 防路径冲突
    },
    load(id) {
      if (id === '\0virtual:hello') return `export const msg = '你好，虚拟模块'`
    },

    // Rollup 钩子：最常用的「改代码」钩子，等价于 Webpack loader
    transform(code, id) {
      if (id.endsWith('.ts')) {
        // 在代码头部插入一段注释（仅示意，真实场景更克制）
        return { code: `/* ${banner} */\n${code}`, map: null }
      }
    },

    // Vite 专属：往 dev server 挂自定义中间件
    configureServer(server) {
      server.middlewares.use('/api/echo', (req, res) => {
        res.end('来自 Vite 中间件') // 浏览器访问 /api/echo 命中这里
      })
    },

    // Vite 专属：在 HTML 里注入 script / link
    transformIndexHtml(html) {
      return {
        html,
        tags: [{ tag: 'script', attrs: { src: '/inject.js' } }],
      }
    },
  }
}
```

### 2. 在 vite.config.ts 里注册插件

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { myBannerPlugin } from './plugins/myBannerPlugin'

export default defineConfig({
  plugins: [
    vue(),                       // 官方插件，处理 .vue 单文件组件
    myBannerPlugin('build-2026'), // 我们的自定义插件，按顺序执行
  ],
})
```

### 3. 迁移 Webpack loader 的最小示例

```typescript
import type { Plugin } from 'vite'

// 原 Webpack loader：把 .txt 文件内容包成 export default 字符串
// 迁移到 Vite：loader 的本质就是「读源码→返回新源码」，落到 transform
export function txtLoaderPlugin(): Plugin {
  return {
    name: 'txt-loader',
    transform(code, id) {
      if (id.endsWith('.txt')) {
        // 返回 JS 源码，让浏览器能 import 这个 txt 当字符串用
        return `export default ${JSON.stringify(code)}`
      }
    },
  }
}
```

## 06 · 环境变量与多环境配置怎么管理

@id
vite-env-config

@level
基础

@freq
2

@tags
环境变量 | mode | 配置

@ask
你们项目里环境变量和多环境（dev/test/prod）是怎么管的？Vite 里 import.meta.env 和 process.env 有什么区别，为什么客户端变量要加 VITE_ 前缀？

@oral
**先说结论**：Vite 用 `mode` 区分环境、用 `.env.[mode]` 文件存放变量，只有带 `VITE_` 前缀的变量才会通过 `import.meta.env` 暴露给浏览器端代码；服务端（vite.config.ts）则通过 `loadEnv` 读取全部变量。这套设计是为了「安全 + 清晰」：不该泄露的密钥留在服务端，前端只拿到显式声明过的变量。

**再说原理，三个层面拆开**。`mode` 是 Vite 的环境标识，默认 `development`（dev 命令）/ `production`（build 命令），也可以用 `--mode staging` 自定义。`.env` 全环境生效，`.env.[mode]` 只在对应 mode 生效，`.env.local` 等带 local 的不进 git。Vite 在启动时把 `.env` 文件解析成 `import.meta.env` 上的属性——但出于安全，**任何不带 `VITE_` 前缀的变量都不会注入前端包**，避免把数据库密码之类误打包进浏览器。

**import.meta.env 和 process.env 的区别**。这是高频坑：`import.meta.env` 是 Vite 注入的、构建期被静态替换的「前端环境变量」（如 `MODE`、`BASE_URL`、`PROD`、`DEV` 以及 `VITE_*`），最终会被编译进产物；而 `process.env` 是 Node 运行时变量，只在 `vite.config.ts` 这种「跑在 Node 里」的文件可用，浏览器代码里不能用 `process.env`。所以配置里要拿全部变量，得用 `loadEnv(mode, root)` 把 `.env` 文件读进来。

**真实项目里的做法**。我一般建 `.env`（公共兜底）、`.env.development`、`.env.staging`、`.env.production`，API 基址、埋点 ID 这类放 `VITE_` 前缀；真正密钥（如部署 token）只在 CI 环境变量里、不写文件。切换环境就是 `vite build --mode staging`，配合 `import.meta.env.MODE` 在代码里做分支。注意改了 `.env` 要重启 dev server，因为它是启动期读取的。

**边界与取舍**。前端变量本质是「公开」的——再怎么加前缀，打进 bundle 后用户都能在源码里看到，所以**绝不要把真正保密的密钥放 `VITE_` 变量**；敏感逻辑（签名、密钥）必须放服务端或构建期注入的一次性值。

**收尾**：`VITE_` 前缀不是语法糖，是「显式授权前端可见」的安全闸门，配合 mode 和 loadEnv 就够管好多环境了。

@points
mode 区分环境（dev/build/自定义），.env.[mode] 按环境加载
只有 VITE_ 前缀变量才进 import.meta.env，避免密钥误打包
import.meta.env 是构建期静态替换的前端变量，process.env 仅 Node 可用
vite.config.ts 里用 loadEnv(mode, root) 读全部 env 文件
前端变量本质是公开的，真密钥必须放服务端/CI，不放 VITE_

@steps
先说 mode + .env.[mode] 的环境划分机制
讲 VITE_ 前缀的安全意义：只有它才注入前端包
区分 import.meta.env（前端、静态替换）与 process.env（仅 Node）
给 loadEnv 在配置里读取全量的写法
提醒改 .env 要重启，且前端变量不可放真密钥

@followups
不加 VITE_ 前缀会怎样？——变量不会注入 import.meta.env，前端代码读不到，也避免误泄露
process.env 能在前端用吗？——不能，它只存在于 Node，vite.config.ts 里可用 loadEnv 替代
改了 .env 不生效？——env 是启动期读取的，必须重启 dev server 才能重新加载

@example
### 1. 多环境 .env 文件示例

```bash
# .env：所有环境兜底（放不敏感的公共值）
VITE_APP_TITLE=面试中心

# .env.development：本地开发
VITE_API_BASE=http://localhost:8080/api
VITE_ENABLE_MOCK=true

# .env.production：生产（只放能公开的前端变量）
VITE_API_BASE=https://api.example.com
VITE_ENABLE_MOCK=false

# 注意：真正保密的密钥不要写文件，放 CI 环境变量
# DB_PASSWORD=xxx  ← 绝不能加 VITE_ 也不能进前端包
```

### 2. 在 vite.config.ts 里用 loadEnv 读全部变量

```typescript
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// mode 由命令行 --mode 决定，比如 vite build --mode staging
export default defineConfig(({ mode }) => {
  // loadEnv 把 .env 和 .env.[mode] 解析成键值对象
  // 第三个参数是前缀过滤，传 '' 表示读取全部（含非 VITE_ 的）
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [vue()],
    // 比如把 API 基址通过 define 注入，等价地暴露给代码
    define: {
      __API_BASE__: JSON.stringify(env.VITE_API_BASE),
    },
  }
})
```

### 3. 在业务代码里使用 import.meta.env

```typescript
// 这些变量在构建期被 Vite 静态替换成字面量，不占运行时
console.log(import.meta.env.MODE)        // 'development' / 'production' / 'staging'
console.log(import.meta.env.VITE_API_BASE) // 来自 .env 文件
console.log(import.meta.env.DEV)         // 是否开发环境
console.log(import.meta.env.PROD)        // 是否生产环境
console.log(import.meta.env.BASE_URL)    // vite 的 base 配置

// 按环境切换行为：生产关掉 mock，开发开着
const apiBase = import.meta.env.VITE_ENABLE_MOCK === 'true'
  ? '/mock'
  : import.meta.env.VITE_API_BASE
```

## 07 · 怎么兼容旧浏览器，target 与 polyfill 怎么配

@id
vite-legacy

@level
进阶

@freq
2

@tags
兼容性 | legacy | polyfill

@ask
如果产品要兼容 IE11 或者老版 Safari，Vite 怎么配？build.target 和 @vitejs/plugin-legacy 分别管什么，polyfill 又是怎么打进去的？

@oral
**先说结论**：Vite 里「语法降级」和「运行时补丁」是两件事，分开管——`build.target` 控制 esbuild 把现代语法（如可选链、async）编译到哪个 ES 版本，解决「语法老浏览器不认」；`@vitejs/plugin-legacy` 负责「运行时补丁（polyfill）」和「给老浏览器单独出一套 SystemJS 包」，解决「新 API（Promise、fetch）老浏览器没有」。要兼容旧浏览器，两者通常要一起上。

**再说原理，先分清楚两个层次**。第一层是语法层：你写了 `?.`、`async/await`、顶级 `import()`，老浏览器解析就直接报错。这层由 `build.target` 指定 esbuild 的编译目标（比如 `'es2015'`），Vite 让 esbuild 把这些语法降级成老浏览器认得的写法。但语法降了，API 不一定有——`Promise`、`Array.includes`、`fetch` 这种「运行时才存在的对象/方法」，语法编译救不了，得靠 polyfill 在前面先补上。

**plugin-legacy 做了什么**。它针对「还要兼容真·旧浏览器（如 IE11）」的场景：基于 browserslist，给不支持原生 ESM 的浏览器生成一套用 SystemJS 加载的 legacy chunk，并自动注入 `core-js`、`regenerator-runtime`、动态 import 等 polyfill；同时现代浏览器走原生 ESM 的 modern chunk，靠 `<script nomodule>` / `module` 双份实现「能力探测、各取所需」。这样现代用户体验不被 legacy 的 polyfill 拖累，旧浏览器也能跑。

**真实项目里的取舍**。我做过 ToB 项目要兼容 IE11，就上了 plugin-legacy，配 `targets: ['ie >= 11']`，代价是包体积明显变大（polyfill 几十 KB 起）。但如果是只兼容「近两三年的 Chrome/Safari」，其实只设 `build.target: 'es2018'` 就够了，根本不用 legacy 插件——因为现代浏览器原生支持 ESM 和这些 API。所以先确认「到底要兼容到多老」，别无脑加 legacy。

**边界与注意**。Vite 5 起 legacy 不再默认集成，需要显式安装 `@vitejs/plugin-legacy`；`build.target` 默认是 `'modules'`（即支持原生 ESM 的浏览器），不设 legacy 就等于「放弃非 ESM 浏览器」。另外 polyfill 体积和兼容范围是正相关的，用 `browserslist` 收紧范围能省不少体积。

**收尾**：`build.target` 管语法降级，plugin-legacy 管 polyfill + 双包，先定兼容范围再决定要不要 legacy。

@points
build.target 管「语法降级」（esbuild 编译目标），解决老浏览器解析报错
plugin-legacy 管「运行时 polyfill + 给旧浏览器出 SystemJS 包」
现代浏览器走 modern chunk，旧浏览器走 legacy chunk（nomodule 探测）
只兼容近年版浏览器时设 target 即可，不必上 legacy 省体积
legacy 需显装插件，polyfill 体积随兼容范围增大

@steps
先区分两件事：语法降级（target）vs 运行时补丁（polyfill）
讲 build.target 怎么让 esbuild 把新语法编译成老语法
讲 plugin-legacy 基于 browserslist 出双包 + 注入 core-js
给取舍：先确认兼容范围，现代浏览器不必上 legacy
提醒 Vite5 需显装插件、polyfill 体积随范围涨

@followups
只设 build.target 不装 legacy 够吗？——若只兼容支持 ESM 的现代浏览器就够；要兼容 IE 这类必须上 legacy
polyfill 是谁提供的？——plugin-legacy 自动注入 core-js、regenerator-runtime 及动态 import 补丁
legacy 包怎么只给旧浏览器加载？——靠 <script type="module"> 与 nomodule 双份，浏览器自身能力探测

@example
### 1. 仅语法降级：设置 build.target

```typescript
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    // esbuild 会把可选链、async、新语法编译到该目标
    // 'modules' 是默认值，代表「支持原生 ESM 的浏览器」
    target: 'es2018', // 兼容近 3~5 年的主流浏览器即可这么设
    // target: ['chrome60', 'safari11'], // 也可按具体浏览器版本
  },
})
// 注意：target 只降级语法，不补 Promise/fetch 这类运行时 API
```

### 2. 兼容 IE11：上 @vitejs/plugin-legacy

```typescript
import { defineConfig } from 'vite'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig({
  plugins: [
    legacy({
      // 目标浏览器范围，决定打哪些 polyfill、出什么 legacy 包
      targets: ['ie >= 11', 'chrome >= 60'],
      // 额外手动指定的 polyfill（按需补充 core-js 模块）
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      // 给现代包也强制注入这些 polyfill（某些场景需要）
      modernPolyfills: true,
      // 渲染前检测是否需要 legacy 的兜底（SPA 常用）
      renderLegacyChunks: true,
    }),
  ],
  build: {
    // legacy 会基于这个 target 出 modern 包，再单独出 legacy 包
    target: 'es2015',
  },
})
```

### 3. 用 browserslist 收敛 polyfill 体积

```json
{
  "browserslist": [
    "last 2 Chrome versions",
    "last 2 Safari versions",
    "not ie <= 11"
  ]
}
```

```html
<!-- plugin-legacy 注入后的大致结构（自动生成，无需手写） -->
<!-- 现代浏览器执行 module 版，旧浏览器因不支持 module 走 nomodule 版 -->
<script type="module" src="/assets/index-x.js"></script>
<script nomodule src="/assets/index-legacy.js"></script>
```

## 08 · Vite 项目的首屏与构建产物性能优化

@id
vite-performance

@level
进阶

@freq
3

@tags
性能优化 | 分包 | 首屏

@ask
你的 Vite 项目首屏比较慢，或者构建产物太大，你会从哪些方向去优化？给我讲讲分包、懒加载、压缩这些具体怎么做。

@oral
**先说结论**：Vite 项目性能优化分两条线——「首屏加载快」和「产物体积小」。首屏靠路由懒加载 + 依赖分包 + 预加载把关键路径做短；产物靠 `manualChunks` 拆 vendor、按需 `dynamic import`、压缩与资源内联阈值来瘦身。两者都建立在「先测量、再优化」上，别盲调。

**再说原理，先讲首屏**。首屏慢最常见两个原因：一是入口 JS 太大，浏览器一次性要下载执行一整包；二是非首屏代码（比如后台路由、富文本编辑器）被打包进了主包。解法是路由级 `() => import()` 懒加载，把每个路由拆成独立 chunk，首屏只加载当前页需要的；再用 `manualChunks` 把 `vue`、`monaco-editor` 这种大且稳定的库单独拆 vendor，借浏览器长缓存，业务更新不影响 vendor 缓存命中。

**产物瘦身的几板斧**。第一，`build.rollupOptions.output.manualChunks` 控制分包策略，避免所有东西挤在一个大 chunk；第二，`build.target` 设到较高版本（es2018+）让 esbuild 少降级、产物更小；第三，压缩默认 esbuild 已很快，追求极致可上 `vite-plugin-compression` 出 gzip/brotli 预压缩文件交给 CDN；第四，`assetsInlineLimit` 控制小资源转 base64 内联（减少请求但增 JS 体积，要权衡）；第五，用 `rollup-plugin-visualizer` 生成体积可视化，先看清「谁最大」再动手。

**真实项目的体感**。我有个项目首屏要拉 2MB+ 的编辑器，把它改为路由懒加载 + manualChunks 单独拆后，首屏 JS 从 2MB 降到 300KB 级，LCP 明显好转；另一个用 `vite-plugin-compression` 出 brotli，配合 Nginx 直接吐预压缩文件，传输体积再砍 70%。但踩过坑：把 `assetsInlineLimit` 调太大，导致主 JS 被一堆 base64 图片撑大、缓存失效，后来回调到 4KB。

**边界与取舍**。优化要盯指标：首屏看 LCP/FCP，产物看 chunk 体积和各 chunk 缓存命中率。不要为了「数字好看」把不该懒加载的首屏组件也懒加载，反而增加请求数。最后记得 `build.chunkSizeWarningLimit` 只是告警阈值，不是优化目标，真正要的是「关键路径最短」。

**收尾**：先 visualizer 量体裁衣，路由懒加载 + vendor 分包是首屏王牌，压缩/内联阈值做收尾，一切以测量为准。

@points
首屏慢主因：主包过大 + 非首屏代码混入，用懒加载 + 分包破解
路由级 () => import() 把非首屏拆成独立 chunk，缩短关键路径
manualChunks 拆 vendor 借浏览器长缓存，业务更新不影响缓存命中
压缩用 esbuild 默认 + vite-plugin-compression 出 gzip/brotli
先 rollup-plugin-visualizer 测量，再动手，别盲调 assetsInlineLimit

@steps
先强调「先测量再优化」，用 visualizer 看谁最大
首屏：路由懒加载 + manualChunks 拆 vendor，缩短关键路径
产物：设较高 build.target 少降级、压缩默认 esbuild
上 vite-plugin-compression 出预压缩文件交给 CDN/Nginx
调 assetsInlineLimit 权衡内联，避免主包被 base64 撑大

@followups
怎么知道产物里谁最大？——用 rollup-plugin-visualizer 生成 treemap，按体积排序定位大依赖
懒加载会影响首屏吗？——只懒加载非首屏代码才有益，首屏组件勿懒加载，否则增请求
brotli 和 gzip 怎么选？——brotli 压缩率更高，交给 CDN/ Nginx 吐预压缩文件，传输体积再砍一截

@example
### 1. 路由懒加载：把非首屏拆成独立 chunk

```typescript
import { createRouter, createWebHistory } from 'vue-router'

// 用动态 import() 而不是静态 import，每个路由编译成独立 chunk
// 首屏只加载当前路由需要的代码，其余按需加载
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('./views/Home.vue') },        // 首屏
    { path: '/editor', component: () => import('./views/Editor.vue') }, // 重型编辑器，按需
    { path: '/report', component: () => import('./views/Report.vue') }, // 报表，按需
  ],
})
```

### 2. manualChunks 拆 vendor，借浏览器长缓存

```typescript
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // 函数式分包：node_modules 里的大库单独成 chunk
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('monaco-editor')) return 'editor' // 重型编辑器独立包
            if (id.includes('vue')) return 'vue'              // 框架相关独立包
            return 'vendor'                                    // 其余第三方归 vendor
          }
        },
      },
    },
    // 小资源 ≤4KB 转 base64 内联（默认 4096），过大反而撑主包
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1500, // 仅告警阈值，不是优化目标
  },
})
```

### 3. 出 gzip / brotli 预压缩文件

```typescript
import { defineConfig } from 'vite'
import viteCompression from 'vite-plugin-compression'

export default defineConfig({
  plugins: [
    // 构建时额外产出 .gz 文件，交给 Nginx 直接吐，省运行时压缩
    viteCompression({ algorithm: 'gzip', threshold: 10240 }),
    // brotli 压缩率更高，可同时开启
    viteCompression({ algorithm: 'brotliCompress', threshold: 10240 }),
  ],
})
```

### 4. Nginx 直接返回预压缩文件

```nginx
# 浏览器支持 br 就吐 .br，否则 .gz，再否则原始文件
gzip_static on;
brotli_static on;

location /assets/ {
    # 优先匹配预压缩文件，传输体积再砍一截
    try_files $uri$br $uri$gz $uri =404;
    expires 30d;          # vendor 等长缓存，借缓存命中提速
    add_header Cache-Control "public, max-age=2592000";
}
```
