---
id: algorithm
name: 算法与数据结构
en: Algorithms
icon: binary
color: #e5484d
order: 14
desc: 笔试与手写环节的高频题型，重点讲清思路、边界和复杂度。
---

## 01 · 复杂度分析：时间和空间复杂度到底怎么算

@id
algo-complexity

@level
基础

@freq
3

@tags
时间复杂度 | 空间复杂度 | 大O

@ask
别急着写算法，先把复杂度讲清楚：时间复杂度和空间复杂度到底怎么数？大O是什么含义？我给你一个嵌套循环或者递归函数，你能现场算出它的复杂度吗？最好把常见的坑也说说。

@oral
**先说结论**：复杂度衡量的是「随着输入规模 n 增大，算法消耗的资源怎么增长」，所以它是一个趋势、是阶，而不是精确次数。大O记法只保留增长最快的那一项，系数和低阶项全部丢掉，比如 3n² + 100n + 5 直接写成 O(n²)。

**时间复杂度怎么数**：核心是数「基本操作」的执行次数和 n 的关系。一层循环跑 n 次就是 O(n)；两层独立嵌套是 O(n²)；每次把规模砍一半（比如二分、完全二叉树遍历）就是 O(log n)；递归里每次调用分裂成两份、深度为 log n，总操作 O(n log n)。有个容易翻车的点：循环变量不是每次 +1 而是 ×2 时，次数就是 log₂n 而不是 n。

**空间复杂度怎么数**：看除了输入本身，额外开了多少内存。单个变量是 O(1)；开了一个和输入等长的数组就是 O(n)；递归要特别小心——每深入一层就多压一个栈帧，递归深度就是额外空间，尾递归在 JS 里并不优化，深度过大会直接爆栈。

**再说瓶颈与优化思路**：当你发现是 O(n²) 的嵌套循环时，瓶颈往往是「内层又扫了一遍」；常见优化是用哈希表把查找从 O(n) 降到 O(1)，或者排序后用双指针把平方级降到线性。

**最后说边界和易错点**：一定要区分最好、最坏、平均情况，比如快排最坏 O(n²)、平均 O(n log n)，面试里默认问平均，但你要主动提最坏；常数次操作写 O(1) 而不是 O(0)；字符串拼接、数组扩容这些隐藏成本在 n 很大时不可忽视。

@points
大O是「增长趋势」，丢系数、丢低阶项，只留最高阶
时间复杂度 = 基本操作次数与 n 的关系；循环砍半就是 O(log n)
空间复杂度要算递归调用栈，JS 不优化尾递归，深递归会爆栈
必须区分最好/最坏/平均，快排最坏 O(n²)、平均 O(n log n)
隐藏成本（字符串拼接、数组扩容）在数据量大时同样关键

@steps
先给定义：大O衡量资源随 n 增长的趋势，只取最高阶、丢常数
数时间：定位基本操作，看循环次数如何随 n 变化
数空间：除输入外额外内存，递归要把调用栈深度算进去
辨析最好/最坏/平均，主动点出最坏情况
指出常见优化方向（哈希降查找、排序+双指针降平方）

@followups
O(log n) 里的 log 底数是多少？——大O忽略常数，底 2 换 e 只差常数倍，所以统一写 log n
为什么快排最坏是 O(n²)？—— pivot 每次都选到最小/最大，划分极度不平衡，退化成 n + (n-1) + … 
JS 里尾递归会被优化吗？——不会，V8 不实现尾调用优化，深递归照样爆栈
空间 O(1) 表示不占内存吗？——不是，表示占用与 n 无关的固定量，常数级内存

@example
### 1. 时间复杂度：数清基本操作的次数

```javascript
// 例 A：单层循环，跑 n 次 → O(n)
function linear(n) {
  for (let i = 0; i < n; i++) { // 执行 n 次
    console.log(i)
  }
}

// 例 B：两层独立嵌套，n × n → O(n²)
function quadratic(n) {
  for (let i = 0; i < n; i++) {       // 外层 n 次
    for (let j = 0; j < n; j++) {     // 内层每次 n 次
      console.log(i, j)
    }
  }
}

// 例 C：每次砍半，log₂n 次 → O(log n)
function halve(n) {
  let count = 0
  while (n > 1) {
    n = Math.floor(n / 2) // 3 → 1，循环变量不是 +1 而是 /2
    count++
  }
  return count // n=8 时返回 3，即 log₂8
}

console.log('linear 跑 5 次:', Array.from({ length: 5 }, (_, i) => i))
console.log('halve(8) 次数 =', halve(8)) // 输出 3，对应 O(log n)
```

### 2. 空间复杂度：额外内存与递归栈

```javascript
// 例 D：只用了固定几个变量 → O(1)
function constantSpace(n) {
  let sum = 0 // 与 n 无关的固定空间
  for (let i = 0; i < n; i++) sum += i
  return sum
}

// 例 E：开了一个与 n 等长的数组 → O(n)
function linearSpace(n) {
  const arr = new Array(n).fill(0) // 额外 O(n) 空间
  return arr
}

// 例 F：递归深度为 n，每一层一个栈帧 → O(n) 空间
function recursiveDepth(n) {
  if (n <= 0) return 0
  return recursiveDepth(n - 1) + 1 // 最深压 n 个栈帧
}

console.log('constantSpace(100) =', constantSpace(100)) // 4950
console.log('linearSpace 长度 =', linearSpace(5).length) // 5
console.log('recursiveDepth(3) =', recursiveDepth(3))   // 3，递归深度即空间
```

## 02 · 数组与字符串高频题：两数之和、最长无重复子串

@id
algo-array-string

@level
手写题

@freq
3

@tags
哈希表 | 滑动窗口 | 双指针

@ask
先来道开胃菜：两数之和，给一个数组和一个目标值，找出和为目标的两个下标。再来一道进阶的，最长无重复字符子串的长度。你先把暴力思路说出来，再讲优化，最后把代码写给我，并告诉我复杂度。

@oral
**先说暴力解**：两数之和最直白的做法是两层循环，对每个元素都去后面找有没有能凑成 target 的配对，时间 O(n²)。最长无重复子串同样可以暴力：枚举所有起点，每个起点向后延伸到出现重复为止，也是 O(n²) 甚至更差。

**说瓶颈**：两数之和的瓶颈是「内层又扫了一遍数组去找补数」，每次查找是 O(n)；最长子串的瓶颈是「每次换起点都要重新判断重复」，重复劳动严重。

