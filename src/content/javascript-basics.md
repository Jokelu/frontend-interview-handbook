---
id: javascript
name: JavaScript
en: Language Core
icon: braces
color: #d6a400
order: 3
part: 1
desc: 作用域、原型、this、异步与手写题，前端面试的基本盘，必须全部拿下。
---

## 01 · 闭包到底是什么，为什么会造成内存泄漏

@id
js-closure

@level
基础

@freq
3

@tags
闭包 | 作用域 | 内存

@ask
你说说闭包到底是什么？不只是背概念啊，要能说清楚它底层是怎么让变量活下来的。还有很多人说闭包会内存泄漏，你见过真实的泄漏场景吗，怎么治理？

@oral
**先给结论**：闭包不是某个 API，而是「函数 + 它定义时所在的词法作用域」这个组合。只要内部函数引用了外层变量，并且这个内部函数被带到了外层作用域之外，那些被引用的变量就不会在外层函数执行完时被回收——它们被「困」在闭包里了。

**原理上**，JavaScript 用的是词法作用域：变量的可见性在代码写下的那一刻就定了，跟函数在哪被调用无关。函数调用时，局部变量本应放在调用栈的栈帧上，函数一返回栈帧就销毁。但如果内部函数引用了这些局部变量、且内部函数会「逃逸」出去（比如被 return 或被挂到全局），V8 没法把栈帧整个回收，就会把这部分变量搬到堆上的函数上下文对象里，由内部函数持有，所以外层结束了它们还活着。

**真实场景我踩过也用过**：做权限请求器时，用工厂函数给每个接口生成带 token 的封装，token 就存在闭包里，外面拿不到也改不了，相当于私有状态；还有事件回调里要记住当前行 id，也得靠闭包保存。这些都说明闭包是「延长变量生命周期」的工具，而不是 bug。

**边界和取舍**：严格说闭包本身不会导致泄漏，它只是延长了变量生命周期。「泄漏」指的是你早不需要它了，但引用链还断不掉。最典型的两种：一是把 DOM 存进闭包后元素被移除，但闭包还引用着，形成 Detached DOM；二是定时器或全局监听引用了大对象却从不清，大对象一直活着。

**收尾**：治理手段就是组件卸载时 removeEventListener / clearInterval 打断引用链；需要给 DOM 挂关联数据优先用 WeakMap，键是弱引用，元素回收时数据自动跟着走，从根本上避免「忘了解绑」式的泄漏。

@points
闭包 = 函数 + 定义时的词法作用域，是词法作用域的产物而非某个 API
变量从调用栈「搬」到堆上的函数上下文，这是外层结束后还能访问的根本原因
闭包常用于私有状态、工厂函数、回调保存上下文，本质是延长变量生命周期
泄漏的本质是引用链没断开，而不是闭包本身有 bug
WeakMap 与显式解绑是控制闭包生命周期的标准手段

@steps
先抛「函数 + 词法作用域」这个定义，强调不是 API，证明你理解本质
讲清变量为什么能活：对比栈帧销毁 vs 堆上上下文对象，说清「搬运」过程
给一个真实项目场景（私有状态 / 回调上下文），让回答落地
主动补一句「闭包不是泄漏、断不掉引用才是」，把话题引到边界
给治理手段：解绑监听、清定时器、WeakMap

@followups
闭包里的变量存在哪？——存在堆上的函数上下文对象里，栈上只留一个指向它的引用
for 循环里 setTimeout 打印索引，var 为什么乱序、let 为什么正常？——var 函数级作用域共享同一绑定，let 每次迭代创建新绑定
怎么用 Chrome 排查闭包泄漏？——Performance 录制 + Memory 堆快照对比，盯 Detached DOM 和 Retained Size
为什么模块顶层变量不算泄漏？——模块作用域的引用一直存在是预期行为，只有「本该释放却没释放」才叫泄漏

@example
### 1. 最小可验证的闭包

