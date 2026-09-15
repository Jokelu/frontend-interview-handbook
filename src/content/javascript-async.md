---
id: javascript
name: JavaScript
en: Language Core
icon: braces
color: #d6a400
order: 3
part: 2
desc: 作用域、原型、this、异步与手写题，前端面试的基本盘，必须全部拿下。
---

## 07 · 事件循环：宏任务与微任务到底是怎么执行的

@id
js-event-loop

@level
进阶

@freq
3

@tags
事件循环 | 微任务 | 异步

@ask
你先整体讲一下 JS 的事件循环到底是什么？宏任务和微任务分别有哪些？如果我现在给你一段代码让你说出打印顺序，你打算怎么一步步分析？

@oral
**先给结论**：JS 是单线程，但靠事件循环实现了"非阻塞"。同步代码跑完，先清空所有微任务队列，再取一个宏任务执行，执行完再清空微任务，往复循环——核心规律就是"每轮宏任务之间必清空全部微任务"。

**再说原理**。调用栈执行同步代码，遇到异步 API（setTimeout、Promise.then、queueMicrotask、MutationObserver 等）不会立即执行，而是把回调挂到对应队列。浏览器每轮循环：先执行一个宏任务；执行完立刻把所有微任务依次清空（微任务里新产生的微任务也会在同一轮被清空）；必要时渲染；再取下一个宏任务。所以微任务的优先级永远高于下一个宏任务。

**举个真实场景**：做搜索联想时，用户输入触发防抖请求，请求回来后用 Promise.then 更新视图，这个更新一定在本次事件循环的微任务阶段完成，不会闪；而 setTimeout 1s 的兜底 loading 是宏任务，会被微任务的视图更新插队。还有 Promise 里抛错没 catch，会进微任务队列触发 unhandledrejection，我们在全局做了统一上报。

**边界与取舍**：Node 和浏览器不一样——Node 11 之前 timers/pending/poll/check/close 分阶段，微任务在阶段切换时清空，之后对齐了浏览器"每个宏任务后清微任务"。另外 requestAnimationFrame 既不是宏也不是微，它在渲染前、微任务之后、下一个宏任务之前执行。await 后面的代码等价于 .then 回调，属于微任务。

**收尾**：看到打印顺序题，先排同步，再排微任务，最后排宏任务，基本不会错。

@points
事件循环让单线程 JS 实现非阻塞：同步先跑，异步回调进对应队列
宏任务（setTimeout/setInterval/IO/UI事件/MessageChannel）与微任务（Promise.then/queueMicrotask/MutationObserver）
每执行完一个宏任务，会先把所有微任务清空，再取下一个宏任务
微任务执行中新产生的微任务会在同一轮被继续清空，不会留到下一轮
await 后续代码等价于 .then 微任务；Node 与浏览器在微任务时机上历史上有差异

@steps
先把代码从上到下拆成"同步 / 微任务 / 宏任务"三类，同步直接按出现顺序排
遇到 Promise 构造器里的同步代码立即执行，.then/catch 的回调进微任务队列
每跑完一段同步或一个宏任务，就把当前所有微任务清空（含新产生的）
按"同步 → 微任务 → 宏任务"的节奏逐步推演，遇到 await 把其后代码当作微任务
最后用一段代码在控制台实际跑一遍，验证推演结果是否一致

@followups
async/await 和 Promise.then 在事件循环上有区别吗？——本质一样，await 后面等价于 .then 回调，都进微任务；只是 await 会让出线程一次，再恢复执行后续
requestAnimationFrame 是宏任务还是微任务？——都不是，它在渲染前、微任务之后、下一个宏任务之前执行，属于渲染阶段
Node.js 里 setTimeout 和 setImmediate 谁先执行？——同一轮 IO 回调之后，setImmediate（check 阶段）先于 setTimeout；但首次进入时机不定，外层可能反过来

@example
### 1. 最经典的打印顺序题

