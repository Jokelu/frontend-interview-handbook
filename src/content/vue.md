---
id: vue
name: Vue
en: Vue 3 Ecosystem
icon: component
color: #41b883
order: 5
desc: 响应式原理、编译期优化与组件通信，Vue 岗的核心考点全部在这里。
---

## 01 · Vue3 响应式原理：Proxy 相比 defineProperty 好在哪

@id
vue-reactivity

@level
高级

@freq
3

@tags
响应式 | Proxy | defineProperty

@ask
你讲讲 Vue3 的响应式原理，为什么要从 defineProperty 换成 Proxy？Proxy 到底好在哪，能解决哪些 defineProperty 解决不了的问题？

@oral
**先给结论**：Vue3 用 Proxy 重写了响应式系统，核心就是为了弥补 `Object.defineProperty` 的天然缺陷——它只能劫持「已经存在的属性」，而且数组和新增/删除属性都很麻烦，Proxy 则能拦截「对象的任意读写、增删、枚举」行为。

**原理层面**：`defineProperty` 是在初始化时遍历对象的每个 key，用 `Object.defineProperty` 给它们逐个包一层 getter/setter，所以一开始没声明的属性，后来加进去是监听不到的，得靠 `Vue.set` 那种 hack 去补救；数组也是同理，直接改 length 或下标 Vue2 拦不住，只能重写 7 个数组方法。Proxy 完全不同，它是「代理整个对象」，返回一个代理对象，拦截 `get / set / has / deleteProperty / ownKeys` 等 13 种 trap。所以你给对象新增属性、删除属性、甚至用 `for...in`、Symbol key，它都能感知到。

**真实项目场景**：我做过一个动态表单配置器，字段完全由后端 JSON 下发，用户还能自定义新增字段。Vue2 里每加一个字段就得 `this.$set`，不然视图不更新，踩了一堆坑；迁到 Vue3 后直接 `form.newField = xxx` 就生效，代码清爽很多。还有删字段，Vue2 删不掉响应式标记，Vue3 的 `delete obj.x` 直接触发依赖更新。

**边界与取舍**：Proxy 不是万能的，它只能代理「一层」对象，嵌套对象需要「懒代理」——访问到子对象时才递归生成代理；而且 Proxy 有兼容性下限（不兼容 IE），这也是当年 Vue2 没用的原因。另外 Proxy 对 `[]` 下标和 `length` 的改动都能拦截，所以 Vue3 直接废弃了 Vue2 那套数组方法重写。

**收尾**：所以回答「好在哪」就三点：能监听属性增删、能监听数组索引和 length、对 Map/Set 等集合类型也有原生支持，整体更彻底、更少 hack。

@points
Proxy 代理的是「整个对象」而非逐个属性，能拦截读写、增删、枚举等 13 种操作
Object.defineProperty 只能劫持初始化时已存在的属性，新增/删除属性需 Vue.set 等 hack 补救
Vue2 数组靠重写 7 个方法实现响应式，Proxy 直接拦截下标与 length 改动
Proxy 对 Map/Set/WeakMap 等集合类型有原生支持，Vue2 完全做不到
Proxy 需「懒代理」处理嵌套对象，且 IE 不兼容是它当年没被采用的主因

@steps
先点出 defineProperty 的致命限制：只能监听已声明属性、数组操作受限
讲 Proxy 的 trap 机制：get/set/has/deleteProperty/ownKeys 等统一拦截
对比新增属性、删除属性、数组下标三种场景在 2 与 3 下的差异
解释「懒代理」如何实现深层响应式，说明递归代理的触发时机
补充边界：兼容性与性能取舍，引到 Vue3 废弃数组方法重写的决策

@followups
Proxy 能拦截所有操作吗？——不能拦截 Object.defineProperty 在被代理对象上再定义属性，也无法代理某些内置对象如 Date 的内部 [[DateValue]] 状态
为什么 Proxy 不能兼容 IE？——因为 Proxy 是 ES6 语法层面特性，无法用 polyfill 模拟，defineProperty 则是 ES5 可降级的
深层对象不会自动被代理吗？——不会，Vue3 采用懒代理，只有在 get 访问到子对象时才为它生成 Proxy

@example
### 1. defineProperty 的盲区：新增属性监听不到

```javascript
// Vue2 思路：初始化时逐个 key 包 getter/setter
function defineReactive(obj, key, val) {
  Object.defineProperty(obj, key, {
    get() { track(key); return val },
    set(newVal) { val = newVal; trigger(key) },
  })
}

const state = {}
defineReactive(state, 'name', 'vue2')
state.name = 'a'          // 触发 setter，视图更新
state.age = 18            // 完全监听不到！age 从没被 defineProperty 过
// Vue2 只能靠 this.$set(state, 'age', 18) 这种 hack 兜底
```

### 2. Proxy 的最小实现：代理整个对象

```javascript
// 极简响应式：用 Proxy 拦截 get/set
function reactive(target) {
  return new Proxy(target, {
    get(obj, key, receiver) {
      track(obj, key)                 // 依赖收集
      const res = Reflect.get(obj, key, receiver)
      // 懒代理：子对象访问时才递归包 Proxy
      return typeof res === 'object' && res !== null ? reactive(res) : res
    },
    set(obj, key, value, receiver) {
      const result = Reflect.set(obj, key, value, receiver)
      trigger(obj, key)               // 触发更新
      return result                  // set trap 必须返回布尔值
    },
    deleteProperty(obj, key) {
      const had = key in obj
      const result = Reflect.deleteProperty(obj, key)
      if (had) trigger(obj, key)      // 删除属性也能被感知
      return result
    },
  })
}

const state = reactive({ name: 'vue3' })
state.age = 18        // 新增属性直接响应，无需任何 hack
delete state.name     // 删除属性也能触发更新
```

### 3. 数组：2 靠重写方法，3 靠拦截 index

```javascript
// Vue2：必须重写 push/pop/splice 等 7 个方法才能监听
const arr = reactive([]) // Vue2 内部把 __proto__ 指向重写后的数组原型

// Vue3：Proxy 直接拦下标与 length
const list = reactive([1, 2, 3])
list[0] = 99     // set trap 触发，视图更新
list.length = 0  // set trap 对 length 也生效，Vue2 做不到这点
```

## 02 · ref 和 reactive 有什么区别，底层怎么实现的

@id
vue-ref-reactive

@level
进阶

@freq
3

@tags
ref | reactive | 响应式

@ask
ref 和 reactive 到底有什么区别？我项目里该用哪个？它们底层分别是怎么实现的？

@oral
**一句话结论**：reactive 只能代理「对象/数组」本身，返回的是原对象的 Proxy；ref 是对「任意值」的包裹，用 `.value` 存取，底层其实也是把 `.value` 上的对象再 reactive 化。

**原理**：reactive 直接对传入对象套一层 Proxy（就是我们上一题写的那个），所以它是「深响应式」——访问到的每个子对象都是 Proxy。但有个坑：reactive 的返回值必须「一直拿着这个返回值用」，如果你把它解构成局部变量再返回，响应式就断了，因为它只是对象的引用而已。ref 则是定义了一个「包装对象」`{ value: x }`，只对 `.value` 这一个 key 做 get/set 拦截；所以不管你是 number、string 还是对象，都能用 ref 包。当 ref 的 `.value` 本身是个对象时，Vue3 会调用 `toReactive` 把它再 reactive 一次，所以 `ref({})` 的内部对象也是响应式的。

