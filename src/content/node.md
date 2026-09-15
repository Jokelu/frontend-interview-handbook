---
id: node
name: Node.js
en: Server Runtime
icon: server
color: #3c873a
order: 7
desc: 事件循环、流与中间件、部署与排查，用来证明全栈落地能力。
---

## 01 · Node 的事件循环和浏览器有什么不同，六个阶段是什么

@id
node-event-loop

@level
高级

@freq
3

@tags
事件循环 | libuv | 阶段

@ask
你先说说 Node 的事件循环和浏览器里的事件循环有什么不一样？libuv 那六个阶段你能讲清楚吗？macro task 和 micro task 在 Node 里又是怎么排的？

@oral
**先说结论**：Node 和浏览器的事件循环都是「单线程 + 异步队列」模型，但 Node 底下多了一层 libuv，它把异步任务拆成六个阶段、按固定顺序一轮一轮地跑，跟浏览器那种「宏任务 + 微任务」相对扁平的模型不完全一样。理解了这点，很多 `setTimeout` 和 `setImmediate` 谁先谁后的面试题就迎刃而解了。

**再说原理**：浏览器只有宏任务和微任务两层，微任务队列清空后才取下一个宏任务。Node 的事件循环在 `timers` 阶段跑 `setTimeout/setInterval` 的回调，然后走 `pending callbacks`（处理上一轮延迟的 I/O 回调）、`idle/prepare`（内部使用），接着是最关键的 `poll` 阶段——它处理 I/O 回调并决定要不要阻塞等新的 I/O 到来，`check` 阶段跑 `setImmediate`，最后 `close callbacks` 处理关闭事件。每个阶段跑完，都会先把当前所有微任务（Promise 回调，而 `process.nextTick` 优先级更高）清空，再进入下一阶段。

**真实项目场景**：我做过一个日志上报服务，用 `setImmediate` 把耗时统计放到当前 poll 阶段之后、下一轮之前执行，避免阻塞正常的 I/O 处理；也踩到过 `Promise.resolve().then` 比 `setTimeout(0)` 先执行的情况——这正是因为在阶段切换时微任务会被立刻清空。还有一次排查「定时器不准」，发现是 poll 阶段被长连接撑住一直在等 I/O，导致 timers 阶段迟迟进不去。

**边界取舍**：`setImmediate` 在 check 阶段、`setTimeout(0)` 在 timers 阶段，二者谁先取决于循环是不是刚启动——同一轮循环里 `setImmediate` 通常更稳，因为 check 紧跟在 poll 之后。另外 `process.nextTick` 不在六个阶段里，它有自己独立的队列，每个阶段之间都会被清空，滥用会饿死 I/O 导致事件循环卡死。

**收尾**：把这六个阶段的名字和顺序讲清楚，再补一句「每个阶段之间都会清空微任务队列、nextTick 优先级最高」，基本就够应对这道题了。

@points
libuv 的事件循环分 timers / pending callbacks / idle-prepare / poll / check / close callbacks 六个阶段
每个阶段之间以及阶段内部都会先清空微任务队列，process.nextTick 队列优先级更高且不在六阶段内
timers 阶段跑 setTimeout/setInterval，check 阶段跑 setImmediate，poll 阶段处理 I/O 并决定阻塞时长
浏览器只有宏任务/微任务两层，Node 多了 libuv 的阶段调度，这是二者最大的结构性区别
微任务在阶段切换时立即清空，所以 Promise 回调总在下一个宏任务（如 setTimeout）之前执行

@steps
先点出共同点：都是单线程 + 异步队列，避免被当成只会背名词
讲清 libuv 六个阶段的名字，以及每个阶段各自处理什么回调
强调「每个阶段跑完先清微任务队列」这条最关键的规则
对比浏览器模型，说明 Node 阶段更细、调度更可控
用 setImmediate 与 setTimeout(0) 的先后差异收尾，体现真实落过地

@followups
setImmediate 和 setTimeout(0) 谁先？——同一轮循环里 setImmediate 在 check 阶段通常更稳；若 timers 阶段已过期则 setTimeout 先执行
process.nextTick 属于哪个阶段？——不属于六阶段，它有独立队列，每个阶段之间都会清空，优先级高于 Promise 微任务
Promise.then 为什么总在 setTimeout 前面？——then 是微任务，在每个阶段切换前被清空，而 setTimeout 要等下一轮 timers 阶段才轮到

@example
### 1. 六个阶段的直观演示

```javascript
// 这段代码能直接看出阶段先后顺序：timers → 阶段间清微任务 → check
setTimeout(() => console.log('timers 阶段：setTimeout'), 0)
setImmediate(() => console.log('check 阶段：setImmediate'))

Promise.resolve().then(() => console.log('微任务：Promise.then'))
process.nextTick(() => console.log('nextTick 队列：优先级最高'))

// 典型输出顺序：
// nextTick 队列（最高） → 微任务（Promise） → timers(setTimeout) → check(setImmediate)
// 因为 nextTick 和微任务在进入 timers 之前就已经被清空了
```

### 2. 用 poll 阶段理解 I/O 阻塞

```javascript
const fs = require('fs')

// 读文件是 I/O 回调，会在 poll 阶段执行
fs.readFile(__filename, () => {
  console.log('poll 阶段：文件读完了')
  // 这两个都在“当前轮”之后排队，体现阶段差异
  setTimeout(() => console.log('下一个 timers 阶段'), 0)
  setImmediate(() => console.log('当前轮 check 阶段'))
})

// 运行后你会看到：文件读完 → setImmediate（check）先 → 下一轮 setTimeout（timers）
// 说明 check 阶段紧跟 poll，而 timers 要等下一轮循环
```

### 3. 用 nextTick 制造“饿死”危险的反例

```javascript
// 反例：nextTick 队列永远清不完，poll 阶段永远进不去，I/O 回调得不到执行
function dangerous() {
  process.nextTick(dangerous) // 每清一个又塞一个，事件循环卡死在阶段之间
}
// dangerous() // 千万别在生产代码里这么写，会饿死整个事件循环、请求全挂

// 正例：把递归放进 setImmediate，每轮让出控制权给 I/O 阶段
function safe(i) {
  if (i <= 0) return
  setImmediate(() => safe(i - 1)) // poll 之后才执行，poll 阶段能正常处理别的请求
}
```

## 02 · CommonJS 和 ESM 的差异，Node 里该怎么选

@id
node-module-system

@level
进阶

@freq
3

@tags
CommonJS | ESM | 模块加载

@ask
CommonJS 和 ESM 到底有什么区别？Node 里现在应该默认用哪个？两者混用会有什么问题，你遇到过吗？