```javascript
console.log('1 同步') // 同步，立即执行

setTimeout(() => console.log('2 宏任务'), 0) // 宏任务

Promise.resolve()
  .then(() => console.log('3 微任务')) // 微任务

queueMicrotask(() => console.log('4 微任务')) // 微任务

console.log('5 同步') // 同步，立即执行

// 输出顺序：1 同步 → 5 同步 → 3 微任务 → 4 微任务 → 2 宏任务
// 原因：同步先跑完，然后清空所有微任务，最后才执行 setTimeout 这个宏任务
```

### 2. 微任务里继续产生微任务，也会在同一轮清空

```javascript
Promise.resolve()
  .then(() => {
    console.log('微任务 A')
    Promise.resolve().then(() => console.log('微任务 A-1')) // A 执行时产生的新微任务
  })
  .then(() => console.log('微任务 B'))

setTimeout(() => console.log('宏任务'), 0)

// 输出：微任务 A → 微任务 A-1 → 微任务 B → 宏任务
// 微任务 A-1 虽是在 A 里新加的，仍会在本轮微任务阶段被清空，不会排到宏任务后面
```

### 3. await 的等价转换

```javascript
async function demo() {
  console.log('a 同步')
  await null // 等价于 Promise.resolve(null).then(...)
  console.log('b 微任务') // 这段代码进入微任务队列
}

demo()
Promise.resolve().then(() => console.log('c 微任务'))
console.log('d 同步')

// 输出：a 同步 → d 同步 → b 微任务 → c 微任务
// await 后面的代码被拆成微任务，在本轮同步执行完、微任务阶段运行
```

## 08 · Promise 原理是什么，手写一个符合规范的 Promise

@id
js-promise-impl

@level
手写题

@freq
3

@tags
Promise | 状态机 | 手写

@ask
你能手写一个 Promise 吗？要符合 Promises/A+ 规范，状态只能从 pending 变一次，then 要能链式调用，还要处理异步和值穿透。说说你打算怎么实现？

@oral
**先给结论**：Promise 本质是一个带状态的容器加观察者。三种状态 pending/fulfilled/rejected，状态一旦变更不可逆；then 注册回调，异步回调通过两个队列存储，resolve 后依次执行，并支持链式返回新 Promise。

**再说原理**。构造器里执行 executor，同步调用 resolve/reject 改状态。then 时若已 settled 就异步执行回调，若还是 pending 就把回调存进 onFulfilled/onRejected 数组。then 必须返回新的 Promise 才能实现链式，且回调返回值要经 resolvePromise 解析，能处理 thenable、循环引用、普通值。

**真实项目**：我们封装统一请求层，用 Promise 包裹 fetch，失败自动重试 N 次再抛给调用方；SSR 数据预取里用 Promise.all 聚合多个接口，等全部就绪再渲染。这些都是基于对 Promise 状态机和异步调度本质的理解。

**边界与取舍**：resolve 一个 thenable 要递归展开；then 回调抛错要 reject 新 Promise；onFulfilled/onRejected 不是函数要做值穿透；多次 resolve/reject 以第一次为准。还要注意回调必须异步（微任务）执行，模拟规范顺序。

**收尾**：手写版不追求 100% 通过合规测试，但状态机、异步、链式、值穿透这四点一定是核心，能讲清就过关。

@points
三种状态 pending/fulfilled/rejected，只能由 pending 单向迁移，多次 resolve/reject 以首次为准
then 返回新 Promise，靠它实现链式调用，而不是复用自身
then 传入非函数时做"值穿透"，把值原样传给下一个 then
回调永远异步执行（用微任务），保证同步 resolve 也能按规范顺序触发
resolvePromise 要处理 thenable、循环引用（TypeError）与回调抛错

@steps
定义三种状态常量与构造函数，接收 executor 并立即调用，捕获同步抛错变 rejected
维护 value/reason 与两个回调数组；resolve/reject 先做状态守卫（非 pending 直接 return）
then 返回新 Promise，先把成功/失败回调 push 进对应数组（pending 时）
定义统一的执行函数，状态 settled 时用 queueMicrotask 异步触发回调，结果交给 resolvePromise 处理
resolvePromise 区分 thenable（递归展开）、普通值与循环引用（直接 reject），最后暴露 catch/resolve/reject 静态方法