**真实场景**：我一般「基本类型用 ref，复杂对象用 reactive」只是表面经验。真正决定因素是会不会解构丢失引用——比如一个表单对象我整体用 reactive，但某个要单独传给子组件、或要在 setup 顶层解构出来的字段就用 ref。模板里 ref 会自动解包（不需要写 `.value`），但在 JS 逻辑里必须显式 `.value`，这是新人最容易踩的点。

**边界与取舍**：ref 在模板和 reactive 内部会自动「解包」，但当成数组元素或 Map 的 value 时不会自动解包，得手动 `.value`；另外 `isRef` / `unref` / `toRefs` 这些工具就是用来处理这些边界的。`toRefs(reactiveObj)` 能把每个属性转成 ref，保证解构后响应式不丢。

**收尾**：所以选型心法——要整体 reactive、且不解构，用 reactive；要跨函数传递、要解构、或基本类型，用 ref。

@points
reactive 返回原对象的 Proxy，只代理对象/数组；ref 包裹任意值，靠 .value 存取
reactive 解构后会丢失响应式，因为只是引用；ref 解构仍是 ref 包装
ref 的 .value 若本身是对象，内部会再 reactive 化（toReactive），所以深层也响应式
模板和 reactive 内部会自动解包 ref，但数组元素/Map value 中不会
toRefs 把 reactive 属性转成 ref，用于安全解构

@steps
先讲 reactive 是对对象直接套 Proxy，强调「解构即失效」
讲 ref 是 { value } 包装，底层在 value 上拦截 get/set
说明 ref 对象内部经 toReactive 处理，所以值对象也响应式
讲自动解包的几种边界场景（模板、reactive 内、数组/Map 内）
给选型建议与 toRefs/isRef 等工具的使用时机

@followups
为什么 reactive 解构会丢失响应式？——解构拿到的是原始值/引用拷贝，脱离了对 Proxy 的访问，get/set 拦截不再触发
ref 在模板里为什么不用写 .value？——编译器在编译阶段对顶层 ref 做了自动解包（unref）处理
toRefs 和 toRef 有什么区别？——toRefs 批量转所有属性，toRef 只针对单个 key 且能指向可能不存在的属性

@example
### 1. reactive 的引用陷阱

```javascript
import { reactive } from 'vue'

const state = reactive({ count: 0, nested: { x: 1 } })
const { count } = state  // 解构：count 拿到的是原始 number，再改它不会触发更新
state.count++           // 通过 Proxy 访问才响应

// 正确做法：要解构就用 toRefs
import { toRefs } from 'vue'
const { count: countRef } = toRefs(state) // 这是 ref，响应式保留
```

### 2. ref 与 reactive 的底层骨架

```javascript
// reactive：直接给对象套 Proxy
function reactive(target) {
  return new Proxy(target, baseHandlers) // get/set 中做依赖收集与触发
}

// ref：本质是一个带 value 的包装对象
function ref(value) {
  const wrapper = {
    get value() { track(wrapper, 'value'); return value },
    set value(newVal) {
      value = newVal
      trigger(wrapper, 'value')
    },
  }
  // 若值是对象，内部再 reactive 化
  if (isObject(value)) value = reactive(value)
  return wrapper
}
```

### 3. 自动解包的边界

```vue
<script setup>
import { ref, reactive } from 'vue'
const count = ref(0)
const state = reactive({ count: ref(5) }) // reactive 内嵌 ref 自动解包
</script>

<template>
  <!-- 模板顶层 ref 自动解包，不用写 .value -->
  <button @click="count++">{{ count }}</button>
  <!-- reactive 里的 ref 也自动解包 -->
  <span>{{ state.count }}</span>
</template>

<script>
// 但放进数组就不会自动解包
const list = reactive([ref(1)]) // list[0] 仍然是 ref，需 list[0].value
</script>
```

## 03 · computed 为什么有缓存，它怎么知道依赖变了

@id
vue-computed

@level
进阶

@freq
3

@tags
computed | 缓存 | 依赖收集

@ask
computed 为什么有缓存？它是怎么知道自己的依赖变了才重新算的？和 methods 比有什么不一样？

@oral
**一句话结论**：computed 本质是一个「带脏标记（dirty flag）的响应式懒计算」，它依赖了哪些东西、靠响应式系统的依赖收集自动记录；只有当依赖变化把它标记为脏，下次访问才会重算，否则直接返回缓存。

**原理**：computed 内部维护一个 `value`（计算结果）和一个 `dirty` 标志。它在创建时会生成一个 effect（副作用函数），但和 watchEffect 不同，这个 effect 默认是「懒执行」的——不会立刻跑，而是在你第一次读取 computed 的 `.value` 时才执行函数、收集依赖，并把结果存进 `value`、把 `dirty` 置为 false。当它依赖的那些响应式数据变化时，响应式系统会触发这个 effect，但它不立刻重算，只是把 `dirty` 置为 true。等下次再访问 `.value`，发现 `dirty === true` 才真正重算并刷新 `value`。

**真实场景**：我有个列表页要根据 `keyword` 和 `list` 算出 `filteredList`，如果用 method 每次渲染都重算一遍（哪怕 keyword 没变），列表上千条时很浪费；用 computed 之后，只有 keyword 或 list 变才重算，其它渲染直接拿缓存。还有个易错点：computed 里不要写有副作用的代码（比如改其它状态），因为它是「缓存的、可能被跳过的」，会造成不可预期的结果。

**边界与取舍**：computed 是「只读」的，默认不能 `computed.value = x`；要可写得传 setter。另外 computed 的缓存是「单例缓存」——多个地方读同一个 computed 只算一次。注意：在 effect（如 watchEffect 或渲染）里访问 computed 才会建立「computed → 依赖」这条链，纯逻辑里手动访问也会触发计算。

**收尾**：对比一下——methods 每次调用都执行、不缓存；computed 基于依赖缓存、依赖不变不重算；watch 是「监听变化做副作用」而不是算值。三者职责完全不同。

@points
computed 内部维护 value 与 dirty 标记，访问时才计算并缓存
创建时生成 lazy effect，首次读 .value 才执行并收集依赖
依赖变化时只把 dirty 置为 true，下次访问才真正重算（懒更新）
computed 默认只读，要赋值需提供 setter
与 methods 比有缓存、与 watch 比它是算值而非做副作用

@steps
先说明 computed = 带 dirty flag 的响应式计算
讲它如何「懒」：首次访问触发 effect 收集依赖并算值
讲依赖变化时为何不立即重算，只置 dirty
讲下次访问根据 dirty 决定复用缓存还是重算
对比 methods / watch，点出三者职责区别与副作用禁忌

@followups
computed 的依赖是怎么收集到的？——首次访问 .value 时，effect 运行并读取内部响应式数据，自然被这些数据的 dep 收集
为什么 computed 里不能写副作用？——因为缓存可能跳过执行，副作用时机不确定，会造成状态不一致
computed 和 watch 谁先执行？——依赖变化后，computed 的 dirty 先被置位，watch 的回调在 flush 阶段按依赖顺序执行

@example
### 1. 手写一个带缓存的 computed

```javascript
function computed(getter) {
  let value
  let dirty = true
  const effectFn = effect(getter, {
    lazy: true,
    scheduler() { dirty = true }, // 依赖变化只置脏，不重算
  })
  return {
    get value() {
      if (dirty) {
        value = effectFn() // 真正重算并写入缓存
        dirty = false
      }
      return value
    },
  }
}

// 用法
const sum = computed(() => data.a + data.b)
console.log(sum.value) // 首次访问，执行 getter，a+b 存进缓存
data.a = 10            // 触发 scheduler，dirty = true
console.log(sum.value) // 重新计算
```

### 2. computed vs methods 的渲染差异