```javascript
// makeCounter 执行完后，局部变量 count 本应随栈帧销毁
// 但内部函数 increment 引用了它，count 被移到堆上的闭包对象
function makeCounter() {
  let count = 0 // 这个变量会活到 increment 被销毁为止
  return function increment() {
    count += 1 // 每次访问的都是同一个 count
    return count
  }
}
const a = makeCounter()
const b = makeCounter() // 再调用一次，产生一份全新的闭包
console.log(a()) // 1
console.log(a()) // 2
console.log(b()) // 1 —— 各有独立环境，互不干扰
```

### 2. 经典循环陷阱：var 与 let

```javascript
// var：函数级作用域，三个回调共享同一个 i
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log('var:', i), 0)
}
// 输出：var: 3 / var: 3 / var: 3（循环跑完后回调才执行，读到的都是最后的 i）

// let：每一轮迭代创建一个新绑定，三个回调各拿一个
for (let j = 0; j < 3; j++) {
  setTimeout(() => console.log('let:', j), 0)
}
// 输出：let: 0 / let: 1 / let: 2

// let 出现前的通用解法：IIFE 手动造闭包，本质和 let 一样
for (var k = 0; k < 3; k++) {
  ;((index) => {
    setTimeout(() => console.log('iife:', index), 0)
  })(k) // 把当前 k 的值传进去，形成独立的一份
}
// 输出：iife: 0 / iife: 1 / iife: 2
```

### 3. 真实会造成泄漏的写法与正确姿势

```javascript
// 反例：DOM 已从页面移除，但闭包还握着它 → Detached DOM 无法回收
function leakByDom() {
  const el = document.querySelector('#big-list') // 一大棵 DOM
  window.__cache = () => el.innerHTML // 挂到 window，引用链连到全局
  el.remove() // 页面上看不到了，内存里还在
}

// 反例：定时器没清，闭包里的大数组一直活着
function leakByTimer() {
  const bigData = new Array(1_000_000).fill('x')
  setInterval(() => console.log(bigData.length), 1000) // 不清就永远回收不了
}

// 正例：WeakMap 弱引用键，元素回收时数据自动清理
const weakCache = new WeakMap()
let box = document.createElement('div')
weakCache.set(box, { clickCount: 0 })
box = null // weakCache 中该记录可被回收，不会泄漏
```

## 02 · var、let、const 的区别，变量提升与暂时性死区

@id
js-var-let-const

@level
基础

@freq
3

@tags
变量提升 | TDZ | 作用域

@ask
var、let、const 到底有什么区别？别只说「var 能重复声明」，把变量提升和暂时性死区讲透，最好能解释 TDZ 到底是 V8 真的「锁住」了变量还是只是规范层面。

@oral
**结论先说**：三者核心差异在四件事上——作用域级别、变量提升后的初始化时机、能否重复声明、能否重新赋值。let / const 把 var 的两个坑（函数级作用域、提升即可用）都堵上了，const 再多一个「绑定不可重赋值」。

**原理**。var 是函数级作用域，声明会整体「提升」到函数顶部，并且提升时就被初始化成 undefined，所以在声明前访问拿到的是 undefined 而不是报错——这叫「提升且初始化」。let / const 同样是提升的，但**只提升声明、不初始化**，从作用域开始到声明语句之间这段区域叫暂时性死区（TDZ），期间访问直接 ReferenceError。规范之所以这么设计，是为了保证「声明之前不能用」，既避免块内变量被外层同名变量污染，也消除了很多隐蔽 bug。

**真实项目里最常踩的**：for 循环里用 var 给事件绑索引，拿到全是最后一项；还有在 switch 的同一个 case 里用 let 重复声明会报 SyntaxError，因为它们处在同一个块作用域。

**边界与取舍**：const 只保证绑定不可再赋值，不保证内容不可变——对象照样能改属性，要冻结得用 Object.freeze。TDZ 是规范层面的「访问即报错」规则，不是 V8 真给内存加了锁，但引擎确实会为 let/const 维护一个「未初始化」状态位来实现它。