@followups
为什么 then 回调是异步的？——规范要求 then 的回调必须异步执行，模拟成微任务，保证同步 resolve 后也能按规范拿到值且顺序正确
Promise 值穿透是什么？——then 的参数不是函数时会被忽略，值直接透传，如 Promise.resolve(1).then(2).then(console.log) 仍打印 1
手写版怎么处理循环引用？——在 resolvePromise 里若 promise2 与 x 相等，直接 reject 一个 TypeError，避免无限递归展开

@example
### 1. 手写 Promise 核心实现（符合 A+ 主要规范）

```javascript
// 手写一个符合 Promises/A+ 核心规范的 Promise
const PENDING = 'pending'
const FULFILLED = 'fulfilled'
const REJECTED = 'rejected'

function MyPromise(executor) {
  if (typeof executor !== 'function') {
    throw new TypeError('Promise resolver ' + executor + ' is not a function')
  }
  this.state = PENDING
  this.value = undefined
  this.reason = undefined
  this.onFulfilledCbs = [] // pending 期间收集的成功回调
  this.onRejectedCbs = []   // pending 期间收集的失败回调

  const resolve = (val) => {
    // 处理 thenable / 另一个 Promise，递归展开成最终值
    if (val && (typeof val === 'object' || typeof val === 'function')) {
      const then = val.then
      if (typeof then === 'function') {
        then.call(val, resolve, reject)
        return
      }
    }
    if (this.state !== PENDING) return // 状态只能变更一次
    this.state = FULFILLED
    this.value = val
    this.onFulfilledCbs.forEach((fn) => fn())
  }

  const reject = (err) => {
    if (this.state !== PENDING) return
    this.state = REJECTED
    this.reason = err
    this.onRejectedCbs.forEach((fn) => fn())
  }

  try {
    executor(resolve, reject)
  } catch (e) {
    reject(e)
  }
}
```

### 2. then / resolvePromise / 静态方法

```javascript
MyPromise.prototype.then = function (onFulfilled, onRejected) {
  // 值穿透：参数不是函数时，替换为透传函数
  onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : (v) => v
  onRejected = typeof onRejected === 'function' ? onRejected : (e) => { throw e }

  const promise2 = new MyPromise((resolve, reject) => {
    const handleFulfilled = () => {
      queueMicrotask(() => { // 规范要求异步执行回调
        try {
          const x = onFulfilled(this.value)
          resolvePromise(promise2, x, resolve, reject)
        } catch (e) {
          reject(e) // 回调抛错 → 新 Promise reject
        }
      })
    }
    const handleRejected = () => {
      queueMicrotask(() => {
        try {
          const x = onRejected(this.reason)
          resolvePromise(promise2, x, resolve, reject)
        } catch (e) {
          reject(e)
        }
      })
    }
    if (this.state === FULFILLED) handleFulfilled()
    else if (this.state === REJECTED) handleRejected()
    else {
      this.onFulfilledCbs.push(handleFulfilled)
      this.onRejectedCbs.push(handleRejected)
    }
  })
  return promise2
}

function resolvePromise(promise2, x, resolve, reject) {
  if (promise2 === x) { // 循环引用，直接 reject
    return reject(new TypeError('Chaining cycle detected for promise'))
  }
  if (x && (typeof x === 'object' || typeof x === 'function')) {
    let called = false
    try {
      const then = x.then
      if (typeof then === 'function') {
        then.call(x, (y) => {
          if (called) return
          called = true
          resolvePromise(promise2, y, resolve, reject) // 递归展开 thenable
        }, (r) => {
          if (called) return
          called = true
          reject(r)
        })
      } else {
        resolve(x) // 普通对象，直接 fulfill
      }
    } catch (e) {
      if (!called) reject(e)
    }
  } else {
    resolve(x) // 普通原始值
  }
}

MyPromise.prototype.catch = function (onRejected) {
  return this.then(null, onRejected)
}
MyPromise.resolve = (val) => new MyPromise((resolve) => resolve(val))
MyPromise.reject = (err) => new MyPromise((_, reject) => reject(err))
```

### 3. 测试用例与预期输出