**说优化思路**：两数之和用哈希表存「值 → 下标」，边遍历边查 target - 当前值 是否已经在表里，查找从 O(n) 降到 O(1)，整体 O(n)。最长无重复子串用滑动窗口 + 哈希表记录「字符 → 最近出现位置」，右指针一直扩，遇到重复就把左指针跳到上次出现位置的下一位，窗口内始终无重复，整个串只扫一遍。

**说复杂度**：两数之和时间 O(n)、空间 O(n)（哈希表）；最长无重复子串时间 O(n)、空间 O(min(n, m))，m 是字符集大小。

**说边界**：两数之和题目保证有唯一解，但你要主动说「没有解 / 多个解怎么办」；最长子串空串返回 0，注意左指针更新用 Math.max 防止回退，字符集考虑 Unicode 超出 ASCII 的情况则用对象/Map 存。

@points
两数之和暴力 O(n²) 的瓶颈在内层线性查找，用哈希表降到 O(1)
滑动窗口核心：右扩左缩，哈希存「字符→最近位置」，保证窗口内无重复
左指针更新要用 Math.max(left, lastSeen + 1)，防止窗口左边界回退
空串、单字符、全相同等边界都要覆盖
最长子串空间是 O(min(n,字符集))，不是 O(1)

@steps
两数之和：暴力两层循环，定位瓶颈在补数查找
引入哈希表存值到下标，边走边查，O(1) 命中即返回
最长子串：定义左右双指针 + 哈希记录最近位置
右指针右移，遇到重复用 Math.max 跳左指针
全程维护最大窗口长度，返回结果

@followups
两数之和如果有多个解返回哪个？——题意通常唯一解，多解可返回任意一组，改返回值类型为二维数组即可
哈希表能不用吗？——可以排序后用双指针，但会丢失原下标，需先备份索引
最长子串用 Set 行不行？——行但删除/收缩时要逐个 delete，不如记录最近位置高效，且无法 O(1) 定位左边界

@example
### 1. 两数之和：哈希表 O(n)

```javascript
// 给定 nums 与目标 target，返回两数下标
// 思路：边遍历边把「值→下标」存进 map，每步查补数是否已在 map
function twoSum(nums, target) {
  const map = new Map() // 存 值 -> 下标，查找 O(1)
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i] // 需要的补数
    if (map.has(complement)) {
      return [map.get(complement), i] // 命中，直接返回
    }
    map.set(nums[i], i) // 没命中，把当前值记下来
  }
  return [] // 题目保证有解，这里兜底
}

// 自测：输入 -> 输出
console.log(twoSum([2, 7, 11, 15], 9))  // [0, 1]，因为 2+7=9
console.log(twoSum([3, 2, 4], 6))       // [1, 2]，因为 2+4=6
console.log(twoSum([3, 3], 6))          // [0, 1]，相同值也能处理
// 时间 O(n)，空间 O(n)
```

### 2. 最长无重复字符子串：滑动窗口 O(n)

```javascript
// 返回字符串中「最长无重复字符子串」的长度
// 思路：滑动窗口 + 哈希表记录字符最近出现下标，左指针遇到重复就右跳
function lengthOfLongestSubstring(s) {
  const lastSeen = new Map() // 字符 -> 最近下标
  let left = 0
  let maxLen = 0
  for (let right = 0; right < s.length; right++) {
    const ch = s[right]
    if (lastSeen.has(ch)) {
      // 关键：左边界取较大值，避免窗口回退
      left = Math.max(left, lastSeen.get(ch) + 1)
    }
    lastSeen.set(ch, right)
    maxLen = Math.max(maxLen, right - left + 1)
  }
  return maxLen
}

// 自测：输入 -> 输出
console.log(lengthOfLongestSubstring('abcabcbb')) // 3，如 "abc"
console.log(lengthOfLongestSubstring('bbbbb'))    // 1，全是重复
console.log(lengthOfLongestSubstring('pwwkew'))   // 3，如 "wke"
console.log(lengthOfLongestSubstring(''))         // 0，空串
// 时间 O(n)，空间 O(min(n, 字符集))
```

## 03 · 链表：反转链表、判断环、合并两个有序链表

@id
algo-linked-list

@level
手写题

@freq
3

@tags
链表 | 快慢指针 | 递归

@ask
链表三连：反转一个单链表；判断链表有没有环；合并两个有序链表。先讲反转的思路，最好迭代和递归都能写，然后环和合并也一起说了，复杂度报一下。

@oral
**先说暴力解（反转）**：最直观是把链表节点的值全取出来放到数组里，再反向塞回去——但这是作弊，没体现指针操作，而且要额外 O(n) 空间。

**说优化思路（反转迭代）**：用三个指针 prev、curr、next 迭代。每次先把 curr.next 暂存到 next，再把 curr.next 指向 prev 完成反转，然后 prev、curr 各往前走一步，直到 curr 为空，prev 就是新头。这是原地 O(1) 空间的做法，也是面试最想看到的。

**递归反转**：函数 reverseList(head) 先递归到尾部，回溯时把 head.next.next 指向 head、head.next 置空，层层反转。代码短但隐式用了调用栈，空间 O(n)。

**判断环**：暴力是存 HashSet 看有没有访问过，O(n) 空间。最优是快慢指针——慢指针一次走一步、快指针一次走两步，如果有环它们必相遇，无环快指针先到 null。空间降到 O(1)。

**合并有序链表**：双指针同时走，谁小接谁，剩下一个直接接在尾巴，时间 O(n+m)、空间 O(1)（迭代）或 O(n+m)（递归）。

**说边界**：空链表、单节点、反转后新头是原来的尾；环要判断 head 和 head.next 非空再启动快慢指针；合并时任一链表为空直接返回另一个。

@points
反转链表迭代法用 prev/curr/next 三指针，原地 O(1) 空间是标准解
递归反转代码更短但占用 O(n) 调用栈，小心深链表爆栈
判断环用快慢指针（1步/2步），相遇即有环，空间 O(1)
合并有序链表双指针谁小接谁，剩余直接拼接
边界：空链表、单节点、环检测前先判 head.next 非空

@steps
反转：初始化 prev=null、curr=head，循环暂存 next 再反转指针
反转递归：先到尾，回溯时让 next.next 指向自己
判断环：慢1快2，相遇返回 true，快指针到 null 返回 false
合并：双指针比较，小者接入结果，推进对应指针
处理边界，返回正确头节点