**收尾**：日常一律用 const，需要重赋值才用 let，几乎不用 var，既规避 TDZ 坑也避免共享作用域问题。

@points
var 是函数级作用域且提升即初始化为 undefined；let/const 是块级作用域且提升但不初始化
TDZ 是声明语句之前访问会 ReferenceError 的区间，用来禁止「声明前使用」
const 只约束绑定不可重赋值，对象属性仍可改，冻结需 Object.freeze
同一块作用域内 let/const 不能重复声明，var 可以
实践默认 const，需重赋值才 let，基本不用 var

@steps
先点出差异维度：作用域、提升行为、重复声明、重赋值
讲 var 的「提升且初始化」和 let/const 的「提升但不初始化」
解释 TDZ 是什么、为什么规范要这么设计
给真实坑：循环索引、switch 同 case 重复声明
收尾：默认 const / let，几乎不用 var，并提 const 不保证深不可变

@followups
TDZ 是引擎真的锁内存了吗？——不是，是规范层面的访问即报错规则，引擎用「未初始化」状态位实现
const 定义的对象能改属性吗？——能，const 只禁止重新赋值绑定，属性照改不误
函数声明和 var 提升谁优先？——函数声明整体提升且优先级高于 var，同名时变量声明被忽略
let 在 for 循环里每轮都新建绑定吗？——是的，循环头部的 let 每次迭代创建独立绑定，这就是能正确捕获索引的原因

@example
### 1. 变量提升与暂时性死区对比

```javascript
// var：提升并初始化为 undefined，声明前访问不报错
console.log(a) // undefined
var a = 1

// let：提升但不初始化，进入 TDZ，访问直接报错
console.log(b) // ReferenceError: Cannot access 'b' before initialization
let b = 2
```

### 2. 块级作用域、重复声明与 const 不可变

```javascript
// 块级作用域：外部访问不到块里的 let/const
{
  let x = 10
  const y = 20
}
console.log(typeof x) // 'undefined'（块外不存在）

// 同作用域重复声明
let z = 1
let z = 2 // SyntaxError: Identifier 'z' has already been declared

// const 只禁重赋值，不禁止改属性
const obj = { n: 1 }
obj.n = 2 // 允许
obj = {}  // TypeError: Assignment to constant variable
```

### 3. 循环中的捕获差异与函数声明提升

```javascript
// for 循环里的 var vs let 捕获索引
const fns = []
for (var i = 0; i < 3; i++) fns.push(() => i)
console.log(fns.map((f) => f())) // [3, 3, 3]

const fns2 = []
for (let j = 0; j < 3; j++) fns2.push(() => j)
console.log(fns2.map((f) => f())) // [0, 1, 2]

// 函数声明整体提升，优先级高于同名 var
console.log(foo()) // 'hoisted'
function foo() { return 'hoisted' }
var foo = 1
```

## 03 · 判断数据类型有哪几种方式，各自的坑在哪

@id
js-type-check

@level
基础

@freq
3

@tags
typeof | instanceof | 类型判断

@ask
判断一个值的类型，你有哪些手段？每个的坑能说全吗？比如 typeof null 为什么是 object，instanceof 在什么情况下会翻车？

@oral
**结论**：判断类型主要四招——typeof、instanceof、Object.prototype.toString.call，以及判断具体值的 Array.isArray / Number.isNaN 等。没有哪一招通吃，得按场景组合。

**原理和坑**。typeof 对基本类型大部分准，但有两个著名坑：typeof null === 'object'（历史遗留 bug，早期用 32 位低位标签标记类型，null 全 0 被误判成对象），以及 typeof 任何函数都是 'function' 而不是 'object'，所有对象类型（数组、正则、日期）都只返回 'object'，区分不了。instanceof 靠原型链：left.__proto__ 一路往上找能不能碰到 right.prototype，所以它**只认引用类型、只认当前执行上下文的构造函数**——一旦跨 iframe / 跨 realm（父页面和子页面的数组不是同一个 Array），instanceof Array 就翻车；而且能被改写原型链伪造。