```javascript
// 用例 1：基本 then 与链式
MyPromise.resolve(1)
  .then((v) => v + 1)
  .then((v) => console.log('test1:', v)) // test1: 2

// 用例 2：链式与值穿透（非函数被忽略）
MyPromise.resolve(10)
  .then(null)
  .then(2)
  .then((v) => console.log('test2:', v)) // test2: 10

// 用例 3：reject 与 catch
MyPromise.reject(new Error('boom'))
  .catch((e) => console.log('test3:', e.message)) // test3: boom

// 用例 4：循环引用报错
const p = new MyPromise((resolve) => resolve())
const cycle = p.then(() => cycle)
cycle.catch((e) => console.log('test4:', e instanceof TypeError)) // test4: true
```

## 09 · 手写防抖 debounce 与节流 throttle，分别用在哪

@id
js-debounce-throttle

@level
手写题

@freq
3

@tags
防抖 | 节流 | 性能

@ask
手写一下防抖和节流，说说它们的区别，分别用在什么场景？最好能带上立即执行和取消的能力。

@oral
**先给结论**：防抖是"停下来才执行"，节流是"每隔一段时间最多执行一次"，两者都是限制高频触发的回调，避免性能浪费。

**再说原理**。防抖每次触发都清掉上一个定时器、重启计时，只有连续触发停止超过 wait 才真正执行；节流用时间戳或定时器保证单位时间只跑一次——时间戳版首次立即执行、尾次可能丢，定时器版尾次补执行、首次延迟。

**真实场景**：搜索联想输入框用防抖，等用户停止输入再发请求，避免每个字符打一次接口；滚动加载（scroll 触发加载更多）、拖拽中的位置计算用节流，保证流畅又不卡。我们项目里图表随窗口 resize 重绘用节流，防抖会导致拖到一半不更新、体验差。

**边界与取舍**：防抖加 immediate/leading 选项实现"首次立即执行 + 后续防抖"；两者都该提供 cancel 取消挂起的调用；节流用 trailing 保证最后一次也执行；用闭包保存 timer/lastTime，注意 this 和参数透传，否则回调里拿不到正确上下文。

**收尾**：核心就是"清定时器 vs 时间闸门"，能讲清这个对比外加各自场景就过关。

@points
防抖：每次触发重置定时器，连续触发只在停止后执行一次
节流：单位时间间隔内最多执行一次，有时间戳和定时器两种实现
防抖适合"输入停止才做"（搜索联想），节流适合"持续触发也要做"（滚动/拖拽）
两者都应透传 this 与参数，并提供 cancel 取消未执行的回调
节流时间戳版首调即执行但尾次易丢，定时器版尾次补执行但首调延迟

@steps
防抖：闭包保存 timer；每次调用先 clearTimeout，再 setTimeout 在 wait 后执行
防抖加 immediate 选项：首次立即执行并置锁，停止 wait 后解锁
节流时间戳版：记录上次执行时间，当前 - 上次 >= wait 才执行并更新时间戳
节流定时器版：无 timer 时才 setTimeout，执行后清空 timer 保证 trailing 补发
统一返回带 cancel 方法的函数，cancel 时清定时器并把闭包状态复位

@followups
debounce 和 throttle 能结合吗？——能，lodash 的 debounce 带 maxWait 就是"节流兜底"，保证长时间持续触发时也会定期执行
为什么滚动用节流而不是防抖？——滚动是持续事件，防抖要停下来才执行会导致加载不及时、甚至永远不触发；节流能稳定每间隔执行
怎么保证 this 和参数正确？——用 rest 参数收集 args，以 context.apply(this, args) 调用原始函数，不要用箭头函数丢失 this

@example
### 1. 手写 debounce（含 immediate 与 cancel）

```javascript
// 防抖：连续触发时只在停止 wait 毫秒后执行最后一次
function debounce(fn, wait = 300, immediate = false) {
  let timer = null
  function debounced(...args) {
    const context = this
    if (timer) clearTimeout(timer) // 每次触发都取消上一次的计时
    if (immediate && !timer) {
      fn.apply(context, args) // 首次立即执行（leading）
    }
    timer = setTimeout(() => {
      timer = null
      if (!immediate) fn.apply(context, args) // 停止触发后才执行（trailing）
    }, wait)
  }
  debounced.cancel = () => { // 取消挂起的调用
    if (timer) clearTimeout(timer)
    timer = null
  }
  return debounced
}
```