@followups
快慢指针为什么一定相遇？——每步快比慢多走 1，相当于快在环内追慢，相对速度 1 必追上
怎么找到环的入口？——相遇后一个指针回 head，两指针同速走，再次相遇点即入口
反转链表能一次遍历搞定吗？——迭代三指针本就是一次遍历，O(n) 时间 O(1) 空间

@example
### 1. 反转链表（迭代 + 递归）

```javascript
// 节点定义
function ListNode(val, next) {
  this.val = val
  this.next = next || null
}

// 迭代反转：prev/curr/next 三指针，原地完成
function reverseListIter(head) {
  let prev = null
  let curr = head
  while (curr) {
    const next = curr.next // 暂存下一个，否则断链找不到
    curr.next = prev       // 反转当前指针
    prev = curr            // prev 前移
    curr = next            // curr 前移
  }
  return prev // 原尾变成新头
}

// 递归反转：回溯时让下一节点指向自己
function reverseListRecur(head) {
  if (!head || !head.next) return head
  const newHead = reverseListRecur(head.next)
  head.next.next = head // 让下一节点指回当前
  head.next = null      // 断开旧指向
  return newHead
}

// 自测：1->2->3->null 反转后应为 3->2->1
const a = new ListNode(1, new ListNode(2, new ListNode(3)))
let r = reverseListIter(a)
const out = []
while (r) { out.push(r.val); r = r.next }
console.log(out) // [3, 2, 1]
// 时间 O(n)，迭代空间 O(1)，递归空间 O(n)
```

### 2. 判断环 + 合并有序链表

```javascript
// 快慢指针判断环：慢1快2，相遇即有环
function hasCycle(head) {
  if (!head || !head.next) return false
  let slow = head
  let fast = head.next
  while (slow !== fast) {
    if (!fast || !fast.next) return false // 快指针到尾，无环
    slow = slow.next
    fast = fast.next.next
  }
  return true
}

// 合并两个有序链表：双指针谁小接谁
function mergeTwoLists(l1, l2) {
  const dummy = new ListNode(0) // 哨兵节点，省去头判断
  let curr = dummy
  while (l1 && l2) {
    if (l1.val <= l2.val) { curr.next = l1; l1 = l1.next }
    else { curr.next = l2; l2 = l2.next }
    curr = curr.next
  }
  curr.next = l1 || l2 // 剩余部分直接接上
  return dummy.next
}

// 自测
const c1 = new ListNode(1, new ListNode(3, new ListNode(5)))
const c2 = new ListNode(2, new ListNode(4, new ListNode(6)))
let m = mergeTwoLists(c1, c2)
const mOut = []
while (m) { mOut.push(m.val); m = m.next }
console.log(mOut)        // [1,2,3,4,5,6]
console.log(hasCycle(c1)) // false，无环
```

## 04 · 栈与队列：有效括号、用栈实现队列、单调栈

@id
algo-stack-queue

@level
手写题

@freq
3

@tags
栈 | 队列 | 单调栈

@ask
栈和队列来一波：判断括号字符串是否有效；用两个栈实现一个队列；再说一个单调栈的经典应用。思路、代码、复杂度都要。

@oral
**先说有效括号（暴力解）**：不停找相邻的 "()" "[]" "{}" 删掉，能删光就有效——但反复扫描很低效，而且字符串删除成本高。

**优化思路**：用栈。遇到左括号就压栈；遇到右括号时，若栈空或栈顶不匹配则直接无效，否则弹出栈顶。遍历完栈必须为空才有效。这是 O(n) 时间、O(n) 空间的标准解。

**用栈实现队列**：队列是 FIFO、栈是 LIFO，核心矛盾在「出队要从栈底取」。用两个栈——inStack 负责压入，outStack 负责弹出。pop/peek 时若 outStack 为空，就把 inStack 全部倒进 outStack，顺序自然反转，于是栈底元素到了 outStack 的栈顶。每个元素最多进出各一次，均摊 O(1)。

**单调栈**：维护一个「栈内元素单调递增/递减」的栈，用来在 O(n) 内求出「下一个更大元素」「每日温度」「柱状图最大矩形」等。以每日温度为例，栈里存下标且对应温度递减，遇到更高温度就不断弹出并计算天数差，最后栈里剩下的是没等到更暖天气的日子。

**说边界**：有效括号要考虑右括号多于左括号（栈空时来了右括号）；实现队列时 empty 要两个栈都空才算空；单调栈初始为空、弹出时核对栈顶下标再算差。

@points
有效括号用栈：左压右弹，遍历完栈须空，且遇右括号时栈不能空
用栈实现队列靠「双栈倒数据」，pop 均摊 O(1)
单调栈保持单调性，能在 O(n) 求下一个更大元素/温度差
有效括号右括号多于左括号时无脑无效（栈空还来右括号）
队列 empty = 两个栈都为空

@steps
有效括号：左括号入栈，右括号匹配栈顶，不匹配或栈空则无效
遍历结束检查栈是否为空
实现队列：push 进 inStack，pop 时 outStack 空则倒置
单调栈：维护递减栈，遇更大值弹出并计算间距
处理边界（栈空、双栈空、剩余元素）

@followups
单调栈为什么是 O(n)？——每个元素最多入栈出栈一次，总操作线性
用栈实现队列 peek 怎么写？——和 pop 同理，只是不弹出 outStack 栈顶
有效括号只判断数量够吗？——不够，顺序和类型都必须匹配，()[]{} 数量对但交叉就错

@example
### 1. 有效括号 + 用栈实现队列

```javascript
// 有效括号：左压右弹，栈空遇右括号或结束栈非空都无效
function isValid(s) {
  const stack = []
  const pair = { ')': '(', ']': '[', '}': '{' }
  for (const ch of s) {
    if (ch === '(' || ch === '[' || ch === '{') {
      stack.push(ch)
    } else {
      if (stack.length === 0) return false // 右括号多了
      if (stack.pop() !== pair[ch]) return false // 类型不匹配
    }
  }
  return stack.length === 0 // 左括号多了也不行
}

// 用两个栈实现队列
class MyQueue {
  constructor() { this.in = []; this.out = [] }
  push(x) { this.in.push(x) }
  _move() { if (this.out.length === 0) while (this.in.length) this.out.push(this.in.pop()) }
  pop() { this._move(); return this.out.pop() }
  peek() { this._move(); return this.out[this.out.length - 1] }
  empty() { return this.in.length === 0 && this.out.length === 0 }
}

// 自测
console.log(isValid('()[]{}')) // true
console.log(isValid('([)]'))   // false，交叉无效
console.log(isValid('(('))     // false，左多
const q = new MyQueue()
q.push(1); q.push(2); q.push(3)
console.log(q.pop(), q.peek(), q.empty()) // 1 2 false
// 时间：括号 O(n)；队列均摊 O(1)
```