**真实场景**：我做过一个 SDK 要区分「用户传的是函数、数组还是普通对象」来走不同序列化，typeof 不够用，最后用 Object.prototype.toString.call 拿到 '[object Array]' / '[object Object]' / '[object Null]' 这种精确标签，最稳。

**边界**：toString 对自定义类也只返回 '[object Object]'，区分不出子类；NaN 必须用 NaN !== NaN 或 Number.isNaN，因为它连自己都不等于。

**收尾**：日常组合是——基本类型用 typeof（避开 null），数组用 Array.isArray，复杂精确类型用 toString.call，引用实例用 instanceof 但要小心跨 realm。

@points
typeof 对基本类型基本可用，但 typeof null 为 'object'、所有对象类型都返回 'object'、函数是 'function'
instanceof 走原型链，仅适用引用类型，且跨 iframe / 跨 realm 会因原型不同翻车
Object.prototype.toString.call 能拿到 [object Type] 精确标签，是判断复杂类型最稳的手段
数组用 Array.isArray 最可靠（不受 realm 影响），NaN 用 Number.isNaN
没有单一方案通吃，按「基本类型 / 数组 / 引用实例 / 精确标签」分层判断

@steps
先列出四招并说「没有通吃方案」
讲 typeof 的两个坑：null 和对象类型不细分
讲 instanceof 原理（原型链）及跨 realm 翻车
给出生产里用 toString.call 拿精确标签的做法
收尾：分层组合判断，并点 NaN / 自定义类边界

@followups
typeof null 为什么是 object？——历史 bug：早期用值的低位类型标签标记，null 全 0 被当成对象标签
跨 iframe 的数组 instanceof Array 为什么是 false？——父子窗口各有一份 Array 构造函数，原型不是同一个对象
怎么精确判断数组？——Array.isArray 不看原型、认内部 [[Class]]，跨 realm 也可靠
toString.call 对自定义类返回什么？——仍是 [object Object]，区分不出子类，需额外约定

@example
### 1. typeof 的坑

```javascript
typeof 123        // 'number'
typeof 'a'        // 'string'
typeof undefined  // 'undefined'
typeof null       // 'object' —— 历史遗留 bug
typeof []         // 'object' —— 数组也是 object，区分不出
typeof {}         // 'object'
typeof function(){} // 'function' —— 唯一特例
typeof Symbol()   // 'symbol'
```

### 2. instanceof 原理与翻车场景

```javascript
// 本质：沿 __proto__ 找 right.prototype
[] instanceof Array   // true
[] instanceof Object  // true（原型链向上）

// 跨 iframe：父子页面 Array 不是同一个构造函数
const iframe = document.createElement('iframe')
document.body.appendChild(iframe)
const SubArray = iframe.contentWindow.Array
const x = new SubArray()  // 在子页面创建的数组
x instanceof Array     // false —— 翻车

// 可被原型链伪造
class Fake {}
const o = {}
Object.setPrototypeOf(o, Fake.prototype)
o instanceof Fake      // true（实际上不是 Fake 实例）
```

### 3. toString.call 与推荐的可靠组合

```javascript
const tag = (v) => Object.prototype.toString.call(v)
tag(null)        // '[object Null]'
tag([])          // '[object Array]'
tag({})          // '[object Object]'
tag(new Date())  // '[object Date]'
tag(/a/)         // '[object RegExp]'
tag(NaN)         // '[object Number]'

// 推荐的可靠组合
Array.isArray([])   // true（跨 realm 也稳）
Number.isNaN(NaN)   // true
tag(undefined)      // '[object Undefined]'
```

## 04 · 手写深拷贝，怎么处理循环引用和特殊对象

@id
js-deep-clone

@level
手写题

@freq
3

@tags
深拷贝 | 递归 | WeakMap

@ask
手写一个深拷贝。先说思路，然后考虑清楚：循环引用怎么防？Map / Set / Date / RegExp 这些特殊对象怎么办？函数又怎么处理？