### 2. 手写 throttle（时间戳 + 定时器，首调即执行且尾次补发）

```javascript
// 节流：单位时间 wait 内最多执行一次
function throttle(fn, wait = 300) {
  let last = 0
  let timer = null
  function throttled(...args) {
    const context = this
    const now = Date.now()
    const remaining = wait - (now - last) // 距离上次执行还差多久
    if (remaining <= 0) {
      if (timer) { clearTimeout(timer); timer = null }
      last = now
      fn.apply(context, args) // 时间到了，立即执行
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now()
        timer = null
        fn.apply(context, args) // 尾部补一次，保证最后一次不丢
      }, remaining)
    }
  }
  throttled.cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
    last = 0
  }
  return throttled
}
```

### 3. 测试用例与预期输出

```javascript
// 防抖测试：1 秒内连点 5 次，只应触发 1 次最终调用
let count = 0
const onSearch = debounce(() => { count++ }, 500)
for (let i = 0; i < 5; i++) onSearch()
console.log('debounce 立即触发次数(应为0):', count) // 0
setTimeout(() => console.log('debounce 停止后次数(应为1):', count), 700) // 1

// 节流测试：每 50ms 点一次，1 秒内约每 300ms 触发一次
let tCount = 0
const onScroll = throttle(() => { tCount++ }, 300)
const start = Date.now()
const id = setInterval(() => {
  onScroll()
  if (Date.now() - start > 1000) {
    clearInterval(id)
    setTimeout(() => console.log('throttle 1秒内触发次数(约3~4):', tCount), 400)
  }
}, 50)
```

## 10 · 手写 Promise.all / allSettled / race

@id
js-promise-all

@level
手写题

@freq
2

@tags
Promise | 并发 | 手写

@ask
手写一下 Promise.all，要处理非 Promise 值、保持结果顺序、一个失败就整体 reject。再顺手写一下 allSettled 和 race？

@oral
**先给结论**：Promise.all 是"全部成功才成功，任一失败就失败，结果按输入顺序"；allSettled 是不管成败都等全部结束返回状态数组；race 是谁先 settle 就用谁。

**再说原理**。all 先统一把入参用 Promise.resolve 包成 Promise，计数完成的个数，全部 fulfilled 才 resolve 结果数组（下标对齐顺序）；任一 reject 立即 reject 整个。allSettled 不短路，每个都记录 {status, value|reason}。race 则是把第一个 settle 的结果透传出去。

**真实场景**：我们首页要并行拉多个接口（用户信息、banner、商品列表），用 all 聚合，失败就走错误页；批量上传用 allSettled 拿每个文件成功或失败明细，不因为一个失败丢掉其它结果；race 配合超时，Promise.race([req, timeout]) 实现请求超时熔断。

**边界与取舍**：入参非数组或空数组（all 空数组直接 resolve []）；非 Promise 元素要规范化；all 要短路（一个失败立刻 reject，不等其余）；allSettled 永不 reject；race 不会取消其余 Promise，需要配合 abort。

**收尾**：关键差异就三个词——短路 / 不短路 / 取最快。

@points
all：全部 fulfilled 才 resolve，结果按输入顺序对齐；任一 reject 立即短路
allSettled：等待所有都 settle，返回 {status, value|reason}，永不 reject
race：第一个 settle 的结果（成功或失败）决定整体，用于超时熔断
实现前先用 Promise.resolve 把非 Promise 元素规范化，保证语义一致
注意空数组与下标填充：用 results[i] 而非 push，才能保持顺序

@steps
入参先转数组，空数组直接 resolve([])，避免永远 pending
用 Promise.resolve 把每个元素包成 Promise，保证非 Promise 也能 .then
维护计数器 count，每完成一个填入 results[index]，count 到长度才 resolve
all 在第一个 reject 时立即 reject 并停止；allSettled 始终记录结果不短路
race 只需在第一个 .then/.catch 里 resolve/reject 整个外层 Promise