### 2. 单调栈：每日温度（下一个更大元素）

```javascript
// 返回还要等几天才会更暖；用递减栈存下标
function dailyTemperatures(temps) {
  const n = temps.length
  const ans = new Array(n).fill(0)
  const stack = [] // 存下标，对应温度递减
  for (let i = 0; i < n; i++) {
    // 当前更暖，就不断弹出并计算天数差
    while (stack.length && temps[i] > temps[stack[stack.length - 1]]) {
      const idx = stack.pop()
      ans[idx] = i - idx
    }
    stack.push(i)
  }
  return ans
}

// 自测：输入 -> 输出
console.log(dailyTemperatures([73, 74, 75, 71, 69, 72, 76, 73]))
// [1,1,4,2,1,1,0,0]，如第3天(75)等4天到第7天(76)才更暖
// 时间 O(n)，空间 O(n)
```

## 05 · 哈希表应用：数组去重、分组与手写 LRU 缓存

@id
algo-hash-lru

@level
手写题

@freq
3

@tags
哈希表 | LRU | Map

@ask
哈希表实战：数组去重、按某特征分组都好说，重点考你手写一个 LRU 缓存——get 和 put 都要 O(1)，容量满了淘汰最久没用的。来，写一下。

@oral
**先说去重和分组（暴力解）**：去重可以用双重循环判断「前面有没有出现过」，O(n²)；分组可以每遇到一个就从头扫一遍找同类，也慢。

**优化思路**：去重用 Set/对象记录见过的，边走边查 O(1)，整体 O(n)；分组用哈希表 key 是分组特征、value 是数组，一遍归类。

**手写 LRU（核心）**：要求 get/put 都是 O(1)，且满了淘汰「最久未使用」。难点是「如何同时做到快速查找和快速淘汰」。单独用对象查是 O(1) 但不知道谁最久；单独用数组知道顺序但查找 O(n)。

**最优解：哈希表 + 双向链表**。哈希表做 O(1) 查找定位节点；双向链表按「使用顺序」排，头是最新、尾是最久。get 命中时把节点移到表头（标记最近使用）；put 时若 key 已存在就更新值并移到头，不存在就新建节点插到头，超容量则删尾节点并同步删哈希。JS 里用 Map 更省事——Map 会保持插入顺序，最近访问的用 delete + set 重新插入就能排到最后，删除最久的就是第一个 key。

**说复杂度**：哈希表版时间 O(1)、空间 O(capacity)；Map 版同样 O(1)，实现更短。

**说边界**：容量为 0 或 1 的退化情况；get 不存在返回 -1；put 已存在算「使用」要刷新顺序；并发不考虑。

@points
去重/分组用哈希把查找从 O(n) 降到 O(1)
LRU 关键：O(1) 查找 + O(1) 淘汰，单用对象或数组都做不到
标准解 = 哈希表 + 双向链表（头新尾旧）
JS 可用 Map 的插入顺序，delete+set 刷新顺序，first key 即最久
边界：容量≤1、get 未命中返回 -1、put 已存在要刷新顺序

@steps
去重/分组：用 Set/Map 记录已见，一遍 O(n) 完成
LRU 设计：明确需要 O(1) 查找和 O(1) 淘汰
用 Map 实现：get 命中则 delete+set 移到末尾
put：已存在刷新值并移到末尾，否则新增到末尾
超容量时删 Map 的第一个 key（最久未用）

@followups
为什么不用数组存顺序？——数组删头/插头是 O(n)，不满足 O(1)
双向链表相比单链表的优势？——删除节点需改前驱，单链表找不到前驱，双链表 O(1)
Map 版 LRU 的缺陷？——仍要遍历到首个 key 删除，但删除本身 O(1)；且 Map 有内存开销

@example
### 1. 数组去重与分组

```javascript
// 去重：Set 去重，O(n)
function unique(arr) {
  return [...new Set(arr)]
}

// 按特征分组：哈希表 key->数组，一遍归类，O(n)
function groupBy(arr, keyFn) {
  const map = new Map()
  for (const item of arr) {
    const k = keyFn(item)
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(item)
  }
  return [...map.values()]
}

// 自测
console.log(unique([1, 2, 2, 3, 3, 3])) // [1, 2, 3]
console.log(groupBy(
  [{ t: 'a' }, { t: 'b' }, { t: 'a' }],
  (x) => x.t
))
// [[{t:'a'},{t:'a'}], [{t:'b'}]]
// 时间 O(n)，空间 O(n)
```

### 2. 手写 LRU 缓存（Map 版，O(1)）

```javascript
// 容量 capacity，get/put 均摊 O(1)
class LRUCache {
  constructor(capacity) {
    this.cap = capacity
    this.map = new Map() // 保持插入顺序，末尾=最近使用
  }
  get(key) {
    if (!this.map.has(key)) return -1
    const val = this.map.get(key)
    this.map.delete(key) // 删除后重新插入，排到末尾=标记为最近
    this.map.set(key, val)
    return val
  }
  put(key, val) {
    if (this.map.has(key)) this.map.delete(key) // 已存在先删
    this.map.set(key, val)
    if (this.map.size > this.cap) {
      // Map 第一个 key 即最久未使用，删除它
      const oldest = this.map.keys().next().value
      this.map.delete(oldest)
    }
  }
}

// 自测：容量 2
const c = new LRUCache(2)
c.put(1, 1); c.put(2, 2)
console.log(c.get(1)) // 1，访问后 1 变最近
c.put(3, 3)           // 淘汰最久的 2
console.log(c.get(2)) // -1，已被淘汰
c.put(4, 4)           // 淘汰最久的 1
console.log(c.get(1)) // -1
console.log(c.get(3), c.get(4)) // 3 4
// 时间 O(1) 均摊，空间 O(capacity)
```

## 06 · 二叉树：三种遍历、最大深度、最近公共祖先

