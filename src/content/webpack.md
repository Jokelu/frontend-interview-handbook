---
id: webpack
name: Webpack
en: Bundler
icon: package
color: #1c78c0
order: 8
desc: 构建流程、loader 与 plugin 原理、产物体积与构建速度优化。
---

## 01 · Webpack 的构建流程是什么，核心概念有哪些

@id
webpack-process

@level
进阶

@freq
3

@tags
构建流程 | Compiler | Compilation

@ask
你先整体说一下 webpack 的构建流程是什么？它核心的几个概念——Compiler、Compilation、module、chunk、bundle——你是怎么理解的，它们之间的关系能讲清楚吗？

@oral
**先说结论**：webpack 本质是一个「静态模块打包器」，输入是一堆有依赖关系的源文件，输出是浏览器能直接跑的一个或几个 bundle。它做的事可以概括为四件：从入口出发构建依赖图、用 loader 把每种文件转译成 JS、用 plugin 在生命周期钩子上做增强、最后把产物 emit 到磁盘。

**再说原理**：这套机制里最核心的是 Compiler 和 Compilation 两个对象。Compiler 是整个 webpack 运行周期的「总指挥」，整个进程里只有一个实例，负责读配置、搭环境、触发构建、把结果写盘；Compilation 是「每一次构建」的上下文——注意是一次 webpack 运行可以产生多个 Compilation（比如 watch 模式下文件一变就新建一个），它持有本次构建的 modules、chunks、assets 等所有状态集合。构建主链路是：entry 出发 → 对每个 module 调用 loader 转成 AST → 递归解析依赖收集成 module graph → 按配置把 module 分组进 chunk → 通过 template 渲染成最终文件 → emit 到 output 目录。

**举个真实项目的排查例子**：我们中后台项目冷启动一度要 40 秒。我不想瞎猜慢在哪，先用 speed-measure-webpack-plugin 一挂，发现 80% 时间耗在 eslint-loader 和 babel-loader 的 transform 上，于是把 eslint 挪到编辑器/CI、babel 加 cacheDirectory，直接从 40s 降到 12s。这个经历让我体会到：只有真懂 Compiler/Compilation 这条主链路，才能精准定位是「解析慢」还是「生成慢」。

**边界取舍**：webpack 5 的持久化缓存（filesystem cache）已经把很多「构建慢」的问题内置解决了，不用再靠各种 hack；而且现在 Vite 走的是「依赖预构建 + 浏览器原生 ESM」，构建模型跟 webpack 差别很大，面试里顺带提一句能体现视野。

**最后收尾**：所以答这道题，关键是把「Compiler 一次、Compilation 多次」讲清楚，再把 module graph → chunk → asset 这条主链路串起来，就够专业了。

@points
webpack 是静态模块打包器：输入带依赖的源文件，输出浏览器可执行的 bundle
构建四阶段：依赖收集成 module graph、loader 转译、plugin 生命周期增强、emit 产出
Compiler 是单次运行的总指挥（读配置、写盘），Compilation 是每次构建的状态容器
核心产物链路：entry → module(递归解析) → chunk → asset → output
watch / 多次构建会生成多个 Compilation，状态彼此不共享

@steps
先一句话定性：静态模块打包器，把依赖图编译成浏览器能跑的 bundle
抛出 Compiler / Compilation 的区别，强调「一次 vs 多次」
走一遍主链路：入口 → loader 转译 → 递归依赖成 module graph → 分组 chunk → template 渲染 asset → emit
把 loader（module 阶段）和 plugin（生命周期钩子）两个概念嵌进主链路里
拿真实优化案例说明：理解链路能定位瓶颈（如 speed-measure 定位慢点）
收尾补一句 Vite 等新一代构建模型的差异，体现视野

@followups
Compiler 和 Compilation 有什么区别？——Compiler 整个运行只有一个，管配置和生命周期；Compilation 每次构建（含 watch 重编译）新建一个，持有本次的模块/分块/资源状态
module、chunk、bundle 三者关系？——module 是单个源文件经 loader 后的产物；chunk 是按入口/动态导入/splitChunks 分组后的集合；bundle 是 chunk 最终输出的文件
webpack 5 的持久化缓存存在哪、怎么失效？——默认在 node_modules/.cache/webpack，按文件内容 hash 和配置 hash 做 key，文件或配置变了就重新生成

@example
### 1. 最小可运行的 webpack 配置（看清四个核心概念落点）

```javascript
// webpack.config.js —— 一个最朴素的配置，已经包含构建流程的四大要素
const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
  mode: 'development', // 决定内置优化开关，development 不压缩、production 压缩
  entry: './src/index.js', // ① 入口：依赖图的起点，可配成对象做多入口
  output: {
    path: path.resolve(__dirname, 'dist'), // 产物输出目录
    filename: 'bundle.[contenthash].js', // ② 出口：文件名，contenthash 用于缓存
  },
  module: {
    rules: [
      {
        test: /\.js$/, // ③ loader：命中文件后用对应处理器转译（这里用 babel）
        use: ['babel-loader'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({ template: './index.html' }), // ④ plugin：在生命周期钩子上注入能力
  ],
}
```

### 2. Compiler 与 Compilation 的具象区分

```javascript
// 自定义 plugin 最能体现两者区别：compiler 上挂的是「全局钩子」，compilation 上挂的是「构建钩子」
class DemoPlugin {
  apply(compiler) {
    // compiler.hooks 整个 webpack 生命周期只触发一次级别的钩子
    compiler.hooks.done.tap('DemoPlugin', (stats) => {
      console.log('本次完整构建结束，compiler 级别的钩子')
    })

    // compilation 每次「重新构建」都会拿到一个新的实例
    compiler.hooks.compilation.tap('DemoPlugin', (compilation) => {
      // 在这里能拿到本次构建的 modules / chunks / assets
      compilation.hooks.processAssets.tap('DemoPlugin', () => {
        console.log('当前 compilation 的资源正在生成，构建级钩子')
      })
    })
  }
}
```

### 3. 用 speed-measure 定位「到底是哪一步慢」

