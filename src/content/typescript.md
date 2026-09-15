---
id: typescript
name: TypeScript
en: Type System
icon: file-type
color: #3178c6
order: 4
desc: 类型体操、泛型约束与工程配置，中高级岗位的硬性加分项。
---

## 01 · interface 和 type 有什么区别，项目里该怎么选

@id
ts-interface-vs-type

@level
基础

@freq
3

@tags
interface | type | 类型定义

@ask
你平时写类型是用 interface 还是 type？这俩到底有啥区别？那我现在给你一个场景，我既要能合并扩展、又要表达联合类型，你分别会怎么选？把你们团队里的约定说清楚。

@oral
**先给结论**：interface 和 type 在「描述对象结构」这件事上 90% 可以互换，但 interface 是「接口声明」、天生为对象契约设计，支持声明合并和继承；type 是「类型别名」，更底层，能表达联合、交叉、元组和所有类型体操。**项目里的默认约定应当是：描述数据结构和对象形状优先用 interface，涉及联合 / 交叉 / 工具类型推导时再用 type。**

**再说原理上的硬差异**。第一，声明合并：同名 interface 会合并成员，type 一旦声明就不能重开，重复声明直接报错，这点在给第三方库补全类型时非常关键。第二，继承写法：interface 用 extends 链，type 用交叉 `&`；区别在于交叉出现同名不兼容属性时会直接收敛成 never，而接口继承对方法签名是「重载合并」更宽容。第三，表达能力：union、tuple、conditional、mapped 这些只有 type 能写，interface 不行。第四，错误信息与编译性能：interface 有独立身份，报错时能显示接口名，大型项目里定位更友好，早期 TS 接口解析也确实更快，现在差距已很小。

**给你两个真实场景**。其一，定义后端接口返回的用户结构，我用 interface，因为将来可能通过 `declare module` 给某字段补类型，或者组件 Props 要被别人 extends 扩展。其二，请求方法我写成 `type ApiResponse<T> = { code: number; data: T; msg: string }`，因为它包了一层泛型、属于工具类型，type 更自然。

**边界与取舍**：不要为了「统一」强行只用一种。约定是「对象形状用 interface，其余用 type」，而不是「全局只用 type」。另外 class 实现两者都行，但 implements 一个交叉类型常常比 interface 麻烦。

**收尾**：能合并、要扩展、是对象 → interface；要联合、要体操、是工具类型 → type。面试时把「声明合并」和「联合类型只能 type」这两点抛出来，基本就够区分了。

@points
interface 支持声明合并与 extends 继承，type 声明后不可重开、只能靠交叉 &
union、tuple、conditional、mapped 等高级类型只有 type 能表达
interface 在报错信息和大型项目可读性上更有优势
class 可以同时 implements interface 和 type
约定：对象形状 / 契约用 interface，联合与工具类型用 type

@steps
先点明二者在对象结构上可互换，稳住面试官预期
讲清声明合并这个 interface 独有、且最常被忽略的能力
对比继承写法：interface extends 链 vs type 交叉 &，指出 never 收敛的坑
说明 type 在联合 / 元组 / 类型体操上的不可替代性
落到团队约定：数据结构用 interface，其余用 type，不强制统一

@followups
interface 能 extends type 吗？——能，interface 可以 extends 一个 type 别名，反之 type 用交叉 & 也能合并接口
声明合并在真实项目有什么用？——给第三方库做模块扩展（declare module）、给 window 补全局类型时离不开它
type 和 interface 哪个编译更快？——早期接口更快，现代 TS 二者差距可忽略，选型依据应是语义而非性能

@example
### 1. 同一份对象结构，两种写法都合法

```typescript
// 用 interface：对象形状的默认选择
interface User {
  id: number
  name: string
}

// 用 type：同样能描述对象，但它是「别名」而非「声明」
type UserAlias = {
  id: number
  name: string
}
```

把鼠标悬停在 `User` 和 `UserAlias` 上，VS Code 都能提示结构；但报错时 interface 会显示 `User`，type 会展开成内联结构，这是体验差异。

### 2. 声明合并 —— interface 独有的能力

```typescript
// 第一次声明：基础字段
interface ApiConfig {
  baseURL: string
}

// 同名的第二次声明：自动合并，不会报错
interface ApiConfig {
  timeout: number
}

// 合并结果等价于 { baseURL: string; timeout: number }
const cfg: ApiConfig = { baseURL: '/api', timeout: 5000 }

// type 重复声明直接编译报错：Duplicate identifier
// type ApiConfig2 = { a: number }
// type ApiConfig2 = { b: number } // ❌ 这里会报重复标识符
```

真实用途：给第三方库补全类型或做 declare module 模块增强时，只能靠 interface 合并。

### 3. 交叉 & 遇到属性冲突会收敛成 never

```typescript
interface A {
  id: number
  tag: string
}
interface B {
  id: number
  tag: number // 与 A 的 tag 类型不兼容
}

// 交叉后 tag 变成 string & number = never，赋值时直接报错
type AB = A & B
const x: AB = { id: 1, tag: '' as never } // tag 只能是 never，无法构造合法值
```

而 interface 继承同名方法会「重载合并」而非报错，这是继承比交叉宽容的地方。

### 4. 真实项目：后端响应与请求方法

```typescript
// 数据结构：用 interface，方便后续 extends 或合并扩展
interface UserDTO {
  id: number
  name: string
  role: 'admin' | 'user'
}

// 请求返回：包一层泛型，属于工具类型，用 type 更自然
type ApiResponse<T> = {
  code: number
  data: T
  msg: string
}

// 请求封装：入参泛型约束，返回对应的 data 类型
declare function request<T>(url: string): Promise<ApiResponse<T>>

async function loadUser() {
  const res = await request<UserDTO>('/user/1')
  // res.data 已经被推断成 UserDTO，点出来有 id / name / role
  return res.data.name
}
```

## 02 · any、unknown、never 的区别与正确用法

@id
ts-any-unknown-never

@level
进阶

@freq
3

@tags
any | unknown | never | 类型安全