@id
algo-binary-tree

@level
手写题

@freq
2

@tags
二叉树 | 递归 | 遍历

@ask
二叉树基础：前序、中序、后序遍历怎么写？求树的最大深度？再来个进阶——求两个节点的最近公共祖先（LCA）。递归思路讲清楚。

@oral
**先说三种遍历**：它们区别只在「访问根」的时机。前序是「根左右」、中序「左根右」、后序「左右根」。最直观的写法是递归，每次先处理当前节点，再递归左右子树，只是语句顺序不同，时间都是 O(n)（每个节点访问一次）、空间 O(h)（h 是树高，即递归栈深度，最坏退化为链表 O(n)）。

**最大深度**：递归地想——一棵树的深度等于「左子树深度和右子树深度的最大值再加 1（自己这一层）」。终止条件是节点为空返回 0。这是典型的「自底向上」递归，非常短。

**最近公共祖先（LCA）**：核心递归逻辑是——如果当前节点等于 p 或 q，那它自己就是这一支的命中节点，直接返回；否则递归左右子树。若左右都返回非空，说明 p、q 分列当前节点两侧，当前节点就是 LCA；若只有一侧非空，说明两个目标都在那一侧，把那一侧的结果往上传递。二叉树（非 BST）版本不依赖大小关系，纯靠结构判断。

**说复杂度**：三者都是 O(n) 时间、O(h) 空间。

**说边界**：空树深度 0；LCA 中 p 或 q 本身可能就是另一个的祖先（此时返回那个祖先）；遍历要考虑节点可能只有单侧子树。

@points
三种遍历只差「访问根」的时机：前序根左右、中序左根右、后序左右根
递归遍历时间 O(n)、空间 O(h)，h 最坏退化为 O(n)
最大深度 = max(左深, 右深) + 1，空节点返回 0
LCA：左右都命中当前节点即祖先；单侧命中则向上传递
边界：空树深 0；某节点本身可能是另一节点的祖先

@steps
写前/中/后序：固定递归框架，仅调整「访问」语句位置
最大深度：递归左右取最大再加 1，空返回 0
LCA：当前==p或q返回自身；否则递归左右
LCA 判断：左右皆非空→当前为祖先；否则传非空侧
处理空树与祖先即自身等边界

@followups
二叉树遍历能用迭代写吗？——能，用显式栈模拟递归，前序最简单，中序稍绕
LCA 在 BST 上怎么优化？——利用大小关系：当前值在 p、q 之间即为祖先，否则往对应侧走
最大深度和最大直径区别？——直径经过根的最长路径=左深+右深，要额外维护全局最大值

@example
### 1. 三种遍历与最大深度

```javascript
// 节点定义
function TreeNode(val, left, right) {
  this.val = val
  this.left = left || null
  this.right = right || null
}

// 前序：根左右
function preorder(root, out = []) {
  if (!root) return out
  out.push(root.val); preorder(root.left, out); preorder(root.right, out)
  return out
}
// 中序：左根右
function inorder(root, out = []) {
  if (!root) return out
  inorder(root.left, out); out.push(root.val); inorder(root.right, out)
  return out
}
// 后序：左右根
function postorder(root, out = []) {
  if (!root) return out
  postorder(root.left, out); postorder(root.right, out); out.push(root.val)
  return out
}
// 最大深度：max(左,右)+1
function maxDepth(root) {
  if (!root) return 0
  return Math.max(maxDepth(root.left), maxDepth(root.right)) + 1
}

// 自测：构造 1(2,3(4,5))
const t = new TreeNode(1,
  new TreeNode(2),
  new TreeNode(3, new TreeNode(4), new TreeNode(5)))
console.log('前序', preorder(t))  // [1,2,3,4,5]
console.log('中序', inorder(t))   // [2,1,4,3,5]
console.log('后序', postorder(t)) // [2,4,5,3,1]
console.log('深度', maxDepth(t))  // 3
// 时间 O(n)，空间 O(h)
```

### 2. 最近公共祖先（LCA）

```javascript
// 二叉树（非搜索树）求 p、q 的 LCA
function lowestCommonAncestor(root, p, q) {
  if (!root || root === p || root === q) return root // 命中或空
  const left = lowestCommonAncestor(root.left, p, q)
  const right = lowestCommonAncestor(root.right, p, q)
  if (left && right) return root // 分列两侧，当前即祖先
  return left || right           // 否则把非空那侧向上传
}

// 自测：树 3(5(6,2(7,4)),1(0,8))，求 5 和 1 的 LCA
const n3 = new TreeNode(3)
const n5 = new TreeNode(5), n1 = new TreeNode(1)
const n6 = new TreeNode(6), n2 = new TreeNode(2), n0 = new TreeNode(0), n8 = new TreeNode(8)
const n7 = new TreeNode(7), n4 = new TreeNode(4)
n3.left = n5; n3.right = n1
n5.left = n6; n5.right = n2; n2.left = n7; n2.right = n4
n1.left = n0; n1.right = n8
console.log(lowestCommonAncestor(n3, n5, n1).val) // 3
console.log(lowestCommonAncestor(n3, n5, n4).val) // 5（5 是 4 的祖先）
// 时间 O(n)，空间 O(h)
```

## 07 · 排序算法：快排、归并、堆排的实现与取舍

@id
algo-sort

@level
手写题

@freq
3

@tags
快排 | 归并 | 堆排序

@ask
排序三件套：手写快速排序、归并排序，再口头说下堆排序。它们的复杂度、稳定性、适用场景分别是什么？为什么实际工程里常用快排的变体？

@oral
**先说快排（暴力解思路）**：选一个 pivot，比它小的放左边、大的放右边，再对左右递归。最直观是开两个新数组装左右部分——清晰但额外 O(n) 空间。

**优化：原地 partition**。用双指针（或单指针 i 标记「已排好的小数区尾巴」），遍历数组把小于 pivot 的交换到前面，最后把 pivot 放到分界处，再递归左右。平均 O(n log n)、最坏 O(n²)（pivot 总选极值），空间 O(log n) 递归栈。工程上用三数取中、随机 pivot、小数组切 insertion sort 来规避最坏。

**归并排序**：核心是「分治 + 合并两个有序数组」。先把数组对半分到只剩一个元素，再两两合并成有序。合并需要额外 O(n) 空间，所以空间 O(n)；时间稳定 O(n log n)，且是**稳定排序**，这是它相对快排的最大优势，适合链表和外部排序。