@oral
**结论**：深拷贝就是把一个对象里的所有嵌套引用都重新创建一份，让新对象和原对象彻底断开引用、互不影响。核心是「递归遍历 + 按类型分别处理」，不能无脑递归，否则循环引用直接爆栈。

**思路**：用 WeakMap 当「已访问表」，记录原对象 → 克隆体。进入一个对象先查表，命中就直接返回缓存的克隆体，这样循环引用（a.self = a）既不死循环也不会拷贝出两份。然后按类型分支：普通对象 / 数组递归拷贝；Date、RegExp 用各自构造函数 new 一份；Map、Set 重建并逐项深拷贝；其他内置对象（如 Error）按需要兜底；函数一般直接返回引用（函数本身不可「拷贝」，也没有拷贝意义），或视需求忽略。

**真实项目**：我们接口返回的大 JSON 要塞进表单做双向编辑，必须深拷贝一份再改，否则改了的脏数据会回写到原响应，导致列表和详情串味。

**边界与取舍**：用 WeakMap 而不是 Map，是因为键是弱引用，原对象被回收时缓存自动释放，不会造成内存泄漏；但 WeakMap 的键必须是对象，原始值类型直接返回即可。Symbol 键、不可枚举属性、原型链上的属性通常不在拷贝范围，按需决定是否用 Reflect.ownKeys 并保留原型。

**收尾**：生产环境别自己造轮子，用 structuredClone（现代浏览器 / Node 原生，但也不支持函数和 DOM），复杂场景用 lodash.cloneDeep。手写主要用于面试展示你对递归、引用、类型的把控。

@points
用 WeakMap 记录「原对象 → 克隆体」，命中即返回，专门解决循环引用和重复引用
按类型分支处理：普通对象/数组递归，Date/RegExp 用构造器重建，Map/Set 逐项深拷
函数通常不拷贝（直接返回引用），原始值直接返回
WeakMap 弱引用键避免克隆缓存造成内存泄漏；原始值无需入表
生产优先 structuredClone / lodash，手写重在展示对递归与引用的理解

@steps
先讲整体目标：断开新旧对象的引用，让二者互不影响
引入 WeakMap 做访问缓存，解决循环引用和重复引用
按 typeof / 构造器类型分支：对象、数组、Date、RegExp、Map、Set
说明函数的处理策略（一般返回引用）和原始值直接返回
提边界：Symbol 键、不可枚举、原型保留，以及生产用现成方案

@followups
为什么用 WeakMap 而不是 Map 存缓存？——WeakMap 键弱引用，原对象回收时缓存自动释放，不会泄漏
structuredClone 能拷贝函数吗？——不能，函数、DOM、Error 等不在其支持范围，会直接抛错
循环引用不处理会怎样？——无限递归直到调用栈溢出 RangeError
怎么拷贝 RegExp？——new RegExp(source, flags) 重建，注意 lastIndex 一般不保留

@example
### 1. 完整可运行的深拷贝实现

```javascript
/**
 * 深拷贝：递归复制，并用 WeakMap 处理循环引用与重复引用
 * @param {*} target 待拷贝的值
 * @param {WeakMap} cache 已访问的原对象 -> 克隆体
 */
function deepClone(target, cache = new WeakMap()) {
  // 1. 原始值 / 函数：直接返回（函数无拷贝意义，视需求可忽略）
  if (target === null || typeof target !== 'object') return target

  // 2. 已拷贝过：返回缓存的克隆体，避免循环引用死循环
  if (cache.has(target)) return cache.get(target)

  // 3. 特殊内置对象：用各自构造器重建
  if (target instanceof Date) return new Date(target)
  if (target instanceof RegExp) return new RegExp(target.source, target.flags)
  if (target instanceof Map) {
    const clone = new Map()
    cache.set(target, clone) // 先入表，再递归，保证循环引用能命中
    target.forEach((v, k) => clone.set(deepClone(k, cache), deepClone(v, cache)))
    return clone
  }
  if (target instanceof Set) {
    const clone = new Set()
    cache.set(target, clone)
    target.forEach((v) => clone.add(deepClone(v, cache)))
    return clone
  }

  // 4. 普通对象 / 数组：保持原构造器与类型，同时拷贝 Symbol 键
  const clone = Array.isArray(target) ? [] : {}
  cache.set(target, clone)
  Reflect.ownKeys(target).forEach((key) => {
    clone[key] = deepClone(target[key], cache)
  })
  return clone
}
```