@followups
Promise.all 空数组会怎样？——直接以 resolve([]) 结束，不会 pending，因为已经"全部完成"
all 失败是短路还是会等全部？——短路，第一个 reject 立刻 reject，其余仍在跑但结果被丢弃
race 实现超时需要注意什么？——超时 Promise 要 reject 并配合 abort，否则请求还在后台占用连接；且 race 不会取消其它 Promise

@example
### 1. 手写三种并发控制

```javascript
// 手写 Promise.all：全部成功才成功，结果按序，任一失败即失败
function promiseAll(tasks) {
  return new Promise((resolve, reject) => {
    const list = Array.from(tasks)
    const results = new Array(list.length)
    let count = 0
    if (list.length === 0) { resolve(results); return } // 空数组直接成功
    list.forEach((task, i) => {
      Promise.resolve(task) // 非 Promise 先规范化
        .then((val) => {
          results[i] = val // 按下标填，保证顺序
          count++
          if (count === list.length) resolve(results)
        })
        .catch((err) => reject(err)) // 任一失败立即短路
    })
  })
}

// 手写 Promise.allSettled：等所有结束，永不 reject
function promiseAllSettled(tasks) {
  return new Promise((resolve) => {
    const list = Array.from(tasks)
    const results = new Array(list.length)
    let count = 0
    if (list.length === 0) { resolve(results); return }
    list.forEach((task, i) => {
      Promise.resolve(task)
        .then((val) => { results[i] = { status: 'fulfilled', value: val } })
        .catch((err) => { results[i] = { status: 'rejected', reason: err } })
        .finally(() => {
          count++
          if (count === list.length) resolve(results) // 不短路，等全部
        })
    })
  })
}

// 手写 Promise.race：第一个 settle 的决定结果
function promiseRace(tasks) {
  return new Promise((resolve, reject) => {
    Array.from(tasks).forEach((task) => {
      Promise.resolve(task).then(resolve, reject) // 谁先 settle 谁说了算
    })
  })
}
```

### 2. 测试用例与预期输出

```javascript
// 测试 all：顺序保持 + 成功聚合
promiseAll([1, Promise.resolve(2), 3]).then((r) => console.log('all:', r)) // all: [1, 2, 3]

// 测试 all：失败短路
promiseAll([Promise.resolve(1), Promise.reject('err'), Promise.resolve(3)])
  .catch((e) => console.log('all reject:', e)) // all reject: err

// 测试 allSettled：成功失败都记录
promiseAllSettled([Promise.resolve('a'), Promise.reject('b')]).then((r) =>
  console.log('allSettled:', r)
) // allSettled: [{status:'fulfilled',value:'a'},{status:'rejected',reason:'b'}]

// 测试 race：取最快
promiseRace([
  new Promise((_, r) => setTimeout(() => r('slow'), 100)),
  Promise.resolve('fast'),
]).then((r) => console.log('race:', r)) // race: fast
```

## 11 · new 操作符做了什么，手写一个 new

@id
js-new-operator

@level
手写题

@freq
2

@tags
new | 构造函数 | 原型

@ask
new 一个对象的时候到底发生了什么？你能手写一个 myNew 吗？要考虑构造函数返回值的情况。

@oral
**先给结论**：new 干了四件事——建空对象、把它的原型链指向构造函数的 prototype、把 this 绑定到这个对象并执行构造函数、最后根据返回值决定返回谁。

**再说原理**。第一步创建空对象 obj；第二步 obj 的原型指向 Constructor.prototype（现在推荐用 Object.create）；第三步以 obj 为 this 调用构造函数；第四步若构造函数显式返回一个对象，则返回该对象，否则返回 obj。这就是"返回对象覆盖、返回原始值忽略"的原因。

**真实场景**：手写 myNew 能真正理解原型继承本质；日常里 new Vue()、new Promise() 都是这套机制。做插件时判断一个值是否某类实例用 instanceof，背后就是沿着原型链找 prototype。

**边界与取舍**：构造函数 return 一个对象（含数组/函数）会替换默认实例，导致 instanceof 失准；return 原始值（数字/字符串）被忽略，仍返回新对象；构造函数不能是箭头函数（没有 this 与 prototype）；手写版要做类型校验，非函数抛 TypeError。

**收尾**：抓住"原型绑定 + this 绑定 + 返回值判定"三点，new 就讲透了。