```vue
<script setup>
import { ref, computed } from 'vue'
const list = ref(Array.from({ length: 1000 }, (_, i) => i))
const keyword = ref('')
// computed：keyword / list 不变就复用缓存
const filtered = computed(() => list.value.filter(x => String(x).includes(keyword.value)))
// method：每次渲染都重新 filter 一遍，无缓存
function filterMethod() { return list.value.filter(x => String(x).includes(keyword.value)) }
</script>

<template>
  <!-- 这两种写法结果一样，但 filtered 有缓存，filterMethod() 每帧重算 -->
  <li v-for="n in filtered" :key="n">{{ n }}</li>
</template>
```

### 3. 可写 computed

```javascript
const firstName = ref('张')
const lastName = ref('三')
const fullName = computed({
  get: () => firstName.value + lastName.value,
  set(val) {
    [firstName.value, lastName.value] = val.split('') // 写回依赖
  },
})
fullName.value = '李四' // 触发 setter，firstName/lastName 被更新
```

## 04 · watch 和 watchEffect 的区别，什么时候用哪个

@id
vue-watch

@level
基础

@freq
3

@tags
watch | watchEffect | 副作用

@ask
watch 和 watchEffect 到底有什么区别？实际项目里你一般怎么选？

@oral
**一句话结论**：watch 是「明确监听某个源、回调里拿到新旧值」，watchEffect 是「自动收集回调里用到的依赖、依赖变就重跑」，一个是指定源、一个是自动追踪。

**原理**：watch 需要你显式传入要监听的 source（一个 ref、reactive 的某个属性、或 getter 函数），它内部对这个 source 建立 effect；只有当 source 变化时才执行回调，回调参数直接给 `(newVal, oldVal)`，还能用 `flush` 控制时机、用 `deep` 深度监听。watchEffect 不需要指定源，它一上来就立刻执行一次你的回调来做依赖收集——回调里访问到的所有响应式数据，都会自动成为它的依赖；之后任何一个依赖变了，回调就重跑。所以 watchEffect 第一次执行是有副作用的（常用于「初始化就跑一次」），watch 默认是「变化才跑」。

**真实场景**：我做「路由参数变化重新拉数据」时用 watch，因为我要明确监听 `route.params.id` 的新旧值去发请求；而做「主题色跟随某个状态、或者把某些 state 同步到 localStorage」时用 watchEffect，因为监听的就是回调里那几个值，写出来最省事——比如 `watchEffect(() => localStorage.setItem('theme', theme.value))`，theme 一变就自动存。

**边界与取舍**：watchEffect 拿不到旧值，因为它不知道你关心哪个；要拿旧值就得用 watch。另外 watchEffect 默认是「立即执行」的，如果不想上来就跑一次，得手动加标志位，或者用 watch 的 `{ immediate: true }` 配合。还有 `flush: 'post'` 让回调在 DOM 更新后跑，`'pre'`（默认）在更新前，处理 DOM 相关逻辑时很关键。

**收尾**：经验法则——要拿新旧值、只想监听特定源，用 watch；想「自动追踪、一变法就跑、不在意旧值」，用 watchEffect。

@points
watch 需显式指定监听源，回调拿到 newVal/oldVal；watchEffect 自动收集依赖
watchEffect 立即执行一次做依赖收集，watch 默认变化才跑
watchEffect 拿不到旧值，watch 可以
两者都支持 flush 控制时机（pre/post）与停止监听
选型：特定源+新旧值用 watch，自动追踪+副作用用 watchEffect

@steps
先点出核心差别：指定源 vs 自动追踪
讲 watch 的 source、回调参数 (new, old)、deep/immediate 选项
讲 watchEffect 立即执行收集依赖的机制，旧值不可得
讲 flush 在不同时机执行的意义（尤其 DOM 更新后）
给真实场景的选型建议，收尾

@followups
watchEffect 怎么停止？——调用它返回的 stop 函数即可；组件卸载时 Vue 会自动调
watch 的 deep 为什么有性能代价？——深层对象要递归遍历每个属性建立依赖，对象大时开销明显
watch 监听 reactive 对象整体要怎么写？——直接传对象会隐式 deep，建议用 getter 只监听具体字段以减少开销

@example
### 1. watch：明确源 + 新旧值

```javascript
import { watch, ref } from 'vue'

const count = ref(0)
watch(count, (newVal, oldVal) => {
  console.log(`从 ${oldVal} 变成 ${newVal}`)
}, { immediate: true }) // immediate 让它在挂载时就跑一次

// 监听多个源用数组
const a = ref(1), b = ref(2)
watch([a, b], ([newA, newB], [oldA, oldB]) => {
  console.log(newA, newB)
})
```

### 2. watchEffect：自动追踪

```javascript
import { watchEffect, ref } from 'vue'

const theme = ref('dark')
// 立即执行一次（收集 theme 为依赖），theme 一变就重跑
const stop = watchEffect(() => {
  localStorage.setItem('theme', theme.value)
})
// 需要停止时
stop()
```

### 3. flush 控制 DOM 时机

```javascript
import { watch, ref } from 'vue'

const list = ref([])
watch(list, () => {
  // 默认 flush:'pre'，此时 DOM 还没更新
}, { flush: 'post' }) // 改成 post，回调在 DOM 更新完成后执行，可安全读 DOM
```

## 05 · 组件通信有哪些方式，分别适合什么场景

@id
vue-communication

@level
基础

@freq
3

@tags
组件通信 | props | provide

@ask
Vue 组件之间通信有哪些方式？每种你一般什么时候用？

@oral
**一句话结论**：Vue 的组件通信可以按「方向」和「距离」来选——父子用 props/emits，跨层用 provide/inject，兄弟或全局用状态库（Pinia），还有 ref 直接调子组件、事件总线兜底等。

**原理与全家桶**：最基础的是父子：父传子用 `props`（单向数据流，子组件不能直接改，要改就 emit 事件让父改，或用 `v-model` 语法糖）；子传父用 `emits` 派发事件。再往上是 provide/inject，祖先 provide 一个值，任意后代 inject 拿到，适合「主题、locale、当前用户」这种注入型数据，它跳过了中间组件的逐层透传，但要注意它不是响应式双向的——要响应式得 provide 一个 ref/reactive。距离更远、关系松散的（比如毫无父子关系的两个模块、或者全局共享的用户信息、购物车），就该用 Pinia 这种集中式状态管理。还有 `ref` / `defineExpose` 让父组件直接拿到子组件实例去调用方法（适合命令式交互，比如让子表单校验）。最后 EventBus（mitt 之类）适合完全没有父子关系的「广播」，但耦合隐蔽、难维护，我一般只在对复用组件解耦时用。

**真实场景**：列表页和筛选栏是父子，用 props + emit；一个「当前语言」要从顶层 App 透到很深的翻译组件，用 provide/inject 最省事，否则要层层 prop 传；用户登录态、购物车这种全局数据，直接 Pinia；一个弹窗组件需要父去调 `open()`，用 ref + expose。

**边界与取舍**：props 不是「不能改」，而是单向——子组件改自己的 props 会告警，规范做法是 emit 回去或本地拷贝一份。provide/inject 的缺点是「谁 provide 的不清晰」，大型项目滥用会很难追溯数据流，所以只放真正的全局注入。EventBus 容易造成「幽灵事件」，能用状态管理的就别用。

**收尾**：选型的层次就是——近父子走 props/emits，跨层注入走 provide/inject，全局共享走 Pinia，命令式调用走 ref/expose。

@points
父子：props 单向下行、emits 上行，子不直接改 props
跨层：provide/inject 跳过多级透传，响应式需注入 ref/reactive
全局共享：Pinia 集中式管理，适合用户态、购物车等
命令式交互：父用 ref + 子 defineExpose 调用方法
解耦广播：mitt 事件总线，但易成幽灵事件，慎用