@ask
any、unknown、never 这三个我老搞混。你说说它们分别什么时候用？如果我接一个外部接口返回的数据，应该标 any 还是 unknown？never 又是干嘛的，我好像从来没用过。

@oral
**先给结论**：any 是彻底关掉类型检查（逃生舱），unknown 是类型安全的 any（必须先收窄再用），never 是「绝不可能有值」的底部类型。三条铁律：**any 可赋给任意类型且不被检查；unknown 不能直接操作、必须先收窄；never 只能被赋值给一切、却没有任何东西能赋给它。**

**再说原理**。any 会「传染」——一旦某个值变成 any，后续链式调用全都退化成 any，TS 等于白开。unknown 是 any 的类型安全替代品，它「我现在不知道是什么，但用之前必须先证明」；通过 typeof / instanceof / 自定义守卫收窄后，才能调用对应方法。never 出现在三种地方：函数永远抛错或死循环（返回类型就是 never）、switch 穷尽检查里的兜底分支、以及条件类型里用来「过滤掉」某些分支。

**给你真实场景**。解析 fetch 的 JSON 时，我用 unknown 而不是 any，强制在业务层做字段校验，避免把脏数据当合法对象用。写状态机事件处理时，未处理的事件分支我写 `assertNever(event)`，一旦将来新增事件忘了处理，编译期就会直接炸出来，这是 never 最强的用法。

**边界与取舍**：别把 any 当默认值到处撒；非空断言 `!` 虽然不等于 any，但同样会跳过检查、危险。unknown 用起来啰嗦，这恰是它的安全性代价，值得。never 在运行时不占任何内存，纯粹是类型层概念。

**收尾**：三者的定位完全不同——any 是「我不管」，unknown 是「我先不知道但会核实」，never 是「这分支不可能发生」。把 unknown 用在系统边界、never 用在穷尽性检查，是 TS 进阶的分水岭。

@points
any 关闭检查且会「传染」，unknown 是类型安全替代、必须先收窄
never 是底部类型：只能赋值给一切，却无任何值能赋给它
unknown 适合系统边界（如 fetch / JSON.parse 的结果）
never 适合穷尽性检查与条件类型里的分支过滤
非必要不写 any，用 unknown 或具体类型替代

@steps
先区分三者语义定位：any 不管、unknown 核实、never 不可能
讲清 any 的传染性，说明为什么不能当默认值
给出 unknown 在系统边界的真实用法（fetch / parse）
用 switch + never 兜底展示穷尽性检查的价值
总结替换策略：any → unknown → 具体类型

@followups
unknown 能直接赋值给 string 吗？——不能，unknown 只能赋值给 unknown / any，使用前必须收窄
函数返回 never 有什么意义？——标记「永不返回」，配合穷尽检查让遗漏分支在编译期报错
条件类型里 never 怎么过滤？——`T extends U ? T : never` 在联合上分发，把不满足的变成 never 从而被剔除

@example
### 1. any 会「传染」，丢失全部类型保护

```typescript
let value: any = 123
value = 'hello' // 任意类型都能赋给 any
value.foo.bar.baz // ⚠️ 编译不报错，但运行时大概率炸
// 一旦进入 any，后续链式调用都退化成 any，TS 失去意义
```

### 2. unknown 强制收窄后才能用

```typescript
function handle(input: unknown) {
  // input.toUpperCase() // ❌ 直接报错：unknown 上不存在 toUpperCase
  if (typeof input === 'string') {
    return input.toUpperCase() // ✅ 收窄为 string 后可用
  }
  if (Array.isArray(input)) {
    return input.length // ✅ 收窄为 any[] 后可用
  }
  throw new TypeError('unsupported input')
}
```

### 3. never 做穷尽性检查

```typescript
type Event = { type: 'click'; x: number } | { type: 'key'; key: string }

function assertNever(x: never): never {
  throw new Error('未处理的事件: ' + JSON.stringify(x))
}

function handleEvent(e: Event) {
  switch (e.type) {
    case 'click':
      return e.x
    case 'key':
      return e.key
    // 如果将来给 Event 加了 'scroll'，这里没 case 会报错：
    // Argument of type '{ type: "scroll" }' is not assignable to never
    default:
      return assertNever(e)
  }
}
```

### 4. never 在条件类型里过滤分支

```typescript
// 只保留字符串类型的联合成员
type OnlyString<T> = T extends string ? T : never

type Mixed = string | number | boolean
type Result = OnlyString<Mixed> // 分发后：string | never | never = string
```

## 03 · 泛型是什么，怎么写一个带约束的泛型工具函数

@id
ts-generics

@level
进阶

@freq
3

@tags
泛型 | extends | 约束

@ask
泛型你肯定用过，但你能讲清楚泛型到底是解决什么问题的吗？再给我写一个带约束的泛型函数，比如从一个对象上按 key 取属性，要求 key 必须合法。

@oral
**先给结论**：泛型就是「类型参数」，让函数 / 类 / 接口在定义时不写死具体类型、调用时再由实参推断出来，从而既保留类型信息又不退化成 any。约束用 `extends` 给类型参数加一道「上限」。

**再说原理**。没有约束时 T 是个来路不明的类型，你几乎不能对它做任何操作（因为 TS 不知道它有哪些成员）。加上 `<T extends SomeType>` 之后，T 被限制为 SomeType 的子类型，于是你能安全地访问其属性、调用其方法。常见约束有：`T extends object`、`T extends keyof U`、`T extends (...args: any) => any`、`T extends string`。约束的本质是「在灵活度和安全性之间取平衡点」。

**给你真实场景**。我写过类型安全的 `request<T>(url): Promise<T>`，调用处直接拿到业务类型，不会拿到 any。更经典的是 `getProp(obj, key)`，用 `K extends keyof T` 约束 key 必须属于 obj，返回值自动推断成 `T[K]`——这比手写 `obj[key as keyof T]` 安全得多。还有一个 `merge` / `pick` 工具也是泛型约束的常客。