@points
new 四步：建空对象 → 绑定原型 → 以 this 调用构造函数 → 按返回值决定返回对象
新对象的 __proto__ 指向构造函数的 prototype，instanceof 据此判断归属
构造函数显式返回对象则覆盖默认实例，返回原始值则被忽略
箭头函数不能当构造函数（无 this、无 prototype、不可 new）
手写版需校验入参是函数，否则抛 TypeError

@steps
校验第一个参数是函数（构造函数），不是就抛错
用 Object.create(Constructor.prototype) 创建以原型为 __proto__ 的新对象
以新对象为 this，通过 Constructor.apply(obj, args) 执行构造函数
判断构造函数返回值：是对象或函数就返回它，否则返回新对象
支持剩余参数透传给构造函数，保持真实 new 的调用语义

@followups
构造函数 return 一个数组会怎样？——数组也是对象，会替换掉默认的 new 实例，instanceof 失准
Object.create 和 new 的区别？——Object.create(proto) 只做原型绑定不执行构造函数；new 还会调用构造函数
为什么箭头函数不能 new？——箭头函数没有自己的 this 和 prototype 属性，引擎直接禁止对其使用 new

@example
### 1. 手写 myNew

```javascript
// 手写 myNew：模拟 new 操作符的四个步骤
function myNew(Constructor, ...args) {
  if (typeof Constructor !== 'function') {
    throw new TypeError('myNew 的第一个参数必须是构造函数')
  }
  // 1. 创建新对象，2. 原型指向 Constructor.prototype
  const obj = Object.create(Constructor.prototype)
  // 3. 以新对象为 this 执行构造函数
  const result = Constructor.apply(obj, args)
  // 4. 返回对象/函数则覆盖，否则返回新对象
  if (result !== null && (typeof result === 'object' || typeof result === 'function')) {
    return result
  }
  return obj
}
```

### 2. 测试用例与预期输出

```javascript
function Person(name, age) {
  this.name = name
  this.age = age
}
Person.prototype.say = function () { return this.name + ':' + this.age }

const p = myNew(Person, 'lyf', 9)
console.log(p.name, p.age)            // lyf 9
console.log(p.say())                  // lyf:9
console.log(p instanceof Person)      // true

// 构造函数返回对象 → 覆盖默认实例
function WithReturn() { this.x = 1; return { y: 2 } }
const w = myNew(WithReturn)
console.log(w.x, w.y, w instanceof WithReturn) // undefined 2 false

// 构造函数返回原始值 → 忽略，仍返回新对象
function WithPrimitive() { this.x = 1; return 100 }
console.log(myNew(WithPrimitive).x)   // 1

// 类型校验：非函数报错
try { myNew({}) } catch (e) { console.log('err:', e instanceof TypeError) } // true
```

## 12 · 垃圾回收机制与常见内存泄漏的排查方法

@id
js-gc-leak

@level
进阶

@freq
2

@tags
GC | 内存泄漏 | 性能

@ask
说说 V8 的垃圾回收机制？标记清除和引用计数有什么区别？怎么在前端实际排查内存泄漏？

@oral
**先给结论**：JS 自动 GC，主流是"标记-清除"配合分代回收；内存泄漏本质是"本该释放的对象引用链没断"。

**再说原理**。V8 把内存分新生代（年轻对象，Scavenge 复制算法，快）和老生代（存活久的，Mark-Sweep 标记清除 + Mark-Compact 整理碎片）。标记清除从根对象（window、栈变量）出发，可达的对象标活，不可达的回收；引用计数统计引用数，为 0 即回收，但循环引用无法回收，已不是现代主力。

**真实场景**：我们 SPA 路由切换后旧页面 DOM 没卸载干净、全局事件监听/定时器没 remove、闭包持有大对象、Vue 组件忘了在 beforeUnmount 解绑第三方库（如 ECharts、地图实例），都会导致老生代涨、页面越用越卡。

**排查方法**：Chrome DevTools 的 Performance Monitor 看 JS Heap 是否只增不减；Memory 面板拍堆快照，对比路由前后 Detached DOM 与 Retained Size；用 Allocation instrumentation 看哪些对象持续增长；Performance 录制找长任务与频繁 GC。