@oral
**先说结论**：CommonJS 是 Node 自带的、运行时同步加载的模块系统，走 `require` / `module.exports`；ESM 是语言标准的、解析期静态分析、异步加载的系统，走 `import` / `export`。新项目我默认选 ESM，只在维护老库或写 CLI 时才保留 CJS。

**再说原理**：CJS 的 `require` 是运行时同步读文件、把文件包成函数执行，所以能写在 `if` 里动态加载；ESM 在解析阶段就确定了依赖图，因此支持 tree-shaking、顶层 `await`、循环依赖也更稳。CJS 导出的是 `module.exports` 那个对象引用，循环依赖时会拿到半初始化的对象；ESM 是 live binding（活绑定），循环引用能拿到最终值，不会半路 undefined。

**真实项目场景**：我们 BFF 层用 ESM，配合 `tsx` 直接跑 TS 源码，构建用 esbuild 把没用到的工具函数摇掉，包体积小了一截。升级一个老 CJS 组件库时踩过坑：在 ESM 里 `import pkg from 'xxx'` 拿到的是 `default`，而它真实导出在 `module.exports = {...}` 上，需要用 `import * as pkg` 或确认它有 `export default` 兼容。

**边界取舍**：纯 ESM 包不能被 CJS 用 `require` 直接加载，这是很多库升级的痛点；Node 靠 `.mjs` 或 `package.json` 的 `type: module` 决定用哪个解释器。混用时 CJS 里不能用 `import`，ESM 里想用 `require` 得从 `module.createRequire` 拿。另外 ESM 的 `import` 语法写起来像同步，底层其实是异步加载，模块图解析完才执行。

**收尾**：选型逻辑就是——新项目无脑 ESM，要兼容老生态或写 CLI 才考虑 CJS，混用务必想清 `default` 导出和依赖图解析时机这两层差异。

@points
CJS 运行时同步加载、支持动态 require；ESM 解析期静态分析、支持 tree-shaking 和顶层 await
ESM 是 live binding，循环依赖拿到最终值；CJS 循环依赖拿到半初始化对象，容易踩坑
Node 靠 .mjs 或 package.json 的 type:module 决定解释器，二者默认不互通
ESM 中 default 导出与 CJS 的 module.exports 互操作要小心，import 默认拿到的是 { default }
新项目优先 ESM，老库/CLI 维护可保留 CJS，混用时 require 需 createRequire

@steps
区分两个维度：加载时机（运行 vs 解析）和语法（require vs import）
讲清 CJS 包裹函数执行的机制，解释它为什么能动态 require
对比循环依赖两种表现，这是高频追问点
说清 Node 怎么判断模块类型，以及 ESM 与 CJS 互操作陷阱
给出选型结论：新项目 ESM，老生态 CJS，混用注意 default

@followups
ESM 的 import 是同步还是异步？——语法上写起来像同步，底层是异步加载，模块图解析完才执行，且支持顶层 await
CJS 怎么实现循环依赖不崩？——靠 module.exports 那个对象引用，后加载的能补上属性，但执行顺序错会导致拿到 undefined
Node 怎么知道用哪个解释器？——看文件后缀 .mjs/.cjs 或就近 package.json 的 type 字段，type:module 时 .js 当 ESM

@example
### 1. CommonJS 的包裹与动态加载

```javascript
// Node 会把每个 CJS 文件包成 (function(exports, require, module, __filename, __dirname){ ... })
// 所以 require 是运行时执行，可以写在条件里——这是 ESM 做不到的
function loadLogger(debug) {
  if (debug) {
    return require('./logger-dev') // 运行时才决定加载哪个模块
  }
  return require('./logger-prod')
}

// module.exports 就是那个被导出的对象引用
module.exports = { loadLogger }
```

### 2. ESM 的静态 import 与 live binding

```javascript
// ESM 在解析阶段就确定依赖图，下面的 import 不能写在 if 里
import { loadConfig } from './config.mjs'

// 循环依赖场景：a.mjs 和 b.mjs 互相 import，靠 live binding 拿到最终值
// a.mjs: export let value = 1;（后被 b 改成 2）
// 在 a 里 import { value } from './b.mjs'，拿到的是实时绑定，值为 2
console.log(loadConfig())

// 顶层 await：ESM 独有，CJS 不支持，适合启动期拉配置
const res = await fetch('https://api.example.com/health')
console.log(res.status)
```

### 3. 在 ESM 中兼容加载 CJS 包

```javascript
// 情况 A：CJS 包用 module.exports = {...} 导出
// 用命名空间导入能拿到全部属性
import * as cjsPkg from 'some-cjs-lib'
console.log(cjsPkg.foo)

// 情况 B：想要 default，需要确认包是否写了 export default 兼容层
import cjsDefault from 'some-cjs-lib' // 等价 cjsPkg.default，可能为 undefined

// 情况 C：在 ESM 里要用 require（Node 提供 createRequire 逃生口）
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const oldLib = require('legacy-cjs') // 临时混用老库时使用
```

## 03 · Buffer 是什么，为什么 Node 需要它

@id
node-buffer

@level
进阶

@freq
2

@tags
Buffer | 二进制 | 内存

@ask
说说 Buffer 是什么？为什么浏览器里没有、Node 里却必须有？平常你都在哪些地方用到它？

@oral
**先说结论**：Buffer 是 Node 里专门存二进制数据的一块内存视图，它是 `Uint8Array` 的子类，用来在 JS 里按字节操作数据——因为 JS 原生只有字符串，没有处理 TCP 流、文件字节的能力，而服务端天天跟二进制打交道。

**再说原理**：V8 的 JS 字符串是 UTF-16，处理网络包、图片、压缩流这些原始字节会非常别扭，还可能因为编码不一致而乱码。Buffer 直接指向一块连续内存（堆外 C++ 或堆内），按字节寻址，读写就是 `buf[0]` 这种数组操作。它和 `Uint8Array` 共享内存布局，所以能和 TypedArray 互转，但 Buffer 额外提供了 `toString('utf8')`、`concat`、`allocUnsafe` 这些 IO 友好的方法。

**真实项目场景**：我们做文件上传服务，拿到的是 `Buffer` 分片，拼完再 `fs.writeFile` 落盘；也用 `Buffer.from(base64)` 把前端传来的 base64 头像解码成字节存对象存储；用 `crypto` 做签名时，密钥和待签串都得是 Buffer。曾经因为用 `allocUnsafe` 没清内存，出现过旧数据残留的偶发 bug——这是个很隐蔽的坑。

**边界取舍**：`Buffer.allocUnsafe` 快但可能带脏数据，涉及安全/加密一定要用 `alloc` 或自己 `fill(0)`；大 Buffer 注意它可能走堆外内存，不计入 V8 堆上限，容易被 `--max-old-space-size` 骗过，导致进程 OOM 但堆图看着正常。排查内存时要看进程的常驻集（RSS）而不是只看堆快照。