@steps
先按「通信距离」把方式分类，给整体心智模型
讲父子：props/emits 与单向数据流原则
讲跨层：provide/inject 的用法与响应式注意点
讲全局与命令式：Pinia 与 ref/expose 的适用场景
补边界：EventBus 风险与滥用 provide 的隐患，给选型总结

@followups
props 能在子组件里改吗？——直接改会告警；正确做法是 emit 回父组件，或用 v-model，或本地复制一份 state
provide/inject 怎么做到响应式？——provide 一个 ref 或 reactive，inject 侧拿到的是同一引用，自然响应
为什么大型项目慎用 EventBus？——事件流向不可见、易产生重复监听和内存泄漏，调试困难

@example
### 1. 父子：props + emits + v-model

```vue
<!-- Child.vue -->
<script setup>
const props = defineProps({ modelValue: String })
const emit = defineEmits(['update:modelValue'])
function onChange(e) {
  emit('update:modelValue', e.target.value) // 不直接改 props
}
</script>

<!-- Parent.vue -->
<template>
  <Child v-model="name" /> <!-- 等价于 :modelValue + @update:modelValue -->
</template>
```

### 2. 跨层：provide / inject

```vue
<!-- Ancestor.vue -->
<script setup>
import { provide, ref } from 'vue'
const locale = ref('zh')
provide('locale', locale) // 注入一个 ref，后代可响应
</script>

<!-- DeepChild.vue -->
<script setup>
import { inject } from 'vue'
const locale = inject('locale', 'zh') // 第二个参数是默认值
</script>
```

### 3. 命令式：ref + defineExpose

```vue
<!-- Modal.vue -->
<script setup>
function open() { /* ... */ }
defineExpose({ open }) // 显式暴露，父才能拿到
</script>

<!-- Parent.vue -->
<script setup>
import { ref } from 'vue'
const modalRef = ref()
modalRef.value.open() // 直接调子组件方法
</script>
<template><Modal ref="modalRef" /></template>
```

## 06 · 组件上的 v-model 是怎么实现的（Vue3 与 Vue2 的差异）

@id
vue-v-model

@level
进阶

@freq
3

@tags
v-model | 双向绑定 | 自定义组件

@ask
组件上的 v-model 是怎么实现的？Vue3 和 Vue2 比有什么区别？

@oral
**一句话结论**：v-model 本质就是「语法糖」——在原生元素上是 `:value` + `@input` 的缩写；在组件上是 `:modelValue` + `@update:modelValue` 的缩写，子组件通过 emit 这个事件把新值抛回去。Vue3 相比 Vue2 最大的变化是：默认 prop 从 `value` 改成 `modelValue`，而且支持多个 v-model 和自定义修饰符。

**原理**：Vue2 里一个组件只能有一个 v-model，背后是 `:value` + `@input`，prop 名固定叫 `value`，事件固定叫 `input`；想改名字得用 `model` 选项。Vue3 把这套重写为：默认 prop 是 `modelValue`，默认事件是 `update:modelValue`，所以 `<Child v-model="x" />` 完整展开就是 `<Child :modelValue="x" @update:modelValue="x = $event" />`。因为这次重写，Vue3 支持一个组件上写多个 v-model，比如 `<Child v-model:title="a" v-model:content="b" />`，各自对应 `title`/`update:title` 和 `content`/`update:content`。还能绑定修饰符，比如 `v-model.trim`，Vue3 会把修饰符作为一个 prop（如 `modelModifiers`）传给子组件，让你自己决定怎么处理。

**真实场景**：我做表单弹窗时，父组件用一个 `v-model="visible"` 控制显隐，子组件内部关弹窗时 `emit('update:modelValue', false)`；做富文本编辑器组件时用了 `v-model:html` 和 `v-model:text` 两个绑定，分别同步 HTML 和纯文本，这在 Vue2 单 v-model 下得自己造轮子。

**边界与取舍**：Vue3 还把 `.sync` 修饰符废弃了，统一收敛到 `v-model:xxx` 的写法，这是和 Vue2 的一个重要差异（Vue2.3+ 用 `:title.sync` 实现多绑定，Vue3 用 `v-model:title`）。另外自定义修饰符处理时，要注意 `update:modelValue` 的 payload 在修饰符里已经被你改过，父组件拿到的是处理后的值。

**收尾**：记忆点——Vue2 是 value+input、单 v-model、可 .sync；Vue3 是 modelValue+update:modelValue、多 v-model、修饰符可自定义。

@points
v-model 是语法糖：组件上等价于 :modelValue + @update:modelValue
Vue2 默认 prop 是 value、事件是 input；Vue3 改成 modelValue / update:modelValue
Vue3 支持多个 v-model（v-model:title / v-model:content），Vue2 只能一个
Vue2 多绑定靠 .sync；Vue3 用 v-model:xxx 统一替代，废弃 .sync
自定义修饰符通过 modelModifiers 等 prop 传入，由子组件自行处理

@steps
先说 v-model 是语法糖，分原生元素和组件两种情况
讲 Vue2 的 value/input 与 model 选项限制
讲 Vue3 的 modelValue/update:modelValue 重写
讲 Vue3 多 v-model 与修饰符机制，对比 Vue2 的 .sync
给真实组件场景，收尾差异记忆点

@followups
Vue3 为什么把 value 改成 modelValue？——为避免和原生 value 属性语义冲突，并支持多个双向绑定
多个 v-model 怎么实现的？——每个 v-model:xxx 生成一对 :xxx 与 @update:xxx，互不影响
自定义修饰符怎么拿到？——Vue3 会注入 xxxModifiers prop（如 modelModifiers），子组件读取后处理值

@example
### 1. Vue3 单 v-model 展开

```vue
<!-- 父组件 -->
<Child v-model="name" />
<!-- 等价于 -->
<Child :modelValue="name" @update:modelValue="name = $event" />

<!-- Child.vue -->
<script setup>
const props = defineProps(['modelValue'])
const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <input :value="modelValue" @input="emit('update:modelValue', $event.target.value)" />
</template>
```

### 2. Vue3 多 v-model + 修饰符

```vue
<!-- 父组件：两个独立双向绑定 -->
<Editor v-model:html="h" v-model:text="t" />

<!-- Editor.vue -->
<script setup>
const props = defineProps({
  html: String,
  text: String,
  htmlModifiers: { default: () => ({}) }, // 修饰符以 prop 形式注入
})
const emit = defineEmits(['update:html', 'update:text'])
function onInput(e) {
  let val = e.target.value
  if (props.htmlModifiers.trim) val = val.trim() // 子组件自行处理修饰符
  emit('update:html', val)
}
</script>
```

### 3. Vue2 对比（回忆）

```vue
<!-- Vue2：单 v-model，value + input -->
<Child v-model="name" />
<!-- 多绑定用 .sync（Vue3 已废弃） -->
<Child :title.sync="title" />
<!-- 等价于 -->
<Child :title="title" @update:title="title = $event" />
```

## 07 · nextTick 的原理，为什么改了数据 DOM 还没更新

@id
vue-nexttick

@level
进阶

@freq
3

@tags
nextTick | 微任务 | 异步更新

@ask
nextTick 是什么原理？为什么我改了数据，DOM 还没立刻更新？

@oral
**一句话结论**：Vue 的视图更新是「异步批量」的——你改数据并不会立刻操作 DOM，而是把这次变更对应的更新函数（effect）推到一个队列里，等当前同步代码跑完、微任务阶段才统一 flush，所以你改完立刻读 DOM 读到的还是旧的；nextTick 就是「等这一轮 flush 结束后，再执行你的回调」。

