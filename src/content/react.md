---
id: react
name: React
en: React 18 & Hooks
icon: atom
color: #0891b2
order: 6
desc: Fiber 架构、Hooks 原理与并发特性，大厂面试的高频方向。
---

## 01 · React 的渲染流程与 Fiber 架构解决了什么问题

@id
react-fiber

@level
高级

@freq
3

@tags
Fiber | 可中断渲染 | 调度

@ask
你先整体讲讲 React 的一次渲染到底发生了什么？为什么 16 之后要搞一套 Fiber 架构？它到底解决了什么真问题，又带来了什么新成本？

@oral
**先说结论**：React 16 引入的 Fiber 是一套「可中断、可恢复、可调度」的渲染架构，核心是把原来递归不可中断的 diff 改造成一个个工作单元，按时间切片逐步完成，从而解决「大组件树更新时主线程被长时间占用、页面掉帧卡顿」的问题。

**再说原理**。在 Fiber 之前 React 用的是 Stack Reconciler，它递归地遍历组件树做 diff，这个递归一旦开始就必须一口气走完，中间没法停下来。如果一次更新涉及几千个节点（比如大表格筛选、长列表重排），主线程会被占住上百毫秒，期间浏览器没法处理用户输入、没法执行动画，表现出来就是输入框打不出字、滚动掉帧。Fiber 的思路是：把组件树映射成一条「链表树」，每个节点都是一个 fiber 对象，上面挂着组件类型、props、state，以及 `child`（第一个子节点）、`sibling`（下一个兄弟）、`return`（父节点）三个指针。渲染过程不再是递归，而是「走一步、看一眼时间够不够、不够就先让出主线程」的循环。

**关键是两个阶段**。render 阶段（也叫协调阶段）是可中断的，它负责计算哪些节点变了、生成副作用链表（effectList），这个过程可以被调度器打断和恢复；commit 阶段是不可中断的，它把 render 阶段算好的结果一次性同步地落到真实 DOM 上、调用生命周期和 `useEffect`。所以用户永远不会看到「渲染到一半」的界面。

**讲讲真实项目里的收益**。我之前维护一个后台报表页，一次条件筛选要重渲染两三千行表格，老架构下输入会卡 200ms 以上，体验很差。迁移到 Fiber 之后，配合时间切片，重渲染被拆成很多 5ms 左右的小片，浏览器能穿插处理输入和动画，输入卡顿基本消失了，长列表滚动也顺滑了。

**边界与取舍也得说清**。第一，Fiber 不是银弹：commit 阶段仍然不可中断，极端情况下一次性 commit 大量 DOM 还是会卡；第二，并发特性（如 `startTransition`）默认不开启，需要你主动使用，Fiber 只是提供了地基；第三，任务切片、链表遍历本身有开销，对极小的组件树反而可能更慢一点点。另外 Fiber 让「渲染可重入」后，很多副作用和生命周期的执行时机变得更微妙，这正是后面 Hooks、并发特性深挖的源头。

**收尾**：所以 Fiber 的本质是「把渲染从一次性同步递归，变成可调度、可中断、可恢复的增量任务」，它为 React 18 的并发特性铺好了路。

@points
Fiber 是 React 16 引入的新协调引擎，把递归不可中断的 diff 改造成链表遍历的可中断工作单元
每个 fiber 节点用 child / sibling / return 指针串成链表树，支持「走一步退一步」的可恢复遍历
渲染分 render（可中断、可切片、生成 effectList）与 commit（同步、不可中断）两阶段
Scheduler 用约 5ms 时间切片让出主线程，配合 lane 模型做细粒度优先级调度
Fiber 解决的是「大更新阻塞主线程导致掉帧卡顿」问题，是并发特性（transition / Suspense）的地基

@steps
先点出 Stack Reconciler 的痛点：递归 diff 不可中断，长任务阻塞主线程导致卡顿掉帧
引出 Fiber 本质：组件树映射成带指针的链表，每个节点是可独立处理的工作单元
讲清两阶段：render 可中断只算副作用，commit 同步落地，用户看不到半成品
讲调度：时间切片 + lane 优先级，高优交互可打断低优渲染（如输入框打断数据加载）
结合真实性能场景说明收益，最后补「commit 不可中断、开销存在、并发默认关闭」的边界

@followups
Fiber 节点和我们常说的虚拟 DOM 节点是什么关系？——虚拟 DOM 是描述 UI 的数据结构，fiber 是在此之上叠加了调度指针（child/sibling/return）和调度状态（flags、lane、alternate）的可执行工作单元，一个组件对应一个或一组 fiber
render 阶段可以被中断，那会不会出现界面只更新了一半？——不会，DOM 只在不可中断的 commit 阶段才变更，render 中断只是暂停计算，用户看到的永远是完整的新结果
lane 模型相比老版的 expirationTime 好在哪？——lane 用二进制位表示优先级，能表达多个并发优先级、支持互相让路与合并，比单一时间戳更细粒度、更灵活

@example
### 1. 极简 Fiber 调度器：演示「可中断渲染」的核心思想

```javascript
// 极简 Fiber 调度器：只保留 React 可中断渲染的主干思想
// 真实 React 还有 lane 优先级、effectList、错误处理、Hooks 链表等，这里全部省略

// 用链表表示一个组件树：每个节点有 child（子）、sibling（兄弟）、return（父）
function createFiber(type, props) {
  return {
    type,            // div / span / 函数组件本身
    props,           // 属性与 children
    child: null,     // 第一个子 fiber
    sibling: null,   // 下一个兄弟 fiber
    return: null,    // 父 fiber，用于「走完子树后回到上层继续遍历」
    stateNode: null, // 对应的真实 DOM 实例（commit 阶段填充）
  }
}

// 全局指针：当前正在处理的工作单元，以及整棵树的根
let nextUnitOfWork = null
let workInProgressRoot = null

// 时间切片：每帧最多工作 5ms，到点就 yield 让出主线程
const TIME_BUDGET = 5

function workLoop(deadline) {
  // shouldYield 模拟 React 的「时间片用完了就让出主线程」
  const start = Date.now()
  while (nextUnitOfWork && Date.now() - start < TIME_BUDGET) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
  }
  // 没干完就等下一帧（真实环境是 requestIdleCallback / MessageChannel），这就是「可中断」
  if (nextUnitOfWork) {
    requestIdleCallback(workLoop)
  } else if (workInProgressRoot) {
    commitRoot() // render 阶段全部算完，才进入不可中断的 commit
  }
}

// 处理一个 fiber，返回「下一个要处理的工作单元」
// 遍历顺序：先走子节点 → 子节点走完走兄弟 → 兄弟走完回到父节点的兄弟
function performUnitOfWork(fiber) {
  // beginWork：这里简化为「给当前节点造一个子节点」
  if (!fiber.child && fiber.props && fiber.props.children) {
    const childProps = Array.isArray(fiber.props.children)
      ? fiber.props.children[0]
      : fiber.props.children
    const child = createFiber(childProps.type, childProps.props)
    child.return = fiber
    fiber.child = child
    return child // 优先往子节点深入
  }
  // 没有子节点了，尝试走兄弟，再不行就回到父节点向上「归」
  if (fiber.sibling) return fiber.sibling
  return fiber.return
}

function commitRoot() {
  // commit 阶段：同步把 fiber 树映射成真实 DOM，不可中断
  // 真实 React 在这里执行 DOM 插入/更新/删除、调用生命周期、触发 useEffect
  console.log('commit：DOM 已一次性更新，用户不会看到渲染到一半的界面')
  workInProgressRoot = null
}

// 启动一次「渲染」：假装根是 <div>，它有一个 <span> 子节点
workInProgressRoot = createFiber('div', { children: { type: 'span', props: {} } })
nextUnitOfWork = workInProgressRoot
requestIdleCallback(workLoop)
```

### 2. 两阶段对比：为什么 render 能中断而 commit 不能

```javascript
// 假设我们要把一个列表从 1000 项更新到 2000 项
// render 阶段：可中断，只做计算，不碰 DOM
function renderPhase(fiberTree) {
  // 遍历 2000 个节点做 diff，时间不够就暂停，下次从断点继续
  // 期间页面显示的还是旧的 1000 项，用户无感知
}

// commit 阶段：不可中断，必须一口气完成
function commitPhase(effectList) {
  // 真实 DOM 的 2000 次插入在这里同步发生
  // 如果这里被中断，页面会停在不一致状态，所以 React 不允许它中断
  effectList.forEach((effect) => applyDomEffect(effect))
}

// 这就是为什么 React 要把「计算」和「落地」分开：
// 计算可以分片让出主线程，落地必须原子化保证一致性
```

### 3. 用 lane 理解优先级：用户输入打断数据加载

```javascript
// 伪代码：lane 是 31 位的二进制，每一位代表一个优先级通道
// 0b0001 = 同步优先级（用户输入），0b0100 = 默认优先级（数据更新）
const SyncLane = 0b0001
const DefaultLane = 0b0100

// 输入框打字 → 标记 SyncLane，最高优先级，立即调度
function onInput(value) {
  scheduleUpdate(SyncLane, () => setText(value))
}

// 远程数据返回 → 标记 DefaultLane，低优先级，可以被用户输入打断
function onFetchResolve(data) {
  scheduleUpdate(DefaultLane, () => setList(data))
}

// 调度器在每次时间切片后，优先挑选「更低位（更高优先级）」的 lane 先执行
// 这就是 useTransition 能把「非紧急更新」降级、让位给交互的理论基础
```

## 02 · Hooks 为什么不能写在条件语句里，状态存在哪

@id
react-hooks-rules

@level
高级

@freq
3

@tags
Hooks | 链表 | 调用顺序

@ask
你天天写 Hooks，那我问你：为什么 useState、useEffect 不能写在 if、for 里？React 是拿什么来识别「这次的 useState 对应的是哪个状态」的？状态到底存在哪，为什么函数组件每次渲染都重新执行、状态却没丢？

@oral
**先说结论**：Hooks 能「对号入座」靠的是「每次渲染调用顺序完全一致」，React 内部用一个**链表**按顺序把每个 Hook 的状态串在 fiber 节点上；一旦你在条件语句里跳过某个 Hook，顺序就错位了，状态会张冠李戴甚至直接报错。

**再说原理**。函数组件每次渲染都会从头到尾执行一遍函数体，函数里的局部变量（let / const）每次都是全新的，根本留不住状态。真正存状态的地方是**组件对应的 fiber 节点**。每个 fiber 上有一个 `memoizedState` 指针，指向这个组件第一个 Hook 的「hook 对象」，hook 对象之间通过 `next` 指针串成一条链表。比如你写了 `const [a] = useState(0)` 再写 `const [b] = useState(1)`，那么第 1 个 hook 挂着 a 的状态，它的 `next` 指向第 2 个 hook，挂着 b 的状态。