**边界与取舍**：约束不是越紧越好，过度约束会牺牲泛型的灵活度。能用内建工具（Partial / Pick / Record）就别手搓。另外注意 `extends` 在「泛型约束」和「条件类型」里语义不同：前者是上限限制，后者是 `T extends U ? X : Y` 的判断，别混为一谈。

**收尾**：写泛型先想「我需要 T 上的哪些能力」，据此加最小约束。面试时把 `K extends keyof T` 这个范式讲透，基本就能证明你真的在业务里用过泛型。

@points
泛型是类型参数，调用时由实参推断，避免退化为 any
约束 `<T extends U>` 给类型参数加「上限」，才能安全访问成员
`K extends keyof T` 是最常用的约束范式，保证 key 合法
约束并非越紧越好，过度约束会牺牲灵活度
注意区分「泛型约束 extends」与「条件类型 extends」两种语义

@steps
先说明泛型解决的问题：保留类型信息、避免 any
解释无约束时 T 几乎不可用，引出约束的必要性
给出 `K extends keyof T` 这个核心范式并解释推断链路
展示真实应用：typed request、getProp、pick 工具
提醒约束粒度与条件类型语义的区别

@followups
类型参数是怎么推断出来的？——通常由函数实参或返回值反推，也可用显式 `fn<Type>()` 指定
泛型约束能约束多个参数吗？——可以，如 `<T, K extends keyof T>`，多个约束可叠加
为什么不直接用 any？——any 会丢失返回值类型，调用链全部失保，泛型在零成本下保留类型

@example
### 1. 无约束 vs 有约束

```typescript
// 无约束：T 是 unknown 的超集，不能对它有任何假设
function identity<T>(v: T): T {
  return v
}

// 有约束：T 必须是带 length 的对象，于是能安全访问 .length
function logSize<T extends { length: number }>(v: T): T {
  console.log(v.length) // ✅ 编译通过
  return v
}
logSize('hello') // ✅ string 有 length
logSize([1, 2, 3]) // ✅ 数组有 length
// logSize(123) // ❌ number 没有 length
```

### 2. 核心范式：按合法 key 取值（K extends keyof T）

```typescript
// 约束 K 必须是 T 的键，返回值类型自动是 T[K]
function getProp<T extends object, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}

const user = { id: 1, name: 'Ada', age: 30 }

const id = getProp(user, 'id') // 类型推断为 number
const name = getProp(user, 'name') // 类型推断为 string
// getProp(user, 'email') // ❌ 编译报错：参数 'email' 不在 keyof user 中
```

### 3. 真实项目：带泛型约束的请求封装

```typescript
// 约束响应体必须是对象，调用处拿到的就是具体业务类型
interface ApiResponse<T extends object> {
  code: number
  data: T
  msg: string
}

declare function request<T extends object>(url: string): Promise<ApiResponse<T>>

interface UserDTO {
  id: number
  name: string
}

async function loadUser() {
  const res = await request<UserDTO>('/user/1')
  // res.data 被精确推断为 UserDTO，点出来有 id / name
  const n: string = res.data.name
  return n
}
```

### 4. 泛型工具：pick（带约束的裁剪）

```typescript
// 只保留 keys 指定的字段，K 必须来自 keyof T
function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const out = {} as Pick<T, K>
  for (const k of keys) out[k] = obj[k]
  return out
}

const nameAge = pick(user, ['name', 'age']) // 类型为 { name: string; age: number }
```

## 04 · 条件类型与 infer：怎么从函数类型里提取返回值

@id
ts-conditional-infer

@level
高级

@freq
3

@tags
条件类型 | infer | 类型体操

@ask
条件类型和 infer 我老是看不懂。你解释下这俩是什么，然后现场给我写一个从函数类型里把返回值类型抠出来的工具，最好再讲讲 infer 还能用在哪。

@oral
**先给结论**：条件类型 `T extends U ? X : Y` 是「类型层面的 if」；`infer` 在条件类型的 extends 子句里「捕获」一个待推断的类型变量。两者组合，就能从复杂类型里把某一段「抠」出来。最经典的产物就是内置的 `ReturnType`。

**再说原理**。语法固定是 `T extends SomeType<infer R> ? R : Fallback`。当 T 真的匹配上 `SomeType<...>` 时，infer 把里面的实际类型存进 R，分支返回 R。infer 可以出现在任意位置：函数返回值、函数参数、Promise 包裹层、数组元素、构造器实例等。配合「分发条件类型」（联合类型遇到 `T extends U ? X : Y` 会逐个成员分发），还能批量转换类型。

**给你真实场景**。我封装请求层时，要拿 `async function fetchUser(): Promise<UserDTO>` 的「去掉 Promise 后的 UserDTO」，就写 `type Awaited<T> = T extends Promise<infer U> ? U : T`（TS 4.5 起已有内置 Awaited）。再比如从 `AxiosResponse<T>` 里 infer 出 T，或从 `(a: number) => string` 里 infer 出参数类型组。

**边界与取舍**：infer 只能写在条件类型的 extends 子句里（即 `?` 之前），不能独立使用。同名 infer 出现多份时，协变位置取交叉、逆变位置（如函数参数）取联合。条件类型本身在裸类型参数上才会分发，用元组或 `[]` 包一层能关掉分发。

**收尾**：条件类型 + infer 是类型体操的发动机。先吃透 `ReturnType` / `Parameters` / `InstanceType` 这几个内置，再尝试自己写一个，面试时现场推演会比背结论加分得多。

@points
条件类型 `T extends U ? X : Y` 是类型层的 if / else
infer 只能在 extends 子句里捕获待推断类型，常用于提取片段
内置 ReturnType 就是 `T extends (...a: any) => infer R ? R : any`
infer 可出现在返回值、参数、Promise、数组元素、构造器等多处
裸类型参数上的条件类型会「分发」，用元组包裹可关闭分发

@steps
先讲条件类型是类型层面的条件分支
说明 infer 的语法位置：只能写在 extends 子句
现场推导 ReturnType 的实现，讲清推断链路
扩展到 Awaited、Parameters 等 infer 在不同位置的用法
点出分发条件类型的特性与关闭方式