**边界与取舍**：弱引用（WeakMap/WeakSet）的键不影响回收；不要盲目手动 delete，现代引擎不靠它；对象池化复用要谨慎，可能反而常驻内存。

**收尾**：定位泄漏 = 快照对比找增长对象 + 顺引用链找到谁还握着它。

@points
V8 采用分代回收：新生代 Scavenge 复制、老生代 Mark-Sweep/Compact
标记-清除从 GC Roots 出发标记可达对象，不可达才回收；能解决循环引用
引用计数靠引用数归零回收，但循环引用会漏（已非主流）
泄漏本质是可达性没断：未解绑的监听/定时器、闭包持大对象、Detached DOM
排查靠 DevTools：Performance Monitor 看堆趋势 + Memory 快照对比 Retained Size

@steps
先讲清 GC 根基：可达性（GC Roots 出发能触达即存活），而非引用计数
说明分代：新生代小且短命用 Scavenge，老生代用标记清除 + 整理
讲清标记清除如何处理循环引用（互相引用但都从根不可达 → 一起回收）
列出前端常见泄漏源：未移除监听/定时器、闭包大对象、Detached DOM、第三方实例未销毁
给排查 SOP：Performance Monitor 观察 → Memory 两次快照 diff → 找 Detached/增长对象 → 顺引用链定位持有者

@followups
为什么有了标记清除还要提引用计数？——历史上有循环引用缺陷（老 IE 引擎），现代 V8 主用标记清除，但引用计数是理解"为什么闭包不回收"的基础
WeakMap 能解决什么泄漏？——键是弱引用，对象没别处引用时会被回收，适合缓存/关联数据，避免 Map 强引用导致泄漏
怎么判断是内存泄漏而不是正常缓存？——多次进入/离开同一页面后拍快照，若某类对象数量/Retained Size 单调上升且不回落，基本可判定泄漏

@example
### 1. 标记清除如何处理循环引用（对比引用计数）

```javascript
// 引用计数视角：a、b 互相引用，计数都至少为 1，永远无法回收（旧引擎泄漏）
// 标记清除视角：只要 a、b 都不再被 GC Roots 触达，就被一起回收
let a = {}
let b = {}
a.ref = b
b.ref = a
a = null
b = null // 此时 a、b 从根不可达，下一轮 GC 被标记清除一并回收
```

### 2. 常见泄漏：定时器与监听未解绑

```javascript
// 反例：组件销毁后 timer 和 listener 仍在引用大对象
function badSetup() {
  const big = new Array(1e6).fill('x')
  setInterval(() => console.log(big.length), 1000) // 不清 → 泄漏
  window.addEventListener('resize', () => big)     // 不 remove → 泄漏
}

// 正例：在组件卸载时主动解除引用
function goodSetup() {
  const big = new Array(1e6).fill('x')
  const onResize = () => console.log(big.length)
  const timer = setInterval(() => onResize(), 1000)
  window.addEventListener('resize', onResize)
  return () => { // 类似 Vue 的 onUnmounted
    clearInterval(timer)
    window.removeEventListener('resize', onResize)
  }
}
```

### 3. WeakMap 让关联数据随对象一起回收

```javascript
const strong = new Map()
const weak = new WeakMap()
let user = { id: 1 }

strong.set(user, { visits: 0 })
weak.set(user, { visits: 0 })

user = null
// strong 仍强引用 user → 不会回收；weak 的键是弱引用 → 记录可被回收
console.log('strong 是否还持有:', strong.size) // 1
```

### 4. 排查 SOP（DevTools 操作步骤）

1. 打开 Chrome DevTools → Performance Monitor，勾选 JS Heap Size
2. 在页面反复进入/离开目标路由 5~10 次
3. 观察 JS Heap 是否只增不减（泄漏特征：锯齿上沿持续抬高）
4. Memory 面板：拍 Heap Snapshot A → 操作 → 拍 Snapshot B
5. 选 B，过滤 Detached 或在 Comparison 视图看增长最多的对象
6. 点开 Retainers（引用链），顺着找到是哪个闭包/全局变量握着它