**调用顺序就是索引**。React 在 render 阶段执行你的函数组件时，每遇到一个 Hook，就顺着链表「读当前、移向下一个」：useState 读 `memoizedState` 当前节点拿到 a，再 `next` 拿到 b。它**不看名字、不看变量、只认顺序**。所以只要每次渲染 Hook 的调用次序一模一样，链表节点和状态就能精准对应。

**那条件语句为什么炸**。假设第一个 useState 外面套了 `if (flag)`，第一次渲染 flag 为 true，调用了 3 个 Hook；第二次 flag 变 false，只调用了 2 个。第二次 React 按链表取状态时，第 2 个位置拿到的其实是第一次第 3 个 Hook 的状态，直接错位。React 还会抛出 `Rendered fewer hooks than expected` 或 `more hooks` 的报错来阻止这种不一致。

**真实场景里的坑**。我见过有人把 `useEffect` 写在了 `if (someCondition)` 里，想「满足条件才监听」，结果条件变化后整个组件状态全乱、甚至白屏。正确做法是 Hook 永远写在顶层，把条件放进 Hook 内部（比如 `useEffect(() => { if (!condition) return; ... }, [condition])`）。循环里调 Hook 同理——次数变了顺序就变，所以也禁止。

**边界与取舍**。Hooks 规则通过 eslint-plugin-react-hooks 的 `rules-of-hooks` 在开发期静态检查，能拦掉大部分违规。另外，`useRef` 的值也存在对应 hook 节点上（放在 `memoizedState` 里，通过 `ref.current` 访问），它不触发重渲染、却能在多次渲染间保持引用，常被用来「绕过闭包陷阱」持有最新值。

**收尾**：所以「Hooks 不能写条件里」不是语法限制，而是**顺序即索引**这条底层机制的必然要求，状态活在 fiber 链表上，不在函数闭包里。

@points
Hooks 靠「每次渲染调用顺序一致」来定位状态，React 不靠变量名、只靠顺序
组件状态存在 fiber 节点上，fiber.memoizedState 指向第一个 hook，hook 之间用 next 串成链表
函数组件每次重渲染都重新执行，局部变量会丢失，但 hook 链表在 fiber 上被保留
条件/循环导致 Hook 数量变化，链表顺序错位，状态张冠李戴并触发 React 报错
状态由 hook 对象持有：memoizedState（值）、queue（更新队列）、next（下一个 hook）

@steps
先抛出结论：Hooks 对号入座靠调用顺序，不是靠名字
讲状态存在哪：函数闭包留不住，真正在 fiber 节点的 memoizedState 链表上
画调用链路：第一个 useState 对应链表头，下一个对应 next，顺序即索引
解释条件语句的破坏：if 让某次渲染少/多一个 Hook，链表错位、状态错配并报警
给正确写法：Hook 永远顶层调用，条件放进 Hook 内部；顺带提 useRef 也挂在链表上

@followups
如果违反了规则，React 具体报什么错？——会抛 Rendered more hooks than expected 或 fewer hooks than expected，因为它按链表长度对账发现不匹配
那为什么自定义 Hook 里可以多次调用 useState？——因为自定义 Hook 在「被调用的那一行」展开成它的若干 Hook，整体仍然遵循「每次渲染顺序一致」，只要它内部不在条件里跳 Hook 就合法
useRef 的值存在哪，它为什么不触发重渲染？——ref 对象存在对应 hook 节点的 memoizedState 上，React 只对 state 变化做调度，改 ref.current 只是一个普通赋值，不参与渲染流程

@example
### 1. 手搓一个最小 Hooks：看清「顺序即索引」

```javascript
// 极简 Hooks 实现：用一条链表模拟 React 的 memoizedState
// 只支持 useState，重点演示「调用顺序」如何对应到状态

// 全局：当前正在渲染的组件（fiber 的简化版）
let currentFiber = null
// 全局：遍历链表时当前走到哪个 hook 节点
let currentHook = null
// 全局：当前是「首次挂载」还是「更新」，决定是初始化还是复用
let isMount = true

// 每个 hook 节点：存值 + 指向下一个
function createHook() {
  return { memoizedState: null, next: null }
}

// 我们的 useState：完全靠「顺序」工作，不看变量名
function useState(initial) {
  // 第一次挂载：给当前 fiber 建链表头，或往下挂一个新节点
  if (isMount) {
    const hook = createHook()
    hook.memoizedState = typeof initial === 'function' ? initial() : initial
    if (!currentFiber.memoizedState) {
      currentFiber.memoizedState = hook
      currentHook = hook
    } else {
      currentHook.next = hook
      currentHook = hook
    }
  } else {
    // 更新阶段：顺着链表走到「第 N 个」hook，直接读上次的值
    currentHook = currentHook ? currentHook.next : currentFiber.memoizedState
  }

  const setState = (action) => {
    // 真实 React 这里是把更新塞进 queue，再由调度器统一处理
    const value = typeof action === 'function' ? action(currentHook.memoizedState) : action
    currentHook.memoizedState = value
    // 触发重新渲染（这里简化为同步重跑组件函数）
    render()
  }

  // 返回 [值, 设置函数]，和 React 一模一样
  return [currentHook.memoizedState, setState]
}

// 组件函数：注意两个 useState 永远按顺序出现在顶层
function Counter() {
  const [count, setCount] = useState(0)   // 链表第 1 个节点
  const [name, setName] = useState('lyf')  // 链表第 2 个节点

  if (count > 0) {
    // 反例：把第三个 Hook 放进条件，第二次渲染 count=1 时会多调一次
    // 链表长度对不上，状态立刻错位 → 模拟里会读到错误的值
    // const [bad, setBad] = useState('bug')  // ❌ 千万别这么写
  }

  return { count, name }
}

// 模拟一次渲染：重置遍历指针，跑组件，再切到更新模式
function render() {
  currentHook = null
  currentFiber = currentFiber || { memoizedState: null }
  // 重新执行组件函数，按顺序填充/读取链表
  Counter()
  isMount = false
}
```

### 2. 条件语句如何让链表错位（对比示意）

```javascript
// 渲染第 1 次：flag = true，调用了 3 个 Hook
// 链表：[A] -> [B] -> [C]
useState(0)   // A：count
if (true) {
  useState(1) // B：temp
}
useState(2)   // C：list

// 渲染第 2 次：flag = false，只调用了 2 个 Hook
// 但链表上 React 期望的还是 [A][B][C] 三格，实际只走两格
// 第 2 格拿到的变成了「本该是 C 的 list 状态」，彻底错位
useState(0)   // A：count（对）
if (false) {
  useState(1) // 这次被跳过！
}
useState(2)   // 实际读到了链表第 2 格（B 的 temp），而不是第 3 格（C 的 list）
```

### 3. 正确姿势：条件放进 Hook 内部

```javascript
// 错误：条件包裹 Hook，破坏调用顺序
// if (open) {
//   useEffect(() => { const id = setInterval(tick, 1000); return () => clearInterval(id) }, [])
// }

// 正确：Hook 永远在顶层，条件写在内部
useEffect(() => {
  if (!open) return            // 不满足条件就直接 return，Hook 数量不变
  const id = setInterval(tick, 1000)
  return () => clearInterval(id) // 清理函数也只在 open 为真时注册
}, [open])
```

## 03 · useState 的更新是同步还是异步，批量更新怎么做的

@id
react-batching

@level
进阶

@freq
3

@tags
setState | 批量更新 | 调度

@ask
调用 setState 之后，状态是立刻变还是异步变？React 18 的批量更新到底批的是什么，为什么有时候批不上？你能在 setTimeout 里也拿到批量更新的效果吗？

@oral
**先说结论**：在 React 18 里，setState 触发的是**调度**而不是立刻改值——更新是「异步」的（更准确说是被批量调度），并且在 18 中**默认全程自动批处理**：事件处理函数、Promise、setTimeout、原生事件回调里多次调用 setState 都会被合并成一次渲染。

**再说原理**。setState 干了两件事：一是把更新对象（或函数）塞进该 Hook 的更新队列 `queue`；二是向 React 调度器请求一次重渲染。真正「计算新状态、执行渲染」被推迟到当前调用栈清空之后，由 Scheduler 在合适的时机统一做。这就是为什么 `setCount(count + 1); console.log(count)` 打印的还是旧值——因为此刻还停留在当前这次渲染的闭包里，新 state 根本没算出来。

**批量更新批的是什么**：在同一个「执行上下文」里连续多次 setState，React 不会每次都渲染，而是把它们攒进同一个 fiber 的更新队列，最后只用**最新一次** render 算出结果、只提交一次 DOM。比如一次点击里 `setA(1); setB(2); setC(3)`，DOM 只更新一次，而不是三次。这能避免中间态导致的多余渲染和闪烁。

**React 18 的关键变化**：17 及以前，批量更新只在「合成事件」和「生命周期」里生效；在 `setTimeout`、原生 `addEventListener`、Promise `.then` 里调用 setState 会**同步、逐个**刷新（不批）。React 18 引入了 automatic batching，通过统一的调度入口（`flushSync` 除外），让这些「逃逸」场景也能批量了。所以现在你在 `setTimeout` 里连着 setState，也只会渲染一次。

**什么情况下批不上**：一是用 `ReactDOM.flushSync(fn)` 强制同步刷新，fn 里的更新会立刻提交、打断批处理；二是把更新放在不同「离散事件」里（两次独立的 click），它们本来就是两次独立的批；三是直接修改 `state` 变量（不通过 setState）当然不算更新。另外更新函数式写法 `setCount(c => c + 1)` 能保证在批处理里基于最新值累加，而 `setCount(count + 1)` 依赖闭包旧值，连续调用会丢更新。

**真实场景**：我们列表页有个「全选」按钮，一次要 `setSelectedIds`、`setCount`、`setIndeterminate`，如果用 17 的写法放在 async 函数的 await 之后，会触发三次重渲染；升级 18 后自动合并成一次，交互明显更跟手。

**收尾**：所以别再说「setState 是异步的」这么笼统，准确说法是「18 默认全场景自动批处理 + 调度触发」，只有 `flushSync` 和极少数边界才会打破批处理。

@points
setState 是把更新入队并请求调度，并非立即改值；当前渲染闭包里读到的仍是旧 state
React 18 默认 automatic batching，事件、Promise、setTimeout、原生回调里的多次更新都会合并成一次渲染
批量更新合并的是「同一执行上下文」内的多次 setState，只算一次新状态、只提交一次 DOM
React 17 及以前只有合成事件/生命周期里才批，setTimeout 等场景会逐个同步刷新；18 补齐了这一点
flushSync 会强制同步提交打断批处理；连续更新用函数式写法可避免基于旧闭包导致的丢更新

@steps
先纠正误区：setState 不是「异步赋值」，而是「入队 + 请求调度」
讲清状态何时算出来：延后到当前栈清空后由 Scheduler 统一执行，所以本帧读到旧值
讲批量：同一上下文的多次更新合并进一个队列，只渲染一次
对比 17 与 18：18 把 setTimeout / Promise / 原生事件也纳入自动批处理
讲边界：flushSync 破批、离散事件是两次批、函数式更新避免旧闭包丢值