@followups
infer 能独立使用吗？——不能，必须嵌在条件类型的 extends 子句里
为什么裸类型参数会分发？——联合类型遇到 `T extends U ? X : Y` 会逐成员计算，用 `[T]` 包裹可抑制
Parameters 怎么写？——`type Parameters<T> = T extends (...a: infer P) => any ? P : never`

@example
### 1. 手写 ReturnType，从函数类型提取返回值

```typescript
// 内置 ReturnType 的简化实现
type MyReturnType<T> = T extends (...args: any) => infer R ? R : never

// 输入类型 → 得到什么类型
type F = (a: number, b: string) => { ok: boolean }
type R = MyReturnType<F> // 得到 { ok: boolean }

// 验证：下面这行若类型不匹配会编译报错
const r: R = { ok: true }
```

把鼠标悬停在 `R` 上，VS Code 显示 `type R = { ok: boolean }`，证明提取成功。

### 2. Awaited：拆掉 Promise 包裹层

```typescript
// 从 Promise<T> 里 infer 出 T（TS 4.5+ 已有内置 Awaited）
type MyAwaited<T> = T extends Promise<infer U> ? U : T

async function fetchUser(): Promise<{ id: number; name: string }> {
  return { id: 1, name: 'Ada' }
}

type User = MyAwaited<ReturnType<typeof fetchUser>> // 得到 { id: number; name: string }
```

### 3. infer 在数组元素与参数位置

```typescript
// 提取数组元素类型
type ElementOf<T> = T extends (infer E)[] ? E : never
type E1 = ElementOf<string[]> // string

// 提取函数参数元组
type MyParameters<T> = T extends (...args: infer P) => any ? P : never
type P1 = MyParameters<(a: number, b: string) => void> // [number, string]
```

### 4. 分发条件类型：批量过滤

```typescript
// 裸类型参数 T 遇到联合会分发，逐个成员计算
type ToString<T> = T extends string ? T : never

type Mixed = string | number | boolean
type OnlyStr = ToString<Mixed> // string | never | never = string

// 用元组包裹可关闭分发（此时整体匹配，不会逐成员）
type ToStringNoDistrib<T> = [T] extends [string] ? T : never
type R2 = ToStringNoDistrib<Mixed> // never（整体不是 string）
```

## 05 · 映射类型与 keyof，手写 Partial / Pick / Omit

@id
ts-mapped-types

@level
高级

@freq
3

@tags
映射类型 | keyof | 工具类型

@ask
Partial、Pick、Omit 你肯定用过，但能自己写出来吗？讲讲 keyof 和映射类型是什么关系，然后现场手写这三个工具类型，最好用真实业务举个例子。

@oral
**先给结论**：`keyof T` 取出类型 T 的所有键组成联合；映射类型 `{ [K in keyof T]: ... }` 遍历这些键、逐个生成新结构。Partial / Pick / Omit 的本质，全都是「基于 keyof 的映射 + 键的选择」。

**再说原理**。最基础的映射是 `{ [K in keyof T]: T[K] }`，它逐项复制 T 的属性。修饰符能改变属性性质：`?` 让属性变可选，`-?` 去掉可选；`readonly` / `-readonly` 控制只读。Pick 用子约束 `K extends keyof T` 限制允许的键；Omit 是「Pick 掉 Exclude 出来的键」，或者用 TS 4.1 的 key remapping 写法 `{ [K in keyof T as K extends U ? never : K]: T[K] }`，把不要的键映射成 never 直接剔除。

**给你真实场景**。做表单时编辑态用 `Partial<User>` 让所有字段可空可缺；列表列配置用 `Pick<User, 'id' | 'name'>` 只挑展示字段；接口入参用 `Omit<User, 'id' | 'createdAt'>` 去掉服务端生成的字段。需要把某个 prop 整体改名时，用 remapping 的 `as` 做键重映射。

**边界与取舍**：手写时别忘了给 Pick 的键加 `extends keyof T` 约束，否则会漏掉类型安全。Omit 用 `Exclude<keyof T, K>` 实现时，K 本身也可以是联合，要确认你真的想要「排除这些键」。映射类型默认不会保留原类型的 readonly / 可选修饰符，需要时显式加 `+?` 之类。

**收尾**：理解了 keyof + 映射 + 修饰符，你就既能读懂也能改写所有内置工具类型。面试把 Partial 和 Omit 的 remapping 写法都写出来，能明显拉开和只背 api 的人的差距。

@points
keyof T 取出 T 的所有键组成联合类型
映射类型 `{ [K in keyof T]: T[K] }` 逐项遍历生成新结构
修饰符 ? / -? / readonly / -readonly 控制属性性质
Pick 用 `K extends keyof T` 约束键，Omit 排除指定键
TS 4.1 的 key remapping（as）能做键的过滤与重命名

@steps
先讲 keyof 的作用：拿到所有键的联合
写出最基础的映射类型 Copy<T>
加 ? 修饰符推导 Partial 的实现
用 `K extends keyof T` 约束推导 Pick
用 Exclude 或 key remapping 推导 Omit，并给真实业务例子

@followups
映射类型会保留 readonly 吗？——默认不会，需要显式写 `readonly [K in keyof T]` 或 `+readonly` 来保留
Omit 为什么不用再映射一遍？——标准实现是 `Pick<T, Exclude<keyof T, K>>`，借内建工具组合即可
key remapping 还能干嘛？——除过滤外还能给键加前缀 / 改名，如 `as \`get${Capitalize<K>}\``

@example
### 1. 基础映射：逐项复制

```typescript
interface User {
  id: number
  name: string
  age: number
}

// 遍历 keyof User，逐项生成同结构副本
type Copy<T> = { [K in keyof T]: T[K] }

type UserCopy = Copy<User> // { id: number; name: string; age: number }
```

### 2. 手写 Partial（加 ? 修饰符）

```typescript
// 给每个属性加 ?，全部变可选
type MyPartial<T> = { [K in keyof T]?: T[K] }

type UserDraft = MyPartial<User>
// 得到 { id?: number; name?: string; age?: number }
// 真实业务：表单编辑态，所有字段可空可缺
const draft: UserDraft = { name: 'Ada' } // ✅ 只填一部分也合法
```