```bash
# 安装性能测量插件
npm i -D speed-measure-webpack-plugin

# 用 SMP 包裹原配置后构建，终端会按 loader/plugin 打印耗时
# 典型输出：
#   babel-loader        took 18.2 s
#   eslint-loader       took 11.5 s
#   HtmlWebpackPlugin   took 0.4 s
# 一眼就能看出慢点，而不是瞎猜
```

## 02 · loader 和 plugin 的区别，原理分别是什么

@id
webpack-loader-plugin

@level
进阶

@freq
3

@tags
loader | plugin | 生命周期

@ask
loader 和 plugin 都是 webpack 的扩展机制，它们到底有什么区别？各自的工作原理是什么，你平时怎么决定该用哪个？

@oral
**先说结论**：loader 和 plugin 是 webpack 两个扩展机制，但干的活完全不一样——loader 只管「单个文件的内容怎么转译」，是一个管道式、文件级的转换器；plugin 能监听整个构建生命周期的钩子，几乎什么事都能做（生成文件、改资源、注入变量、上报体积）。一句话总结：loader 解决「单个文件怎么读」，plugin 解决「构建流程怎么改」。

**再说原理**：loader 本质就是一个函数，输入源字符串、输出转译后的字符串（或 buffer）。webpack 把每个匹配到的文件丢进你配的 use 数组，从右到左（或者说从后往前）链式执行——比如 `use: ['style-loader', 'css-loader']`，先跑 css-loader 把 css 转成 JS 模块，再跑 style-loader 把它塞进 DOM。它运行在 module 构建阶段，靠 AST（如 babel）或正则改写内容。plugin 则是实现了 `apply(compiler)` 的类，在 `compiler.hooks` 上 `tap` 注册回调，在你需要的生命周期点（比如 emit 前、afterCompile）拿到 compilation 对象做任意事。所以 loader 是「点」的能力，plugin 是「面」的能力。

**真实场景**：我们做过一个需求——把构建出的每个 chunk 体积打到公司监控平台。loader 完全做不到，因为 loader 只看得见单个文件、不掌握全局产物；最后写了一个 plugin，在 `compilation.hooks.processAssets` 里读 assets 的 size，post 到接口。反过来，要把 tsx 里写死的 px 按设计稿转成 rem，用 postcss-loader 配个插件就够了，完全没必要上 plugin。所以选型上的经验是：只改内容用 loader，要动流程或产物用 plugin。

**边界取舍**：loader 必须返回处理后的内容，不能「什么都不做」就 return（除非是有意 passthrough）；plugin 滥用全局钩子会拖慢构建，要注意只在必要阶段 tap，别在高频钩子上挂重逻辑。

**收尾**：回答时把「loader = 转译 / 管道 / 文件级，plugin = 钩子 / 流程级」这个对比抛出来，再各补一句原理和一个场景，就很完整了。

@points
loader 是「文件内容转译器」，输入源码字符串/Buffer，输出转译后内容，只作用于匹配到的文件
loader 链式执行：use 数组从右到左，上一个的输出是下一个的输入
plugin 通过 apply(compiler) 在 compiler.hooks 上 tap 钩子，能干预任意构建阶段
选型原则：只改单文件内容用 loader；要动流程/产物/资源用 plugin
loader 运行在 module 阶段，plugin 贯穿整个 Compiler/Compilation 生命周期

@steps
先给一句话定义区分：loader 转译文件、plugin 改流程
讲 loader 原理：纯函数、链式、右到左、基于 AST 或正则
讲 plugin 原理：apply(compiler) + tap 钩子 + 操作 compilation
给两个真实场景说明选型（px→rem 用 loader，体积上报用 plugin）
补边界：loader 必须返回内容、plugin 钩子不要乱挂
收尾把「文件级 vs 流程级」的对比框架复述一遍

@followups
loader 的 use 数组执行顺序？——从右到左（从后往前），如 ['style-loader','css-loader'] 先 css-loader 后 style-loader
pitch 是什么，为什么有时 loader 从前往后？——loader 有 normal 和 pitch 两段，pitch 从左往右先执行，可用于短路跳过后续 loader
plugin 怎么拿到最终产物内容？——在 compilation.hooks.processAssets（或旧版 emit）钩子里读 compilation.assets，可改可加

@example
### 1. loader 链式执行顺序的直观演示

```javascript
// 配置：use 数组从右往左执行，pitch 段才从左往右
module.exports = {
  module: {
    rules: [
      {
        test: /\.less$/,
        // 执行顺序（normal 阶段）：less-loader → css-loader → style-loader
        // 即先编译成 css，再转成 JS 模块，最后注入 <style>
        use: ['style-loader', 'css-loader', 'less-loader'],
      },
    ],
  },
}

// 写一个「什么都不做但能看到顺序」的调试 loader
module.exports = function (source) {
  console.log('[debug-loader] 收到源文件，长度:', source.length)
  return source // 必须返回内容，否则产物里这块就空了
}
```

### 2. 一个最小 plugin 的骨架

```javascript
// my-plugin.js —— plugin 必须是带 apply 方法的类（或函数）
class MyPlugin {
  apply(compiler) {
    // 在「资源即将写入磁盘」的钩子上操作
    // processAssets 比旧版的 emit 更语义化，能区分资源处理阶段
    compiler.hooks.thisCompilation.tap('MyPlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        { name: 'MyPlugin', stage: compilation.constructor.PROCESS_ASSETS_STAGE_OPTIMIZE },
        () => {
          // 在这里遍历 compilation.assets 就能拿到/改所有产物
          console.log('产物文件数:', Object.keys(compilation.assets).length)
        }
      )
    })
  }
}
module.exports = MyPlugin
```

### 3. 在配置里同时挂 loader 和 plugin

```javascript
const MyPlugin = require('./my-plugin')

module.exports = {
  module: {
    rules: [
      { test: /\.js$/, use: ['babel-loader'] }, // loader：文件级转译
    ],
  },
  plugins: [
    new MyPlugin(), // plugin：流程级扩展
  ],
}
```

### 4. 用 node 跑一次构建看 loader/plugin 触发顺序

```bash
# 用 webpack 的 CLI 触发一次构建，控制台能看到我们的 log 顺序
npx webpack --config webpack.config.js
# 终端输出顺序大致是：
#   [debug-loader] 收到源文件 ...   ← module 阶段，loader 先跑
#   产物文件数: 3                    ← emit 前，plugin 后跑
```