### 2. 测试用例与预期输出

```javascript
// 用例 1：基本嵌套 + 循环引用
const a = { name: 'x', list: [1, { n: 2 }] }
a.self = a // 循环引用
const ca = deepClone(a)
console.log(ca === a)            // false —— 是新对象
console.log(ca.list === a.list)  // false —— 嵌套也被拷贝
console.log(ca.self === ca)      // true  —— 循环被正确还原（指向自身）
ca.name = 'y'
console.log(a.name)              // 'x'   —— 互不影响

// 用例 2：特殊对象
const b = { d: new Date(), r: /ab/g, m: new Map([['k', { v: 1 }]]) }
const cb = deepClone(b)
console.log(cb.d instanceof Date)     // true
console.log(cb.r instanceof RegExp)   // true
console.log(cb.m.get('k') === b.m.get('k')) // false —— Map 内的值也被深拷
```

## 05 · 原型与原型链是什么，手写一个 instanceof

@id
js-prototype

@level
进阶

@freq
3

@tags
原型链 | prototype | instanceof

@ask
讲讲原型和原型链，最好能把它和类、继承的关系说清楚。然后——手写一个 instanceof，别调原生的。

@oral
**结论**：每个函数创建时都会自带一个 prototype 属性（它的实例共享的「原型对象」），每个对象创建时都有一个内部指针 [[Prototype]]（浏览器里叫 __proto__）指向它的原型。顺着这些指针一路向上，就构成了「原型链」，这是 JS 实现继承的机制。

**原理**。当访问 obj.x 而 obj 自身没有 x 时，JS 会沿 __proto__ 往它的原型上找，再往上找原型的原型……直到 null 为止，这条链路就是原型链；找不到就返回 undefined。构造函数 new 出来的实例，它的 __proto__ 指向构造函数的 prototype。ES6 的 class 只是原型继承的语法糖：class A extends B 时，A.prototype.__proto__ === B.prototype，A.__proto__ === B，实例方法在 A.prototype、静态方法在 A 上。

**真实项目**：我们封装基础组件时用 class 继承把通用逻辑放父类、差异放子类，底层就是原型链在查找方法；还有给内置对象的原型打补丁也走原型。

**边界与取舍**：__proto__ 是浏览器暴露的访问器，规范里建议用 Object.getPrototypeOf 读写；改原型链（如设 __proto__）有性能代价；原型上的引用类型属性会被所有实例共享，这是经典坑。

**收尾**：手写 instanceof 就是手动沿实例的 __proto__ 往上爬，看能不能碰到构造函数的 prototype。

@points
函数有 prototype（实例共享原型），对象有内部 [[Prototype]]（即 __proto__）指向其原型
属性查找沿 __proto__ 向上直到 null，这条链就是原型链；找不到返回 undefined
new 出来的实例，其 __proto__ 指向构造函数的 prototype
class 是原型继承的语法糖：子类 prototype.__proto__ 指向父类 prototype
原型上的引用类型属性被所有实例共享，是常见坑

@steps
先区分 prototype（函数的）和 __proto__（对象的）这两个概念
讲属性查找如何沿原型链向上，直到 null
把 class / extends 还原成原型关系，点明语法糖本质
提边界：共享引用属性、用 Object.getPrototypeOf 代替 __proto__
落到 instanceof 实现：沿 __proto__ 爬，比对 prototype