### 3. 手写 Pick（约束键 + 逐项选取）

```typescript
// K 必须来自 keyof T，只保留 K 指定的键
type MyPick<T, K extends keyof T> = { [P in K]: T[P] }

// 真实业务：表格列配置，只挑展示字段
type UserTableRow = MyPick<User, 'id' | 'name'>
// 得到 { id: number; name: string }
```

### 4. 手写 Omit（两种写法）

```typescript
// 写法一：组合内建 Exclude + Pick（标准实现）
type MyOmit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>

// 写法二：TS 4.1+ key remapping，把不要的键映射成 never 剔除
type MyOmit2<T, K extends keyof T> = {
  [P in keyof T as P extends K ? never : P]: T[P]
}

// 真实业务：接口入参，去掉服务端生成的字段
type CreateUserInput = MyOmit<User, 'id' | 'age'>
// 得到 { name: string }
```

## 06 · 类型守卫与类型收窄的几种方式

@id
ts-type-guard

@level
进阶

@freq
2

@tags
类型守卫 | 收窄 | is

@ask
类型收窄你用过哪些手段？typeof、instanceof 之后，自定义守卫怎么写？再给我讲讲可辨识联合，以及 4.4 之后那个 asserts 是什么东西。

@oral
**先给结论**：类型守卫是「在运行期做一次判断、让 TS 在对应分支里自动收窄类型」的机制。常见手段有：typeof、instanceof、in、自定义 `is` 谓词守卫、可辨识联合，以及 4.4+ 的断言函数 `asserts`。

**再说原理**。TS 的收窄由「控制流分析」驱动——只要某个判断能证明变量属于某类型，对应分支里类型就被收小。typeof 适合原始类型；instanceof 适合类实例；in 适合带不同字段的对象；自定义守卫 `pet is Fish` 把判断逻辑封装成类型谓词，TS 会信任它并在 true 分支里收窄。可辨识联合（带 `kind` 等字面量 tag 的联合）配合 switch，是最顺手的写法。断言函数 `asserts cond` 则用于「不满足就抛错」的场景，抛错后类型被断言成立、继续往下走。

**给你真实场景**。处理后端返回时，接口可能返回 `{ type: 'user', name }` 或 `{ type: 'bot', id }`，我用 `kind` 可辨识联合 + switch，每个 case 里字段自动收窄，还能顺带享受穷尽检查。解析 localStorage 的 JSON 时先用 typeof 确认是 object 再继续访问。

**边界与取舍**：自定义守卫是你「向编译器作的保证」，判断逻辑写错了 TS 不会发现（比如把谓词写反），所以守卫函数内部的判断必须真实可靠。`asserts` 守卫适合「条件不成立就抛错、成立则后续视为真」的流程控制。

**收尾**：优先用可辨识联合 + 内置守卫；逻辑复杂再上自定义 `is` 或 `asserts`。能现场写出一个 `asserts condition` 守卫，是 TS 进阶的明显信号。

@points
typeof / instanceof / in 是内置守卫，覆盖原始值、实例、字段差异
自定义守卫用 `x is T` 类型谓词，把判断封装并让 TS 信任
可辨识联合 + switch 是最顺手的收窄组合，且天然支持穷尽检查
asserts 守卫在「不满足就抛错」时断言类型成立，4.4+ 支持
自定义守卫是人为保证，内部判断必须真实，否则 TS 无法察觉错误

@steps
先列举内置守卫：typeof / instanceof / in 各自适用场景
讲可辨识联合如何配合 switch 自动收窄字段
写出自定义 `is` 守卫的签名与实现要点
引入 asserts 守卫，说明它和 is 的区别
提醒自定义守卫是人为保证，判断逻辑必须真实可靠

@followups
`x is T` 和 `x: T` 返回值有什么不同？——is 是类型谓词，true 分支里 TS 会按 T 收窄；普通 boolean 不会触发收窄
asserts 守卫有什么用？——条件不成立就抛错，成立后类型被断言为真，常用于参数校验
可辨识联合一定要字面量 tag 吗？——是的，需要联合成员共享一个字面量类型的判别字段（如 type / kind）

@example
### 1. 内置守卫：typeof 与 in

```typescript
function format(value: string | number) {
  if (typeof value === 'string') {
    return value.trim() // ✅ 收窄为 string
  }
  return value.toFixed(2) // ✅ 收窄为 number
}

interface HasName {
  name: string
}
interface HasId {
  id: number
}

// 用 in 判断对象携带哪个字段
function describe(x: HasName | HasId) {
  if ('name' in x) {
    return x.name // ✅ 收窄为 HasName
  }
  return x.id // ✅ 收窄为 HasId
}
```

### 2. 自定义类型谓词守卫

```typescript
interface Fish {
  swim: () => void
}
interface Bird {
  fly: () => void
}

// 返回值是类型谓词 `pet is Fish`，TS 在 true 分支按 Fish 收窄
function isFish(pet: Fish | Bird): pet is Fish {
  return (pet as Fish).swim !== undefined
}

function move(pet: Fish | Bird) {
  if (isFish(pet)) {
    pet.swim() // ✅ 收窄为 Fish
  } else {
    pet.fly() // ✅ 收窄为 Bird
  }
}
```

### 3. 可辨识联合 + switch（带穷尽检查）

```typescript
type Shape =
  | { kind: 'circle'; r: number }
  | { kind: 'rect'; w: number; h: number }

function area(s: Shape): number {
  switch (s.kind) {
    case 'circle':
      return Math.PI * s.r ** 2 // s 收窄为 circle
    case 'rect':
      return s.w * s.h // s 收窄为 rect
  }
}
```

### 4. 断言函数 asserts

```typescript
// 不满足就抛错，满足后后续视为 string
function assertIsString(x: unknown): asserts x is string {
  if (typeof x !== 'string') {
    throw new TypeError('expected string, got ' + typeof x)
  }
}

function useValue(x: unknown) {
  assertIsString(x)
  x.toUpperCase() // ✅ 此处 x 已被断言为 string，可直接调用
}
```