## 03 · 手写一个 loader：在生产环境去掉 console.log

@id
webpack-custom-loader

@level
手写题

@freq
2

@tags
loader | AST | 代码转换

@ask
你手写一个 loader 吧，需求是：生产环境构建时把代码里的 console.log 去掉。你会怎么实现，为什么不用正则直接 replace 掉？

@oral
**先说结论**：手写一个「生产环境去掉 console」的 loader，核心就是写一个函数，接收源文件字符串，用 AST 把所有的 console.log / info / warn 调用节点删掉（或置空），再把 AST 转回代码返回。关键点是不要用正则「硬删」，而是走 AST，避免把字符串里的 console.log 误伤、也避免删断语法。

**再说原理**：loader 本身只是个 `(source) => code` 的函数，难点在「怎么安全地改代码」。直接用正则 `source.replace(/console\.log\(.*\)/g, '')` 风险很大——多行调用删不干净、字符串里出现的会误删、还容易留下空行或语法错误。正确做法是接 `@babel/core`：用 `babel.parse` 把源码解析成 AST，遍历 CallExpression 找到 `console.xxx` 且是 MemberExpression 的节点，用 `@babel/types` 标记为需要移除，再用 `generator` 生成新代码。也可以用 `@babel/traverse` 的 Visitor 模式在遍历里直接 `path.remove()` 删除节点，这是最干净的做法。

**真实场景**：我们项目之前用过正则替换的 loader，结果有同事在代码里写了 `const note = 'console.log 被误删了'` 这种注释字符串，打包后整段逻辑错位直接白屏。换成 AST 方案后就没有这类问题。而且我们只在生产 `process.env.NODE_ENV === 'production'` 时启用，开发环境保留 console 方便调试。

**边界取舍**：完全删除 console 会让线上排障很难，所以很多团队改成「保留 error，过滤 log/info」，或者用 `terser` 的 `compress.pure_funcs` 直接干掉，比手写 loader 更稳。手写 loader 的价值在于「要按业务规则定制」，比如只删某个目录下、或只删带特定注释标记的 console。

**收尾**：所以手写 loader 的套路是固定三步——拿到 source、AST 改造、返回 code，再在配置里按环境挂载即可，模板记住就不慌。

@points
loader 是 `(source, map) => code` 的函数，难点在「如何安全地改代码」
正则硬删 console 有坑：多行删不净、字符串误伤、易留语法错误
正道是用 @babel/core 解析成 AST，遍历 CallExpression 删 console 节点，再生成代码
只在 production 启用，开发环境保留 console 方便调试
更省事可用 terser 的 drop_console；手写 loader 适合「按业务规则定制删除」

@steps
初始化：loader 文件导出一个函数，接收 source
用 @babel/parser 把 source 解析成 AST（开 jsx/typescript 插件兼容 tsx）
用 @babel/traverse 遍历，命中 console.log/info/warn 的 CallExpression 就 path.remove()
用 @babel/generator 把 AST 还原成代码字符串返回
在 webpack.config 的 module.rules 里按 test 和 include 挂载
用 node 跑一次构建前后对比产物，验证 console 已消失、error 被保留

@followups
为什么不用正则直接 replace？——多行调用删不净、字符串中的 console 会误伤、还可能留下空行破坏语法
怎么只删 console.log 但保留 console.error？——在 traverse 里判断 memberName，只移除 log/info/warn，error 放行
这个 loader 和 terser 的 drop_console 比哪个好？——terser 更成熟稳定，手写 loader 胜在可定制（按模块/按关键字）

@example
### 1. 完整可用的 loader：基于 AST 删除 console

```javascript
// drop-console-loader.js
// 一个生产环境删除 console 的 loader，基于 babel 的 AST 操作，安全不误伤
const babelParser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const generate = require('@babel/generator').default
const t = require('@babel/types')

// loader 固定签名：source 是文件原始内容，返回改造后的代码
module.exports = function dropConsoleLoader(source) {
  // 只在生产环境生效，开发环境原样返回，保留调试 console
  if (process.env.NODE_ENV !== 'production') {
    return source
  }

  // ① 把源码解析成 AST（sourceType: module 支持 import/export）
  const ast = babelParser.parse(source, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'], // 兼容 tsx，避免解析报错
  })

  // ② 遍历 AST，找到 console.xxx 的调用并删除
  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee
      // 必须是 console.log / info / warn 这种「成员调用」才算
      if (
        t.isMemberExpression(callee) &&
        t.isIdentifier(callee.object, { name: 'console' }) &&
        t.isIdentifier(callee.property)
      ) {
        const method = callee.property.name
        // 只删 log/info/warn，保留 error 方便线上排障
        if (['log', 'info', 'warn', 'debug'].includes(method)) {
          path.remove() // 直接移除整个调用节点，不留空行
        }
      }
    },
  })

  // ③ 把 AST 重新生成代码返回给 webpack
  const output = generate(ast, { comments: false }, source)
  return output.code
}
```

### 2. 在 webpack 里注册这个 loader

```javascript
const path = require('path')

// webpack.config.js —— 按文件类型和目录挂载我们的 loader
module.exports = {
  module: {
    rules: [
      {
        test: /\.(js|ts|jsx|tsx)$/,
        // 只对 src 下的业务代码生效，node_modules 跳过（第三方库自己管）
        include: path.resolve(__dirname, 'src'),
        use: [
          'babel-loader', // 先 babel 转译
          path.resolve(__dirname, 'drop-console-loader.js'), // 再删 console
        ],
      },
    ],
  },
}
```

### 3. 验证：构建前后对比产物

```bash
# 准备一个带 console 的测试文件 src/demo.js
#   export const hi = () => { console.log('hi'); console.error('oops'); return 1 }

# 生产环境构建
cross-env NODE_ENV=production npx webpack --config webpack.config.js

# 在 dist 里的产物搜索 console，预期结果：
#   grep "console.log" dist/main.*.js  → 无匹配（已删除）
#   grep "console.error" dist/main.*.js → 仍有（被保留）
```

### 4. 如果用 terser 更省事的做法（对比参考）