@followups
为什么 setTimeout 里 setState 在 17 不批、18 就批了？——17 只在合成事件的批量上下文里收集更新，setTimeout 脱离了该上下文就立即刷新；18 用统一的调度入口，无论来源都走同一套批处理
用 setCount(count + 1) 连续调三次，结果是多少？——如果是基于同一闭包旧值，三次都拿到同一个旧 count，最后只 +1；必须用 setCount(c => c + 1) 才能正确累加到 +3
flushSync 是什么，什么时候用？——它强制把里面的更新同步、立即提交，会打破批处理、可能造成多次渲染，仅在「必须让 DOM 此刻就更新」的极少数场景（如测量布局）使用

@example
### 1. 手搓一个最小批处理：看清「入队 + 统一刷新」

```javascript
// 极简批处理模拟：多次 setState 只触发一次 render
// 真实 React 用 Scheduler + 更新队列，这里简化为「微任务里统一 flush」

let isBatching = false          // 是否处于批量上下文中
let pendingUpdates = []         // 攒着还没执行的更新
let state = { a: 0, b: 0 }      // 当前状态

function setState(partial) {
  pendingUpdates.push(partial)  // 1) 先把更新入队，不立刻改 state
  if (!isBatching) {
    // 不在批量上下文里（如 React 17 的 setTimeout）→ 立即刷新
    flushSyncNow()
  }
}

function flushSyncNow() {
  // 2) 把攒着的所有更新一次性合并到 state，只 render 一次
  const updates = pendingUpdates
  pendingUpdates = []
  for (const u of updates) state = { ...state, ...u }
  console.log('render 一次，state =', state)
}

// 模拟 React 18 的批量上下文：包一层 batchedUpdates
function batchedUpdates(fn) {
  isBatching = true
  fn()
  flushSyncNow()               // 函数跑完，统一刷新
  isBatching = false
}

// React 18 行为：三次更新只 render 一次
batchedUpdates(() => {
  setState({ a: 1 })
  setState({ b: 2 })
  setState({ a: 3 })
})
// 输出：render 一次，state = { a: 3, b: 2 }（最后的值覆盖，只渲染一次）
```

### 2. React 17 vs 18：setTimeout 里的批处理差异

```javascript
// React 17：setTimeout 脱离合成事件上下文，每次 setState 立刻刷新 → 渲染两次
setTimeout(() => {
  setA(1) // 立刻 render
  setB(2) // 立刻 render
}, 0)

// React 18：自动批处理，setTimeout 里的多次更新也合并 → 只渲染一次
setTimeout(() => {
  setA(1) // 入队
  setB(2) // 入队
  // 函数结束后统一 flush，只 render 一次
}, 0)

// 想强制同步（18 里打破批处理）：用 flushSync
import { flushSync } from 'react-dom'
flushSync(() => {
  setA(1) // 这一下立即提交，本次批被打破
})
setB(2)   // 另起一批
```

### 3. 函数式更新：避免基于旧闭包丢更新

```javascript
function Counter() {
  const [count, setCount] = useState(0)

  // 反例：三连击都基于同一闭包里的旧 count=0，最后只 +1
  const bad = () => {
    setCount(count + 1)
    setCount(count + 1)
    setCount(count + 1) // 结果还是 1，丢了两次
  }

  // 正例：函数式更新基于「队列里的最新值」累加，三连击得到 3
  const good = () => {
    setCount((c) => c + 1)
    setCount((c) => c + 1)
    setCount((c) => c + 1) // 结果是 3
  }
}
```

## 04 · useEffect 的依赖数组与闭包陷阱怎么解决

@id
react-useeffect-closure

@level
进阶

@freq
3

@tags
useEffect | 闭包 | 依赖

@ask
useEffect 的依赖数组到底有什么用，写漏了会怎样？我经常在 effect 里拿到旧的 state，这就是闭包陷阱吧，你都有什么解法？

@oral
**先说结论**：`useEffect` 的依赖数组告诉 React「这些变量变了才重新跑 effect」；**写漏依赖会让你在 effect 里读到旧的 props / state，这就是典型的闭包陷阱**。解法无外乎四招：补全依赖、用函数式更新、用 ref 存最新值、用 `useCallback` / 提取事件函数。

**再说原理**。函数组件每次渲染都会重新执行，effect 回调函数是在「那一次渲染」的作用域里创建的，它闭包捕获的正是**那一次**的 props 和 state。依赖数组就是 React 用来判断「这次渲染的 effect 要不要重跑」的依据。如果你没把 effect 里用到的变量列进依赖，React 就不会在那些变量变化时重跑 effect，于是 effect 内部闭包里锁定的还是上一次的值——这就是「闭包陷阱」。

**举个真实例子**。一个搜索框 effect：`useEffect(() => { fetchData(keyword) }, [])`，依赖空数组，意图「只在挂载时请求一次」。可 keyword 变了它不会重跑，永远用初始值去请求，结果数据和输入框对不上。更隐蔽的是 `setInterval`：`useEffect(() => { const id = setInterval(() => console.log(count), 1000); return () => clearInterval(id) }, [])`，这里 count 永远是初始值 0，因为 effect 只挂载时跑了一次，闭包锁死了 0。

**解法一：补全依赖**。最正统、也是 ESLint `exhaustive-deps` 推荐的——把 effect 用到的每个响应式值都列进去。`useEffect(() => { fetchData(keyword) }, [keyword])`，keyword 变就重跑，拿到最新值。代价是频繁重跑，需要配合清理函数取消旧请求。

**解法二：函数式更新**。如果 effect 只是想「基于上一个状态算下一个」，不依赖闭包里的旧值，就用 `setCount(c => c + 1)`，这样无论 effect 跑不跑、闭包里 count 是多少，更新都基于队列最新值，根本不需要把 count 列进依赖。

**解法三：用 ref 持有最新值**。把会变的值同步进 `ref`，effect 里读 `ref.current`，ref 不触发重渲染、却能跨渲染保持最新引用，完美绕过闭包陷阱。最常见的就是「最新 props / 最新回调函数」模式。

**解法四：`useCallback` / 提取事件函数 + `useEvent`**。如果 effect 依赖一个函数，用 `useCallback` 把它记忆化并列入依赖；React 19 还提供了 `useEvent`，专门把「事件处理函数」从依赖里解耦，既不丢最新值、又不引发 effect 重跑。

**边界与取舍**：盲目列全依赖可能导致 effect 抖动（高频重跑），这时用 ref 或拆分 effect 更稳；清理函数（`return` 里 cancel）在依赖变化重跑前会先执行，是避免竞态请求的关键。

**收尾**：闭包陷阱不是 bug，是 JS 闭包 + 依赖数组共同作用的必然结果，核心思路永远是「要么让 effect 跟着最新值重跑，要么让被捕获的值通过 ref / 函数式更新保持新鲜」。

@points
依赖数组是 React 判断 effect 是否重跑的依据，漏写会让 effect 闭包锁定旧值，即闭包陷阱
函数组件每次渲染重建闭包，effect 捕获的是「那一次渲染」的 props / state
解法一：补全依赖（配合清理函数取消旧请求），是 ESLint exhaustive-deps 的推荐做法
解法二：用函数式更新 setX(x => ...) 不依赖闭包旧值，避免把 state 列进依赖
解法三：用 useRef 同步最新值，effect 读 ref.current 跨渲染保鲜；解法四：useCallback / useEvent 解耦函数依赖

@steps
先讲依赖数组的作用：声明「哪些值变了才重跑 effect」
点出闭包陷阱本质：effect 捕获的是某次渲染的 props/state，依赖不全就不重跑 → 旧值
给反例：空依赖的 setInterval 永远读到初始 count
逐一给四招：补全依赖 / 函数式更新 / useRef 最新值 / useCallback + useEvent
补边界：依赖全了可能抖动，用 ref 或拆分 effect 缓解；清理函数防竞态

@followups
为什么在 effect 里发请求经常拿到旧数据？——effect 闭包捕获了执行那一刻的变量，依赖没列全就不重跑，自然一直是旧值；列上依赖 + 在清理函数里 abort 旧请求即可
useRef 为什么能解决闭包陷阱？——ref 对象本身存在 fiber 上、跨渲染引用不变，effect 读 ref.current 永远是最新写入的值，不依赖闭包里的旧快照
依赖数组传空数组 [] 真的只跑一次吗？——是的，但前提是 effect 内部不依赖任何会变的外界值；一旦依赖了却写空，就会陷入闭包陷阱，所以空数组要特别谨慎

@example
### 1. 反例：setInterval 里的闭包陷阱

```javascript
function Counter() {
  const [count, setCount] = useState(0)

  // 反例：空依赖，effect 只在挂载时跑一次
  // 闭包把 count 锁死在初始值 0，之后永远是 0
  useEffect(() => {
    const id = setInterval(() => {
      console.log(count) // 永远打印 0
    }, 1000)
    return () => clearInterval(id)
  }, []) // ❌ 漏了 count
}
```

### 2. 正解一：补全依赖 + 清理函数（防竞态）