**收尾**：记住 Buffer = 二进制字节视图、是 Uint8Array 子类、IO 场景无处不在，安全性上别用不安全分配、排查 OOM 别漏掉堆外内存，这道题就讲透了。

@points
Buffer 是 Node 处理二进制字节的视图，继承自 Uint8Array，操作的是连续内存而非字符串
JS 原生无字节能力，服务端要处理网络流/文件/加密，所以必须有 Buffer
Buffer 默认可能指向堆外内存，读写按字节，避免 UTF-16 字符串处理二进制的乱码与低效
allocUnsafe 不初始化内存，安全/加密场景须用 alloc 或手动 fill(0)
大 Buffer 占用堆外内存，不计入 V8 堆上限，排查 OOM 要把常驻集也算进去

@steps
先定义：Buffer 是二进制字节视图，不是字符串
讲清为什么需要它：JS 字符串是 UTF-16，处理原始字节会乱码且低效
说明与 Uint8Array 的关系和额外提供的 IO 方法
列出真实用到 Buffer 的地方：文件、base64、crypto
点出安全和内存边界：allocUnsafe 脏数据、堆外内存 OOM

@followups
Buffer 和 Uint8Array 什么关系？——Buffer 是 Uint8Array 的子类，共享内存布局，可互转，但 Buffer 多了字符串编解码等方法
allocUnsafe 为什么快又有风险？——跳过内存清零所以快，但可能读到上一次使用的残留数据，加密/敏感数据禁用
Buffer 算在 V8 堆内存里吗？——不一定，可能走堆外内存，所以堆快照看不到，OOM 要单独看进程常驻集 RSS

@example
### 1. 字符串与 Buffer 的编解码

```javascript
// 字符串 → Buffer：按指定编码把字符变成字节
const buf = Buffer.from('你好', 'utf8')
console.log(buf) // <Buffer e4 bd a0 e4 bd a0> 每个汉字 3 字节（UTF-8）

// Buffer → 字符串：按编码还原，编码写错就会乱码
console.log(buf.toString('utf8')) // 你好

// 错误示范：用 latin1 去读 utf8 字节，得到乱码字符串
console.log(Buffer.from('你好').toString('latin1')) // ä½ å¥½
```

### 2. 处理分片上传的字节拼接

```javascript
const fs = require('fs')

// 前端一片片传过来，服务端把每片 Buffer 收齐再落盘
function saveChunks(chunks) {
  // concat 把多个 Buffer 拼成一个连续的，比字符串 += 快且不会乱码
  const all = Buffer.concat(chunks)

  // 用 alloc 而非 allocUnsafe，确保没有上次的残留脏数据
  const safe = Buffer.alloc(all.length)
  all.copy(safe)
  fs.writeFileSync('./upload/video.mp4', safe)
}

// 解码前端 base64 头像：base64 本质就是字节的一种文本编码
const b64 = 'iVBORw0KGgoAAAANS...' // 前端传来的 base64
const imgBuf = Buffer.from(b64, 'base64') // 直接转成图片字节
```

### 3. crypto 签名必须用 Buffer

```javascript
const crypto = require('crypto')

// 待签字符串和密钥都先转成 Buffer，避免两端编码不一致导致签名对不上
const secret = Buffer.from('my-secret-key', 'utf8')
const payload = Buffer.from('orderId=123&amount=99', 'utf8')

const hmac = crypto.createHmac('sha256', secret)
hmac.update(payload)
const sign = hmac.digest('hex') // 64 位十六进制签名
console.log(sign)

// 涉及密钥/令牌时禁用 allocUnsafe，防止残留密钥字节被泄露
// const danger = Buffer.allocUnsafe(32) // 可能残留上次的密钥
```

## 04 · Stream 与背压：怎么优雅地处理大文件

@id
node-stream

@level
高级

@freq
3

@tags
Stream | 背压 | 大文件

@ask
大文件处理你用什么方式？Stream 和直接 readFile 有什么差别？背压（backpressure）是什么，怎么处理？

@oral
**先说结论**：大文件绝不能用 `readFile` 一次性读进内存，要用 Stream 边读边处理；Stream 的核心难点是「生产快、消费慢」导致的背压，不处理会让内存暴涨甚至 OOM。

**再说原理**：`fs.createReadStream` 返回可读流，数据按 chunk 流向可写流，`pipe` 内部已经帮我们做了背压——可写流消费不过来时会返回 false 并触发 `drain` 事件，可读流自动暂停，等可写流 `write` 返回 true 再继续。背压本质是「流速不匹配时，用暂停/恢复来反压上游」，把生产速度压到和消费速度匹配。

**真实项目场景**：我们做日志归档，一个 8GB 的 nginx 日志，用 `readFile` 直接 OOM 进程崩了；改成 `createReadStream` 配合 `zlib.createGzip` 管道压缩，内存稳定在几十 MB。也写过自定义 Transform 流做逐行解析和字段脱敏，边读边写，处理完一个 20GB 的访问日志机器毫无压力。

**边界取舍**：`pipe` 自动背压适合绝大多数场景，省心；自己写 `data` 事件监听时，必须手动判断 `write` 返回值并调 `pause/resume`，否则背压失效、内存照样爆。ObjectMode 流（chunk 是对象而非 Buffer）适合 ETL 管道，但吞吐不如字节流，节点多时开销明显。

**收尾**：记住「Stream = 流式、低内存、可组合」，背压交给 pipe 或手写 pause/resume，再配合 Transform 做压缩/脱敏，大文件处理基本就稳了。

@points
readFile 一次性把文件读进内存，大文件直接 OOM；Stream 按 chunk 流式处理，内存恒定
背压是消费速度跟不上生产速度时，通过暂停可读流反压上游，防止内存堆积
pipe 内部已自动处理背压：可写流 write 返回 false 触发暂停，drain 后恢复
手动监听 data 事件必须自己判断 write 返回值并 pause/resume，否则背压失效
Transform / ObjectMode 流适合做管道化的 ETL、压缩、脱敏等中间处理

@steps
先对比 readFile 与 Stream 的内存差异，点出 OOM 风险
解释背压概念：流速不匹配时的反压机制
讲清 pipe 如何自动背压（drain / write 返回值）
给出手动处理背压的写法，对比自动方案的取舍
举 Transform 流做压缩/脱敏的真实场景收尾

@followups
pipe 会自动处理背压吗？——会，可写流 write 返回 false 时可读流暂停，drain 事件后恢复
手动监听 data 怎么防内存爆？——每次 write 返回 false 就 pause，监听可写流 drain 再 resume
ObjectMode 流是什么？——chunk 是对象而非 Buffer，适合 ETL 管道，但吞吐低于字节流