```javascript
const TerserPlugin = require('terser-webpack-plugin')

// webpack.config.js 的 optimization，一行配置替代手写 loader 的大部分场景
module.exports = {
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            // drop_console: true 会删全部；下面是只删 log/info/warn 的写法
            pure_funcs: ['console.log', 'console.info', 'console.debug'],
          },
        },
      }),
    ],
  },
}
```

## 04 · 手写一个 plugin：输出产物大小报告

@id
webpack-custom-plugin

@level
手写题

@freq
2

@tags
plugin | 钩子 | 产物分析

@ask
你写一个 plugin，要求每次构建完输出一份产物大小报告。你打算监听哪个钩子，怎么拿到产物大小，又怎么把报告写出来？

@oral
**先说结论**：手写一个「输出产物大小报告」的 plugin，就是写一个带 `apply(compiler)` 的类，在 `compiler.hooks.done` 或者 `compilation.hooks.processAssets` 钩子里拿到所有 assets，算出每个文件的大小，再写一个 JSON/Markdown 报告到磁盘，或者打印到控制台。核心是「找准钩子 + 读 compilation.assets + 写文件」这三步。

**再说原理**：plugin 的入口是 `apply(compiler)`，webpack 启动时会 `new Plugin().apply(compiler)` 把控制权交给你。你要监听钩子——想拿最终产物大小，最稳的是 `compiler.hooks.done`，它的回调拿到 `stats`，`stats.toJson()` 里有 assets 数组，每项带 `name` 和 `size`。另一个更「webpack 原生」的做法是在 `thisCompilation` 里 tap `compilation.hooks.processAssets`，此时 `compilation.assets` 已经是最终要落盘的文件集合，可以直接遍历。写报告用 Node 的 `fs` 即可，注意路径用 `compiler.options.output.path`，别写死。

**真实场景**：我们做性能卡点，每次 CI 构建后把这个报告推到内部平台，超过阈值就让流水线变红。因为只靠人眼看 bundle 大小很容易忽略某个依赖偷偷变大。报告里我还会算「总体积」和「Top N 大文件」，定位是哪个 chunk 膨胀。

**边界取舍**：`emit` 钩子里改 assets 是「改产物」，而「只统计不改动」用 `done` / `processAssets` 更合适，别在 emit 里既读又写造成递归。还有 sourcemap 文件也会被算进 assets，统计时要按后缀过滤掉 `.map`，否则数字虚高。

**收尾**：手写 plugin 的套路就是 apply + 选钩子 + 操作 compilation，记住这个模板，90% 的 plugin 需求都能套。

@points
plugin 入口是 apply(compiler)，webpack 启动时调用它把钩子挂上
拿产物大小用 compiler.hooks.done（stats.toJson().assets）或在 processAssets 里读 compilation.assets
写报告用 Node fs，路径拿 compiler.options.output.path，避免写死
统计时要过滤 .map 等 sourcemap，否则体积虚高
只统计不改动用 done/processAssets；要改产物内容再进 emit

@steps
定义 class，写 apply(compiler) 入口
在 thisCompilation 里 tap compilation.hooks.processAssets，或 tap compiler.hooks.done
遍历 assets，累加每个文件 size（过滤 .map）
整理成报告对象（总量 + Top N）
用 fs 写 report.json 到 output 目录，或打印到终端
在配置里 new 这个 plugin，跑构建验证 dist 下出现报告

@followups
done 和 emit 钩子有什么区别？——done 在产物已写完磁盘后触发，适合统计；emit 在写盘前触发，适合改/加 assets
为什么统计要过滤 .map？——sourcemap 体积可能比源码还大，算进「业务产物」会严重虚高，误导优化方向
processAssets 的 stage 参数干嘛用？——决定你的回调在资源处理流水线的哪一步执行，避免和内置优化顺序冲突

@example
### 1. 完整 plugin：输出产物大小报告

```javascript
// size-report-plugin.js
// 一个统计并输出 bundle 大小报告的 plugin
const fs = require('fs')
const path = require('path')

class SizeReportPlugin {
  // webpack 启动时会调用 apply，并传入全局 compiler
  apply(compiler) {
    // 在「本次构建完成、产物已就绪」的钩子拿到最终状态
    compiler.hooks.done.tap('SizeReportPlugin', (stats) => {
      // stats.toJson() 拿到结构化的编译结果，assets 即所有产物文件
      const assets = stats.toJson({ assets: true }).assets || []

      // 过滤掉 sourcemap，避免体积虚高
      const realAssets = assets.filter((a) => !a.name.endsWith('.map'))

      // 计算每个文件大小，并排个序找 Top N
      const rows = realAssets
        .map((a) => ({ name: a.name, size: a.size }))
        .sort((x, y) => y.size - x.size)

      const total = rows.reduce((sum, r) => sum + r.size, 0)

      const report = {
        totalKB: +(total / 1024).toFixed(2),
        topFiles: rows.slice(0, 5), // 只看最大的 5 个，定位膨胀来源
        generatedAt: new Date().toISOString(),
      }

      // 写到产物目录，路径从 compiler 配置里取，别写死
      const outPath = compiler.options.output.path
      fs.writeFileSync(
        path.join(outPath, 'size-report.json'),
        JSON.stringify(report, null, 2)
      )

      console.log(`[SizeReport] 总体积 ${report.totalKB}KB，最大文件: ${report.topFiles[0].name}`)
    })
  }
}
module.exports = SizeReportPlugin
```

### 2. 注册到 webpack 配置

```javascript
const SizeReportPlugin = require('./size-report-plugin')

// webpack.config.js
module.exports = {
  plugins: [
    new SizeReportPlugin(), // 无参即可，路径自动从 output 取
  ],
}
```

### 3. 跑构建并查看报告

```bash
# 生产构建
npx webpack --config webpack.config.js

# 产物目录里会多出 size-report.json
# cat dist/size-report.json 可见：
# {
#   "totalKB": 312.45,
#   "topFiles": [{ "name": "main.8a3c.js", "size": 198302 }, ...],
#   "generatedAt": "2026-09-14T..."
# }
```

### 4. 进阶：用 processAssets 钩子（更贴近 webpack 原生写法）