```javascript
function Search() {
  const [keyword, setKeyword] = useState('')
  const [list, setList] = useState([])

  // 正例：keyword 进依赖，变了就重跑；清理函数 abort 掉上一次请求
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/search?q=${keyword}`, { signal: controller.signal })
      .then((r) => r.json())
      .then(setList)
      .catch((e) => {
        if (e.name !== 'AbortError') throw e
      })
    return () => controller.abort() // 重跑前先取消旧请求，避免旧数据覆盖新数据
  }, [keyword]) // ✅ 依赖列全
}
```

### 3. 正解二：函数式更新，不依赖闭包旧值

```javascript
function Counter() {
  const [count, setCount] = useState(0)

  // 用函数式更新：基于队列最新值，不依赖闭包里的旧 count
  // 因此 effect 不需要把 count 列进依赖，也不会读到旧值
  useEffect(() => {
    const id = setInterval(() => {
      setCount((c) => c + 1) // ✅ 永远基于最新值 +1
    }, 1000)
    return () => clearInterval(id)
  }, []) // 这里空依赖是安全的，因为没读闭包里的 count
}
```

### 4. 正解三：useRef 持有最新值，绕过闭包

```javascript
function Chat() {
  const [msg, setMsg] = useState('')
  const latestMsg = useRef(msg)

  // 每次渲染都把最新 msg 同步进 ref
  useEffect(() => {
    latestMsg.current = msg
  }, [msg])

  useEffect(() => {
    const id = setInterval(() => {
      // 读 ref.current，永远是最新写入的值，不受 effect 闭包限制
      console.log('最新消息：', latestMsg.current)
    }, 1000)
    return () => clearInterval(id)
  }, []) // 不依赖 msg，却总能拿到最新 msg
}
```

## 05 · useMemo 和 useCallback 真的能提升性能吗

@id
react-memo

@level
进阶

@freq
3

@tags
useMemo | useCallback | memo

@ask
很多人无脑给每个函数、每个对象都包 useMemo / useCallback，你觉得这真的能提升性能吗？什么时候该用，什么时候是过度优化？

@oral
**先说结论**：`useMemo` / `useCallback` **不是性能银弹，甚至可能拖慢性能**。它们只在「产出物会被当作 props 传给被 `React.memo` 包裹的子组件，或作为其他 Hook 的依赖」时才真正起作用；否则只是白白增加比较成本和内存占用。

**再说原理**。先厘清三个东西的关系：`React.memo` 是组件级缓存，它会对 props 做**浅比较**，props 没变就跳过重渲染；`useMemo` 缓存的是「计算结果」（比如一个派生数组、一个昂贵对象）；`useCallback` 缓存的是「函数引用」。关键是：JS 里对象 / 函数每次渲染都是**新引用**，所以父组件重渲染时，即使传的 `onClick` 逻辑一模一样，子组件拿到的也是不同引用，`React.memo` 的浅比较会判定「变了」从而重渲染。

**所以 useCallback 的价值场景**：子组件被 `React.memo` 包了，父组件把 `handleClick` 当 prop 传下去，如果不用 `useCallback`，父每次渲染都生成新函数 → 子组件无谓重渲染；用 `useCallback` 锁定引用，子组件才能靠 memo 跳过重渲染。同理 `useMemo` 适合：① 计算开销很大的派生值（复杂过滤、排序、深层克隆）；② 要把对象 / 数组当 prop 传给 memo 子组件，避免引用变化引发重渲染；③ 作为 `useEffect` / `useCallback` 的依赖，避免依赖项引用频繁变化导致 effect 抖动。

**真实项目里的坑**。我接手过一个列表组件，里面十几处 `useCallback`、二十几处 `useMemo`，作者以为在优化，结果：每次渲染 React 还是要跑「依赖比较」这一小段逻辑，小的计算（比如 `a + b`）包 `useMemo` 反而比直接算还慢；更糟的是，`useMemo` 依赖写错会读到陈旧值引发 bug。我们 profiling 后发现只有两处（大列表的派生过滤、传给虚拟列表的回调）值得缓存，其余全去掉后渲染反而快了。

**边界与取舍**：`useMemo` / `useCallback` 本质是用「空间换时间」+ 牺牲一点可读性，必须配合实际测量。React 官方态度很明确：不要为了防重渲染而无脑加，先用 `React.memo` 包住真正贵重的子组件，再在 profiler 里确认「哪次重渲染是多余的」，针对性地加 `useCallback` / `useMemo`。另外 React 18 的并发渲染、`useDeferredValue`、`useTransition` 往往比手抖这两个 Hooks 更治本。

**收尾**：一句话——**先测量、再缓存；`memo` 是闸门，`useCallback` / `useMemo` 是钥匙，没有闸门钥匙没用**。

@points
useMemo / useCallback 不是银弹，它们自身有依赖比较成本和内存开销，滥用反而更慢
核心前提：引用相等——JS 函数/对象每次渲染都是新引用，导致 React.memo 浅比较失效
useCallback 的真正价值：把函数引用锁住，让被 React.memo 包裹的子组件能跳过无谓重渲染
useMemo 适合：昂贵派生计算、要当 memo 子组件 props 的对象、作为其他 Hook 的依赖
必须先测量（Profiler）再优化；没有 React.memo 这道闸门，useCallback/useMemo 往往毫无收益

@steps
先泼冷水：无脑包反而更慢，因为比较本身有成本、还占内存
讲清机制：引用相等 + React.memo 浅比较，新引用会让 memo 子组件白重渲染
划定使用场景：memo 子组件 props、昂贵计算、作为依赖项
给真实反例：全包 useMemo 后 profiling 反而更慢，该去掉
补边界：配合 Profiler 测量，并发特性（useTransition/useDeferredValue）更治本

@followups
不加 useCallback，React.memo 子组件就一定会重渲染吗？——父组件重渲染时传的函数/对象是新引用，memo 浅比较失败，子组件会重渲染；加了 useCallback 锁定引用才能跳过
useMemo 的依赖写漏了会怎样？——会返回上一次缓存的旧值，在值其实已变时造成「陈旧数据」bug，比不用还危险
那是不是能用 useTransition / useDeferredValue 替代它们？——思路不同：这两个是「让非紧急更新降级、不阻塞交互」，从并发层面减少卡顿；useMemo/useCallback 是「避免重复计算与重渲染」，两者可叠加但不可互相完全替代

@example
### 1. 反例：无脑包 useMemo 反而更慢

```javascript
function Bad() {
  const [a, setA] = useState(1)
  const [b, setB] = useState(2)

  // 反例：a + b 这种极廉价的计算也包 useMemo
  // 每次渲染都要做依赖比较 [a, b]，开销比直接相加还大
  const sum = useMemo(() => a + b, [a, b]) // ❌ 过度优化

  return <div>{sum}</div>
}
```

### 2. 正例：useCallback 让 memo 子组件跳过重渲染

```javascript
// 子组件用 React.memo 包裹，props 浅比较不变就跳过重渲染
const List = React.memo(function List({ items, onItemClick }) {
  console.log('List 重渲染了')
  return items.map((it) => <li key={it.id} onClick={() => onItemClick(it)}>{it.name}</li>)
})

function Parent() {
  const [count, setCount] = useState(0)
  const [items] = useState([{ id: 1, name: 'a' }])

  // 不用 useCallback：每次 Parent 重渲染都生成新函数 → List 跟着重渲染
  // const onItemClick = (it) => console.log(it)

  // 用 useCallback 锁定引用：count 变化时 List 不会因为 onItemClick 变化而重渲染
  const onItemClick = useCallback((it) => console.log(it), []) // ✅ 关键

  return (
    <div>
      <button onClick={() => setCount((c) => c + 1)}>count: {count}</button>
      <List items={items} onItemClick={onItemClick} />
    </div>
  )
}
```

### 3. 正例：useMemo 缓存昂贵派生值

```javascript
function SearchableList({ rows, keyword }) {
  // 正例：大数据量的过滤/排序很贵，用 useMemo 只在 rows/keyword 变时才重算
  const filtered = useMemo(() => {
    return rows
      .filter((r) => r.name.includes(keyword)) // 假设 rows 有上万条
      .sort((a, b) => a.score - b.score)
  }, [rows, keyword]) // ✅ 依赖列全，避免拿到旧数据

  return <ul>{filtered.map((r) => <li key={r.id}>{r.name}</li>)}</ul>
}
```

### 4. 组合拳：memo + useMemo + useCallback 一起用

```javascript
const Grid = React.memo(function Grid({ data, onSelect }) {
  return data.map((d) => <Cell key={d.id} value={d} onClick={onSelect} />)
})

function Page() {
  const [text, setText] = useState('')
  const [source] = useState(() => genHugeData()) // 一次性生成的大数组

  // useMemo 锁 data 引用，避免 Page 因 text 变化而重算 data
  const data = useMemo(() => source.map(transform), [source])
  // useCallback 锁 onSelect 引用，让 Grid 能靠 memo 跳过重渲染
  const onSelect = useCallback((d) => console.log(d), [])

  return (
    <>
      <input value={text} onChange={(e) => setText(e.target.value)} />
      <Grid data={data} onSelect={onSelect} />
    </>
  )
}
```

## 06 · React 合成事件是什么，和原生事件有什么区别

@id
react-synthetic-event

@level
进阶

@freq
2

@tags
合成事件 | 事件委托 | 事件池

@ask
React 的合成事件到底是什么，为什么要有它？它和原生 addEventListener 有什么区别，事件冒泡和阻止默认行为在合成事件里还是原样生效吗？

@oral
**先说结论**：React 合成事件（SyntheticEvent）是 React 在原生 DOM 事件之上包的一层**跨浏览器统一封装**，它通过「事件委托」把事件集中到根容器统一处理，既抹平了浏览器差异，又能在事件触发时拿到稳定的、带池化历史的事件对象。

**再说原理**。React 并不是给每个 DOM 节点都 `addEventListener`，而是利用**事件委托**：在 React 17 之前，所有事件都委托到 `document`；React 17 之后，委托下沉到**每个 `createRoot` 对应的根容器**（即你调用 `root.render` 的那个 DOM 节点）。当原生事件在这个根容器上冒泡触发时，React 根据事件目标（event.target）找到对应的 fiber 路径，再沿着 React 组件树**从底向上**模拟一遍 React 侧的冒泡，依次调用你在 JSX 里写的 `onClick` 等处理函数。

**和原生事件的区别**有几点：① **绑定位置不同**——原生你自己 `addEventListener` 绑在哪就在哪，React 全部委托到根容器，组件卸载时也不用逐个解绑，由 React 统一管理；② **事件对象不同**——合成事件是 React 用 `SyntheticEvent` 包出来的，属性和原生基本一致（如 `stopPropagation`、`preventDefault`、`nativeEvent`），但它是跨浏览器归一化的；③ **冒泡机制**——React 合成事件的冒泡是「在 React 组件树里冒泡」，如果你在原生 DOM 上手动监听，它走的是真实的 DOM 树冒泡，两者路径不一定完全一致，尤其在 React 17 之后委托点变了；④ **事件池（event pooling）**——React 16 及以前为了性能会复用事件对象（用完清空属性），所以在异步代码里访问 `e.target` 会得到 null，需要 `e.persist()`；**React 17 起移除了事件池**，这个坑没了，可以放心在 setTimeout 里读事件。

**真实场景的坑**。我们做过一个「点击组件外部关闭弹窗」的需求，在 `document` 上 `addEventListener('click', ...)` 来监听外部点击，但组件内部用的是 React 的 `onClick`。在 React 16 里，合成事件委托到 document，导致 document 上的原生监听和 React 合成事件「谁先谁后」很微妙，容易误关；升级到 17 后委托点变成根容器，原生监听挂在 document 反而能稳定先于合成事件拿到（因为根容器在 document 之内冒泡先到 document）。这直接影响了我们判断「原生监听和合成事件谁先触发」。

**边界与取舍**：`e.stopPropagation()` 只能阻止 React 合成事件在 React 树里继续冒泡，阻止不了原生 DOM 的冒泡；要彻底阻断原生冒泡得用 `e.nativeEvent.stopImmediatePropagation()`。另外 `preventDefault` 在 React 合成事件里对多数场景有效，但 React 不支持像 `onScroll` 这类被动事件（passive）的 `preventDefault`，这是浏览器性能限制。

**收尾**：合成事件本质是一层「委托 + 封装」，核心价值是统一 API 和自动解绑，理解它和原生事件在「委托点、冒泡路径、事件池」上的差异，才能避开那些诡异的触发顺序问题。

@points
合成事件是 React 在原生事件之上封装的跨浏览器统一事件对象，通过事件委托集中处理
React 17 起事件委托从 document 下沉到每个 createRoot 对应的根容器，影响原生与合成事件的触发先后
合成事件沿 React 组件树「自底向上」模拟冒泡，与原生 DOM 树冒泡路径可能不一致
事件池（event pooling）在 React 16 存在、17 起已移除，故 17+ 可放心在异步里读事件对象
stopPropagation 只阻断 React 侧冒泡，不阻断原生 DOM 冒泡；preventDefault 对被动事件无效

@steps
先给定义：合成事件是对原生事件的跨浏览器封装，核心是事件委托
讲委托点变化：16 委托到 document，17 起委托到根容器，这是面试常挖的点
讲触发流程：原生事件冒泡到根容器 → React 找 fiber 路径 → 沿组件树模拟冒泡调处理函数
讲差异：绑定位置、事件对象、冒泡路径、事件池（17 移除）
讲边界：stopPropagation 不阻断原生冒泡，preventDefault 对被动事件无效，给出真实误触顺序坑

@followups
React 17 把事件委托从 document 改到根容器，有什么实际影响？——在 document 上手动加的原生监听，会先于根容器里的合成事件拿到事件（因为根容器在 document 之内），这影响「点击外部关闭弹窗」等场景的判断
为什么 React 16 里 setTimeout 里读 e.target 是 null？——因为 16 有事件池，事件对象在同步处理完就被复用清空；17 移除事件池后这个坑消失
合成事件里调用 stopPropagation 能阻止原生事件冒泡吗？——不能，它只阻止 React 组件树的合成冒泡；要阻断原生冒泡需用 e.nativeEvent.stopImmediatePropagation()

@example
### 1. 合成事件 vs 原生事件：委托点与触发顺序

```javascript
// 在 React 17+ 环境中：
// 根容器 = document.getElementById('root')（我们调用 createRoot 的那个节点）
// 原生监听挂在 document 上