**堆排序**：先把数组建成大顶堆（O(n)），然后反复把堆顶（最大值）换到末尾并下沉调整，得到升序。时间 O(n log n)、空间 O(1)（原地），但不稳定，且缓存局部性差，实际常慢于快排。

**说取舍**：平均最快用快排（不稳定）；要稳定或链表排序用归并；要原地且最坏可控用堆排。JS 的 Array.sort 在 V8 里对短数组用插入、长数组用快排变体 TimSort。

**说边界**：空数组/单元素直接返回；快排注意 pivot 选取防最坏；归并的合并区间别越界。

@points
快排平均 O(n log n)、最坏 O(n²)，原地 partition 靠 pivot 选取规避最坏
归并稳定 O(n log n)，需 O(n) 额外空间，适合链表/外部排序
堆排 O(n log n) 且 O(1) 空间但不稳定，缓存差常慢于快排
快排不稳定、归并稳定，这是二者关键取舍点
工程用三数取中/随机 pivot + 小数组插排优化快排

@steps
快排：选 pivot，partition 把小数放左、大数放右，递归两侧
快排优化：随机/三数取中 pivot，防有序数据退化
归并：对半分治到单元素，再合并两个有序段
归并合并：双指针比较，用临时数组收集，拷回原区间
堆排：建大顶堆，交换堆顶与末尾，下沉调整，重复至有序

@followups
为什么快排平均比堆排快？——快排缓存局部性好、交换少；堆排跳跃访问缓存不友好
归并能原地吗？——难且复杂，常规实现需 O(n) 辅助空间
什么场景必须用稳定排序？——按多关键字排序（先按部门的再按工资的）依赖稳定性

@example
### 1. 快速排序（原地 partition）

```javascript
// 原地快排：单指针标记小数区，平均 O(n log n)，最坏 O(n²)
function quickSort(arr, left = 0, right = arr.length - 1) {
  if (left >= right) return arr // 区间长度<=1 直接返回
  const pivot = arr[right]      // 取末位作 pivot（工程上用随机更稳）
  let i = left                  // i 是「已排好小数区」的尾指针
  for (let j = left; j < right; j++) {
    if (arr[j] < pivot) {       // 比 pivot 小就换到前面
      [arr[i], arr[j]] = [arr[j], arr[i]]
      i++
    }
  }
  [arr[i], arr[right]] = [arr[right], arr[i]] // pivot 归位
  quickSort(arr, left, i - 1)  // 递归左半
  quickSort(arr, i + 1, right) // 递归右半
  return arr
}

// 自测：输入 -> 输出
console.log(quickSort([3, 6, 8, 10, 1, 2, 1])) // [1,1,2,3,6,8,10]
console.log(quickSort([]))                      // []
console.log(quickSort([5]))                     // [5]
// 平均时间 O(n log n)，空间 O(log n) 递归栈
```

### 2. 归并排序（稳定 O(n log n)）

```javascript
// 归并排序：分治 + 合并两个有序段，稳定，需 O(n) 辅助空间
function mergeSort(arr) {
  if (arr.length <= 1) return arr
  const mid = arr.length >> 1
  const left = mergeSort(arr.slice(0, mid))  // 左半排序
  const right = mergeSort(arr.slice(mid))    // 右半排序
  return merge(left, right)
}
function merge(a, b) {
  const res = []
  let i = 0, j = 0
  while (i < a.length && j < b.length) {
    // 相等时先取 a，保证稳定性
    res.push(a[i] <= b[j] ? a[i++] : b[j++])
  }
  return res.concat(a.slice(i), b.slice(j)) // 拼接剩余
}

// 自测：输入 -> 输出
console.log(mergeSort([38, 27, 43, 3, 9, 82, 10])) // [3,9,10,27,38,43,82]
// 时间 O(n log n)，空间 O(n)，稳定
```

## 08 · 二分查找与双指针：边界处理与经典题型

@id
algo-binary-search

@level
手写题

@freq
2

@tags
二分查找 | 双指针 | 边界

@ask
二分查找看着简单，边界最容易写错。你写个在有序数组里找 target 的标准二分，再说说「找第一个等于 target 的位置」怎么改；另外用双指针做个有序数组的两数之和。

@oral
**先说标准二分（暴力解）**：从头线性扫，O(n)。有序数组明显能更快。

**优化：二分查找**。核心是用左右指针 mid = (left+right)>>1，比较 nums[mid] 与 target：相等返回，小了收缩左边界，大了收缩右边界，直到 left>right。时间 O(log n)。

**边界是最大坑**：循环条件写 `left <= right` 还是 `<`、更新写 `mid` 还是 `mid±1`，必须配套。我习惯用「左闭右闭」区间 `[left, right]`，循环条件 `left <= right`，因为 right 是合法下标；中点命中后返回，否则 `left = mid+1` 或 `right = mid-1`，因为 mid 已排除。这样不会死循环也不会漏。

**找第一个等于 target**：不能命中就返回，而要当 `nums[mid] >= target` 时把右边界收到 `mid`（保留 mid 可能是答案），最后判断 `nums[left] === target`。这是「寻找左边界」模板。

**有序数组两数之和（双指针）**：和之前哈希法不同，这里数组已排序且要求用 O(1) 空间。用左右指针，和太大右移、太小左移，直到命中，O(n) 时间 O(1) 空间。

**说边界**：空数组/找不到返回 -1；找左边界时 left 可能越界要先判；双指针需防 left>=right 时还访问。

@points
二分用「左闭右闭 [left,right]」配 `left<=right` 与 `mid±1` 最不易错
找第一个等于 target 要用「寻找左边界」模板，>=时收右边界到 mid
标准二分 O(log n)，双指针两数之和 O(n) 且 O(1) 空间
循环更新必须配套，否则死循环或漏元素
边界：空数组返回 -1，左边界结果要先判越界与命中

@steps
标准二分：定左右闭区间，算 mid，比较后收缩对应边界
命中即返回，未命中更新 mid±1 排除已查中点
找左边界：>=target 时 right=mid 保留候选，结束后校验
有序两数之和：左右指针，和偏大右移、偏小左移
处理空数组/未找到等边界

@followups
为什么 mid 用 (left+right)>>1 而不是 (left+right)/2？——位运算更快，且避免大数相加溢出（JS 数字虽不溢出但习惯使然）
找左右边界差别在哪？——左边界 >=时收右，右边界 <=时收左，最后校验
二分能用于旋转数组查找吗？——能，先判断 mid 落在哪段有序区再收缩