```javascript
// 另一种实现：在资源生成阶段直接读 compilation.assets
class SizeReportPluginV2 {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('SizeReportPluginV2', (compilation) => {
      compilation.hooks.processAssets.tap(
        { name: 'SizeReportPluginV2', stage: compilation.constructor.PROCESS_ASSETS_STAGE_REPORT },
        () => {
          // compilation.assets 的 key 是文件名，value 是 SizeOnlySource/ RawSource
          const names = Object.keys(compilation.assets)
          const total = names
            .filter((n) => !n.endsWith('.map'))
            .reduce((s, n) => s + compilation.assets[n].size(), 0)
          console.log('[V2] 当前构建产物总大小:', total, 'bytes')
        }
      )
    })
  }
}
```

## 05 · HMR 热更新的原理是什么

@id
webpack-hmr

@level
高级

@freq
3

@tags
HMR | WebSocket | 模块替换

@ask
你讲讲 HMR 热更新是怎么实现的？为什么改了代码页面不刷新还能更新，底层靠什么机制？

@oral
**先说结论**：HMR（Hot Module Replacement）就是「不刷新整页、只把改动的模块替换进正在运行的页面」。开发时改完代码，页面状态（比如表单输入、滚动位置）不丢失，体验比整页刷新好太多。它底层是 webpack 的 watch + 增量构建 + WebSocket 推送 + 浏览器端运行时替换模块这套组合拳。

**再说原理**：webpack 起 dev server 时会开一个 WebSocket 长连接，同时 watch 文件。你一保存，webpack 重新编译，但只编译「受影响的模块」，产出两个东西：一个是更新后的模块代码（hot update chunk），一个是描述「哪些模块变了」的 manifest（json）。dev server 通过 WebSocket 把 manifest 推给浏览器。浏览器里的 HMR runtime（webpack 注入的）收到后，按 manifest 去拉新的模块 chunk，然后调用该模块的 `module.hot.accept` 回调——如果模块自己或父级声明了 accept，就执行回调用新模块替换旧的；如果没人 accept，就一路冒泡到顶层，最终退化成整页刷新。

**真实排查**：我们遇到过「改了组件但页面没更新」。原因一是模块没写 accept，React 项目其实靠 react-refresh 自动处理了，但我们某个纯工具模块自己管理了状态没接；二是 dev server 的 WebSocket 被公司代理切断了，manifest 推不过来，控制台能看到 `[HMR] disconnected`；三是配置 `hot: true` 但 devServer 的 client 配置有冲突导致失效。

**边界取舍**：HMR 不是银弹，有副作用的模块（比如直接在模块顶层执行 DOM 操作、起定时器的）热替换后旧的没清理会重复执行，必须自己在 accept 回调里 dispose 旧资源（`module.hot.dispose`）。另外 CSS 的热替换是 webpack 内置支持的，不需要你写 accept。

**收尾**：把「watch 增量编译 → WS 推 manifest → runtime 拉新模块 → accept 替换/冒泡刷新」这条链路讲清楚，HMR 就答透了。

@points
HMR = 只替换变更模块、不整页刷新，保留页面运行时状态
链路：文件改动 → webpack 增量编译 → WS 推送 manifest → 浏览器拉 hot-update chunk → module.hot.accept 替换
没人 accept 时热更新冒泡到顶层，退化为整页刷新
WS 断开 / 没写 accept / 配置错都会导致「改了不生效」
有副作用的模块要在 accept 里 dispose 旧资源，否则重复执行

@steps
定性：HMR 是局部热替换，保留状态，区别于整页刷新
讲底层四件套：watch 文件、增量编译、WebSocket 推送、runtime 替换
拆 manifest 与 hot-update chunk 的职责
讲 module.hot.accept 的替换逻辑和「冒泡退化刷新」
举排查案例：WS 断开、缺 accept、配置 hot 没开
补边界：副作用模块要 dispose，否则重复执行

@followups
模块没人写 module.hot.accept 会怎样？——热更新请求向上冒泡，直到顶层还没人处理就整页刷新
manifest 和 hot-update chunk 分别是什么？——manifest(json) 告诉浏览器哪些模块变了；hot-update chunk(js) 是更新后模块的新代码
为什么有时 HMR 后页面状态乱了？——模块顶层有副作用（定时器/DOM 监听）没在 dispose 里清理，新旧都跑了

@example
### 1. dev server 开启 HMR 的最小配置

```javascript
// webpack.config.js —— 开发环境开启热更新
module.exports = {
  mode: 'development',
  devServer: {
    hot: true, // ① 打开 HMR，dev server 才会增量编译 + 开 WS
    // 注意 webpack 5 用 hot 即可；老版本还要配合 HotModuleReplacementPlugin
    port: 8080,
    // 若走公司代理，确保 WS 路径没被拦，否则控制台报 disconnected
    client: { overlay: true },
  },
  plugins: [
    // webpack 4 需要显式加这个插件；webpack 5 配 hot:true 可省略
    // new webpack.HotModuleReplacementPlugin(),
  ],
}
```

### 2. 在业务模块里声明 accept（自己接管替换）

```javascript
// counter.js —— 当自身或依赖它的模块变化时，执行回调做局部替换
let count = 0
export function tick() {
  count += 1
  return count
}

// module.hot 只在 dev 且开启 HMR 时存在，生产构建会被 tree-shake 掉
if (module.hot) {
  // accept 表示「这个模块可以自己热替换」，不必冒泡到整页刷新
  module.hot.accept(() => {
    console.log('[HMR] counter 模块已热替换，count 当前值保留')
  })

  // 如果模块有副作用（定时器/监听），在 dispose 里清理，避免新旧都跑
  module.hot.dispose(() => {
    console.log('[HMR] counter 旧实例即将被替换，先清理副作用')
  })
}
```

### 3. 浏览器侧发生了什么（HMR 运行时流程）

```javascript
// 伪代码：webpack 注入的 HMR runtime 核心逻辑（帮助理解，不必手写）
// 1. WS 收到服务端推来的 manifest：{ h: hash, c: { 0: true } }（模块 0 变了）
// 2. 按 manifest 去拉 ./0.[hash].hot-update.js（新模块代码）
// 3. 调用该模块注册的 accept 回调做替换
// 4. 如果某个模块没 accept，向上一级模块询问，直到入口；都没人接 → location.reload()
```