// 原生监听：挂在 document，处于根容器「外层」
document.addEventListener('click', () => {
  console.log('原生 document 监听：先触发')
})

function App() {
  // 合成事件：委托在根容器，冒泡到根容器后由 React 派发
  // 根容器在 document 之内，所以真实冒泡是先到根容器（合成），再到 document（原生）
  return <button onClick={() => console.log('React 合成事件：后触发')}>点我</button>
}

// 点击按钮输出顺序（React 17+）：
// 1. 原生 document 监听：先触发   ← document 比根容器更靠外
// 2. React 合成事件：后触发
//
// 而在 React 16 中：合成事件委托在 document，两者都在 document，
// 顺序会变得微妙，这也是 17 把委托点下沉到根容器的原因之一
```

### 2. 事件池（event pooling）的差异演示

```javascript
// React 16：事件对象会被池化复用，异步访问拿到空值
function LegacyHandler() {
  function onClick(e) {
    console.log(e.target) // 同步里正常
    setTimeout(() => {
      console.log(e.target) // ❌ 16 里是 null，因为事件已被回收到池中
      // 16 中需用 e.persist() 保留
    }, 0)
  }
  return <button onClick={onClick}>16 的坑</button>
}

// React 17+：事件池已移除，异步里读事件完全正常
function ModernHandler() {
  function onClick(e) {
    setTimeout(() => {
      console.log(e.target) // ✅ 17+ 里正常，不再是 null
    }, 0)
  }
  return <button onClick={onClick}>17 之后无坑</button>
}
```

### 3. 手动模拟「事件委托 + 组件树冒泡」

```javascript
// 极简版：演示 React 合成事件「委托到根 + 沿组件树冒泡」的思想
// 真实 React 用 fiber 树回溯，这里用组件层级数组近似

// 根容器上只挂一个原生监听（这就是「事件委托」）
document.getElementById('root').addEventListener('click', (nativeEvent) => {
  // 1) 根据原生事件的 target，反查出对应的组件路径（自底向上）
  const path = getComponentPath(nativeEvent.target) // 例如 [Button, Form, App]

  // 2) 沿组件树从底向上「模拟冒泡」，依次调用各层注册的 onClick
  for (const component of path) {
    const handler = component.props.onClick
    if (handler) {
      // 3) 用 SyntheticEvent 包一层，提供跨浏览器统一 API
      const syntheticEvent = createSyntheticEvent(nativeEvent)
      handler(syntheticEvent)
      if (syntheticEvent.__stopped) break // 对应 stopPropagation
    }
  }
})

// 关键点：原生事件只绑在根容器一个地方，组件里的 onClick 并不直接 addEventListener，
// 组件卸载时 React 自然无需逐个解绑 —— 这正是事件委托带来的自动管理优势
```

## 07 · 受控组件与非受控组件怎么选，表单怎么做

@id
react-controlled

@level
基础

@freq
3

@tags
受控组件 | 表单 | ref

@ask
受控组件和非受控组件你都用过吧，区别到底是什么？实际做表单的时候你怎么选，一堆字段的表单你一般怎么组织？

@oral
**先说结论**：受控组件的 `value` 由 React 的 state 驱动、`onChange` 回写，数据是「单向数据流、state 是唯一真相」；非受控组件的值由 DOM 自己管，你用 `ref` 在需要时读取。选哪个，核心看「要不要实时校验、字段联动、提交前统一取值」。

**再说原理**。受控的本质是 `value` + `onChange`：每次按键触发 setState → 重渲染 → 输入框显示新值，整个表单状态都在 React 手里，随时可校验、可联动、可回显。非受控则是 `defaultValue` + `ref`，React 只在挂载时设一次初始值，之后的输入 React 完全不跟进，只有你主动 `ref.current.value` 去拿。

**举个真实场景**。简单的搜索框、文件上传（file input 出于安全本就不能被脚本赋值，天然非受控）用非受控最省事，少一次重渲染；但登录表单、带实时校验和联动的复杂表单必须用受控——比如「确认密码」要和「密码」实时比对、「用户名不足 3 字禁用提交」，这些离开了 state 做不了。多字段表单我一般用一个 state 对象集中管理，或者上 `react-hook-form`（它走非受控 + ref 注册，性能更好）。

**边界与取舍**。受控的代价是每次按键都重渲染，字段很多、层级很深时可能卡。优化方式：用 `React.memo` 把纯展示子树隔离、对输入框做防抖、或者干脆把频繁变化的字段下沉成独立组件、不放在顶层 state。另外非受控拿值的时机要注意——只能在提交或某个事件里读 `ref.current.value`，你没法在 render 阶段实时用到它。

**收尾**：能实时控制和校验的用受控，追求性能或简单交互的用非受控，复杂表单推荐 `react-hook-form`，它把两者的优点结合了。

@points
受控组件：value 来自 state、onChange 回写，state 是唯一真相来源，可实时校验联动
非受控组件：用 defaultValue + ref，DOM 自己管理值，只在需要时读取，无每次重渲染
受控适合实时校验、字段联动、提交前统一校验；非受控适合简单输入、file 上传、追求性能
大表单受控高频输入可能卡顿，可防抖、React.memo 隔离或改用非受控 / react-hook-form
file input 因安全限制只能读不能写，天然非受控，必须用 ref 取 files

@steps
先给定义：受控 value+onChange 单向流，非受控 ref+defaultValue 由 DOM 管
对比数据流向：受控 state 单一来源、非受控 React 不跟踪每次输入
讲选型：实时校验/联动 → 受控；简单/性能敏感 → 非受控
给多字段表单组织方式：单个 state 对象或第三方库 react-hook-form
补边界：受控卡顿的优化手段、file input 必须非受控

@followups
file input 为什么不能受控？——浏览器出于安全禁止脚本给 file 赋值，它只能读不能写，所以 value 无法由 React 驱动，天然非受控，用 ref 取 files
受控组件每次按键都 setState 重渲染，大表单会不会卡？——会，输入框多、层级深时每次击键全树比对；可用 React.memo 隔离、防抖、或改用非受控 / react-hook-form
react-hook-form 为什么性能更好？——它默认非受控，用 ref 注册字段、不通过 setState 管理每次输入，重渲染被最小化，只在需要校验/提交时读值

@example
### 1. 受控组件：带实时校验的登录表单

```tsx
import { useState, FormEvent } from 'react'

function LoginForm() {
  // 所有字段集中在一个 state 对象里，state 是「唯一真相」
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')

  // 受控核心：value 来自 state，onChange 把输入回写到 state
  function handleChange(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault() // 阻止原生表单默认提交刷新页面
    if (form.username.length < 3) {
      setError('用户名至少 3 个字符') // 实时校验的延伸：提交前再卡一道
      return
    }
    console.log('提交：', form) // 提交时统一从 state 取值
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={form.username}
        onChange={(e) => handleChange('username', e.target.value)}
        placeholder="用户名"
      />
      <input
        type="password"
        value={form.password}
        onChange={(e) => handleChange('password', e.target.value)}
        placeholder="密码"
      />
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="submit">登录</button>
    </form>
  )
}
```

### 2. 非受控组件：用 ref 在提交时取值

```tsx
import { useRef, FormEvent } from 'react'

function SearchBar() {
  // 非受控：输入框的值由 DOM 自己管理，React 不通过 state 跟踪每次输入
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // 只在需要时通过 ref 读取当前值，整个过程没有 setState 重渲染
    console.log('搜索关键词：', inputRef.current?.value)
  }

  // defaultValue 设置初始值，之后 React 不再接管
  return (
    <form onSubmit={handleSubmit}>
      <input ref={inputRef} defaultValue="" placeholder="搜点什么" />
      <button type="submit">搜索</button>
    </form>
  )
}
```

### 3. file input 必须非受控

```tsx
import { useRef } from 'react'