**原理**：Vue 在响应式数据被改时，触发依赖的 effect，但 effect 不会马上跑，而是调用 `queueJob` 把自己塞进一个更新队列，并去重（同一个组件多次改只排一次）。然后在当前宏任务结束、微任务（Promise.then / MutationObserver，降级到 setTimeout）里执行 `flushJobs`，按组件父→子顺序、并清空队列，这时候才真正去 patch DOM。nextTick 内部维护一个 `pending` 标志和 callbacks 数组：你调 `nextTick(fn)`，fn 被推进 callbacks；如果还没排过 `Promise.then(flushCallbacks)`，就排一个；flush 时先执行 Vue 自己的队列、再执行用户的 callbacks，所以你的回调一定在 DOM 更新之后。

**真实场景**：我做过一个「改完列表数据后，自动滚动到底部」的需求。一开始直接 `list.push(...); el.scrollTop = el.scrollHeight`，结果 scrollHeight 还是旧的——因为 DOM 还没刷新。改成 `await nextTick()` 之后再设 scrollTop 就对了。还有「对话框打开后聚焦输入框」也要等 DOM 渲染完再 `input.focus()`。

**边界与取舍**：Vue3 的 nextTick 基于 Promise 微任务（不再是 Vue2 的 macroTask 降级优先），所以它在同一事件循环的微任务里完成，比 setTimeout 更快、时机更靠前。但要注意，nextTick 只保证「DOM 已 flush 这个组件」，如果你等的是子组件内部的 DOM，只要它们在同一个更新周期里、父组件 flush 时子组件也会一起 patch，所以通常没问题；跨了多个更新周期就要多次 await。

**收尾**：一句话记住——改数据不立刻改 DOM 是为了「合并多次修改、避免重复渲染」，nextTick 是「等合并后的渲染真正落地」的回调点。

@points
Vue 更新是异步批量的：改数据只是把 effect 入队，当前同步代码跑完才 flush
nextTick 把回调放进队列，在 Vue 的 DOM 更新（flushJobs）之后执行
Vue 对同一组件的多次数据改动会去重，只渲染一次
Vue3 的 nextTick 基于 Promise 微任务，比 setTimeout 更早执行
常见用途：更新后读 DOM、聚焦、滚动定位等需在渲染落地后操作

@steps
先解释「为什么 DOM 没立刻变」：异步批量更新机制
讲 queueJob 去重入队与 flushJobs 统一执行
讲 nextTick 如何用 Promise 微任务把用户回调排到 flush 之后
讲 Vue3 基于微任务、区别于 Vue2 的降级策略
给真实场景（滚动/聚焦）与注意事项

@followups
为什么要把更新放进队列而不是立刻执行？——避免同一轮多次改数据触发多次渲染，合并成一次提升性能
nextTick 和 setTimeout 谁先执行？——nextTick 基于 Promise.then（微任务），早于 setTimeout（宏任务）
同一轮多次改 props 会渲染几次？——去重后只渲染一次，无论改多少次

@example
### 1. 手写一个最小 nextTick

```javascript
let pending = false
const callbacks = []
function flushCallbacks() {
  pending = false
  const copies = callbacks.slice(0)
  callbacks.length = 0
  copies.forEach((cb) => cb())
}
function nextTick(cb) {
  return new Promise((resolve) => {
    callbacks.push(() => {
      try { cb && cb() } finally { resolve() }
    })
    if (!pending) {
      pending = true
      // 微任务优先；浏览器环境用 Promise，Node 用 process.nextTick
      Promise.resolve().then(flushCallbacks)
    }
  })
}
```

### 2. 异步批量更新（去重）

```javascript
const queue = new Set()
let flushing = false
function queueJob(job) {
  queue.add(job)          // 同一 job 只会进一次，自动去重
  if (!flushing) {
    flushing = true
    Promise.resolve().then(() => { // 微任务里统一执行
      queue.forEach((j) => j())
      queue.clear()
      flushing = false
    })
  }
}
```

### 3. 真实场景：更新后操作 DOM

```vue
<script setup>
import { ref, nextTick } from 'vue'
const list = ref([])
const box = ref(null)
async function addAndScroll() {
  list.value.push('new item')
  await nextTick() // 等 DOM 真正渲染完
  box.value.scrollTop = box.value.scrollHeight // 此刻读到的是最新高度
}
</script>
```

## 08 · diff 算法怎么工作的，key 到底起什么作用

@id
vue-diff

@level
高级

@freq
3

@tags
diff | 虚拟DOM | key

@ask
Vue 的 diff 算法到底怎么工作的？key 有什么用，为什么不能用 index 当 key？

@oral
**一句话结论**：Vue 的 diff 是在「同层级、同类型」的虚拟节点之间比对的算法，key 的作用就是给每个节点一个「稳定身份」，让算法能准确判断「这是同一个节点、只是位置/内容变了」，还是「节点被增删了」。

**原理**：Vue3 的 patch 过程（基于 inferno 思路优化过的）是「先比头和尾、再做中间乱序处理」。同层比对时，如果新旧节点类型（tag）不同，直接销毁旧的、建新的，不做细比；类型相同才进入 patch 子节点。比子节点时，Vue 用 key 把「旧 children」建成一个 key→节点的映射表，然后遍历新 children：能按 key 找到旧节点就复用（只更新变化的属性/内容），找不到就新建；如果新旧顺序不同，算法会通过「最长递增子序列」算出最少移动次数，尽量只移动、不重建 DOM。没有 key 时，Vue 只能「就地复用」——按位置一一对应去 patch，这会导致状态错乱。

**为什么不能用 index 当 key**：index 是「位置」不是「身份」。列表做删除/排序时，元素的位置变了但 index 没变，Vue 会误以为「还是那个节点」而复用，结果输入框的值、组件内部 state 都被错误地保留在了错误的行上。举个例子：一个带输入框的列表，删掉第 0 项后，原来第 1 项的输入框内容会「跑到」第 0 项——因为它的 index 从 1 变成了 0，被就地复用。用业务 id 当 key，身份稳定，删除第 0 项只移除对应节点，其余各归各位。

**真实场景**：我做过一个可拖拽排序的表格，一开始用 index 当 key，拖完顺序后某些行的高亮状态和编辑态全串了；换成每行数据的唯一 `rowId` 当 key 后，复用关系正确，bug 消失。

**边界与取舍**：key 只要在同一层兄弟节点里唯一即可，不需要全局唯一。静态节点（没有 key、也不会变）Vue3 会在编译期直接跳过 diff。另外 key 设成随机数每次都变，反而会让所有节点每次都重建，性能最差，千万别这么干。

**收尾**：核心就一句——key 是节点的「身份证」，让 diff 在「复用」和「重建」之间做对决策；index 当 key 等于把身份证换成座位号，人换了座位号却没变，系统就认错人了。

@points
Vue diff 在同层、同类型节点间比对，类型不同直接销毁重建
key 为节点提供稳定身份，使算法能复用而非就地 patch
Vue3 用 key 建映射表 + 最长递增子序列，算出最少移动次数
index 当 key 是位置而非身份，删除/排序会导致状态错乱
key 只要求同层兄弟唯一，设随机数反而每次全量重建

@steps
先讲 diff 的范围：同层、同类型才细比，否则重建
讲 key 如何建立「旧→新」映射，实现节点复用
讲无 key 时「就地复用」的错误复用问题
讲为什么 index 当 key 在增删/排序时会串状态
讲 Vue3 的最长递增子序列优化与 key 使用的边界