### 4. 验证 HMR 是否真的在工作

```bash
# 启动 dev server
npx webpack serve --config webpack.config.js

# 改一个文件保存，控制台预期看到：
#   [HMR] Waiting for update signal from WDS...
#   [HMR] Updated modules:
#   [HMR]  - ./src/counter.js
#   [HMR] App is up to date.
# 页面不刷新、表单输入还在，说明 HMR 生效
```

## 06 · Tree Shaking 的原理与失效场景

@id
webpack-tree-shaking

@level
高级

@freq
3

@tags
TreeShaking | ESM | sideEffects

@ask
Tree Shaking 的原理是什么？什么情况下会失效，你项目里遇到过摇不掉的情况吗？

@oral
**先说结论**：Tree Shaking 是「打包时把没被用到的导出代码摇掉」的死代码消除手段，依赖 ES Module 的静态结构（import/export 在编译期就能确定依赖关系）。它跟「压缩」不是一回事：Tree Shaking 是删掉没引用的模块/导出，Terser 压缩是进一步缩减留下的代码。要让它生效，前提是代码必须是 ESM，且生产模式开启。

**再说原理**：ESM 的 import/export 是静态的，webpack 在构建依赖图时就能标记出「哪些导出从来没被 import 过」，这些就是可摇掉的。但光靠静态分析还不够——如果模块顶层有副作用（比如 `polyfill()` 直接执行、或给全局挂东西），摇掉它程序就坏了。所以 webpack 4+ 引入 `package.json` 的 `sideEffects` 字段：标记为 `false` 表示「本包没有任何副作用，放心摇」；写成数组表示「只有这些文件有副作用，其余可摇」。再配合 `usedExports` 分析（production 默认开），没被使用的 export 会被打上 `unused harmony export` 标记，最后 Terser 把它真正删掉。

**真实场景**：我们引了个工具库，只用了其中一个函数，但打包体积没小多少。查出来是库是 CommonJS 打包的、且没标 sideEffects，webpack 不敢摇。换用它的 ESM 构建（或 `module` 字段指向的版本）并加上 `sideEffects: false` 后，体积掉了 60%。还有个坑：用 `export * from` 再只引其中一项，静态分析可能摇不掉，要留意。

**边界取舍**：Tree Shaking 对「动态特性」无效——比如 `import()` 动态导入、Reflect、或者把对象当字典遍历取值再调用，分析器不知道你用了哪个，就整段保留。另外 Babel 如果把 ESM 提前转成 CJS（`@babel/preset-env` 的 modules 默认 true），会直接废掉 Tree Shaking，必须设 `modules: false` 交给 webpack 处理。

**收尾**：记住三件套——ESM 语法 + sideEffects 标记 + modules:false，Tree Shaking 就稳了。

@points
Tree Shaking 是依赖 ESM 静态结构的死代码消除，删「没被引用的导出」，不等于压缩
sideEffects 字段告诉 webpack 哪些模块可安全摇掉；false 表示全包无副作用
production 模式默认开 usedExports 分析，未使用导出打标记后由 Terser 真删
Babel 把 ESM 转 CJS（modules 默认 true）会废掉 Tree Shaking，要设 modules:false
动态导入/字典式调用等动态特性摇不掉，会整段保留

@steps
定性：Tree Shaking = 删未使用导出，建立在 ESM 静态分析上
讲原理：构建期标记未引用导出 → sideEffects 判断可否摇 → usedExports + Terser 删除
讲 sideEffects 字段：false 与数组两种写法
给真实案例：CJS 库换 ESM + 标 sideEffects 后体积骤降
补失效场景：Babel modules:true、动态导入、字典式调用
收尾给三件套：ESM + sideEffects + modules:false

@followups
sideEffects 和 usedExports 有什么区别？——sideEffects 决定「整个模块能不能摇」，usedExports 决定「模块里哪些导出没被用」
为什么 Babel 设 modules:true 会破坏 Tree Shaking？——ESM 被提前编译成 CJS，丢失静态结构，webpack 无法静态分析依赖
只引库里一个函数但体积没小，怎么查？——看库的 package.json 有没有 module 字段和 sideEffects，且确认构建产物是 ESM 而非 CJS

@example
### 1. 一个可被摇掉的模块 vs 摇不掉的写法

```javascript
// math.js —— 纯 ESM，没有任何副作用，导出都可被静态分析
export function add(a, b) {
  return a + b
}
export function mul(a, b) {
  return a * b
}

// app.js —— 只用了 add，mul 没被引用
import { add } from './math'
console.log(add(1, 2)) // mul 会被标记为 unused harmony export，最终被 Terser 删掉
```

### 2. package.json 里声明 sideEffects

```json
{
  "name": "my-lib",
  "version": "1.0.0",
  "main": "dist/index.cjs.js",
  "module": "dist/index.esm.js",
  "sideEffects": false
}
```

补充说明：当包里确实有一部分代码有副作用（比如全局 polyfill、注入样式的 css），应把 `sideEffects` 写成数组，例如 `["*.css", "./src/polyfill.js"]`，表示「只有这些文件有副作用、其余可摇」，而不是一刀切写 false。

### 3. Babel 必须保留 ESM 交给 webpack

```javascript
// babel.config.js —— 关掉 ESM→CJS 的转换，否则 Tree Shaking 失效
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        // 关键：让 webpack 拿到原生 import/export 来做静态分析
        modules: false,
      },
    ],
  ],
}
```

### 4. 验证 Tree Shaking 是否生效

```bash
# 生产构建
npx webpack --mode production

# 在产物里搜索没被引用的导出名，预期找不到
# grep "function mul" dist/main.*.js  → 无匹配，说明 mul 已被摇掉

# 反例：故意写 modules:true 重新构建，再 grep，mul 还在 → 证明被破坏了
```

## 07 · 代码分割与懒加载怎么做

@id
webpack-code-splitting

@level
进阶

@freq
3

@tags
代码分割 | 动态导入 | 缓存

@ask
代码分割和懒加载你平时怎么做？webpack 有哪些手段可以实现，你项目里具体怎么用的？