@followups
class 和原型继承什么关系？——class 是原型继承的语法糖，extends 设置子类 prototype.__proto__ 为父类 prototype
为什么原型上的引用属性会被共享？——所有实例 __proto__ 指向同一原型对象，引用属性只有一份
Object.create(null) 的原型链？——没有原型，__proto__ 为 null，连 toString 都没有
怎么判断「自有属性」还是「继承属性」？——obj.hasOwnProperty('x') 为 true 表示自身拥有

@example
### 1. 原型链查找与共享属性坑

```javascript
function Person(name) {
  this.name = name
}
Person.prototype.say = function () { return this.name }

const p = new Person('Tom')
console.log(p.name)   // 'Tom' —— 自身属性
console.log(p.say())  // 'Tom' —— 原型上的方法，沿链找到
console.log(p.__proto__ === Person.prototype)        // true
console.log(Person.prototype.__proto__ === Object.prototype) // true
console.log(Object.prototype.__proto__)              // null —— 链顶

// 改原型上的引用属性会影响所有实例
Person.prototype.hobbies = []
const p2 = new Person('Amy')
p.hobbies.push('code')
console.log(p2.hobbies) // ['code'] —— 被共享了
```

### 2. 手写 instanceof

```javascript
/**
 * 手写 instanceof：沿 left 的原型链向上，看能否碰到 right.prototype
 * @param {*} left 实例
 * @param {Function} right 构造函数
 */
function myInstanceof(left, right) {
  if (left === null || (typeof left !== 'object' && typeof left !== 'function')) return false
  let proto = Object.getPrototypeOf(left) // 等价于 left.__proto__
  const prototype = right.prototype
  while (proto !== null) {
    if (proto === prototype) return true // 命中构造函数的原型
    proto = Object.getPrototypeOf(proto)  // 继续向上爬
  }
  return false // 爬到 null 都没碰到
}

console.log(myInstanceof([], Array))   // true
console.log(myInstanceof({}, Array))    // false
console.log(myInstanceof('a', String)) // false（原始值不是对象）
console.log(myInstanceof(new Date(), Object)) // true
```

### 3. class 语法糖还原成原型关系

```javascript
class A { static s() {} method() {} }
class B extends A { method() {} }

console.log(B.prototype.__proto__ === A.prototype) // true —— 方法继承链
console.log(B.__proto__ === A)                     // true —— 静态方法也继承
const b = new B()
console.log(b.__proto__ === B.prototype)           // true
```

## 06 · this 的指向规则，手写 call / apply / bind

@id
js-this

@level
手写题

@freq
3

@tags
this | call | bind

@ask
this 的指向规则你是怎么记的？给我一个完整的优先级排序。然后手写 call、apply、bind，注意细节。

@oral
**结论**：this 是谁，不看函数定义在哪，而看函数「怎么被调用」。我用四步优先级记：**new 绑定 > 显式绑定(call/apply/bind) > 隐式绑定(对象调用) > 默认绑定(全局 / undefined)**。箭头函数例外，它没自己的 this，直接捕获外层词法 this。

**原理**。默认绑定下，非严格模式 this 是全局对象，严格模式是 undefined。隐式绑定：obj.fn() 调用时 this 是 obj；但把方法单独赋值出来再调用（const f = obj.fn; f()）会丢失 this，变成默认绑定。显式绑定：call/apply/bind 强行指定 this。new 绑定：new Foo() 时 this 是新建的对象，且若构造函数 return 一个对象则 this 被替换。优先级上 new 最高，因为它能覆盖显式绑定（new 时传的 this 会被忽略）。

**真实场景**：数组 forEach 里写普通函数想用 this，结果丢了，改成箭头函数或 bind 一次就解决了；事件回调里用箭头函数保证 this 指向组件实例。

**边界与取舍**：call/apply 立即执行、区别只在参数形式（apply 收数组）；bind 返回新函数且可「柯里化」预置参数、且 new 被绑函数时 this 仍是新实例（bind 的硬绑定可被 new 推翻，这是实现要处理的细节）。