## 07 · 函数重载在真实业务里怎么用

@id
ts-overload

@level
进阶

@freq
2

@tags
重载 | 签名 | API设计

@ask
函数重载在 TS 里到底是怎么工作的？你给我举个例子，比如一个格式化日期的函数，既能传 Date 又能传时间戳。重载签名和实现签名有什么区别？

@oral
**先给结论**：函数重载用「多条函数签名 + 一条实现签名」来描述「入参不同、返回不同」的函数，给调用方精确的类型提示，而真正的实现只有一个。

**再说原理**。写在最上面的是「重载签名」，只有声明、没有函数体，每条描述一种调用形态；最底下是「实现签名」，带函数体，必须能兼容所有重载签名。关键点：**重载签名在编译后会被抹掉，运行时只存在实现函数**。所以实现签名的参数类型要「宽」到能覆盖全部重载（通常写成 any 或联合），但对外暴露的提示来自重载签名。

**给你真实场景**。我写 `formatDate` 时，既能传 `Date`、也能传 `number` 时间戳、还能传 `string`，每种入参都给出对应的返回类型提示。再比如 `createStyle` 传对象或字符串、或 `axios.get` 根据泛型返回不同 data 形态，都是重载的典型用武之地。

**边界与取舍**：重载不是「多个实现」，它只是类型层的多态，运行时不分身。别用重载去替代联合参数——如果只是入参类型不同、但逻辑和语义一致，直接用一个联合参数 `string | number` 更简单；重载适合「不同入参对应不同返回形态 / 不同语义」的情形。实现体里通常用 `if` 分流处理。

**收尾**：重载解决的是「同一函数多种形态」的 DX 问题。讲清「重载签名会擦除、运行时只有实现体」这一点，能体现你理解 JS 本质而非只背类型语法。

@points
重载 = 多条重载签名（无函数体）+ 一条实现签名（有函数体）
重载签名编译后会被抹掉，运行时只有实现函数存在
实现签名参数要「宽」到覆盖所有重载（常为 any / 联合）
重载适合「不同入参对应不同返回形态」，非单纯类型不同
实现体内部用 if 分流，真正的逻辑只写一次

@steps
先说明重载是「签名 + 实现」两段式结构
强调重载签名编译后被擦除，运行时仅实现函数
写出 formatDate 的多条重载签名
给出对应的一条「宽」实现签名与内部 if 分流
点出重载与联合参数的取舍，避免滥用

@followups
重载签名为什么不能写函数体？——它只是类型声明，真实逻辑只在实现签名里，写体会产生多实现歧义
实现签名会对外暴露吗？——不会，调用方只能看到重载签名，实现签名的宽松类型被隐藏
重载能替代联合参数吗？——不能也不必，仅当不同入参语义 / 返回形态不同才值得用重载

@example
### 1. formatDate：多种入参、各自返回提示

```typescript
// 重载签名 1：传 Date
function formatDate(date: Date): string
// 重载签名 2：传时间戳
function formatDate(timestamp: number): string
// 重载签名 3：传字符串
function formatDate(text: string): string

// 实现签名：参数放宽到联合，必须有函数体，且不对外暴露
function formatDate(input: Date | number | string): string {
  const d = input instanceof Date ? input : new Date(input)
  return d.toISOString()
}

formatDate(new Date()) // ✅ 提示入参 Date
formatDate(1710000000000) // ✅ 提示入参 number
```

### 2. 入参不同、返回形态也不同

```typescript
// 重载：传 id 返回单个对象，传 id 数组返回数组
function getUser(id: number): { id: number; name: string }
function getUser(ids: number[]): { id: number; name: string }[]

function getUser(input: number | number[]): any {
  // 实现体：根据类型分流，真正只这一份逻辑
  if (Array.isArray(input)) {
    return input.map((id) => ({ id, name: 'u' + id }))
  }
  return { id: input, name: 'u' + input }
}
```

### 3. 反例：这种情况不该用重载

```typescript
// 如果只是入参类型不同、语义一致，直接用联合参数更简单
// 不必写成两条重载
function add(a: number | string, b: number | string): number {
  return Number(a) + Number(b)
}
```

## 08 · TS 类型是运行时行为吗？类型擦除与 enum 的坑

@id
ts-compile-erase

@level
进阶

@freq
2

@tags
类型擦除 | enum | 编译期

@ask
你说过 TS 类型都是编译期的，那 enum 也是吗？类型擦除到底是什么意思？我之前用 enum 定义状态码，结果打包体积变大了，你帮我分析下怎么回事，还有没有更好的写法？

@oral
**先给结论**：TS 类型完全在编译期，编译后**被擦除**，运行时根本不存在；但 `enum`（尤其数值 enum）和 `namespace` 会生成真实运行时代码——这正是坑的来源。

**再说原理**。类型擦除指 interface / type / 泛型等只存在于 .ts 文件，输出 .js 里一行不留。所以你不能用类型做 `instanceof`、不能用 `typeof T`、也不能把类型当值传参。enum 是例外：普通 enum 编译成双向映射对象（`A[0]='x'` 且 `A['x']=0`），既占运行时又会被打进包；`const enum` 则被完全内联擦除，但它和 `isolatedModules` / Babel 不兼容，跨文件还容易出问题，所以 TS 官方现在**不推荐 const enum**。

**给你真实场景**。我用 enum 定义接口状态码，结果打包体积莫名变大、且 tree-shaking 不掉；后来换成 `as const` 的对象 + 用 `typeof` 派生联合：`const Status = { Ok: 1 } as const; type Status = typeof Status[keyof typeof Status]`，既零运行时、又有关键字补全。还有人把 enum 当类型用在 switch 上，漏分支却没有编译报错——因为 enum 不是受控的穷尽联合。

**边界与取舍**：decorator、namespace 也可能留下运行时代码，别以为它们是纯类型。凡是需要「运行时判别」的场景，靠真实存在的值（如字符串字面量对象），而不是类型。