@example
### 1. 错误示范 vs 正确的流式压缩

```javascript
const fs = require('fs')
const zlib = require('zlib')

// 反例：8GB 文件直接读进内存，V8 堆瞬间被打满 → 进程 OOM 崩溃
// fs.readFile('./huge.log', (err, buf) => { ... })

// 正例：用 pipe 把「读 → 压缩 → 写」串成流，内存只在几十 MB 波动
fs.createReadStream('./huge.log') // 可读流，按 chunk 吐数据
  .pipe(zlib.createGzip()) // 转换流：边读边压缩
  .pipe(fs.createWriteStream('./huge.log.gz')) // 可写流：落盘
  .on('finish', () => console.log('压缩完成，内存几乎没涨'))
```

### 2. 手写背压（不用 pipe 时）

```javascript
const fs = require('fs')

// 手动监听 data 时，必须自己处理背压，否则还是会内存爆
function copyWithBackpressure(src, dst) {
  const rs = fs.createReadStream(src)
  const ws = fs.createWriteStream(dst)

  rs.on('data', (chunk) => {
    // write 返回 false 说明可写流缓冲区满了，必须暂停上游
    if (!ws.write(chunk)) {
      rs.pause() // 反压：让可读流先别吐数据
      ws.once('drain', () => rs.resume()) // 缓冲区腾空后再恢复
    }
  })
  rs.on('end', () => ws.end())
}

copyWithBackpressure('./a.bin', './b.bin')
```

### 3. 自定义 Transform 流做逐行脱敏

```javascript
const { Transform } = require('stream')

// 把每行日志里的手机号打码，边读边写，不占内存
const maskPhone = new Transform({
  transform(chunk, enc, cb) {
    const text = chunk.toString()
    const masked = text.replace(/1\d{10}/g, '1**********') // 简单打码
    cb(null, masked) // 处理后的 chunk 交给下游
  },
})

fs.createReadStream('./access.log')
  .pipe(maskPhone)
  .pipe(fs.createWriteStream('./access.masked.log'))
```

## 05 · Koa 洋葱模型 / Express 中间件原理，手写一个

@id
node-middleware

@level
手写题

@freq
3

@tags
中间件 | 洋葱模型 | compose

@ask
Koa 的洋葱模型和 Express 中间件有什么区别？你能手写一个 compose 把中间件串起来吗？

@oral
**先说结论**：Express 是线性执行，下一个中间件靠 `next()` 进入，但进去后回不来，没法在「响应之后」统一做事；Koa 的洋葱模型用 `async/await` 把中间件包成层层嵌套，能在 `await next()` 前后都插逻辑，所以可以做统一的错误处理、耗时统计。

**再说原理**：洋葱模型本质是「函数组合 + 递归」。compose 接收一个中间件数组，返回 `dispatch(i)`：先取第 i 个，调用时把 `ctx` 和一个「调用下一个」的 next 传进去；`await next()` 内部递归 `dispatch(i+1)`。这样执行顺序就是 1→2→3→3→2→1，像穿过洋葱一样一层层进去再一层层出来。

**真实项目场景**：我们 BFF 层用 Koa，写了一个 `errorHandler` 包在最外层 try/catch 统一返回 500；一个 `responseTime` 在 `await next()` 前后打点算耗时；还有 `auth` 中间件在 next 前校验 token。这些都依赖洋葱的「前后都能插手」特性——Express 里想在这些时机统一做事就很别扭。

**边界取舍**：Express 的中间件不是严格洋葱，res.send 之后控制权很难回到前面的中间件，只能靠事件或封装；Koa 的 compose 要求中间件必须 `await next()`，漏写会卡住后续。手写版还要注意 koa-compose 对同一个 next 被重复调用的防御——重复放行会导致下游执行两次。

**收尾**：能手写 compose + 讲清 1-2-3-3-2-1 执行顺序，并点出「必须 await next、防重复调用」这两个坑，这道题就过关了。

@points
Express 中间件线性执行，next() 进入下一个后难以回到前面；Koa 用 async/await 实现洋葱模型
洋葱模型 = 函数组合 + 递归 dispatch，执行顺序是 1→2→3→3→2→1
compose 核心是 dispatch(i)：调用第 i 个中间件，传入 ctx 和递归调用 dispatch(i+1) 的 next
Koa 中间件必须在 next 前 await，否则后续不执行；koa-compose 会防御 next 被重复调用
洋葱模型适合统一错误处理、耗时统计、鉴权等「前后都要插手」的逻辑

@steps
先对比 Express 与 Koa 的执行差异，点出洋葱模型的优势
解释洋葱是递归函数组合，给出 1-2-3-3-2-1 的直觉
手写 compose：dispatch(i) 取中间件并传入 next
next 内部递归 dispatch(i+1)，用 Promise 串起异步
提醒漏写 await next、重复调用 next 的坑，收尾

@followups
为什么 Koa 能前后都执行而 Express 难？——Koa 中间件 return 的是 Promise，await next() 前后都能写；Express 调 next 后控制权单向流动
compose 里 next 重复调用会怎样？——koa-compose 用标记位抛错，防止一个中间件被多次放行导致下游执行两遍
如果不写 await next 会怎样？——后面的中间件永远不执行，请求卡住，这是最常见手写错误

@example
### 1. 手写 Koa 风格 compose

```javascript
// 中间件格式：(ctx, next) => Promise
// compose 把数组串成洋葱：依次 dispatch(0), dispatch(1) ...
function compose(middlewares) {
  return function (ctx) {
    // 递归执行第 i 个中间件，next 就是「调用下一个」
    function dispatch(i) {
      const fn = middlewares[i]
      if (!fn) return Promise.resolve() // 没有下一个就结束
      // 关键：把 dispatch(i+1) 作为 next 传给当前中间件
      return Promise.resolve(fn(ctx, () => dispatch(i + 1)))
    }
    return dispatch(0)
  }
}

// 测试：观察执行顺序，应当输出 1 2 3 4 5 6
const ms = [
  async (ctx, next) => { console.log(1); await next(); console.log(6) },
  async (ctx, next) => { console.log(2); await next(); console.log(5) },
  async (ctx, next) => { console.log(3); await next(); console.log(4) },
]
compose(ms)({}) // 这就是洋葱：进去 123，出来 456
```

### 2. 带 ctx 和错误捕获的真实中间件