**收尾**：手写这三个就是用 Symbol 当临时键把函数挂到目标对象上执行，bind 还要支持柯里化和 new 语义。

@points
this 取决于调用方式而非定义位置，箭头函数捕获外层 this 且无自己的 this
优先级：new 绑定 > 显式绑定(call/apply/bind) > 隐式绑定(对象调用) > 默认绑定
隐式绑定会「丢失」：方法被取出单独调用时 this 退回到默认绑定
call 立即执行收散列参数，apply 收数组，bind 返回绑定后的新函数
bind 返回的函数可 new，此时 this 是新实例（硬绑定被 new 覆盖）

@steps
先给四档优先级，强调「看怎么调用」
讲默认/隐式/显式/new 各自规则与丢失 this 的经典坑
说明箭头函数无 this、捕获词法 this
讲 call/apply 区别（参数形式）和 bind 的柯里化
落到手写：临时键挂函数执行实现 call，apply 改参数，bind 返回柯里化且兼容 new 的函数

@followups
箭头函数能用 call 改 this 吗？——不能，箭头函数没有自己的 this，call/apply/bind 传的 this 被忽略
隐式绑定为什么会丢失？——方法被赋值给变量后调用，与对象的关联断开，退化成默认绑定
bind 返回的函数还能 new 吗？——能，且 new 时绑定的 this 会被新建对象覆盖（硬绑定失效）
new 和 call 同时用（new fn.call(obj)）指向谁？——new 优先级更高，this 是新建实例

@example
### 1. 四条规则的演示

```javascript
// 默认绑定（严格模式 undefined，非严格全局）
function f() { return this }
const obj = { f }
console.log(obj.f() === obj) // true —— 隐式绑定，this 是 obj
const g = obj.f
console.log(g() === obj)     // false —— 取出后丢失 this，退化默认绑定

// 箭头函数无自己的 this
const arrow = () => this
console.log(arrow.call({ x: 1 })) // 仍是外层 this，call 改不了

// new 绑定优先级最高
function Foo() { this.v = 1 }
const bound = Foo.bind({ v: 99 })
console.log(new bound().v) // 1 —— new 覆盖了 bind 的 this
```

### 2. 手写 call / apply

```javascript
// 手写 call：用临时键把函数挂到目标对象上执行
Function.prototype.myCall = function (ctx, ...args) {
  ctx = ctx == null ? globalThis : Object(ctx) // null/undefined 转全局，原始值装箱
  const key = Symbol('fn') // 避免覆盖已有属性
  ctx[key] = this          // this 是调用 myCall 的函数
  const result = ctx[key](...args) // 作为 obj 方法调用，this 即 ctx
  delete ctx[key]          // 清理临时键
  return result
}

// 手写 apply：仅参数形式不同（收数组）
Function.prototype.myApply = function (ctx, args = []) {
  ctx = ctx == null ? globalThis : Object(ctx)
  const key = Symbol('fn')
  ctx[key] = this
  const result = ctx[key](...args)
  delete ctx[key]
  return result
}

console.log(Math.max.myCall(null, 1, 2, 3)) // 3
console.log(Math.max.myApply(null, [1, 2, 3])) // 3
```

### 3. 手写 bind（柯里化 + 兼容 new）

```javascript
// 手写 bind：返回柯里化且兼容 new 的函数
Function.prototype.myBind = function (ctx, ...preset) {
  const self = this
  function bound(...args) {
    const isNew = this instanceof bound // new 调用时 this 是新建实例
    return self.apply(isNew ? this : ctx, [...preset, ...args])
  }
  bound.prototype = Object.create(self.prototype) // 保持原型链，new 时 instanceof 正确
  return bound
}

function add(a, b) { return a + b + this.base }
const add10 = add.myBind({ base: 10 }, 1)
console.log(add10(2)) // 13 —— 1 + 2 + 10
console.log(new add10(2) instanceof add) // 原型链保持，语义正确
```