@oral
**先说结论**：代码分割（Code Splitting）是把一个大 bundle 拆成多个小文件，核心目的有两个——「首屏只加载需要的」和「利用浏览器缓存让不变的东西不重复下载」。Webpack 做分割主要有三种手段：入口手动配多入口、动态 import() 自动拆、以及 splitChunks 公共抽离。

**再说原理**：最常用也最「智能」的是动态导入——你在代码里写 `import('./xxx')`，webpack 遇到这个语法会自动把 xxx 单独打成一个 chunk，运行时按需加载（返回 Promise）。首屏不进这个分支就不下载，天然实现懒加载。第二类是 `splitChunks`，在 production 下默认开启，规则是「同一模块被多个 chunk 引用、且体积超过阈值（默认 20KB）就抽成公共 chunk」，这样 react、lodash 这类基础库只打一次，配合 contenthash 文件名长期缓存。第三类是多入口 `entry: { app, vendor }` 手动分，但现在更推荐用 splitChunks 而不是手写。

**真实场景**：我们中后台首页原本 1.2MB，首屏 4 秒。做法是：路由级用 `React.lazy(() => import())` 把每个页面对应的 chunk 拆出来，首屏只加载首页那块；再把 react/react-dom 等用 `cacheGroups` 抽成 `vendors` chunk 并设长缓存。改完首屏直接降到 600KB、2 秒。还有个坑：动态 import 的魔法注释 `/* webpackChunkName */` 能起名字，否则 chunk 名是一串 hash 不好排查。

**边界取舍**：拆太碎会有「请求数暴涨 + HTTP 开销」的反效果，尤其 HTTP/1.1 下并发有限；HTTP/2 多路复用会缓解。所以一般配合 `maxInitialRequests` 和 `minSize` 控制粒度。另外懒加载的组件要有 loading 兜底，避免网络慢时白屏。

**收尾**：记住「动态 import 管首屏、splitChunks 管复用缓存」这两个抓手，代码分割就答到位了。

@points
代码分割目的：首屏只加载必要代码 + 利用缓存避免重复下载
三种手段：多入口手动配、动态 import() 自动拆、splitChunks 公共抽离
动态 import 返回 Promise，运行时按需加载，天然实现路由级懒加载
splitChunks 默认抽「被多处引用且超阈值」的模块，配合 contenthash 长缓存
拆太碎会请求数暴涨；HTTP/2 下更友好，用 minSize/maxInitialRequests 控粒度

@steps
定性：分割是把大包拆小，服务首屏与缓存两个目标
讲动态 import：语法即分割点，运行时按需加载做懒加载
讲 splitChunks：默认规则（复用+体积阈值）和 cacheGroups 抽 vendors
给真实案例：路由级 React.lazy + vendors 抽离，首屏体积/耗时双降
补魔法注释 webpackChunkName 便于排查
边界：拆太碎请求数问题、HTTP/2 缓解、懒加载要 loading 兜底

@followups
动态 import 和 splitChunks 分别解决什么？——import 解决「首屏不加载暂时用不到的」；splitChunks 解决「公共依赖重复打包、无法长效缓存」
contenthash 在缓存里起什么作用？——文件名随内容变，内容没变 URL 就不变，用户命中强缓存不重新下载
拆太碎会有什么反效果？——请求数暴涨、HTTP/1.1 并发受限反而变慢；用 minSize/maxInitialRequests 控制

@example
### 1. 动态 import 实现路由级懒加载（React 为例）

```javascript
// router.js —— 每个页面单独成一个 chunk，首屏只加载当前路由对应的
import React, { Suspense, lazy } from 'react'

// lazy 接收返回 Promise 的动态 import，webpack 自动把 Home 拆成独立 chunk
const Home = lazy(() => import(/* webpackChunkName: "home" */ './pages/Home'))
const Detail = lazy(() => import(/* webpackChunkName: "detail" */ './pages/Detail'))

// Suspense 兜底：chunk 还没下载完时显示 loading，避免白屏
export default function App() {
  return (
    <Suspense fallback={<div>loading...</div>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/detail" element={<Detail />} />
      </Routes>
    </Suspense>
  )
}
```

### 2. splitChunks 抽离公共库做长效缓存

```javascript
// webpack.config.js —— 把 node_modules 里的第三方库统一抽到 vendors chunk
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all', // 对同步和异步 chunk 都生效
      cacheGroups: {
        vendors: {
          test: /[\\/]node_modules[\\/]/, // 命中第三方依赖
          name: 'vendors', // 抽成一个叫 vendors 的 chunk
          priority: 10, // 优先级高于默认组
        },
      },
    },
  },
  output: {
    // contenthash：内容不变文件名不变，配合 Cache-Control 长缓存
    filename: 'js/[name].[contenthash:8].js',
  },
}
```

### 3. 多入口手动分割（了解即可，现多被 splitChunks 取代）

```javascript
// webpack.config.js
module.exports = {
  entry: {
    app: './src/app.js', // 业务代码
    vendor: './src/vendor.js', // 手动把基础库放 vendor 入口
  },
  output: {
    filename: '[name].[contenthash:8].js',
  },
}
```

### 4. 验证分割结果

```bash
# 构建后列出产物，预期看到多个 chunk 而非单一大包
npx webpack --mode production
ls dist/js
#   vendors.3a1b.js   ← react 等第三方
#   home.9c2d.js      ← 首页懒加载块
#   detail.7e4f.js    ← 详情页懒加载块
#   app.1f0a.js       ← 入口主块
```

## 08 · 构建提速与产物体积优化清单

@id
webpack-optimize

@level
高级

@freq
3

@tags
构建优化 | 体积优化 | 缓存

@ask
最后聊聊优化：构建速度慢、产物体积大，你一般从哪些方向去优化？给一份你的实战清单。

@oral
**先说结论**：构建提速和体积优化是两个维度，但经常被一起问。提速针对「开发者等编译」的痛点，体积针对「用户等加载」的痛点。我的思路是：提速靠缓存 + 缩小处理范围 + 并行；体积靠 Tree Shaking + 分割 + 压缩 + 按需。两者都绕不开「缓存」这个杠杆。