```javascript
// 最外层错误处理中间件：包住所有下游，统一异常响应
async function errorHandler(ctx, next) {
  try {
    await next()
  } catch (err) {
    ctx.status = 500
    ctx.body = { error: err.message } // 下游任何异常都能在这里兜住
  }
}

// 耗时统计：next 前后打点，体现洋葱「前后都插手」
async function responseTime(ctx, next) {
  const start = Date.now()
  await next()
  ctx.responseTime = Date.now() - start // 穿过洋葱后记录耗时
  console.log(`耗时 ${ctx.responseTime}ms`)
}

// 鉴权：next 之前校验，不通过就抛错被 errorHandler 接住
async function auth(ctx, next) {
  if (!ctx.token) throw new Error('未登录')
  await next() // 通过才放行下游
}
```

### 3. 用 compose 串起上面的中间件

```javascript
// 把中间件按顺序组合，errorHandler 必须放最外层才能 catch 到下游异常
const app = compose([errorHandler, responseTime, auth])

// 模拟一次请求上下文
const ctx = { token: 'abc123', status: 200, body: null }
app(ctx).then(() => console.log('请求处理完，status=', ctx.status))
// 若把 ctx.token 设为空，errorHandler 会捕获 auth 抛出的错误并设 500
```

## 06 · 多进程与多线程：cluster 和 worker_threads 怎么用

@id
node-cluster-worker

@level
高级

@freq
2

@tags
cluster | worker_threads | CPU密集

@ask
Node 是单线程的，那多核 CPU 怎么利用？cluster 和 worker_threads 有什么区别，实际怎么选？

@oral
**先说结论**：单进程单线程确实浪费多核，Node 用 `cluster` 开多个进程、用 `worker_threads` 开多个线程来利用多核；前者适合多实例分摊 HTTP 流量，后者适合在单进程内并行跑 CPU 密集任务。

**再说原理**：cluster 通过 `fork` 出多个子进程，每个都跑同一份代码，由 master 监听端口、用轮询把连接分发给 worker，进程间靠 IPC 通信，崩溃一个不影响其他，还能零停机重启。worker_threads 是同一进程内的多线程，共享进程内存地址空间，线程间用 `postMessage` 传结构化克隆的数据，适合把加密、压缩、大 JSON 解析这些阻塞主线程的活丢给 worker。

**真实项目场景**：我们线上 API 服务用 PM2 cluster 模式起了 8 个 worker 吃满 8 核；另有一个报表导出接口要对几十万行做聚合，原本卡主线程，改成 `worker_threads` 后主线程还能正常响应其他请求。也用 `Atomics` + `SharedArrayBuffer` 在两个 worker 间共享计数器，避免频繁 postMessage 拷数据。

**边界取舍**：cluster 每个进程独立内存，没法直接共享大对象，要用 Redis 之类外部存储；worker_threads 共享内存但要自己处理竞争（用 Atomics）。IO 密集别上 worker_threads，它解决的是 CPU 密集，cluster 解决的是「多实例分摊连接」。把 worker_threads 当成解决 IO 并发的手段是常见误区。

**收尾**：IO 多实例用 cluster / PM2，进程内 CPU 密集用 worker_threads，别把两者用反场景，这是选型的关键。

@points
cluster 是多进程，master fork 出多个 worker 共享端口、轮询分发连接，崩溃隔离、可热重启
worker_threads 是单进程内多线程，共享内存地址空间，用 postMessage 传数据
cluster 适合多实例分摊 HTTP 流量；worker_threads 适合进程内并行 CPU 密集任务
cluster 各进程内存独立，共享状态需外部存储（如 Redis）；worker 可用 SharedArrayBuffer 共享
IO 密集用 cluster 即可，worker_threads 只为把阻塞主线程的 CPU 活挪走

@steps
先点明单线程浪费多核，引出两种并行手段
讲清 cluster 的 fork + master 分发 + IPC + 进程隔离
讲清 worker_threads 的线程模型、postMessage 与共享内存
对比两者适用场景：多实例 vs 进程内 CPU 密集
给真实选型：IO 用 cluster/PM2，CPU 用 worker_threads

@followups
cluster 和 worker_threads 最大区别？——前者多进程内存隔离靠 IPC，后者同进程可共享内存；cluster 管多实例，worker 管进程内并行
worker_threads 怎么和主线程通信？——postMessage 传结构化克隆数据，或用 SharedArrayBuffer + Atomics 共享
cluster 下 session 存哪？——不能存进程内存，要放 Redis 等外部存储，否则请求被分到别的 worker 就读不到

@example
### 1. cluster 多进程起服务

```javascript
const cluster = require('cluster')
const os = require('os')
const http = require('http')

// master 进程负责 fork 和分发，worker 负责处理请求
if (cluster.isMaster) {
  const cpus = os.cpus().length
  for (let i = 0; i < cpus; i++) {
    cluster.fork() // 每个 worker 都跑这段文件，但走下面的 else 分支
  }
  cluster.on('exit', (w) => {
    console.log(`worker ${w.process.pid} 挂了，重启一个`) // 进程崩溃自动拉起
    cluster.fork()
  })
} else {
  http
    .createServer((req, res) => {
      res.end(`由 worker ${process.pid} 处理`) // 多核各自响应连接
    })
    .listen(3000)
}
```

### 2. worker_threads 跑 CPU 密集任务

```javascript
const { Worker } = require('worker_threads')

// 主线程：把大计算丢给 worker，自己继续处理别的请求不被阻塞
const worker = new Worker(`
  const { parentPort } = require('worker_threads')
  let sum = 0
  for (let i = 0; i < 5e8; i++) sum += i // 模拟耗时聚合
  parentPort.postMessage(sum) // 计算完回传结果
`, { eval: true })

worker.on('message', (result) => {
  console.log('计算结果：', result) // 主线程没被这次重计算卡住
})
```

### 3. 线程间共享内存（SharedArrayBuffer）

```javascript
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads')

if (isMainThread) {
  // 主线程分配一块可被多个 worker 共享的内存
  const sab = new SharedArrayBuffer(4) // 4 字节，放一个 int32
  const worker = new Worker(__filename, { workerData: sab })
  worker.on('message', () => {
    const view = new Int32Array(sab)
    console.log('共享计数：', view[0]) // 读到的就是 worker 改过的值
  })
} else {
  const view = new Int32Array(workerData)
  Atomics.add(view, 0, 1) // 用 Atomics 保证多 worker 并发安全
  parentPort.postMessage('done')
}
```

## 07 · 大文件上传与断点续传的服务端实现

@id
node-large-upload

@level
场景题

@freq
3

@tags
分片上传 | 断点续传 | 秒传

@ask
大文件上传你们服务端怎么设计的？断点续传和秒传怎么做？分片合并要注意什么？

@oral
**先说结论**：大文件上传核心是「前端分片 + 服务端按唯一标识存分片 + 合并」，断点续传靠「已传分片清单」跳过，秒传靠「文件 hash 命中已存在资源」。

