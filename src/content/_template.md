---
id: template
name: 样板
en: Template
icon: braces
color: #2f6bff
order: 99
desc: 写作样板，不参与渲染（文件名以 _ 开头会被解析器忽略）。
---

## 01 · 闭包是什么，为什么会造成内存泄漏

@id
js-closure

@level
基础

@freq
3

@tags
闭包 | 作用域 | 内存

@ask
你说说闭包是什么？它在你们项目里具体解决过什么问题？还有，我听说闭包容易内存泄漏，这个怎么解释？

@oral
**先说结论**：闭包就是「函数 + 它定义时所在的那个词法环境」。只要一个内部函数引用了外层的变量，并且这个内部函数被带到了外层函数之外，外层那些变量就不会随着函数执行结束被回收，这就是闭包。

**再说原理**。JS 是词法作用域，作用域在代码写下的那一刻就确定了，跟谁调用没关系。函数执行时，局部变量本来放在调用栈上，函数一 return 栈帧就销毁了。但如果里面有函数引用了这些变量、而且这个内部函数会「逃逸」出去，V8 就会把这些变量从栈上搬到一个堆上的闭包对象里，由内部函数持有，所以外层函数结束了它们还活着。

**举个我真实用过的例子**。做商品列表时每一行都要绑点击事件，如果用 var 写 for 循环，所有回调打印出来的索引都是最后一项，因为 var 是函数级作用域、共享同一个变量；用闭包给每个回调单独存一份索引就正常了。当然现在更推荐直接用 let，它每轮循环都会创建一个新的绑定，本身就是闭包思路的语法糖。

**再说泄漏**。严格讲闭包本身不是 bug，它只是让变量活得更久。真正的泄漏是「你已经不需要它了，但引用链还断不掉」。最常见的两种：一是把 DOM 存进了闭包，元素从页面上移除了但闭包还在，DOM 就无法回收；二是定时器或全局事件监听引用了大对象，忘了 clearInterval 或 removeEventListener。

**最后给方案**：组件卸载时清定时器和监听；要给 DOM 挂关联数据优先用 WeakMap，键是弱引用，元素被回收时数据自动跟着走。

@points
闭包 = 函数 + 定义时的词法环境，是词法作用域的产物，不是某个 API
变量从调用栈转移到堆上的闭包对象，这才是「外层执行完还能访问」的根本原因
循环里 var 共享变量、let 每轮新建绑定，是最常被追问的场景
内存泄漏的本质是引用链没断开，而不是闭包本身有问题
WeakMap 与显式解绑是控制闭包生命周期的标准手段

@steps
先复述定义，把「词法环境」这个关键词抛出来，让面试官知道你不是背的八股
解释变量为什么能活下来：对比栈帧销毁和堆上闭包对象，说清搬运过程
给一个自己项目里的真实场景，说明闭包具体解决了什么问题
主动补一句「闭包本身不是问题，泄漏是因为引用没断」，把话题引到边界上
最后给解法：解绑、WeakMap、避免把大对象挂在闭包里

@followups
闭包里的变量存在哪？——存在堆上的 Context 对象里，栈上只留一个指针
for 循环里 setTimeout 打印索引，为什么 var 不行 let 行？——var 函数级作用域共享一个绑定，let 每次迭代创建新绑定
怎么用 Chrome 排查闭包泄漏？——Performance 录制 + Memory 快照对比，看 Detached DOM 和 Retained Size

@refs
MDN：Closures
V8 博客：Understanding V8's memory management

@example
### 1. 最小可验证的闭包

```javascript
// makeCounter 执行完后，它的局部变量 count 本应该被回收
// 但因为内部函数 increment 引用了它，count 被搬到了堆上的闭包对象里
function makeCounter() {
  let count = 0 // 这个变量会一直活到 increment 被销毁为止

  return function increment() {
    count += 1 // 每次访问的都是同一个 count，而不是重新创建的
    return count
  }
}

const counterA = makeCounter()
const counterB = makeCounter() // 再调用一次，会产生一份全新的闭包

console.log(counterA()) // 1
console.log(counterA()) // 2
console.log(counterB()) // 1 —— 两个计数器互不影响，说明每次调用都有独立环境
```

在 Chrome 控制台里打印 `counterA`，展开 `[[Scopes]]` 能看到 `Closure → count: 2`，这就直接证明了变量还挂在函数上。

### 2. 经典循环陷阱：var 与 let 的差别

```javascript
// 反例：var 是函数级作用域，三个回调共享同一个 i
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log('var:', i), 0)
}
// 输出：var: 3 / var: 3 / var: 3（循环早跑完了，回调执行时才去读 i）

// 正例：let 每一轮迭代创建一个新绑定，三个回调各拿一个
for (let j = 0; j < 3; j++) {
  setTimeout(() => console.log('let:', j), 0)
}
// 输出：let: 0 / let: 1 / let: 2

// 正例（let 出现之前的通用解法）：用 IIFE 手动造闭包，本质和 let 一样
for (var k = 0; k < 3; k++) {
  ;((index) => {
    setTimeout(() => console.log('iife:', index), 0)
  })(k) // 把当前 k 的值作为参数传进去，形成独立的一份
}
// 输出：iife: 0 / iife: 1 / iife: 2
```

### 3. 真实会造成泄漏的两种写法

```javascript
// 反例 1：DOM 已经从页面移除，但闭包还握着它 → 元素无法回收（Detached DOM）
function leakByDom() {
  const el = document.querySelector('#big-list') // 一大棵 DOM
  window.__cache = () => el.innerHTML // 挂到 window，引用链一路连到全局
  el.remove() // 页面上看不到了，内存里还在
}

// 反例 2：定时器没清，闭包里的大数组一直活着
function leakByTimer() {
  const bigData = new Array(1_000_000).fill('x')
  setInterval(() => {
    console.log(bigData.length) // 只要 timer 不清，bigData 永远不会被回收
  }, 1000)
}

// 正例：在组件卸载时主动打断引用链
function safe() {
  const bigData = new Array(1_000_000).fill('x')
  const timer = setInterval(() => console.log(bigData.length), 1000)
  return () => clearInterval(timer) // 引用计数归零，可被 GC 回收
}
```

### 4. 正确姿势：WeakMap 让关联数据跟着元素一起消失

```javascript
// Map 的键是强引用：元素被移除了，Map 还握着它 → 泄漏
const cache = new Map()
// WeakMap 的键是弱引用：元素没有别的引用了，这条记录会被自动清理
const weakCache = new WeakMap()

let box = document.createElement('div')
cache.set(box, { clickCount: 0 })
weakCache.set(box, { clickCount: 0 })

box = null // 此时 weakCache 里那条记录可以被回收，cache 里那条永远不会
```