@followups
没有 key 时 Vue 怎么处理？——按位置逐一 patch（就地复用），可能导致组件 state 错配
为什么 index 当 key 删除首行会出错？——删第 0 项后，后续项 index 前移被复用，输入框等内容跟随错位
最长递增子序列在 diff 里干嘛？——算出哪些节点位置相对有序可不动，其余只需移动，最小化 DOM 操作

@example
### 1. 为什么 index 当 key 会串状态

```vue
<!-- 列表：每项是一个带输入框的组件，key 用 index -->
<li v-for="(item, i) in list" :key="i">
  <Child :data="item" />
</li>

<!-- 初始 list = [A, B, C]，输入框分别填了 a / b / c -->
<!-- 删除第 0 项后 list = [B, C]，但 key 变成 0/1 -->
<!-- Vue 认为 key=0 还是原来那个，于是把 A 的输入框（a）复用到了 B 上，错乱 -->
```

### 2. 正确做法：用业务唯一 id

```vue
<li v-for="item in list" :key="item.id">
  <!-- 删第 0 项，只有 id=A 的节点被移除，B/C 各归各位，state 不串 -->
  <Child :data="item" />
</li>
```

### 3. diff 复用核心示意（简化）

```javascript
// 旧 children: [ {key:'a'}, {key:'b'}, {key:'c'} ]
// 新 children: [ {key:'b'}, {key:'a'}, {key:'c'} ]
// 1. 用 key 建旧表：{ a:0, b:1, c:2 }
// 2. 遍历新表，按 key 找到可复用节点
// 3. 通过最长递增子序列判断：c 位置相对有序不动，只需移动 a、b
// 4. 复用真实 DOM 节点，只做必要的属性/顺序更新，而不是销毁重建
```

## 09 · keep-alive 的实现原理与缓存控制

@id
vue-keep-alive

@level
进阶

@freq
2

@tags
keep-alive | 缓存 | 组件

@ask
keep-alive 是怎么实现组件缓存的？它的 include/exclude/max 怎么用，生命周期有什么变化？

@oral
**一句话结论**：keep-alive 是一个「抽象组件」——它自己不渲染任何 DOM，而是把被包裹组件的「组件实例」缓存起来（连同它的 DOM 和状态），切走时不销毁、切回来时直接复用，从而跳过重复的创建/挂载开销。

**原理**：keep-alive 在内部维护一个 `cache`（Map，key 一般是组件 vnode 的 key 或组件名）和一个 `keys` 队列。它实现了自定义的 render：当它渲染时，会取出默认插槽里那个子组件的 vnode，给它打上特殊标识，然后调用 `cacheVNode` 把「渲染好的实例」存进 cache。关键是它劫持了子组件的 `mounted`/`unmounted` 时机——组件第一次进入时正常 mount，但切走时 keep-alive 不会真正 unmount，而是把实例从「激活」移到「停用」状态（触发 `deactivated`），缓存里继续留着；再进来时直接从缓存取出、重新 `activated`，跳过 `created`/`mounted` 那一套。

**缓存控制**：`include` / `exclude` 用逗号分隔的组件名或正则来白名单/黑名单，只有匹配的才缓存；`max` 限制缓存实例数量，超过时用「LRU」策略——最近最少使用的那个被踢出（配合 keys 队列，访问时把 key 移到队尾，超出容量时删队首）。

**真实场景**：我做过后台管理系统的多标签页，每个页签内容多、初始化重（要拉接口、建图表）。用 `<keep-alive :max="10">` 包住 `<router-view>`，切走的页签状态（滚动位置、表单填写）都还在，回来秒开；同时 `max` 防止页签开太多把内存撑爆。某些页（比如实时大盘）不想缓存，就用 `exclude="Dashboard"` 排除。

**边界与取舍**：被缓存的组件不会走 `onMounted` 第二次，所以「每次进入都要刷新数据」的逻辑要放到 `onActivated` 里，而不是 `onMounted`——这是新手最常踩的坑。另外 keep-alive 只能包「一个」直接子组件（或 router-view），包多个要用 `v-if` 控制只渲染一个，否则行为不符合预期。

**收尾**：记住——keep-alive 缓存的是「组件实例 + DOM」，靠 activated/deactivated 接管生命周期，配合 include/max 做精细化控制。

@points
keep-alive 是抽象组件，缓存子组件的实例与 DOM，切走不销毁
内部用 cache Map + keys 队列，首次 mount、之后走 activated/deactivated
include/exclude 按组件名或正则控制哪些缓存
max 限制缓存数，超出按 LRU 淘汰最久未用的实例
被缓存组件不重复 onMounted，刷新逻辑应放 onActivated

@steps
先讲 keep-alive 是抽象组件、不渲染 DOM，只做缓存
讲 cache/keys 如何存实例、激活与停用如何切换
讲 include/exclude 的命中规则
讲 max + LRU 的淘汰机制
讲 onActivated/onDeactivated 的生命周期变化与常见踩坑

@followups
组件切回来还会走 mounted 吗？——不会，只触发 activated；created/mounted 只在首次进入执行一次
max 超出时删哪个？——按 LRU，删除最久没被访问（keys 队首）的缓存实例
怎么让某个页面每次进入都刷新？——把数据拉取等逻辑放进 onActivated，而不是 onMounted

@example
### 1. 基本用法与生命周期

```vue
<template>
  <keep-alive :max="10" exclude="Dashboard">
    <router-view /> <!-- 被路由渲染的组件实例会被缓存 -->
  </keep-alive>
</template>

<script setup>
import { onActivated, onDeactivated, onMounted } from 'vue'
// 普通组件内
onMounted(() => console.log('只首次进入执行一次'))
onActivated(() => console.log('每次从缓存切回来都执行')) // 刷新逻辑放这
onDeactivated(() => console.log('切走但没销毁'))
</script>
```

### 2. 缓存命中判定（示意）

```javascript
// keep-alive 内部用组件名做 key 来判断缓存
const cache = new Map()
const keys = []

function getCacheKey(vnode) {
  return vnode.type.name || vnode.key // 组件名或 vnode key
}

// include / exclude 过滤
function matches(pattern, name) {
  if (Array.isArray(pattern)) return pattern.includes(name)
  if (typeof pattern === 'string') return pattern.split(',').includes(name)
  return pattern.test(name) // 正则
}
```

### 3. LRU 淘汰（示意）

```javascript
function pruneCacheEntry(key) {
  const vnode = cache.get(key)
  if (vnode) unmount(vnode) // 真正销毁被踢出的实例
  cache.delete(key)
  keys.splice(keys.indexOf(key), 1)
}
// 访问时把 key 移到队尾表示「最近用过」
function touch(key) {
  keys.splice(keys.indexOf(key), 1)
  keys.push(key)
}
// 超出 max：删队首（最久未用）
if (keys.length > max) pruneCacheEntry(keys[0])
```

## 10 · Vue3 模板编译做了哪些优化（静态提升、PatchFlag）

@id
vue-compiler-optimize

@level
高级

@freq
3

@tags
编译优化 | PatchFlag | 性能

@ask
Vue3 在模板编译阶段做了哪些优化？静态提升和 PatchFlag 具体是怎么提速的？

@oral
**一句话结论**：Vue3 把大量工作从「运行时」搬到了「编译时」——编译器在把模板编译成 render 函数时，就静态分析出哪些节点永远不变、哪些属性会动态变，于是用「静态提升」避免重复创建，用「PatchFlag」让运行时 diff 只检查真正会变的部分。