**再说原理**：前端把文件切 5MB 一片，算出整个文件的 hash（如 spark-md5），每片带着 `fileHash + index` 上传。服务端先查这个 `fileHash` 在不在——在就直接返回「已存在」实现秒传；不在就按分片落盘到临时目录。续传时前端先问「哪些片你有了」，只补传缺失的。所有片到齐后，按 index 顺序读取分片 `append` 合成一个文件，再校验总大小/hash。

**真实项目场景**：我们视频平台就这么做的，上传 2GB 视频断网后能接着传，体验比一次性上传好太多。合并用流式 `createReadStream` 按顺序 pipe 进一个可写流，避免整文件进内存；还做了「分片过期清理」定时任务，防止半截文件占满磁盘。秒传让我们热门视频重复上传时几乎零成本。

**边界取舍**：hash 计算放前端会卡 UI，可放 Web Worker，或先取「文件头+大小+尾」的秒级假 hash 跑流程、上传完再补真 hash。合并要防并发合并和越界 index；分片建议加唯一上传 id 防止不同文件同 hash 冲突（理论碰撞极低但要有兜底）。另外分片大小要在网络开销和请求数之间权衡，太小请求太多、太大容错差。

**收尾**：把「hash 寻址 + 分片落盘 + 清单续传 + 流式合并」四步讲清，再加秒传与清理，这道题就扎实了。

@points
前端分片（如 5MB）+ 全文件 hash 寻址，是断点续传和秒传的共同基础
秒传：服务端按 fileHash 查重，命中直接返回已完成，免重复存储
续传：前端先拉「已上传分片清单」，只补传缺失片，用 fileHash+index 定位
合并：按 index 顺序流式 append 合成，避免整文件进内存；合并后校验大小/hash
分片需唯一上传上下文防 hash 冲突兜底，并做过期清理防半截文件堆积

@steps
讲清整体链路：前端分片 + hash 寻址 + 服务端落盘
说明秒传：fileHash 命中即返回，省存储与带宽
说明续传：清单比对，只补缺失分片
讲合并：按序流式 append，校验完整性
补边界：hash 计算位置、并发合并防护、分片清理

@followups
秒传和续传用的 hash 一样吗？——都用 fileHash 寻址；秒传查全量是否存在，续传查已有哪些分片
合并时整文件会进内存吗？——不会，用可读流按序 pipe 进可写流，内存恒定
hash 冲突怎么办？——理论极低，兜底用「上传会话 id + 分片 index」隔离，合并后校验总 hash

@example
### 1. 服务端：分片接收与秒传/续传查询

```javascript
const fs = require('fs')
const path = require('path')

const TMP = './uploads/tmp' // 分片临时目录
fs.mkdirSync(TMP, { recursive: true })

// 秒传 + 续传清单：前端先问「这个 fileHash 还差哪些片」
function checkExist(fileHash, total) {
  // 秒传：合并目录里已有最终文件就直接成功，免重复存储
  if (fs.existsSync(`./uploads/${fileHash}`)) {
    return { uploaded: true, done: true }
  }
  // 续传：收集已存在的分片序号，告诉前端只补这些之外的
  const uploaded = []
  for (let i = 0; i < total; i++) {
    if (fs.existsSync(path.join(TMP, `${fileHash}-${i}`))) uploaded.push(i)
  }
  return { uploaded, done: false }
}

// 接收单个分片：以 fileHash-index 命名落盘，方便后续按序拼回
function saveChunk(fileHash, index, chunkBuffer) {
  fs.writeFileSync(path.join(TMP, `${fileHash}-${index}`), chunkBuffer)
}
```

### 2. 服务端：按序流式合并

```javascript
const fs = require('fs')
const path = require('path')

// 所有分片到齐后，按 index 顺序流式合并，避免整文件进内存
function mergeChunks(fileHash, total, dest) {
  return new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(dest)
    let i = 0

    function next() {
      if (i >= total) {
        ws.end()
        // 合并完删掉分片，释放临时空间
        for (let k = 0; k < total; k++) {
          fs.unlinkSync(path.join('./uploads/tmp', `${fileHash}-${k}`))
        }
        return resolve('merged')
      }
      const chunkPath = path.join('./uploads/tmp', `${fileHash}-${i}`)
      // 按序把分片 pipe 进最终文件，一片读完再读下一片
      fs.createReadStream(chunkPath)
        .on('end', () => { i++; next() })
        .pipe(ws, { end: false })
    }
    ws.on('error', reject)
    next()
  })
}
```

### 3. 定时清理半截分片（防空间堆积）

```javascript
const fs = require('fs')
const path = require('path')

// 每天跑一次：删掉超过 24 小时还没合并的分片，防止断网用户的碎片永远占着磁盘
function cleanStaleChunks() {
  const dir = './uploads/tmp'
  const now = Date.now()
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const stat = fs.statSync(p)
    if (now - stat.mtimeMs > 24 * 3600 * 1000) fs.unlinkSync(p)
  }
}
setInterval(cleanStaleChunks, 24 * 3600 * 1000)
```

## 08 · Node 服务的内存泄漏与性能排查怎么做

@id
node-memory-performance

@level
高级

@freq
2

@tags
内存泄漏 | 性能排查 | 火焰图

@ask
你的 Node 服务线上变慢或者内存涨不停，你怎么排查？能讲讲火焰图怎么用吗？

@oral
**先说结论**：先靠监控看是内存涨还是 CPU 高，再针对性抓：内存问题用堆快照对比找「谁在一直涨」，CPU 问题用 `--prof` 或 0x 抓火焰图看热点函数在哪。

**再说原理**：内存泄漏是「该回收的对象引用链没断」。用 `node --inspect` 打开 DevTools 手动点快照，或代码里 `v8.getHeapSnapshot()` 落盘，对比两次快照的 Retained Size 增长，定位是哪个对象在涨（常见：全局缓存无限增长、闭包引用大对象、未解绑的 listener、Timer 没 clear）。CPU 排查用 `node --prof app.js` 生成日志，再用 0x 或 flamegraph 工具生成火焰图，横向越宽说明占用越多。

**真实项目场景**：我们有个服务内存每天涨 200MB，对比快照发现是一个 `Map` 缓存用户会话从不淘汰，改成 LRU（上限 + 过期）后稳定。还有次接口慢，火焰图显示 `JSON.parse` 占了一半，定位到一个 10MB 的大报文每次请求都全量解析，改成流式按需解析后 P99 降了 70%。

**边界取舍**：生产机不能一直开 inspect，用 `kill -USR2` 触发一次性 heapdump 最稳；`--prof` 有性能损耗，只在线下或短暂采样。注意 Buffer 走堆外内存，堆快照看不到，要看进程常驻集 RSS。火焰图横向宽度代表该函数及其子调用占用的 CPU 时间比例，找最宽的函数优先优化。