@example
### 1. 标准二分与查找左边界

```javascript
// 标准二分：左闭右闭区间，O(log n)
function binarySearch(nums, target) {
  let left = 0, right = nums.length - 1
  while (left <= right) {            // 闭区间，left==right 仍要查
    const mid = (left + right) >> 1
    if (nums[mid] === target) return mid
    else if (nums[mid] < target) left = mid + 1 // 排除 mid
    else right = mid - 1
  }
  return -1 // 没找到
}

// 查找「第一个等于 target」的位置（左边界模板）
function firstEqual(nums, target) {
  let left = 0, right = nums.length - 1
  while (left <= right) {
    const mid = (left + right) >> 1
    if (nums[mid] >= target) right = mid - 1 // 候选保留 mid
    else left = mid + 1
  }
  // 结束后 left 是第一个 >=target 的下标
  return nums[left] === target ? left : -1
}

// 自测
console.log(binarySearch([1, 3, 5, 7, 9], 7))   // 3
console.log(binarySearch([1, 3, 5, 7, 9], 4))   // -1
console.log(firstEqual([1, 2, 2, 2, 3], 2))     // 1（第一个 2）
console.log(firstEqual([1, 2, 3], 5))           // -1
// 时间 O(log n)，空间 O(1)
```

### 2. 有序数组的两数之和（双指针）

```javascript
// 已排序数组找两数和为 target 的下标，O(n) 时间 O(1) 空间
function twoSumSorted(nums, target) {
  let left = 0, right = nums.length - 1
  while (left < right) {              // 不能相等，避免重复使用
    const sum = nums[left] + nums[right]
    if (sum === target) return [left, right]
    else if (sum < target) left++     // 和太小，左移增大
    else right--                      // 和太大，右移减小
  }
  return [] // 无解
}

// 自测
console.log(twoSumSorted([2, 7, 11, 15], 9))  // [0, 1]
console.log(twoSumSorted([1, 3, 4, 5, 7], 8)) // [1, 3]（3+5）
console.log(twoSumSorted([1, 2], 5))          // []
// 时间 O(n)，空间 O(1)
```

## 09 · 动态规划入门：爬楼梯、最长递增子序列

@id
algo-dp

@level
进阶

@freq
2

@tags
动态规划 | 状态转移 | 递推

@ask
动态规划入门两题：爬楼梯（一次 1 或 2 阶，n 阶有多少种走法）；最长递增子序列（LIS）长度。讲讲你怎么定义状态、写转移方程，以及怎么优化空间。

@oral
**先说爬楼梯（暴力解）**：枚举所有走法再数，指数级，明显不行。

**优化：递推/DP**。定义 dp[i] 为「到第 i 阶的方法数」。最后一步要么从 i-1 走 1 阶、要么从 i-2 走 2 阶，所以 dp[i] = dp[i-1] + dp[i-2]——这其实就是斐波那契。基础 dp[0]=1（地面算一种）、dp[1]=1。时间 O(n)、空间 O(n)，而且因为只用到前两项，可优化成两个变量滚动，空间 O(1)。

**LIS（最长递增子序列）**：定义 dp[i] 为「以第 i 个数结尾的最长递增子序列长度」。对每个 i，往前找所有 nums[j] < nums[i] 的 j，取 dp[j] 最大值再加 1。答案是整个 dp 的最大值。暴力转移 O(n²)、空间 O(n)。

**LIS 优化（进阶）**：维护一个 tails 数组，tails[k] 表示「长度为 k+1 的递增子序列的最小结尾」。遍历 nums，用二分把每个数替换到 tails 中第一个 >= 它的位置（找不到就追加）。tails 的长度就是 LIS 长度，时间降到 O(n log n)。这是经典的「耐心排序」思路。

**说复杂度**：爬楼梯 O(n)/O(1)；LIS 基础 O(n²)，优化 O(n log n)。

**说边界**：n=0 或 1 直接返回；LIS 空数组返回 0；转移时 j 从 0 到 i-1 别越界。

@points
DP 核心是定义状态 + 写转移方程，爬楼梯 = 斐波那契 dp[i]=dp[i-1]+dp[i-2]
爬楼梯可滚动变量优化到 O(1) 空间
LIS 定义 dp[i]=以 i 结尾的最长长度，答案为 dp 最大值
LIS 优化用 tails + 二分，O(n log n)
边界：n=0/1、空数组，转移下标不越界

@steps
爬楼梯：定义 dp[i] 为到第 i 阶方法数，写出转移 dp[i]=dp[i-1]+dp[i-2]
爬楼梯：用两变量滚动把空间压到 O(1)
LIS：定义 dp[i] 为以 i 结尾的长度，遍历前面找更小者取 max+1
LIS 优化：维护 tails 最小结尾数组，二分插入
返回对应答案并核对边界

@followups
爬楼梯能不能递归带记忆化？——能，memo[i]=memo[i-1]+memo[i-2]，本质同 DP
LIS 的 tails 数组是 LIS 本身吗？——不是，长度对但内容未必是最优子序列
DP 和分治的区别？——DP 有重叠子问题+最优子结构，分治子问题相互独立

@example
### 1. 爬楼梯（DP + 滚动优化）

```javascript
// 爬楼梯：一次 1 或 2 阶，返回走法数
function climbStairs(n) {
  if (n <= 1) return 1 // 0 阶 1 种（不动），1 阶 1 种
  let prev = 1, curr = 1 // dp[0], dp[1]
  for (let i = 2; i <= n; i++) {
    const next = prev + curr // dp[i] = dp[i-2] + dp[i-1]
    prev = curr
    curr = next
  }
  return curr
}

// 自测：输入 -> 输出
console.log(climbStairs(1)) // 1
console.log(climbStairs(2)) // 2（1+1 / 2）
console.log(climbStairs(3)) // 3（111/12/21）
console.log(climbStairs(5)) // 8
// 时间 O(n)，空间 O(1)
```

### 2. 最长递增子序列 LIS（基础 O(n²) 与优化 O(n log n)）