**再说原理（提速）**：第一招持久化缓存——webpack 5 的 `cache.type: 'filesystem'`，把模块编译结果落盘，二次构建直接读，冷启动到热构建差距巨大；第二招缩小范围——`module.rules` 里给 loader 加 `include` 只编译 src、`resolve.extensions` 别列太多、`resolve.modules` 别层层往上找；第三招并行——`thread-loader` 把重 loader 丢到 worker 池，或上 SWC/esbuild 替代 babel。还有 `oneOf` 让规则命中即停、不继续匹配。

**再说原理（体积）**：除了前面说的 Tree Shaking + 动态 import + splitChunks，还有压缩——production 用 Terser 删死代码、用 `CssMinimizerPlugin` 压 CSS；图片走 `asset` 模块 + 压缩插件或转 base64 内联小图；externals 把不常变的库（如 Vue）走 CDN，不进 bundle；最后 `compression-webpack-plugin` 出 gzip/brotli 让服务器直接发压缩包。

**真实排查**：我们一次构建从 8s 涨到 90s，用 speed-measure 发现是某个新加的 svg loader 对每个图标全量解析。加 `include` 限定目录 + 开 filesystem cache 后回到 12s。体积方面，首屏 3MB，查出是 moment 把全部 locale 打进来了，换成 day.js 并干掉 locale，直接砍掉 700KB。

**边界取舍**：thread-loader 有进程通信开销，小项目反而更慢；CDN externals 增加了一条外部请求、且要处理版本。没有银弹，要按项目体量取舍。

**收尾**：把「提速三板斧（缓存/范围/并行）+ 体积四件套（摇树/分割/压缩/按需）」抛出来，再带一个真实排查，这题就立住了。

@points
提速与体积是两个维度：前者服务开发者编译等待，后者服务用户加载等待
提速三板斧：filesystem 持久缓存、缩小 loader/include 与 resolve 范围、thread-loader/esbuild 并行
体积四件套：Tree Shaking、动态 import 分割、Terser/CSS 压缩、externals/CDN 与图片内联
真实抓手：speed-measure 定位慢点、bundle 分析工具找膨胀依赖
边界：thread-loader 有开销、externals 增加外部请求，按体量取舍

@steps
先把「提速 vs 体积」两个目标分开，避免混着答
提速：filesystem cache、include 缩小范围、oneOf、thread-loader/esbuild
体积：Tree Shaking、splitChunks、Terser/CssMinimizer、externals、图片处理
给真实排查：speed-measure 定位慢 loader、moment locale 膨胀
补压缩：compression-webpack-plugin 出 gzip/brotli
收尾强调缓存杠杆与按体量取舍

@followups
webpack 5 的 filesystem 缓存存在哪、为什么快？——存 node_modules/.cache，按内容 hash 做 key，二次构建跳过已编译模块
thread-loader 一定更快吗？——不一定，进程通信有开销，只有重 loader（babel/ts）且项目大时才划算
怎么分析到底是哪个依赖让包变胖？——用 webpack-bundle-analyzer 看可视化图谱，或 size-report 找 Top N

@example
### 1. 构建提速：持久化缓存 + 缩小范围 + 并行

```javascript
// webpack.config.js —— 提速三板斧集中在配置里
const path = require('path')
const os = require('os')
module.exports = {
  // ① 持久化缓存：二次构建直接读盘，冷→热差距巨大
  cache: {
    type: 'filesystem', // webpack 5 内置，存到 node_modules/.cache/webpack
    buildDependencies: { config: [__filename] }, // 配置变了也失效重编
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        // ② 缩小范围：只编译 src，node_modules 跳过
        include: path.resolve(__dirname, 'src'),
        // oneOf：命中第一条就停，不再往下匹配，省时间
        oneOf: [
          { resourceQuery: /worker/, use: ['worker-loader'] },
          { use: ['babel-loader'] },
        ],
      },
      // ③ 并行：把重的 babel 丢到 worker 池（大项目才划算）
      { test: /\.ts$/, use: ['thread-loader', 'babel-loader'] },
    ],
  },
  resolve: {
    // 别列太多后缀、别层层往上找，减少解析试探
    extensions: ['.js', '.ts'],
    modules: [path.resolve(__dirname, 'src'), 'node_modules'],
  },
}
```

### 2. 体积优化：压缩 + 抽离 + 按需

```javascript
// webpack.config.js —— 体积四件套
const TerserPlugin = require('terser-webpack-plugin')
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin')
const CompressionPlugin = require('compression-webpack-plugin')

module.exports = {
  mode: 'production',
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin(), // 删死代码、压 JS
      new CssMinimizerPlugin(), // 压 CSS
    ],
    splitChunks: { chunks: 'all' }, // 公共依赖抽离，配合 contenthash 缓存
  },
  plugins: [
    // 出 gzip/brotli，让服务器直接发压缩包，传输再小一截
    new CompressionPlugin({ algorithm: 'gzip', test: /\.(js|css)$/ }),
  ],
  externals: {
    // 不常变的库走 CDN，不进 bundle（需自行在 html 引入 script）
    vue: 'Vue',
  },
}
```

### 3. 用分析工具定位膨胀来源

```bash
# 安装可视化分析插件
npm i -D webpack-bundle-analyzer

# 构建时自动打开图谱，方块越大说明该模块越胖
npx webpack --mode production
# 同时可配合前面的 size-report 看 Top N 大文件

# 常见膨胀元凶与解法：
#   moment 全量 locale  → 换 day.js 或 moment-locales-webpack-plugin 干掉
#   lodash 全量引入     → 改为 lodash-es + 按需 import，或 babel-plugin-lodash
#   重复打包 react      → splitChunks 把 react 抽 vendors，保证只一份
```

### 4. 一键看构建耗时（定位提速瓶颈）

```bash
# speed-measure-webpack-plugin 包裹配置后，每个 loader/plugin 的耗时一目了然
# 终端输出示例：
#   SMP  ⏱  Loader        babel-loader     took 22.41 s
#   SMP  ⏱  Loader        svg-loader       took 31.10 s   ← 明显异常，优先查
#   SMP  ⏱  Plugin        MiniCssExtract    took 1.20 s
# 一眼锁定最慢的那一环，针对性加缓存/加 include/换更快工具
```