**收尾**：内存看快照对比 + 引用链，CPU 看火焰图热点，这两板斧基本能定位大部分线上性能问题。

@points
内存问题：对比两次 heap snapshot，看 Retained Size 增长，定位「该回收却活着」的对象
常见泄漏源：无限增长的全局缓存、闭包持有大对象、未解绑 listener、未 clear 的 Timer
CPU 问题：node --prof 生成日志，配合 0x/flamegraph 出火焰图，横宽=热点函数
生产环境用 kill -USR2 触发一次性 heapdump，避免长期开 inspect 影响性能
Buffer 占堆外内存，堆快照看不到；排查 OOM 要把常驻集也算上

@steps
先看监控区分是内存涨还是 CPU 高，决定走哪条路
内存：开 inspect 或代码落 heap snapshot，对比两次找增长点
顺着 Retained Size 定位泄漏对象，复盘引用链为何断不掉
CPU：--prof 采样 + 火焰图，找最宽的热点函数
给生产落地的采集方式（USR2 / 短时采样）和真实案例收尾

@followups
堆快照怎么对比看泄漏？——抓两份快照，按 Retained Size 差排序，找一直涨且不释放的对象
火焰图横向宽度代表什么？——该函数及其子调用占用的 CPU 时间比例，越宽越该优化
生产机怎么安全抓快照？——给进程发 kill -USR2，让 heapdump 模块写一次快照，不长期开 inspect

@example
### 1. 代码里主动落堆快照（对比用）

```javascript
const { writeHeapSnapshot } = require('v8')

// 手动触发两次快照，用 Chrome DevTools 对比 Retained Size
function dump(label) {
  const file = writeHeapSnapshot(`./${label}.heapsnapshot`)
  console.log('已生成快照：', file)
}

// 反例：全局 Map 从不淘汰，用户会话一直堆 → 内存只涨不跌
const sessionCache = new Map()
function addSession(id, data) {
  sessionCache.set(id, data) // 没有删除逻辑，典型的泄漏点
}

// 正例：抓两份快照后，会发现 sessionCache 的 retained size 持续增长
dump('before') // 服务启动后立刻抓一份
setTimeout(() => dump('after'), 60 * 1000) // 跑一分钟后抓第二份对比
```

### 2. 用 LRU 修复无限缓存泄漏

```javascript
const { LRUCache } = require('lru-cache') // 或自己实现一个带上限的 Map

// 加容量上限 + 过期时间，内存不再无脑涨
const cache = new LRUCache({ max: 10_000, ttl: 1000 * 60 * 30 })

function addSession(id, data) {
  cache.set(id, data) // 超过 1 万条或 30 分钟自动淘汰最旧的
}
```

### 3. CPU 火焰图采样（线下）

```bash
# 用 --prof 跑服务，生成 isolate-xxx-v8.log 采样日志
node --prof app.js

# 用 0x 工具一键生成可交互火焰图（会自动起本地页面）
# npx 0x app.js

# 或者用官方方式把日志转成可读的 tick 信息
node --prof-process isolate-*.log > tick.txt

# 火焰图里横向最宽的函数就是 CPU 热点，优先优化它
# 常见热点：JSON.parse 大报文、正则回溯、同步大循环
```

## 09 · 进程守护与部署：PM2、Docker 与健康检查

@id
node-deploy

@level
场景题

@freq
2

@tags
PM2 | Docker | 部署

@ask
你的 Node 服务怎么上线部署的？PM2 和 Docker 怎么配合？健康检查怎么做的？

@oral
**先说结论**：我们单体服务用 PM2 cluster 模式兜底进程守护和零停机重启；容器化走 Docker，PM2 只负责进程内管理、容器负责编排；健康检查靠一个 `/healthz` 接口给 K8s/负载均衡探活用。

**再说原理**：PM2 用配置文件 `ecosystem.config.js` 起多个实例、配 `max_memory_restart` 在内存超阈值时把进程拉起、`watch` 关掉避免误重启，还能 `pm2 reload` 做零停机（逐个重启 worker）。Docker 里把 PM2 跑在 `CMD`，用 `pm2-runtime` 让进程退出码正确传递给容器，便于 K8s 重启。健康检查分存活（liveness，挂了就重启）和就绪（readiness，没就绪就不给流量）两种探针。

**真实项目场景**：我们 CI 构建出镜像，部署到 K8s，容器里 `pm2-runtime start ecosystem.config.js`；`/healthz` 检查 DB 连接和 Redis 连接是否可用，K8s 每 10 秒探一次，连不上就摘流量。`max_memory_restart: 1G` 兜住偶发泄漏，避免半夜被 OOM 叫醒。

**边界取舍**：容器里一般不要再开 PM2 cluster（K8s 多副本已解决多实例），否则进程数翻倍难管理；`pm2-runtime` 而非 `pm2` 前台运行，否则容器主进程会立刻退出。健康检查别查太重，别把探活打成压测——一次 `SELECT 1` 加 `ping` 就够了。

**收尾**：PM2 管进程守护、Docker/K8s 管编排、/healthz 管探活，三层各司其职，部署就稳了。

@points
PM2 负责进程守护、cluster 多实例、max_memory_restart 自动拉起、reload 零停机
Docker 内用 pm2-runtime 而非 pm2，保证前台运行且退出码传给容器
K8s 健康检查分 liveness（挂了重启）与 readiness（没就绪不给流量）两类探针
/healthz 应检查核心依赖（DB/Redis）连通性，但别做成重查询避免变压测
容器内一般不开 PM2 cluster，多实例交给 K8s 副本，避免进程数翻倍难管

@steps
先说部署形态：PM2 管进程、Docker 管打包、K8s 管编排
讲 PM2 关键能力：守护、cluster、内存重启、零停机 reload
讲 Docker 里 pm2-runtime 的正确用法与退出码传递
讲健康检查两类探针与 /healthz 实现要点
给生产取舍：容器别重复开 cluster、探活别太重，收尾

@followups
为什么容器里要用 pm2-runtime 而不是 pm2？——pm2 后台运行会让容器主进程立刻退出；runtime 前台跑并转发退出码
liveness 和 readiness 区别？——liveness 失败 K8s 重启容器，readiness 失败只摘流量不重启
max_memory_restart 干什么？——进程内存超阈值自动重启，兜底偶发泄漏防 OOM 半夜告警

@example
### 1. PM2 配置文件

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'fe-interview-api',
    script: 'dist/server.js',
    instances: 'max',              // 吃满所有 CPU 核心
    exec_mode: 'cluster',          // 多进程模式
    max_memory_restart: '1G',      // 内存超 1G 自动重启，兜底泄漏
    watch: false,                  // 生产关掉，避免文件变动误重启
    env_production: {
      NODE_ENV: 'production',
    },
  }],
}
// 启动：pm2 start ecosystem.config.js --env production
// 零停机：pm2 reload fe-interview-api
```

### 2. Dockerfile

```dockerfile
# 用 LTS 版本，体积和稳定性都合适
FROM node:20-alpine