**原理之静态提升（hoistStatic）**：模板里那些完全静态的节点（没有插值、没有绑定）在编译时只会被创建一次，提升到 `render` 函数外面的常量里，每次渲染直接复用同一个 vnode 引用，而不是每次都调用 `createElement` 重新建。这样减少了函数调用开销，也因为引用相同，diff 时可以直接跳过（sameVNode 为 true 就不动它）。Vue3 还会对「静态属性」做进一步的 `cacheStatic`，把静态 vnode 缓存起来。

**原理之 PatchFlag**：对于动态节点，编译器会给它打上一个「补丁标记」数字，比如 `TEXT`（只有文本变）、`CLASS`、`PROPS`（并有具体的动态属性数组）、`FULL_PROPS` 等。运行时 patch 时读取这个 flag，就只去更新对应那一项——比如只标了 TEXT，就只比文本、根本不去碰 class、style 或子节点。更进一步，编译器还会生成「动态 props 的列表」，运行时更新属性时只遍历这个短名单，而不是整个 props 对象。

**还有哪些优化**：`Block Tree`——把模板里所有的「动态节点」收集到一个 block 里，diff 时只遍历这些动态节点（忽略静态），把复杂度从「整棵树」降到「动态节点集合」；`cacheHandlers` 把事件处理函数缓存起来避免每次重新创建；`hoistStatic` 配合 `patchFlag` 让静态结构几乎零成本。

**真实场景**：我做过一个列表页，表头 10 列是纯静态文字、只有单元格内容动态。Vue2 每次渲染都要递归比对整张表；Vue3 编译后表头被提升、单元格带 PatchFlag，diff 只动单元格文本，列表上千行时渲染开销明显下降。

**边界与取舍**：这些优化是「编译期」做的，所以必须走 `.vue` 单文件编译或 `vue-loader`；如果用运行时编译（`full build`），拿不到这些优化，性能会退化。另外动态绑定越多、越分散，PatchFlag 的收益越小——把「会变」和「不变」的部分在模板上拆清楚，能最大化编译优化。

**收尾**：一句话——Vue3 用「编译时分析」换取「运行时更少的 diff 工作量」，静态提升省创建、PatchFlag + Block 省比对。

@points
静态提升（hoistStatic）：静态节点只创建一次并复用，减少重复建 vnode
PatchFlag：编译期给动态节点打标记，运行时只更新对应类型（如文本/class）
动态 props 列表：运行时只遍历真正变化的属性，而非整个 props
Block Tree：收集所有动态节点，diff 只遍历动态部分，跳过静态
优化依赖编译期分析，运行时编译（full build）拿不到这些收益

@steps
先点明「编译时搬工作量到运行时」的核心思路
讲静态提升：静态节点提升到 render 外、引用复用、diff 跳过
讲 PatchFlag：动态标记让 patch 只更新指定维度
讲 Block Tree 与动态 props 列表如何缩小 diff 范围
讲 cacheHandlers 与「必须走编译期」的边界，收尾

@followups
PatchFlag 是怎么被运行时读到的？——编译后 vnode 带 patchFlag 字段，patch 时按位判断要更新哪类内容
静态提升有什么代价吗？——基本无；但过度内联的静态结构仍可能被提升，反而省了创建开销
为什么运行时编译没有这些优化？——full build 在浏览器里即时编译，没做静态分析与标记，退回全量 diff

@example
### 1. 静态提升对比

```javascript
// 编译前模板
// <div><span class="static">标题</span><p>{{ msg }}</p></div>

// Vue2 运行时：每次渲染都调用 _c 重新创建静态 span
render() {
  return _c('div', [_c('span', { staticClass: 'static' }, ['标题']), _c('p', [msg])])
}

// Vue3 编译后：静态 span 提升到外部常量，render 内直接复用引用
const _hoisted = createElementVNode('span', { class: 'static' }, '标题', -1 /* HOISTED */)
function render(_ctx) {
  return [ _hoisted, createElementVNode('p', null, toDisplayString(_ctx.msg), 1 /* TEXT */) ]
}
```

### 2. PatchFlag 标记

```javascript
// 1 = TEXT：只有文本会变，patch 时只比 children 文本
createElementVNode('p', null, _ctx.msg, 1 /* TEXT */)

// 2 = CLASS：只比 class
createElementVNode('div', { class: _ctx.cls }, null, 2 /* CLASS */)

// 8 = PROPS 且带具体属性名单，运行时只更新这几个
createElementVNode('div', { id: _ctx.id, title: _ctx.tip }, null, 8 /* PROPS */, ['id', 'title'])
```

### 3. Block Tree 收集动态节点

```javascript
// 编译后，openBlock 收集本次渲染的所有动态节点进一个数组
// diff 时只遍历这个数组（动态节点集合），静态节点被整体跳过
function render(_ctx) {
  return (openBlock(), createElementBlock('div', null, [
    _hoisted,                                   // 静态，跳过
    createElementVNode('p', null, _ctx.msg, 1), // 动态，进 block
  ]))
}
```

## 11 · 组合式 API 相比选项式 API 解决了什么问题

@id
vue-composition-api

@level
进阶

@freq
3

@tags
composition API | 逻辑复用 | setup

@ask
组合式 API 相比选项式 API 解决了什么问题？为什么 Vue3 要推它？

@oral
**一句话结论**：选项式 API 把「同一块逻辑」按「选项类型」（data、methods、computed、watch）切碎分散在不同地方，组合式 API 则让你可以按「功能」把相关状态和行为组织在一起，并通过「组合函数（composables）」实现真正可复用的逻辑封装。

**原理与痛点**：在选项式 API 里，一个「搜索功能」要在 data 里放 keyword/loading/result，在 methods 里放 doSearch，在 computed 里放 filtered，在 watch 里放防抖——同一功能散落在 4 个选项里。组件一大，读代码要上下反复跳，这就是著名的「逻辑碎片化」。更致命的是逻辑复用：选项式只能用 mixins，但 mixins 有「命名冲突、来源不明、数据来源不可追溯」三大问题。组合式 API 把逻辑写成「返回响应式状态的普通函数」（composable，如 `useFetch`、`useMouse`），在 `setup` 里调用，相关代码天然聚在一起；复用就是 import 函数，完全没有 mixins 的副作用。

**真实场景**：我做过一个带「鼠标位置、视口尺寸、网络状态」三者监听的组件。选项式得写三套 data + 三套 mounted/onUnmounted 监听，互相穿插；改成组合式后，`useMouse()`/`useWindowSize()`/`useOnline()` 三个函数直接 `setup` 里调用，每个函数内部自包含「状态 + 监听 + 清理」，模板里直接用，组件清爽很多。做跨组件的逻辑复用（比如所有表单都要的「防抖提交」）也只要抽一个 `useDebouncedSubmit` 到处 import。

**边界与取舍**：组合式不是银弹——它更灵活也更需要自律，函数里如果随便依赖外部变量会很难维护；官方建议 composable 只依赖传入参数和模块级状态。另外选项式 API 在 Vue3 仍完整保留，老项目不必强迁；但新项目、复杂组件强烈建议组合式。`<script setup>` 是组合式最顺手的语法糖，编译期把顶层绑定自动暴露给模板。

**收尾**：一句话——组合式 API 把「按类型组织」改成「按功能组织」，并用函数解决了 mixins 复用那堆老大难问题。

@points
选项式 API 按选项类型切分逻辑，导致同一功能碎片化、跨选项跳跃
选项式复用靠 mixins，存在命名冲突、来源不明、不可追溯问题
组合式 API 按功能聚合状态与行为，代码内聚、可读性强
逻辑复用靠 composable 函数，无 mixins 副作用，可随意 import
<script setup> 是组合式最佳语法糖；选项式在 Vue3 仍保留兼容