function AvatarUploader() {
  const fileRef = useRef<HTMLInputElement>(null)

  function handleUpload() {
    // file 没有 value 属性、不能被脚本赋值，只能读 → 天然非受控
    const file = fileRef.current?.files?.[0]
    if (!file) return
    console.log('选中文件：', file.name, file.size)
  }

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" />
      <button onClick={handleUpload}>上传</button>
    </>
  )
}
```

## 08 · React 18 并发特性：useTransition 与 Suspense

@id
react-concurrent

@level
高级

@freq
2

@tags
并发 | useTransition | Suspense

@ask
React 18 的并发特性具体指什么？useTransition 和 Suspense 分别是解决什么问题的，它们怎么配合起来用？

@oral
**先说结论**：并发特性指的是 React 能「同时维护多棵 UI 版本、按需让路」的渲染能力。useTransition 把非紧急更新标记成**可中断、可让位**的低优先级任务；Suspense 让组件在「等待异步资源」时先显示 fallback。两者配合实现「输入不卡、慢数据优雅加载」。

**再说原理**。并发渲染（Concurrent Rendering）下，React 可以中断一个正在进行的渲染，去处理更紧急的任务，之后再恢复——注意这是「可中断的调度」，不是多线程并行。useTransition 返回 `[isPending, startTransition]`，被它包起来的更新被标记为 transition（可中断、低优先级），用户紧急输入（高优先级）会打断它。Suspense 则是基于「子组件 throw 一个 promise」的边界机制：子组件等待数据时挂起，显示 fallback，数据就绪后再继续渲染该子树。

**真实场景**。搜索框输入时，每敲一个字就重渲染大数据量结果列表，会明显卡。用 `startTransition` 把「结果列表更新」包起来，输入框（紧急）立即响应，列表在后台慢慢算，`isPending` 显示「加载中」。Suspense 我常用于路由懒加载（`React.lazy`）和配合支持 suspense 的数据层（`use` / Relay / SWR 的 suspense 模式）做请求边界，组件加载或数据未就绪时优雅地显示骨架屏。

**边界与取舍**。第一，useTransition **不会让你的计算变快**，它只是让慢更新「不阻塞紧急交互」，计算量本身一点没少；第二，Suspense 在 React 18 客户端和服务端都可用，但数据请求需要你自己抛 promise（或用支持 suspense 的库），它管的是「异步边界」而非「请求本身」；第三，把 Suspense 包在 transition 更新外，慢数据期间 UI 不冻结、还能保持可交互。另外 `useDeferredValue` 和 useTransition 同源，前者延迟「某个值」的渲染，后者延迟「一段更新」。

**收尾**：并发不是多线程，而是「可中断、可让路的渲染调度」——useTransition 管优先级，Suspense 管异步边界，两者一起才构成完整的并发体验。

@points
并发渲染 = React 可中断进行中的渲染去处理更紧急任务再恢复，是调度层面、非多线程并行
useTransition 把更新标记为低优先级、可中断，让紧急交互（如输入）优先，isPending 反映进行中
Suspense 通过 throw promise 挂起子树，等待异步资源时显示 fallback，数据就绪再继续
两者配合：Suspense 包住 transition 更新，慢数据期间不卡 UI、显示优雅加载态
并发不「加速」计算，只是调整优先级与让路，紧急交互才立即响应

@steps
先定义并发渲染：可中断、可让路，区别于多线程并行
讲 useTransition：startTransition 标记低优先级更新，紧急输入可打断它
讲 Suspense：异步边界，throw promise 时挂起显示 fallback
讲配合：Suspense 包裹 transition 更新，实现「输入不卡 + 慢加载优雅」
补边界：不加速计算、数据请求需支持 suspense、顺带提 useDeferredValue

@followups
useTransition 能让我的计算变快吗？——不能，它只改变更新的优先级和是否可被中断，计算量本身没少；它让紧急交互不被慢更新阻塞，体验上「更跟手」
Suspense 是怎么知道「数据好了」的？——子组件在数据未就绪时 throw 一个 promise，Suspense 捕获后渲染 fallback，并在 promise resolve 后重试该子树
React 18 并发一定要用 useTransition 吗？——不是必须；lazy + Suspense 也能用并发能力，useTransition 主要解决「紧急更新被非紧急大更新拖慢」的场景

@example
### 1. useTransition：让输入框不被大列表更新拖卡

```tsx
import { useState, useTransition } from 'react'

function Search() {
  const [keyword, setKeyword] = useState('')
  const [list, setList] = useState<number[]>([])
  // 返回 [是否进行中, 启动过渡的函数]
  const [isPending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // 紧急更新：输入框立即响应，保证打字不卡
    setKeyword(e.target.value)

    // 非紧急更新：把「重算大列表」标记为 transition，可被输入打断
    startTransition(() => {
      // 模拟昂贵的过滤计算（上万条）
      const next = Array.from({ length: 10000 }, (_, i) => i)
        .filter((i) => i.toString().includes(e.target.value))
      setList(next) // 这次更新优先级低，输入时会被让路
    })
  }

  return (
    <div>
      <input value={keyword} onChange={handleChange} placeholder="搜索" />
      {/* isPending 为 true 时给出视觉反馈，但不阻塞输入 */}
      <p>{isPending ? '加载中…' : `共 ${list.length} 条`}</p>
      <ul>
        {list.slice(0, 50).map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  )
}
```

### 2. Suspense：异步边界 + 优雅 fallback

```tsx
import { Suspense, lazy } from 'react'

// React.lazy 让组件按需加载，加载期间会 throw promise 被 Suspense 捕获
const HeavyChart = lazy(() => import('./HeavyChart'))

function Dashboard() {
  return (
    // 子组件在等待（加载/数据）时，显示 fallback，不阻塞整个页面
    <Suspense fallback={<div>图表加载中…</div>}>
      <HeavyChart />
    </Suspense>
  )
}
```

### 3. useTransition + Suspense 配合：慢数据不卡 UI

```tsx
import { Suspense, useState, useTransition } from 'react'

// 假设某个数据组件内部 throw promise（由支持 suspense 的数据层提供）
function UserList() {
  const users = useSuspenseUsers() // 未就绪时 throw promise
  return <ul>{users.map((u) => <li key={u.id}>{u.name}</li>)}</ul>
}

function Page() {
  const [tab, setTab] = useState('all')
  const [isPending, startTransition] = useTransition()

  function switchTab(next: string) {
    // 切换 tab 触发的数据加载较慢，用 transition 包起来
    // 配合外层 Suspense，加载期间页面不冻结，还能保持可交互
    startTransition(() => setTab(next))
  }

  return (
    <Suspense fallback={<div>切换中…</div>}>
      <div style={{ opacity: isPending ? 0.6 : 1 }}>
        <button onClick={() => switchTab('all')}>全部</button>
        <button onClick={() => switchTab('vip')}>VIP</button>
        {tab === 'all' ? <UserList /> : <UserList />}
      </div>
    </Suspense>
  )
}
```

## 09 · key 为什么不能用 index，diff 是怎么做的

@id
react-key

@level
进阶

@freq
3

@tags
key | diff | 虚拟DOM

@ask
列表渲染为什么要用 key？用数组下标 index 当 key 会有什么问题？React 的 diff 算法到底是怎么比对的？

@oral
**先说结论**：key 是 React 在「同一层级兄弟节点」中识别「谁是谁」的稳定身份证；用 index 当 key，在列表会增删、重排时会导致状态错位、组件被错误复用。React 的 diff 是**同层比较 + key 匹配**，复杂度 O(n)，不是树的全量比对。

**再说原理**。React 在协调（reconcile）阶段对同层节点做 diff。没有 key 或 key 不稳定时，React 默认按位置顺序对应——第一个旧节点对应第一个新节点。当列表中间插入或删除一项，后面的节点全部错位，组件实例和内部 state（如输入框内容、动画状态）被错误地复用或销毁。key 让 React 能跨位置追踪同一元素：新旧两棵树里 key 相同的节点被判定为「同一个」，只做更新；key 不同则销毁重建。

**举个真实场景**。可编辑的 todo 列表，每项是个带输入框的组件。用 index 当 key，删掉第 2 项后，原来第 3 项的输入框内容被「移动」到了第 2 项位置（因为 index 复用），用户看到内容错乱。改用 `item.id` 当 key 后，删除只移除对应 DOM，其余保持原样，bug 消失。

**diff 算法细节**。React 用「同层比较」把复杂度从 O(n³) 降到 O(n)：① 先建立旧 children 的 `key → index` 映射；② 遍历新 children，按 key 找旧节点，能复用就复用并打更新标记，找不到就新建；③ 处理移动时用「lastIndex」策略尽量最小化 DOM 移动，但极端乱序下仍可能多移动。注意 React **不跨层复用**——不同父节点下的同 key 不会复用，会销毁重建。

**边界与取舍**。key 只需在「同一列表内兄弟间」唯一，不必全局唯一；用 `Math.random()` / `Date.now()` 当 key 等于每次渲染都新建，失去复用意义（反而更慢），稳定 id（后端返回或 `useId`）是最佳实践。另外 key 不参与数据展示，仅用于 diff 时的身份识别。

**收尾**：key 的本质是「稳定身份」，index 在动态列表里不稳定所以会出 bug；React diff 靠同层 + key 匹配实现 O(n) 高效复用。

@points
key 是同一层级兄弟节点的稳定身份标识，用于 diff 时跨位置追踪「同一个元素」
用 index 当 key：列表增删/重排时位置错位，组件 state/输入框内容被错误复用，导致 UI 错乱
React diff 采用同层比较（O(n)），按 key 匹配复用、打更新标记，找不到则新建、多余则删除
key 只需在同级兄弟内唯一，用随机值等于每次重建失去复用；用稳定 id 或 useId 最佳
React 不跨父级复用同 key 节点，不同父节点下的元素会销毁重建

@steps
先说 key 的作用：同层兄弟里的稳定身份证，帮 diff 识别元素身份
指出 index 的问题：动态列表增删重排导致位置错位、状态错乱
讲 diff 策略：同层比较 + key 匹配复用，最小化移动/新建
给真实反例：可编辑列表删项后内容错位
补边界：key 同级唯一即可、随机 key 有害、useId 最佳实践

@followups
为什么 index 在「只在尾部追加」时没问题？——因为尾部追加不改变已有项的 index 映射，key 仍稳定；问题出在中间插入/删除/排序等会改变前面项 index 的操作
React 的 diff 为什么不用 O(n^3) 的全树比对？——前端实践中跨层移动极少，React 假设「同层节点才可能需要复用」，只做同层比较把复杂度降到 O(n)，用 key 在层内精确匹配
用随机 uuid 当 key 会怎样？——每次渲染 key 都不同，React 认为全是新节点，全部销毁重建，完全失去复用、性能最差，且会丢失组件内部状态

@example
### 1. 反例：index 当 key 导致状态错位

```tsx
import { useState } from 'react'

// 每个 item 是一个带输入框的组件，输入框有内部 state
function Todo({ text }: { text: string }) {
  const [note, setNote] = useState('') // 输入框里临时写的内容
  return (
    <li>
      <span>{text}</span>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="备注" />
    </li>
  )
}

function BadList() {
  const [items, setItems] = useState(['A', 'B', 'C'])

  // ❌ 用 index 当 key
  // 删掉第 0 项后，B 变成 index 0、C 变成 index 1
  // React 按 key 复用，把「原来 B 的输入框内容」错配到了新位置
  return (
    <ul>
      {items.map((it, i) => (
        <Todo key={i} text={it} />
      ))}
    </ul>
  )
}
// 用户在 B 的输入框写了字，删除 A 后，那个字会「跳」到 A 原先的位置
```

### 2. 正例：稳定 id 当 key

```tsx
function GoodList() {
  // 用后端返回的 id 或 useId 生成稳定 key
  const [items, setItems] = useState([
    { id: 'a1', text: 'A' },
    { id: 'b2', text: 'B' },
    { id: 'c3', text: 'C' },
  ])

  function remove(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id)) // 删除只移除对应项
  }

  // ✅ key 是稳定 id：删除 B 时，A 和 C 的 key 不变，输入框内容保持原样
  return (
    <ul>
      {items.map((it) => (
        <Todo key={it.id} text={it.text} />
      ))}
    </ul>
  )
}
```

### 3. 手搓一个极简 key-diff：按 key 复用

```javascript
// 极简 diff：演示「按 key 匹配」而非「按位置」
// 旧列表和新列表都是 [{key, value}] 形式