```javascript
// 基础 DP：dp[i]=以 i 结尾的 LIS 长度，O(n²)
function lengthOfLIS_dp(nums) {
  if (nums.length === 0) return 0
  const dp = new Array(nums.length).fill(1)
  let max = 1
  for (let i = 1; i < nums.length; i++) {
    for (let j = 0; j < i; j++) {
      if (nums[j] < nums[i]) dp[i] = Math.max(dp[i], dp[j] + 1)
    }
    max = Math.max(max, dp[i])
  }
  return max
}

// 优化：tails 存各长度的最小结尾，二分插入，O(n log n)
function lengthOfLIS(nums) {
  const tails = []
  for (const x of nums) {
    let l = 0, r = tails.length
    while (l < r) { // 找第一个 >= x 的位置
      const m = (l + r) >> 1
      if (tails[m] < x) l = m + 1; else r = m
    }
    tails[l] = x // 替换或追加
  }
  return tails.length
}

// 自测
console.log(lengthOfLIS([10, 9, 2, 5, 3, 7, 101, 18])) // 4（2,3,7,101）
console.log(lengthOfLIS_dp([10, 9, 2, 5, 3, 7, 101, 18])) // 4
console.log(lengthOfLIS([])) // 0
// 时间 O(n²) 或 O(n log n)，空间 O(n)
```

## 10 · 前端高频手写：数组扁平化、柯里化、EventEmitter

@id
algo-frontend-handwrite

@level
手写题

@freq
3

@tags
手写 | 扁平化 | EventEmitter

@ask
最后来几个前端必考的手写：实现数组扁平化（可指定深度）；实现函数柯里化；手写一个 EventEmitter（on/off/emit/once）。这些都得能直接用，说说思路和边界。

@oral
**先说数组扁平化（暴力解）**：递归遍历，遇到数组就展开一层——但只能展一层，深层要递归。

**优化**：递归判断每个元素是不是数组，是就继续扁平化并拼接，否则直接 push；用 depth 参数控制递归深度，depth 为 0 直接返回原层（这是 Array.prototype.flat 的语义）。时间 O(n)、空间 O(d)（递归栈，d 为深度）。其实原生 flat 和 flatMap 已经能做，但手写考察递归与类型判断。

**柯里化**：目标是 `curry(fn)(a)(b)(c)` 等价于 `fn(a,b,c)`。思路是返回一个新函数，每次调用收集参数，当收集到的参数个数 >= 原函数 arity 时就执行，否则继续返回收集函数。关键点是用闭包保存已传参数，并用 `fn.length` 拿到期望参数个数。变体支持「一次传多个」更贴近 lodash。

**EventEmitter**：核心是 `events` 哈希表（事件名 → 回调数组）。on 往数组 push；emit 取出数组依次调用并传参；off 按引用或标识过滤掉；once 是「执行一次后自动 off 的 on」。时间上 on/off/emit 均摊 O(1)~O(n)（emit 遍历回调）。

**说边界**：扁平化对类数组、depth 负数按 0 处理；柯里化要处理 `fn.length` 含默认参数不准的情况；EventEmitter 的 off 要能精确移除，emit 时若回调里又 off 自己不能漏调。

@points
扁平化用递归 + depth 控制深度，遇到数组继续展，depth=0 停
柯里化靠闭包累积参数，达 fn.length 个才执行
EventEmitter 核心是 事件名→回调数组 的哈希表
emit 遍历调用并传参，once 执行一次后自动移除
边界：flat depth 负数、curry 的 fn.length、off 精确移除

@steps
扁平化：递归遍历，数组则递归展平，用 depth 限制层数
柯里化：返回收集函数，参数够则执行否则继续收集
EventEmitter.on：把回调压入对应事件数组
EventEmitter.emit：取数组逐个调用并传参
EventEmitter.off/once：过滤移除 / 执行一次后自删

@followups
原生 flat 能替代手写吗？——生产直接用 Array.prototype.flat，手写只为考察递归
柯里化 fn.length 不准怎么办？——可显式传 arity 参数，或支持「参数够了就执行」的变体
EventEmitter 回调里 emit 同一事件会怎样？——会递归触发，需注意避免无限循环

@example
### 1. 数组扁平化（指定深度）

```javascript
// 扁平化：depth 控制深度，0 即不展；递归展开数组元素
function flatten(arr, depth = 1) {
  const res = []
  for (const item of arr) {
    if (Array.isArray(item) && depth > 0) {
      // 还能展：递归并让深度 -1
      res.push(...flatten(item, depth - 1))
    } else {
      res.push(item)
    }
  }
  return res
}

// 自测：输入 -> 输出
console.log(flatten([1, [2, [3, [4]]]], 1)) // [1, 2, [3, [4]]]，只展一层
console.log(flatten([1, [2, [3, [4]]]], 2)) // [1, 2, 3, [4]]
console.log(flatten([1, [2, [3, [4]]]], Infinity)) // [1, 2, 3, 4]
// 时间 O(n)，空间 O(d) 递归栈
```

### 2. 柯里化与 EventEmitter

```javascript
// 柯里化：累积参数，达 fn.length 执行
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) return fn(...args) // 参数够了
    return (...next) => curried(...args, ...next)     // 继续收集
  }
}
const add = (a, b, c) => a + b + c
const cAdd = curry(add)
console.log(cAdd(1)(2)(3))     // 6
console.log(cAdd(1, 2)(3))     // 6（支持一次传多个）

// EventEmitter：事件名 -> 回调数组
class EventEmitter {
  constructor() { this.events = new Map() }
  on(name, fn) {
    if (!this.events.has(name)) this.events.set(name, [])
    this.events.get(name).push(fn)
    return this
  }
  off(name, fn) {
    const list = this.events.get(name)
    if (list) this.events.set(name, list.filter((f) => f !== fn))
    return this
  }
  emit(name, ...args) {
    (this.events.get(name) || []).slice().forEach((fn) => fn(...args))
    return this
  }
  once(name, fn) {
    const wrap = (...args) => { this.off(name, wrap); fn(...args) }
    return this.on(name, wrap)
  }
}

// 自测
const bus = new EventEmitter()
const log = (m) => console.log('收到:', m)
bus.on('hi', log)
bus.emit('hi', 'hello')        // 收到: hello
bus.off('hi', log)
bus.emit('hi', 'world')        // 无输出（已移除）
let count = 0
bus.once('tick', () => console.log('tick!', ++count))
bus.emit('tick')               // tick! 1
bus.emit('tick')               // 无输出（once 已自删）
// 时间 on/off/emit 均摊 O(1)~O(n)
```