**收尾**：记住铁律——**类型是编译期的，值才是运行时的**。需要运行时判别就用字符串联合 + `as const`，远离 enum 的坑。

@points
interface / type / 泛型编译后被擦除，运行时不存在
普通 enum 编译成双向映射对象，占运行时且难 tree-shake
const enum 被内联擦除，但与 isolatedModules / Babel 不兼容，官方不推荐
需要运行时判别应改用 `as const` 对象 + typeof 派生联合
decorator / namespace 也可能留运行时代码，并非纯类型

@steps
先讲类型擦除的定义：类型不进 .js
指出 enum 是例外，会生成运行时代码
分析普通 enum 双向映射带来的体积与 tree-shaking 问题
给出 as const + typeof 的零运行时替代方案
总结铁律：类型是编译期、值是运行时

@followups
为什么不能用 instanceof 判断类型？——类型在运行时已被擦除，instanceof 只能判断真实存在的值 / 类
const enum 为什么被官方劝退？——它与 isolatedModules 和单文件转译工具冲突，跨模块易出运行时错
as const 怎么派生联合类型？——`const X = {...} as const; type T = typeof X[keyof typeof X]`

@example
### 1. 类型被擦除，不能当值用

```typescript
interface Point {
  x: number
  y: number
}

// 编译后这段逻辑完全消失，下面这行会直接报运行时错误
// console.log(typeof Point) // ❌ Point is not defined（运行时根本没这个变量）
```

### 2. 普通 enum 编译成双向映射对象

```typescript
// 源码
enum Status {
  Ok = 200,
  Err = 500,
}

// 编译后（示意）：既生成对象，又有反向映射，占运行时
// var Status = { 200: 'Ok', 500: 'Err', Ok: 200, Err: 500 }
console.log(Status[200]) // 'Ok' —— 反向映射来自运行时代码
console.log(Status.Err) // 500
```

### 3. const enum 被内联（但与工具链冲突）

```typescript
const enum Color {
  Red,
  Green,
}

// 编译后直接内联成字面量，不生成对象；但 require 单文件转译时易出问题
const c = Color.Red // 编译成 const c = 0
```

### 4. 推荐方案：as const + typeof 派生联合

```typescript
// 零运行时：编译后就是一个普通对象字面量，可被 tree-shake
const Status = {
  Ok: 200,
  Err: 500,
} as const

// 从值反推类型，得到 '200' | '500' 的受控联合
type StatusValue = (typeof Status)[keyof typeof Status]

// 用作判别字段时，switch 漏分支会触发穷尽检查报错
function label(s: StatusValue) {
  switch (s) {
    case Status.Ok:
      return 'ok'
    case Status.Err:
      return 'err'
  }
}
```

## 09 · 装饰器与元数据，NestJS / Angular 里怎么用

@id
ts-decorator

@level
高级

@freq
1

@tags
装饰器 | reflect-metadata | AOP

@ask
装饰器和 reflect-metadata 你了解吗？NestJS 里的 @Controller、@Injectable 到底是怎么运作的？你能不能自己也写一个装饰器，比如给方法加个缓存或者鉴权？

@oral
**先给结论**：装饰器是「给类 / 方法 / 属性 / 参数附加元数据或修改行为」的语法糖，本质是 AOP（面向切面编程）。TS 里有「旧版装饰器」（`experimentalDecorators`）和 TC39 标准装饰器两套；NestJS、Angular 用的还是旧版，配合 `reflect-metadata` 实现依赖注入与路由收集。

**再说原理**。共有五种装饰器：类、方法、访问器、属性、参数。它们本质是「在定义时执行的函数」，能拿到 target / key / descriptor。配合 `reflect-metadata` 的 `Reflect.defineMetadata` / `getMetadata`，框架能在启动时读取 `design:type`、`design:paramtypes`、`design:returntype` 这些由 TS 自动注入的元数据，从而完成 DI 容器装配、路由注册——你写的 `@Get()` 并不「执行」逻辑，而是往一个全局元数据表里登记。

**给你真实场景**。NestJS 里 `@Controller('user')` 标记路由前缀，`@Get(':id')` 把方法挂到 GET，`@Injectable()` 标记可被注入，`@Param() id` 从参数位置读元数据注入对应值；我还写过自定义 `@Roles('admin')` 配合 Guard 做权限，以及 `@Cacheable()` 包裹方法做缓存。Angular 里 `@Component` / `@Input()` 同理。

**边界与取舍**：旧版装饰器需要 `experimentalDecorators: true`，其元数据能力依赖 `emitDecoratorMetadata`。TS 5.x 的**标准装饰器**语法变了（用 `with`、返回 replacement），和 Nest 那套不互通，迁移要小心。装饰器滥用会让控制流变隐晦，定位问题要「顺着元数据找注册表」。

**收尾**：装饰器 = 声明式 AOP + 元数据驱动。能讲清 `reflect-metadata` 怎么把类型在编译期写进元数据、框架又怎么读出来，是这道题的加分核心。

@points
装饰器是附加元数据 / 修改行为的语法糖，本质是 AOP
五种装饰器：类 / 方法 / 访问器 / 属性 / 参数
reflect-metadata 让框架在运行时读取编译期注入的设计元数据
NestJS / Angular 用装饰器做路由收集与 DI 容器装配
TS 5.x 标准装饰器与旧版不互通，迁移需谨慎

@steps
先讲装饰器是声明式 AOP，分五种作用目标
说明 emitDecoratorMetadata 如何注入 design:* 元数据
讲清 reflect-metadata 的读写 API 与框架利用方式
用 NestJS / Angular 实例串起「装饰器 → 注册表 → 运行时」链路
现场写一个自定义方法装饰器（如日志 / 缓存）

@followups
装饰器为什么能拿到参数类型？——emitDecoratorMetadata 让 TS 把 design:paramtypes 写进元数据，运行时可读取
标准装饰器和旧版最大的区别？——语法与执行模型不同（with / replacement），二者不能混用
自定义装饰器能改返回值吗？——方法装饰器可改写 descriptor.value，从而在包裹逻辑里改返回