function diff(oldList, newList) {
  const oldByKey = new Map(oldList.map((n) => [n.key, n]))
  const result = []

  for (const node of newList) {
    const old = oldByKey.get(node.key)
    if (old) {
      // key 相同 → 复用，只做属性更新（打补丁）
      result.push({ type: 'update', key: node.key, from: old.value, to: node.value })
    } else {
      // 新 key → 新建
      result.push({ type: 'create', key: node.key, value: node.value })
    }
  }

  // 旧列表里没出现在新列表的 key → 删除
  const newKeys = new Set(newList.map((n) => n.key))
  for (const node of oldList) {
    if (!newKeys.has(node.key)) {
      result.push({ type: 'remove', key: node.key })
    }
  }
  return result
}

// 旧: [{key:'a',value:1},{key:'b',value:2}]
// 新: [{key:'b',value:20},{key:'c',value:3}]  （删 a、改 b、加 c）
console.log(diff(
  [{ key: 'a', value: 1 }, { key: 'b', value: 2 }],
  [{ key: 'b', value: 20 }, { key: 'c', value: 3 }],
))
// 输出：update b(2→20)、create c、remove a —— 按身份而非位置处理
```

## 10 · 状态管理怎么选：Context、Redux、Zustand 的取舍

@id
react-state-management

@level
进阶

@freq
2

@tags
状态管理 | Redux | Zustand

@ask
现在状态管理方案这么多，Context、Redux、Zustand，你项目里怎么选？各自适合什么场景，又有什么坑？

@oral
**先说结论**：没有银弹。Context 适合「低频、全局」的透传（主题、当前用户、locale）；Redux 适合「复杂、需强约束、要时间旅行/中间件」的大型应用；Zustand 适合「想要 Redux 的简洁能力又不想写样板代码」的中大型应用，且能精准订阅避免无谓重渲染。

**再说原理与对比**。Context 本质是「依赖注入」，Provider 的 value 一变，所有消费组件都重渲染，它无法做「只订阅其中某个字段」的细粒度更新，所以不适合高频变化的状态（如表单每键、mousemove）。Redux 是单一 store + 纯函数 reducer + action 派发，配合 middleware（thunk / saga）处理异步，devtools 的时间旅行调试是杀手锏，代价是样板代码多、学习曲线陡（Redux Toolkit 已大幅简化）。Zustand 是基于 hook 的极简 store，`create` 一个 store，组件用 selector 精准订阅某字段，只有该字段变化才重渲染，无 Provider 嵌套、无样板、TS 友好，内部还用 immer 做不可变更新。

**真实场景**。我们中后台项目，全局用户权限 + 主题用 Context 足够；但有个复杂的「多维筛选 + 跨模块共享」数据看板，用 Context 会导致整页重渲染，改成 Zustand 后按 selector 订阅，性能明显提升。另一个金融交易系统对「状态可追溯、可回放」要求极高，上了 Redux Toolkit + devtools。

**边界与取舍**。Context 的坑是「一变全刷」，可用拆分多个 Context 缓解，但仍不如 selector 精准；Redux 不要为了用而用，小项目是负担；Zustand 注意 selector 返回新对象时要配合浅比较（`useShallow`），否则会死循环重渲染。另外 Jotai / Recoil 这类原子化方案适合「派生状态多」的场景，每个原子独立订阅。

**收尾**：选型的本质是「按状态的作用域和变化频率」——低频全局用 Context，强约束/可追溯用 Redux，灵活高效用 Zustand 或原子方案。

@points
Context 是依赖注入，Provider 值变则所有消费者重渲染，适合低频全局状态（主题/用户/locale）
Redux 单一 store + reducer + action，可预测、可时间旅行调试，适合复杂大型应用，但样板多
Zustand 用 selector 精准订阅，只有订阅字段变化才重渲染，无 Provider、无样板、TS 友好
选型看「作用域 + 变化频率」：低频全局 → Context，强约束可回溯 → Redux，灵活高效 → Zustand
坑：Context 一变全刷、Redux 小项目负担重、Zustand selector 返回新对象需 useShallow 防死循环

@steps
先给总纲：没有银弹，按作用域和变化频率选
讲 Context：依赖注入、一变全刷，适合低频全局
讲 Redux：可预测 + 中间件 + devtools，适合复杂大型
讲 Zustand：selector 精准订阅、无样板，适合中大型灵活场景
给真实选型案例 + 边界：拆分 Context、Redux 别滥用、Zustand 浅比较

@followups
Context 会不会导致性能问题？——会，只要 Provider value 变化，所有 useContext 消费者都重渲染，无法只订阅某个字段；高频状态放 Context 是大忌
Zustand 和 Redux 核心区别是什么？——Redux 强调单一可预测 store + 显式 action/reducer + 中间件生态；Zustand 把 store 藏在 hook 里、按需 selector 订阅，样板极少、重渲染更可控
什么时候该上 Redux 而不是 Zustand？——当团队需要强约定、状态可追溯/可回放（时间旅行）、复杂异步编排（saga）、成熟 devtools 和生态时，Redux Toolkit 更稳妥

@example
### 1. Context：适合低频全局，但会「一变全刷」

```tsx
import { createContext, useContext, useState } from 'react'

// 主题 + 用户信息这类「很少变」的全局状态，用 Context 很合适
const ThemeContext = createContext<'light' | 'dark'>('light')

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  return (
    // 注意：value 每次变化，所有 ThemeContext 消费者都会重渲染
    <ThemeContext.Provider value={theme}>
      <Toolbar />
    </ThemeContext.Provider>
  )
}

function Toolbar() {
  const theme = useContext(ThemeContext) // 主题变了，这里必重渲染
  return <div className={theme}>工具栏</div>
}
```

### 2. Zustand：selector 精准订阅，避免无谓重渲染

```ts
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

// 创建一个 store，状态和方法都在里面
const useStore = create((set) => ({
  count: 0,
  name: 'lyf',
  inc: () => set((s) => ({ count: s.count + 1 })),
}))

// 组件 A：只订阅 count，count 不变就不会重渲染
function Counter() {
  const count = useStore((s) => s.count)
  const inc = useStore((s) => s.inc)
  return <button onClick={inc}>{count}</button>
}

// 组件 B：订阅 name，A 改 count 时 B 不会重渲染（精准订阅）
function Name() {
  const name = useStore((s) => s.name)
  return <span>{name}</span>
}

// 订阅多个字段时用 useShallow 做浅比较，避免返回新对象导致死循环
function Both() {
  const { count, name } = useStore(useShallow((s) => ({ count: s.count, name: s.name })))
  return <p>{name}: {count}</p>
}
```

### 3. Redux Toolkit：强约束 + devtools 时间旅行

```ts
import { configureStore, createSlice } from '@reduxjs/toolkit'
import { useSelector, useDispatch } from 'react-redux'

// slice 把 action 和 reducer 收敛在一起，样板大幅减少
const counterSlice = createSlice({
  name: 'counter',
  initialState: { value: 0 },
  reducers: {
    incremented: (state) => { state.value += 1 }, // 内部用 immer，可直接改
  },
})

const store = configureStore({ reducer: { counter: counterSlice.reducer } })

function Counter() {
  const value = useSelector((s: RootState) => s.counter.value)
  const dispatch = useDispatch()
  return <button onClick={() => dispatch(counterSlice.actions.incremented())}>{value}</button>
}
// 配合 Redux DevTools 可回放每一次 action，定位状态异常非常方便
```

## 11 · 自定义 Hook 实战：怎么抽一个 useRequest

@id
react-custom-hook

@level
进阶

@freq
3

@tags
自定义Hook | useRequest | 复用

@ask
你肯定封装过自定义 Hook 吧，给我写一个通用的 useRequest，要能管 loading、error、data，还要能取消请求、支持手动触发。

@oral
**先说结论**：useRequest 本质是把「请求三态（data / loading / error）+ 生命周期（发起 / 取消 / 重试）」收敛成一个可复用的 Hook。核心是 useState 管状态、useRef 管请求的发起与清理、AbortController 管取消，再配合 useCallback 记忆化触发函数。

**再说原理**。① 用三个 state 存 `data / loading / error`；② 用一个 ref 持有 `AbortController`，组件卸载或重新发起时 abort 旧请求，防止竞态（旧请求晚回覆盖新数据）；③ 暴露 `run` 手动触发和「挂载自动执行」的开关；④ 用 `useCallback` 把触发函数记忆化，避免依赖抖动；⑤ 用 ref 存最新的回调（如 `onSuccess`）避免闭包旧值。请求函数本身应作为参数传入，保持 Hook 通用。

**真实场景**。我们列表页、详情页到处都是「拉数据 + loading + 错误兜底」，之前每个页面手写一遍，重复且容易漏掉卸载取消，导致内存泄漏或竞态。抽出 useRequest 后，所有页面一行调用，统一处理取消和错误，代码量砍掉一大半。

**边界与取舍**。要处理「竞态」——连续触发时只采用最后一次的结果；要处理「卸载后 setState」——React 18 严格模式下 effect 会双调用，用 `mounted` 标记或 abort 兜底；还可扩展支持防抖、轮询、依赖刷新。注意不要把整个请求函数写死在 Hook 里，应把「请求函数」作为参数传入。另外 `useRequest` 这类封装的成熟实现可参考社区 `ahooks`，但理解底层能帮你应对「为什么我的请求被取消」「为什么状态错乱」这类深挖。

**收尾**：一个健壮的 useRequest = 状态机 + 取消 + 竞态防护 + 可配置触发，是自定义 Hook 复用能力的最佳体现。

@points
useRequest = 把 data/loading/error 三态与请求生命周期收敛成可复用 Hook
用 AbortController 在卸载或重发时取消旧请求，防止竞态（旧响应晚回覆盖新数据）
请求函数作为参数传入，Hook 本身保持通用；触发函数用 useCallback 记忆化防抖动
防护「卸载后 setState」：用 mounted 标记或依赖 abort，避免 React 严格模式双调用报错
可扩展：手动/自动触发、防抖、轮询、依赖刷新、onSuccess 用 ref 持有最新回调

@steps
先讲目标：把请求三态和生命周期收敛成一行调用的 Hook
用 useState 管 data/loading/error，useRef 管 AbortController
effect 清理里 abort 旧请求，防竞态；注意卸载后别 setState
暴露 run 触发、接收请求函数作参数保持通用；useCallback 记忆化
补扩展点：防抖、轮询、严格模式双调用防护

@followups
怎么防止「快速切换导致旧请求覆盖新数据」？——每次发起新请求前 abort 上一次，且只用「最新一次」的响应；也可比较请求序号，丢弃过期响应
React 18 严格模式 effect 执行两次，useRequest 会发两次请求吗？——会（仅开发期），靠 AbortController 取消第一次、mounted 标记避免卸载后 setState，正式环境只执行一次
为什么请求函数要作为 ref 持有而不是依赖？——避免把父组件传进来的回调列进依赖导致 Hook 频繁重建；用 ref 存最新回调，effect 永远调最新版本，避开闭包陷阱

@example
### 1. 基础版 useRequest：三态 + 取消 + 手动触发

```tsx
import { useCallback, useEffect, useRef, useState } from 'react'