WORKDIR /app
# 先拷依赖清单，利用镜像层缓存，改代码时不用重装依赖
COPY package*.json ./
RUN npm ci --omit=dev

COPY dist ./dist
# pm2-runtime 前台运行，退出码能正确传给容器，K8s 才能感知并重启
CMD ["npx", "pm2-runtime", "start", "ecosystem.config.js", "--env", "production"]
```

### 3. 健康检查接口 + K8s 探针

```javascript
// /healthz：只探核心依赖，不查重逻辑，避免变成压测
app.get('/healthz', async (req, res) => {
  try {
    await db.query('SELECT 1') // 探数据库连通
    await redis.ping()         // 探缓存连通
    res.status(200).json({ ok: true })
  } catch (e) {
    res.status(503).json({ ok: false }) // 503 → K8s 摘流量 / 重启
  }
})
```

```yaml
# k8s 探针（片段）
livenessProbe:
  httpGet: { path: /healthz, port: 3000 }
  initialDelaySeconds: 10
  periodSeconds: 10     # 失败就重启容器
readinessProbe:
  httpGet: { path: /healthz, port: 3000 }
  periodSeconds: 5      # 失败只摘流量，不重启
```

## 10 · BFF 与 Serverless 场景下 Node 的取舍

@id
node-bff-serverless

@level
场景题

@freq
2

@tags
BFF | Serverless | 架构

@ask
你们 BFF 层为什么用 Node？Serverless 场景下 Node 有什么优势和坑？两者怎么取舍？

@oral
**先说结论**：BFF 用 Node 是因为它和前端同语言、能聚合多个后端接口减少前端请求数；Serverless（如函数计算）用 Node 是因为冷启动快、按量付费。但两者都有「长连接/有状态」的坑，要按场景取舍。

**再说原理**：BFF 是「Backend For Frontend」，前端要的数据散落在多个微服务，Node 在中间做聚合、裁剪、协议转换，一次请求拼好返回，减少浏览器瀑布流。Serverless 把运行时交给平台，函数冷启动要重新建连接池，所以要避免在 handler 里反复建长连接，把 DB 连接放到实例级复用，或用连接池 + 预热。Node 的事件循环在冷启动时很轻，比 Java 启动快一个量级。

**真实项目场景**：我们商城前端用 BFF 把「商品 + 库存 + 优惠券」三个接口聚成一个，首屏请求从 5 个降到 1 个。但上 Serverless 后踩过坑：每次冷启动新建 Redis 连接把连接数打爆，改成因实例缓存连接 + 设上限才解决；还有函数超时设太短，大聚合被掐断，前端拿到空数据。

**边界取舍**：BFF 适合「重聚合、轻计算」；如果是重 CPU 或大文件处理，Node 在 Serverless 上不划算，不如常驻容器。Serverless 不适合长连接（WebSocket）、有状态会话，这类还是留在常驻 Node 服务里。冷启动敏感的场景要控制依赖体积、用单文件打包，启动才快。

**收尾**：BFF 用 Node 降请求数，Serverless 用 Node 省钱省运维，但连接管理、有状态、超时这三点是必须提前设计好的边界。

@points
BFF 用 Node：前后端同语言，聚合多后端接口、裁剪字段、协议转换，减少前端请求数
Serverless 用 Node：冷启动快、按量付费、免运维，适合突发/不均衡流量
Serverless 坑：冷启动重复建连接打爆连接池，应实例级复用连接 + 设上限
Serverless 不适合长连接/有状态，WebSocket、会话态放常驻 Node 服务更合适
重 CPU/大文件处理在 Serverless 上不划算，留给常驻容器；Node 适合「重聚合轻计算」

@steps
先定义 BFF 为什么用 Node：同语言 + 聚合降请求
讲 Serverless 的优势：冷启动快、按量付费、免运维
点出 Serverless 的连接管理坑与复用方案
对比不适合 Serverless 的场景：长连接、有状态、重 CPU
给真实取舍与超时/依赖体积边界，收尾

@followups
BFF 和网关有什么区别？——网关偏路由/鉴权/限流等横切，BFF 偏业务聚合与字段裁剪，可叠在网关之后
Serverless 冷启动连接池怎么处理？——把 DB/Redis 连接放模块级缓存复用，冷启动只建一次，并设连接上限
什么不适合放 Serverless？——长连接 WebSocket、需要常驻内存的会话、重 CPU 大文件，这些用常驻容器更稳

@example
### 1. BFF 聚合多个后端接口

```javascript
// 前端只调一次 BFF，BFF 并行聚合三个微服务，减少浏览器瀑布流
async function getProductPage(productId) {
  // Promise.all 并行请求，而不是串行 await，省下等待时间
  const [product, stock, coupon] = await Promise.all([
    fetch(`http://svc-product/${productId}`).then((r) => r.json()),
    fetch(`http://svc-stock/${productId}`).then((r) => r.json()),
    fetch(`http://svc-coupon/${productId}`).then((r) => r.json()),
  ])
  // 裁剪字段，只返回前端真正要用的，减小报文体积
  return {
    title: product.title,
    price: product.price,
    available: stock.count > 0,
    coupon: coupon.amount,
  }
}
```

### 2. Serverless 连接复用（防冷启动打爆连接池）

```javascript
// 反例：每次请求都在 handler 里新建连接 → 冷启动频繁时连接数爆掉
// exports.handler = async () => { const redis = createClient(); ... }

// 正例：把连接挂到模块级，实例生命周期内复用，冷启动只建一次
let redis = null
function getRedis() {
  if (!redis) {
    redis = createClient({ maxRetriesPerRequest: 3 })
    redis.connect()
  }
  return redis // 后续请求直接复用这条连接
}

exports.handler = async (event) => {
  const r = getRedis()
  return await r.get(`page:${event.id}`)
}
```

### 3. Serverless 配置与超时注意

```yaml
# 函数计算 / Lambda 配置片段
functions:
  bffAggregate:
    runtime: nodejs20    # 选 LTS，冷启动友好
    timeout: 10          # 大聚合别设太短，否则被掐断；但也不宜过长
    memorySize: 512      # 内存越大 vCPU 配额越高，冷启动也越快
    # 依赖尽量精简、单文件打包，减小冷启动下载与初始化耗时
```

```bash
# 本地用 serverless 框架模拟运行，验证聚合与连接复用逻辑
npx serverless invoke local -f bffAggregate --data '{"id":"123"}'
```