@example
### 1. 自定义方法装饰器：日志环绕

```typescript
// 方法装饰器：拿到原型、方法名、描述符
function Log(target: any, key: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value
  descriptor.value = function (...args: any[]) {
    console.log(`call ${key} with`, args) // 调用前打日志
    const result = original.apply(this, args)
    console.log(`call ${key} ->`, result) // 调用后打结果
    return result
  }
}

class MathSvc {
  @Log
  add(a: number, b: number) {
    return a + b
  }
}
```

### 2. reflect-metadata：读取设计期类型

```typescript
import 'reflect-metadata'

class User {
  @Reflect.metadata('role', 'admin') // 手动写元数据
  name!: string
}

// 读取 TS 注入的设计元数据（需 emitDecoratorMetadata）
const type = Reflect.getMetadata('design:type', User.prototype, 'name')
console.log(type === String) // true

// 框架据此做 DI：拿到构造器参数类型，去容器里找对应实例注入
```

### 3. NestJS 真实片段

```typescript
@Controller('user') // 路由前缀 /user
@Injectable() // 标记为可被 DI 容器注入
export class UserController {
  constructor(private svc: UserService) {} // 参数类型由元数据驱动注入

  @Get(':id') // 注册 GET /user/:id
  findOne(@Param('id') id: string) {
    // @Param 从参数位置读取元数据，把路由参数注入进来
    return this.svc.findById(id)
  }
}
```

### 4. 自定义鉴权装饰器

```typescript
// 把允许的角色写进元数据，Guard 里读取做权限判断
function Roles(...roles: string[]) {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('roles', roles, target, key)
  }
}

class AdminCtrl {
  @Roles('admin')
  deleteAll() {
    /* 只有 admin 能进 */
  }
}
```

## 10 · tsconfig 里最该关注的配置，strict 到底开了什么

@id
tsconfig-strict

@level
进阶

@freq
2

@tags
tsconfig | strict | 工程配置

@ask
你们项目的 tsconfig 是你配的吗？strict 到底一键开了哪些东西？还有 skipLibCheck、moduleResolution 这些你是怎么选的，给个最佳实践。

@oral
**先给结论**：tsconfig 是 TS 工程的「灵魂开关」。最该关注三组：编译目标 / 模块解析（target / module / moduleResolution）、类型严谨度（strict 全家桶）、以及工程约束（noUnused* / skipLibCheck / paths 等）。**strict 不是单个开关，而是一次性打开 8 个子选项的集合。**

**再说原理**。开启 strict 等于同时打开：noImplicitAny（隐式 any 报错）、strictNullChecks（null / undefined 不再随意赋值）、strictFunctionTypes（函数参数逆变检查）、strictBindCallApply（bind / call / apply 参数受检）、strictPropertyInitialization（类属性必须初始化）、noImplicitThis、useUnknownInCatchVariables（catch 变量是 unknown）、alwaysStrict（输出加严格模式）。其中对业务影响最大的是 strictNullChecks。

**给你真实场景**。我新项目一律从 `"strict": true` 起步；遇到第三方无类型声明报红，用 `skipLibCheck` 跳过 .d.ts 内部检查，而不是关掉 strict；路径别名用 `baseUrl` + `paths` 配合 Vite 的 resolve.alias；开启 `verbatimModuleSyntax` / `isolatedModules` 保证打包器下的 ESM 语义；`noUnusedLocals` / `noUnusedParameters` 在 CI 阶段卡掉无用代码。

**边界与取舍**：不要在旧大仓里贸然全开 strict，建议逐项打开、配 `// @ts-expect-error` 渐进迁移。`moduleResolution` 在 Node 生态用 `Bundler` 或 `NodeNext`，配错会导致 import 解析怪异。`skipLibCheck` 只跳过声明文件检查，不影响你自己代码的检查强度。

**收尾**：把 strict 拆成 8 个子项逐个能说出来，再讲清 strictNullChecks 与 skipLibCheck 的取舍，就能证明你真正配过工程，而不只是会写类型。

@points
strict 是集合开关，一次性打开 8 个子选项而非单个
strictNullChecks 影响最大：null / undefined 不再随意赋值
skipLibCheck 跳过第三方 .d.ts 检查，避免被迫关闭 strict
moduleResolution 在 Node 用 Bundler / NodeNext，配错解析会异常
noUnused* / isolatedModules / verbatimModuleSyntax 保障工程与打包语义

@steps
先点明 tsconfig 三大关注组：目标解析 / 严谨度 / 工程约束
拆解 strict 的 8 个子选项，重点讲 strictNullChecks
说明 skipLibCheck 的作用与边界（只跳声明文件）
讲 baseUrl/paths、moduleResolution 与打包器的配合
给出渐进策略：新项目开 strict，旧仓逐项迁移

@followups
strict 能只开其中几项吗？——能，直接显式写子选项，例如只开 strictNullChecks 而关 noImplicitAny
isolatedModules 为什么要开？——保证单文件转译（Babel / esbuild）安全，禁止跨文件类型重导出等
useUnknownInCatchVariables 改了什么？——catch(e) 里的 e 从 any 变 unknown，必须收窄才能用

@example
### 1. strict 实际等价的子选项

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "useUnknownInCatchVariables": true,
    "alwaysStrict": true
  }
}
```

### 2. strictNullChecks 的真实影响

```typescript
// 未开 strictNullChecks 时，下面不报错，埋下运行时隐患
// 开了之后必须显式处理 null
function getName(u: { name: string } | null) {
  // return u.name // ❌ u 可能为 null
  if (u === null) return 'unknown'
  return u.name // ✅ 收窄后可用
}
```

### 3. 推荐的工程配置片段

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

### 4. useUnknownInCatchVariables 行为对比

```typescript
try {
  JSON.parse('{ bad')
} catch (e) {
  // 开 strict 后 e 是 unknown，必须先收窄
  if (e instanceof Error) {
    console.log(e.message) // ✅ 收窄为 Error 后可用
  }
}
```