interface Options<T> {
  manual?: boolean // 是否手动触发（默认挂载自动请求）
  onSuccess?: (data: T) => void
}

// 泛型 Hook：接收「返回 Promise 的请求函数」，返回三态与触发函数
function useRequest<T>(fetcher: () => Promise<T>, options: Options<T> = {}) {
  const { manual = false, onSuccess } = options

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(!manual)
  const [error, setError] = useState<Error | null>(null)

  // 用 ref 持有 AbortController，方便在重发/卸载时取消
  const abortRef = useRef<AbortController | null>(null)
  // 用 ref 持有最新回调，避免闭包旧值、也避免作为依赖导致重建
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess

  const run = useCallback(async () => {
    // 发起前先取消上一次还没结束的请求，防止竞态
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    try {
      const res = await fetcher() // 真实项目可把 signal 透传给 fetch
      if (controller.signal.aborted) return // 已被新请求取消，丢弃结果
      setData(res)
      onSuccessRef.current?.(res)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return // 主动取消不算错误
      setError(e as Error)
    } finally {
      // 只有「当前这次」还没被取消，才结束 loading
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [fetcher])

  // 非手动模式：挂载自动请求；卸载时取消进行中的请求
  useEffect(() => {
    if (manual) return
    run()
    return () => abortRef.current?.abort()
  }, [manual, run])

  return { data, loading, error, run }
}
```

### 2. 用法：列表页与详情页一行走天下

```tsx
// 列表页：自动请求
function UserList() {
  const { data, loading, error } = useRequest(() => fetch('/api/users').then((r) => r.json()))
  if (loading) return <p>加载中…</p>
  if (error) return <p>出错了：{error.message}</p>
  return <ul>{data?.map((u) => <li key={u.id}>{u.name}</li>)}</ul>
}

// 详情页：手动触发（比如点击按钮再查）
function SearchUser() {
  const { data, loading, run } = useRequest(
    () => fetch('/api/user?name=lyf').then((r) => r.json()),
    { manual: true },
  )
  return (
    <>
      <button onClick={run} disabled={loading}>查询</button>
      {loading ? <p>查询中…</p> : data && <p>{data.name}</p>}
    </>
  )
}
```

### 3. 进阶：防抖触发 + 依赖刷新

```tsx
import { useEffect, useRef, useState } from 'react'

// 在 useRequest 基础上加「防抖搜索」：输入停止 300ms 才发请求
function useDebouncedRequest<T>(fetcher: (kw: string) => Promise<T>, delay = 300) {
  const [keyword, setKeyword] = useState('')
  const [data, setData] = useState<T | null>(null)
  const timer = useRef<number>()

  useEffect(() => {
    if (!keyword) return
    clearTimeout(timer.current) // 每次输入重置计时，避免抖动期间狂发请求
    timer.current = window.setTimeout(async () => {
      const res = await fetcher(keyword)
      setData(res)
    }, delay)
    return () => clearTimeout(timer.current)
  }, [keyword, fetcher, delay])

  return { keyword, setKeyword, data }
}
```

## 12 · React 性能优化清单，你怎么定位性能问题

@id
react-performance

@level
进阶

@freq
3

@tags
性能优化 | Profiler | 重渲染

@ask
如果线上一个 React 页面卡，你怎么系统性地定位和优化？给我一份你自己的性能优化清单。

@oral
**先说结论**：性能优化先「测量」再「下手」，不要凭感觉。我的清单是：先用 React DevTools Profiler 定位「谁在重复重渲染、为什么重」，再用 why-did-you-render 找不必要的重渲染，最后按「减少重渲染 → 减少计算 → 减少 DOM 操作」三档逐层优化。

**再说定位手段**。① **React Profiler** 录制一次交互，看每个组件的「渲染耗时」和「高亮重渲染」，能直接看到是哪个组件在反复 render；② **why-did-you-render**（wdyR）第三方库会在控制台告诉你某个组件「因为 props 变了（其实值没变，只是引用变了）」而重渲染，精准定位 useMemo / useCallback 缺位；③ **Chrome Performance** 看长任务、看是否主线程被 JS 占满（Fiber 时间切片没救回来的情况）；④ 生产可上报关键路径耗时做体验监控。

**优化清单（按性价比排序）**。1）**减少不必要的重渲染**：React.memo 包纯展示组件；useCallback / useMemo 锁住传给子组件的引用；拆分 Context 避免一变全刷；状态下沉（把 state 放到真正需要的子树，而不是提到顶层）。2）**降低渲染成本**：useMemo 缓存昂贵派生；大数据列表用虚拟滚动（react-window）；避免在 render 里创建大对象/新函数。3）**并发与交互优先级**：useTransition 把非紧急更新降级；useDeferredValue 延迟展示重的结果。4）**减少 DOM 操作**：稳定 key；避免频繁增删大节点。5）**代码层面**：路由级懒加载（React.lazy + Suspense）、按需引入、防抖节流。

**真实场景**。我们有个筛选看板，每次滑块拖动都重渲染上万行。先用 Profiler 发现「父组件 state 一变，整棵子树重渲染」，于是把滑块 state 下沉到独立小组件 + 用 useDeferredValue 延迟结果，再给列表上虚拟滚动，主线程长任务从 120ms 降到 20ms 以内。

**边界与取舍**。优化有成本（代码变复杂、可读性降），只在「测量证明是瓶颈」的地方优化；React 18 并发特性优先于手抖 Hooks。另外注意「开发模式比生产慢很多」，性能判断一定要在 production build 下做。

**收尾**：性能优化的正确姿势是「Profiler 定位 → 高频重渲染入手 → 并发特性收尾」，而不是一上来就包 useMemo。

@points
先测量后优化：React Profiler 看谁在重复重渲染及耗时，wdyR 找引用变化导致的无用重渲染
减少重渲染最高性价比：React.memo、useCallback/useMemo 锁引用、拆分 Context、状态下沉
降低渲染成本：useMemo 缓存派生、大列表虚拟滚动、不在 render 里建大对象/新函数
并发与交互优先级：useTransition 降级非紧急更新、useDeferredValue 延迟重结果
代码层：路由懒加载、按需引入、防抖节流；且性能判断必须在 production build 下做

@steps
先立原则：测量优先，不凭感觉优化
讲定位工具：Profiler 看重渲染与耗时、wdyR 找无效重渲染、Chrome Performance 看长任务
第一档：减少重渲染（memo / useCallback / 拆分 Context / 状态下沉）
第二档：降低渲染成本（useMemo / 虚拟滚动 / 不在 render 建对象）
第三档：并发特性 + 代码层懒加载/防抖；最后强调生产环境测量

@followups
为什么优化一定要在 production build 下测？——开发模式有额外检查、不开启生产优化，render 慢好几倍，按开发环境结论优化会严重误导
useDeferredValue 和 useTransition 在性能优化上的区别？——useDeferredValue 延迟「某个值」的渲染（如搜索结果），useTransition 把「一段更新」标记为非紧急可中断；前者聚焦值、后者聚焦更新块
why-did-you-render 报「props 没变却重渲染」一般是什么原因？——父组件重渲染时传了新引用（新对象/新函数），子组件浅比较失败；用 useMemo/useCallback 锁引用或 React.memo 即可解决

@example
### 1. 用 Profiler 定位：找到重复重渲染的组件

```tsx
import { Profiler, useState } from 'react'

// onRender 回调：每次组件渲染完都会触发，打印耗时，帮你定位「谁在反复 render」
function onRender(
  id: string,                     // 组件标识
  phase: 'mount' | 'update',
  actualDuration: number,         // 本次渲染实际耗时（毫秒）
) {
  // 生产可上报 actualDuration，关注那些 duration 异常大、且频繁 update 的组件
  if (actualDuration > 5) {
    console.warn(`[性能] ${id} 渲染耗时 ${actualDuration}ms，phase=${phase}`)
  }
}

function App() {
  const [count, setCount] = useState(0)
  return (
    <Profiler id="Dashboard" onRender={onRender}>
      <Dashboard count={count} />
    </Profiler>
  )
}
```

### 2. 优化手段一：React.memo + useCallback 切断无谓重渲染

```tsx
import { memo, useCallback, useState } from 'react'

// 纯展示组件用 memo 包裹：props 引用不变就跳过重渲染
const Row = memo(function Row({ item, onSelect }: { item: Item; onSelect: (id: number) => void }) {
  return <li onClick={() => onSelect(item.id)}>{item.name}</li>
})

function Table() {
  const [items] = useState(genItems(10000))
  const [selected, setSelected] = useState<number>()

  // 不用 useCallback → 每次 Table 重渲染都生成新函数 → Row 跟着重渲染
  // 用了之后引用稳定，Row 只在 item/selected 真正变化时更新
  const onSelect = useCallback((id: number) => setSelected(id), [])

  // 优化点：把「高频变化的 selected」下沉到更小范围，避免整个 Table 重渲染
  return (
    <ul>
      {items.map((it) => (
        <Row key={it.id} item={it} onSelect={onSelect} />
      ))}
    </ul>
  )
}
```

### 3. 优化手段二：useDeferredValue 延迟重结果

```tsx
import { useDeferredValue, useState } from 'react'

function Search() {
  const [keyword, setKeyword] = useState('')
  // 把「昂贵的结果列表」延迟渲染：keyword 立即响应输入，deferred 在空闲时再算
  const deferredKeyword = useDeferredValue(keyword)

  // 输入框（紧急）立即更新，列表（非紧急）用 deferred，输入时不卡
  return (
    <div>
      <input value={keyword} onChange={(e) => setKeyword(e.target.value)} />
      <BigList keyword={deferredKeyword} />
    </div>
  )
}
```

### 4. 优化手段三：大列表虚拟滚动（思路示意）

```tsx
// 不把 10000 行全渲染进 DOM，只渲染「视口内」的几十行
// 用 react-window 的 FixedSizeList 即可，这里只展示调用形态
import { FixedSizeList } from 'react-window'

function VirtualTable({ items }: { items: Item[] }) {
  return (
    <FixedSizeList
      height={500}
      itemCount={items.length}     // 数据量很大，但 DOM 里只有可见的十几个
      itemSize={40}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>{items[index].name}</div> // 只渲染视口内节点
      )}
    </FixedSizeList>
  )
}
```