@steps
先指选项式 API 的「逻辑碎片化」痛点
讲 mixins 复用的三大缺陷
讲组合式如何按功能聚合、用 setup 组织
讲 composable 函数实现无副作用的逻辑复用
讲 <script setup> 与「不必强迁但新项目推荐」的取舍

@followups
composable 和普通函数有什么区别？——它内部使用响应式 API（ref/reactive）并在其中建立生命周期/监听，返回响应式状态
mixin 和 composable 谁更容易出 bug？——mixin 易命名冲突且来源隐晦；composable 显式调用、依赖清晰
<script setup> 里的变量怎么暴露给模板？——顶层声明的变量/函数编译期自动暴露，无需 return

@example
### 1. 选项式：同一功能碎片化

```javascript
// 一个搜索功能被切碎到 4 个选项
export default {
  data() { return { keyword: '', loading: false, result: [] } },
  computed: { filtered() { return this.result.filter(/* ... */) } },
  methods: { async doSearch() { /* 防抖请求 */ } },
  watch: { keyword: 'doSearch' }, // 逻辑散落四处，阅读要反复跳转
}
```

### 2. 组合式：按功能聚合 + 复用

```javascript
// composables/useSearch.js —— 逻辑自包含、可复用
import { ref, watch } from 'vue'
export function useSearch(fetcher) {
  const keyword = ref('')
  const loading = ref(false)
  const result = ref([])
  watch(keyword, async () => {
    loading.value = true
    result.value = await fetcher(keyword.value)
    loading.value = false
  })
  return { keyword, loading, result } // 返回响应式状态
}

// 组件里直接调用，相关逻辑内聚
import { useSearch } from '@/composables/useSearch'
const { keyword, loading, result } = useSearch(fetchUsers)
```

### 3. <script setup> 语法糖

```vue
<script setup>
import { ref, onMounted } from 'vue'
const count = ref(0) // 顶层声明，模板直接用，无需 return
onMounted(() => console.log('mounted'))
</script>

<template>
  <button @click="count++">{{ count }}</button>
</template>
```

## 12 · Pinia 相比 Vuex 的改进与实现原理

@id
vue-pinia

@level
进阶

@freq
2

@tags
Pinia | Vuex | 状态管理

@ask
Pinia 相比 Vuex 有什么改进？它的实现原理大概是怎样的？

@oral
**一句话结论**：Pinia 是 Vue 官方新一代状态库，相比 Vuex 去掉了「mutation 这个冗余概念」、不再区分同步/异步、没有烦人的 `namespaced` 嵌套，API 更简洁，而且它本身就是建立在 Vue3 的响应式（reactive）之上，类型推导几乎是零成本的。

**原理之改进点**：Vuex 强制你「state + getter + mutation + action」四件套，而且改状态必须 `commit` 一个 mutation（mutation 才是唯一能改 state 的地方，且必须同步），异步逻辑放 action、action 再 commit mutation——这套约定在大型项目里非常啰嗦，而且 TS 类型推导很痛苦。Pinia 砍掉了 mutation：你可以直接在 action 里改 `this.xxx = yyy`，也可以不在 action 里、直接在组件里改 state（Pinia 不强制）。它用 `defineStore` 定义 store，`state` 就是一个返回对象的函数（内部用 `reactive` 包起来），`getters` 就是 computed，`actions` 就是方法（支持 async/await 任意写）。

**原理之实现**：Pinia 的核心是「每个 store 用 `reactive` 包装 state、用 `computed` 包装 getters、用普通函数包装 actions」，所以天然就是响应式的，改动自动触发视图更新——它复用了 Vue 自身的响应式系统，而不是像 Vuex 那样自己维护一套订阅。Pinia 内部为每个 store 维护一个 `state` 响应式对象和依赖收集；调用 `$patch` 可以批量改 state（做一次性触发，性能更好）；`$subscribe` 监听状态变化（比 Vuex 的 subscribe 更细）。

**真实场景**：我迁移一个老项目时，原来 Vuex 一个「更新用户信息」要写 action 调接口、再 commit 两个 mutation、还要 `mapState` 映射，模板一大串。换成 Pinia 后，`store.updateUser()` 一个 action 里直接 `this.user = res` 搞定，组件里 `storeToRefs(store)` 拿响应式状态，类型提示全程到位。

**边界与取舍**：Pinia 不强制 mutation，但官方仍建议「复杂业务改动走 action」，保持可追踪（action 能被 devtools 记录）。Vuex 的严格模式在 Pinia 里通过 `$subscribe` + 约定替代。另外 Pinia 没有 Vuex 的 module 嵌套地狱，store 之间是平级、可互相 import 的，但要小心循环依赖。

**收尾**：记忆点——Pinia = 更少的样板（无 mutation/namespaced）+ 复用 Vue 响应式 + 一等公民 TS 支持。

@points
Pinia 去掉 mutation，action 可直接改 state，不再区分同步/异步
无 namespaced，store 平级可互引，告别 module 嵌套
state 用 reactive、getters 用 computed、actions 用函数，复用 Vue 响应式
$patch 批量更新、$subscribe 细粒度监听
一等公民 TS 类型推导，比 Vuex 的 mapXXX 体验好太多

@steps
先讲 Vuex 的 mutation/action 冗余与类型痛点
讲 Pinia 砍掉 mutation、action 直接改 state 的简化
讲 defineStore 三件套（state/getters/actions）与响应式实现
讲 $patch / $subscribe 等能力
讲 TS 支持、store 平级结构与迁移收益，收尾

@followups
Pinia 里想严格管控状态改动怎么办？——仍把改动收敛到 action 里，便于 devtools 追踪，只是不再语法强制
Pinia 的 state 为什么是函数返回？——保证每个 store 实例有独立的状态副本，避免多实例共享污染
Pinia 和 Vuex 谁更适合 TS？——Pinia 基于 reactive/ref，类型可自动推导；Vuex 需大量泛型标注 map 辅助

@example
### 1. Vuex 啰嗦写法（对比）

```javascript
// Vuex：四件套 + commit + map
const store = new Vuex.Store({
  state: { count: 0 },
  mutations: { increment(s, n) { s.count += n } }, // 唯一能改 state 的同步入口
  actions: { asyncAdd({ commit }, n) { commit('increment', n) } }, // 异步走 action
})
// 组件
computed: { ...mapState(['count']) },
methods: { ...mapActions(['asyncAdd']) },
```

### 2. Pinia 简洁写法

```javascript
// stores/counter.js
import { defineStore } from 'pinia'
export const useCounter = defineStore('counter', {
  state: () => ({ count: 0 }),
  getters: { double: (s) => s.count * 2 },
  actions: {
    async increment(n) {            // 异步 action 直接改 state，无需 mutation
      const res = await api(n)
      this.count += res
    },
  },
})

// 组件
import { useCounter } from '@/stores/counter'
import { storeToRefs } from 'pinia'
const store = useCounter()
const { count, double } = storeToRefs(store) // 响应式解构
store.increment(1) // 直接调
```

### 3. Pinia 底层响应式示意

```javascript
// 简化：Pinia 内部用 reactive 包 state、computed 包 getter
import { reactive, computed } from 'vue'

function defineStore(options) {
  const state = reactive(options.state())
  const getters = Object.fromEntries(
    Object.entries(options.getters).map(([k, fn]) => [k, computed(() => fn(state))])
  )
  const actions = Object.fromEntries(
    Object.entries(options.actions).map(([k, fn]) => [
      k, fn.bind({ ...state, ...getters }), // action 内 this 指向 state
    ])
  )
  return () => ({ ...state, ...getters, ...actions })
}
```
