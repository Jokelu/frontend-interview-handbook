---
id: ai
name: 前端 AI 应用
en: AI Application
icon: sparkles
color: #a855f7
order: 13
desc: 大模型接入、流式渲染、RAG 与工具调用，新增的必问方向与差异化加分项。
---

## 01 · 前端怎么接入大模型：SSE 流式输出的完整实现

@id
ai-sse-stream

@level
进阶

@freq
3

@tags
SSE | 流式输出 | ReadableStream

@ask
你们前端是怎么把大模型接进来的？我听说现在都用流式输出，你是用 EventSource 还是自己写的？中间遇到过「半包」或者用户想中途停掉的问题吗？怎么处理的？

@oral
**先说结论**：前端接大模型标准的流式方案是「后端用 SSE（Server-Sent Events）吐增量，前端用 `fetch` + `ReadableStream` 自己解析」，而不是 `EventSource`。原因是 `EventSource` 只支持 GET 且不能带请求体，而对话必须 POST 历史消息，所以得自己实现解析循环。

**再说原理**。SSE 本质是 HTTP 长连接 + `text/event-stream` 约定：每条事件以 `\n\n` 分隔，事件里 `data:` 开头的行就是载荷，服务端吐完会发一行 `data: [DONE]`。难点在于 TCP 分包——网络一次 `read()` 回来的数据可能把一条 `data:` 行从中间切断，所以必须有个字符串缓冲，把不完整的尾部攒到下一帧再拼。

**真实实现细节**。我用 `res.body.getReader()` 拿 `ReadableStream`，循环 `read()` 拿到 `Uint8Array` 用 `TextDecoder('utf-8', { stream: true })` 解码；按 `\n\n` 切块，最后一块不完整就留到 `buffer` 里；遍历每块里的 `data:` 行，跳过非 `data`，遇到 `[DONE]` 直接 `return`，否则 `JSON.parse` 拿 `choices[0].delta.content` 增量 `yield` 出去。

**中断**。我用 `AbortController`，把 `signal` 透传给 `fetch`，用户在 UI 点「停止」就调 `abort()`，流会抛 `AbortError` 被 catch 掉，不会有悬挂连接。

**边界取舍**。API Key 绝不能放前端，必须走自己的后端做反向代理（也顺便做限流和敏感词拦截）；另外增量渲染要配合下一题的打字机节奏，不能收到一点就重渲染一次，否则长文本会卡。延迟上首包时间（TTFT）比总时长更影响体感，我一般会先渲染「思考中」占位。

@points
EventSource 不支持 POST 和请求体，对话类流式必须 fetch + ReadableStream 手写解析
SSE 以 \n\n 分隔事件、data: 开头、[DONE] 收尾，需处理 TCP 分包带来的半行缓冲
TextDecoder 用 stream:true 才能正确处理跨包的 UTF-8 多字节字符
AbortController 透传 signal 是中断生成的标准做法，避免悬挂长连接
API Key 必须放在后端代理，前端只持有自己服务的会话凭证

@steps
确认后端返回 Content-Type: text/event-stream 且开启 streaming，否则降级为普通 JSON
用 fetch POST 带上 messages 与 signal，检查 res.ok 和 res.body 是否存在
getReader 循环 read，解码后按 \n\n 切事件，最后一段不完整的留缓冲
逐行过滤 data: 前缀，[DONE] 退出循环，其余 JSON.parse 取 delta.content 增量回调
UI 收到增量后交给打字机层节流渲染，而不是每来一块就 setState
暴露 stop() 调用 abort()，并统一 catch AbortError 不报错

@followups
为什么不直接用 WebSocket？——WebSocket 也行但 SSE 是单向推送、断线自动重连更省事；只有需要双向（如实时协同）才上 WS。
TextDecoder 的 stream:true 是干嘛的？——告诉解码器「后面还有数据」，避免多字节 UTF-8 字符被分包截断导致乱码。
半包会丢数据吗？——不会，因为把不完整的尾部留在 buffer，下一帧 read 到新数据后拼接再解析。

@example
### 1. 流式解析核心：fetch + ReadableStream 的完整循环

```typescript
// 一个封装好的流式请求函数，逐块 yield 出模型增量文本
export async function* streamChat(
  messages: { role: string; content: string }[],
  signal: AbortSignal, // 外部传入，调用方 abort() 即可中断生成
): AsyncGenerator<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, stream: true }),
    signal, // 把中断信号透传给 fetch
  })
  if (!res.ok || !res.body) throw new Error(`请求失败：${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8') // 不带 stream:true 也能跑，下面手动攒包
  let buffer = '' // 分包缓冲：半个 data: 行先攒在这里

  while (true) {
    const { done, value } = await reader.read()
    if (done) break // 连接正常结束（也有可能 [DONE] 已提前 return）
    buffer += decoder.decode(value, { stream: true })

    // SSE 用 \n\n 分隔事件，先拆出完整事件，最后一段可能不完整留到下次
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''

    for (const event of events) {
      for (const line of event.split('\n')) {
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim() // 去掉 "data:" 前缀
        if (payload === '[DONE]') return // 服务端明确收尾，结束生成
        try {
          const json = JSON.parse(payload)
          // OpenAI 兼容格式：增量内容在 delta.content 上
          yield json.choices?.[0]?.delta?.content ?? ''
        } catch {
          // 单行脏数据跳过，不能让一次解析失败中断整轮对话
        }
      }
    }
  }
}
```

### 2. 在组件里消费：中断与错误兜底

```typescript
import { useState, useRef, useCallback } from 'react'

export function useStreamChat() {
  const [text, setText] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  // 发送一轮对话，内部用上面的 streamChat 逐块追加
  const send = useCallback(async (messages: { role: string; content: string }[]) => {
    abortRef.current?.abort() // 上一轮没结束先打断，避免多流叠加
    const controller = new AbortController()
    abortRef.current = controller
    setText('')

    try {
      for await (const delta of streamChat(messages, controller.signal)) {
        setText((prev) => prev + delta) // 这里只是累加，节流交给打字机层
      }
    } catch (err) {
      // AbortError 是用户主动停止，不是真错误，不要弹 toast
      if ((err as Error).name !== 'AbortError') {
        setText((prev) => prev + '\n[生成出错，请重试]')
      }
    }
  }, [])

  // 用户点「停止」按钮时调用，立刻断开长连接
  const stop = useCallback(() => abortRef.current?.abort(), [])

  return { text, send, stop }
}
```

## 02 · 打字机效果的流式渲染怎么做才不卡

@id
ai-typewriter

@level
进阶

@freq
3

@tags
打字机 | 渲染性能 | 缓冲

@ask
流式回来一堆 token，你是怎么做打字机动画的？直接每收到一个就 setState 会怎样？长文本的时候卡不卡，你是怎么优化的？

@oral
**先说结论**：绝对不能「收到一个 token 就 `setState` 一次」。模型一秒能回几十个增量，如果每个都触发 React 重渲染，长文本会直接卡死。正确做法是把增量先攒进缓冲区，用 `requestAnimationFrame` 把渲染收敛到「每帧最多输出若干个字符」，一帧只 `setState` 一次。

**再说原理**。浏览器的渲染流水线里，JS 执行和绘制是串行的，16ms 一帧。如果一秒内触发上百次 React 更新，每次都要走 reconcile + DOM diff，主线程被挤满，输入框都点不动。RAF 的好处是它天然和屏幕刷新对齐，掉帧时自动跳过，不会无限积压。

**真实实现细节**。我写了一个 `Typewriter` 类：流式回调只负责 `push(chunk)` 把字符塞进 `buffer`，不碰渲染；内部起一个 RAF 循环，每帧从 `buffer` 里取固定步长（比如 6~10 个字符）拼到 `shown`，再调一次 `onFrame(shown)` 去 setState。当 `buffer` 空了就停掉 RAF，省 CPU。这样哪怕后端瞬间灌进来 500 字，屏幕上也是匀速蹦字，主线程始终有空处理用户交互。

**更进一步**。如果内容是 markdown（下一题会讲），不能每帧都重跑 markdown 解析器，否则长文档依旧卡。我的做法是用增量解析或「先纯文本打字、稳定后再整体渲染 markdown」两阶段；或者只对 diff 区间高亮。

**边界取舍**。步长别设太小，太小 RAF 跑不满显得慢；也别太大，太大又变「整段闪现」。我一般按「目标 80~120 字/秒」反推步长。还要注意组件卸载必须 `cancelAnimationFrame`，不然会向已卸载组件 setState 报错。

@points
每个 token 都 setState 会让重渲染次数远超帧率，长文本必卡
核心思路：网络层只负责 push 进缓冲，渲染层用 RAF 收敛到每帧一次
RAF 与刷新率对齐且掉帧自动跳，比 setTimeout 更平滑更省电
markdown 内容不能每帧重解析，需要增量或两阶段渲染
组件卸载必须 cancelAnimationFrame，否则内存泄漏 + 告警

@steps
定义缓冲区 buffer 与已显示 shown，流式回调只 push 不渲染
启动 RAF 循环，每帧从 buffer 取固定步长字符追加到 shown
每帧只调一次 onFrame 触发 setState，把渲染频率压到一帧一次
buffer 空了就停 RAF，避免空转浪费 CPU
暴露 destroy 在卸载时 cancelAnimationFrame，断开引用
对 markdown 内容做两阶段或增量解析，避免每帧重跑高亮

@followups
为什么不用 setTimeout 做节流？——setTimeout 不跟刷新率对齐，后台标签页会被节流到 1s，且累积任务会挤爆主线程，RAF 更稳。
步长设多少合适？——按目标 80~120 字/秒，60fps 下每帧 1~2 字，可按内容长度动态放大。
buffer 会无限增长吗？——不会，每帧都 slice 消费掉，shown 才是真正累积的文本，buffer 只存「待吐」部分。

@example
### 1. 打字机核心类：缓冲 + 每帧定额输出

```typescript
// 把瞬时涌入的 token 攒进缓冲，用 RAF 把渲染收敛到每帧一次
export class Typewriter {
  private buffer = '' // 待输出：网络回调 push 进来的都先放这里
  private shown = '' // 已渲染到屏幕上的完整文本
  private rafId = 0
  private running = false
  private readonly step: number // 每帧最多吐几个字符

  constructor(
    private onFrame: (text: string) => void,
    step = 8, // 默认每帧 8 字，约 480 字/秒，可按需调
  ) {
    this.step = step
  }

  // 流式回调每收到一块就调用：只存不渲染，避免高频 setState
  push(chunk: string) {
    this.buffer += chunk
    this.start()
  }

  private start() {
    if (this.running) return // 已经在跑就不重复起循环
    this.running = true
    const tick = () => {
      if (this.buffer.length === 0) {
        this.running = false // 缓冲空且无新数据，停掉循环省 CPU
        return
      }
      // 每帧只取 step 个字符，模拟稳定打字节奏
      const take = Math.min(this.step, this.buffer.length)
      this.shown += this.buffer.slice(0, take)
      this.buffer = this.buffer.slice(take)
      this.onFrame(this.shown) // 一帧只 setState 一次
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  // 组件卸载时务必调用，否则会向已卸载组件 setState
  destroy() {
    cancelAnimationFrame(this.rafId)
    this.running = false
  }
}
```

### 2. 在 React 里接入打字机

```typescript
import { useEffect, useRef, useState } from 'react'

export function TypewriterView({ fullText }: { fullText: string }) {
  const [view, setView] = useState('')
  const twRef = useRef<Typewriter | null>(null)

  useEffect(() => {
    const tw = new Typewriter(setView, 8)
    twRef.current = tw
    // 模拟流式：把完整文本切成小块逐帧喂给打字机
    let i = 0
    const timer = setInterval(() => {
      if (i >= fullText.length) {
        clearInterval(timer)
        return
      }
      tw.push(fullText.slice(i, i + 12)) // 一次 push 一小段，更接近真实网络分片
      i += 12
    }, 16)
    return () => {
      clearInterval(timer)
      tw.destroy() // 卸载时取消 RAF，避免泄漏与告警
    }
  }, [fullText])

  return <pre>{view}</pre>
}
```

## 03 · RAG 是什么，前端在其中承担什么角色

@id
ai-rag

@level
进阶

@freq
3

@tags
RAG | 向量检索 | 引用溯源

@ask
RAG 你们前端有参与吗？还是纯后端的事？具体你做过哪部分？回答里那种「角标引用」是怎么做到能点过去定位原文的？

@oral
**先说结论**：RAG（检索增强生成）的「检索」和「拼上下文」主要在后端，但前端绝不只是个展示框——切片上传、检索结果的可视化、以及回答里的引用溯源（角标点击跳转原文）都是前端的核心活，而且很吃工程细节。

**再说原理**。RAG 流程是：先把知识库文档切块（chunk），每块算向量存向量库；用户提问时把问题也向量化，做相似度检索召回 Top-K 块，和原问题一起拼进 prompt 交给模型。模型回答时如果引用了某块，我们要让用户能点角标回到那块原文，这就是「引用溯源」。

**前端承担的真实部分**。第一，文档上传与切片预览——大 PDF 上传后我做了分片上传 + 进度，并让用户看到「被切成了 N 段、每段多少字」。第二，检索阶段前端发查询、拿到召回的 chunk 列表（带相似度分数），在侧边栏展示「依据了哪些资料」。第三，也是最关键的可信度部分：后端返回回答时带上 `citations`（每个引用指向某个 chunk 的 id 和字符区间），我在渲染回答时把 `[1]` 角标替换成可点击标签，点击滚动定位到原文片段并高亮，这就是溯源。

**实现细节**。citation 我要求后端返回 `chunkId` + `start/end` 偏移，前端用 `scrollIntoView` 定位，并用 `Range` 把那段原文 mark 高亮。为了防止角标和正文错位，markdown 渲染时角标必须用占位 token 占位，渲染后再做 DOM 注入，不能让模型自由发挥写 `[1]` 否则对不齐。

**边界取舍**。引用块太大体验差，我限制了单段最长 800 字并强制在句号处断开；检索召回数默认 4 条，太多会撑爆上下文还会让模型「东拉西扯」。安全上检索内容也可能含注入攻击，前端展示原文时要走 XSS 防护（见 06 题）。

@points
RAG 后端做检索与拼装，前端负责上传切片、召回展示与引用溯源三块
引用溯源依赖后端返回 chunkId + 字符偏移，前端用锚点 + 高亮定位原文
角标不能让模型自由写，需用占位 token 渲染后再注入 DOM，避免错位
单段切片要限长并在句末断开，召回数控制在 4 左右防止上下文膨胀
检索原文同样要过 XSS 防护，防止知识库投毒导致脚本注入

@steps
文档上传：分片上传 + 进度，后端返回每个 chunk 的 id 与字符区间
发起问答：把问题发给检索接口，拿回 Top-K chunk 列表（含相似度）
渲染侧边栏：展示「依据资料」，让用户知道答案从哪来，建立信任
解析回答里的 citation，把 [n] 角标替换成可点击标签并绑定 chunkId
点击角标：scrollIntoView 定位原文片段，用 Range 高亮对应区间
对召回原文做 XSS 过滤后再展示，避免知识库内容直接注入页面

@followups
为什么角标不能让模型自己写 [1]？——模型写的序号经常对不上真实 chunk，必须用后端结构化 citation 占位注入，才能精确跳转。
前端能不能自己做向量检索？——可以，用 transformers.js 在浏览器跑 embedding 再配本地向量库，但大模型知识库一般太大，仍走后端。
切片大小怎么定？——经验值 300~800 字，按语义在句末切，太小召回噪声多、太大淹没问题。

@example
### 1. 前端文档切片预览（上传阶段）

```typescript
// 把大文本按句号切到目标长度，返回带区间的 chunk 列表
export function chunkText(raw: string, maxLen = 600): {
  id: string
  text: string
  start: number
  end: number
}[] {
  const chunks: { id: string; text: string; start: number; end: number }[] = []
  let cursor = 0
  let buf = ''
  let bufStart = 0

  // 按字符遍历，遇到句号且缓冲区达标就切一刀
  for (let i = 0; i < raw.length; i++) {
    buf += raw[i]
    if (raw[i] === '。' || raw[i] === '\n') {
      if (buf.length >= maxLen) {
        chunks.push({ id: `c${chunks.length}`, text: buf, start: bufStart, end: cursor + 1 })
        buf = ''
        bufStart = cursor + 1
      }
    }
    cursor = i
  }
  if (buf) chunks.push({ id: `c${chunks.length}`, text: buf, start: bufStart, end: raw.length })
  return chunks
}
```

### 2. 引用溯源：角标点击定位并高亮原文

```typescript
import { useRef } from 'react'

// citations: 后端返回的引用，指向某个 chunk 的字符区间
interface Citation { chunkId: string; start: number; end: number }

export function useCitation() {
  const sourceRef = useRef<HTMLDivElement>(null)

  // 点击角标 [n] 时调用：滚动到对应原文并高亮
  const jumpTo = (c: Citation, fullSource: string) => {
    const el = sourceRef.current
    if (!el) return
    const snippet = fullSource.slice(c.start, c.end) // 取出被引用的原文片段
    // 用 TreeWalker 找到文本节点并创建 Range 高亮（比 innerHTML 安全）
    const range = document.createRange()
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let offset = 0
    let node = walker.nextNode()
    while (node) {
      const len = node.textContent?.length ?? 0
      if (offset + len > c.start) {
        range.setStart(node, Math.max(0, c.start - offset))
        range.setEnd(node, Math.min(len, c.end - offset))
        break
      }
      offset += len
      node = walker.nextNode()
    }
    const mark = document.createElement('mark') // 不拼接 HTML，天然防 XSS
    range.surroundContents(mark)
    mark.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return { sourceRef, jumpTo }
}
```

## 04 · Prompt 工程与结构化输出：怎么让模型稳定返回 JSON

@id
ai-structured-output

@level
进阶

@freq
3

@tags
Prompt | JSON Schema | 校验

@ask
你让模型返回 JSON 的时候，它偶尔会多说两句或者格式抖一下，你是怎么保证稳定拿到结构化数据的？纯靠 prompt 说「请返回 JSON」够吗？

@oral
**先说结论**：光在 prompt 里写「请返回 JSON」远远不够，模型经常在你 JSON 前后加一句「好的，这是结果」或者直接 markdown 代码块包起来，解析必崩。工程上我用三道保险：结构化输出参数约束 + 后端/前端的 schema 校验 + 失败重试把错误喂回去。

**再说原理**。现在的模型大多支持 `response_format: { type: 'json_schema', json_schema: {...} }`，服务端会强制约束输出符合给定 JSON Schema，这是第一道也是最稳的保险。但前端调用第三方接口不一定都支持，所以前端自己也要兜底：拿到字符串后用 `zod` 定义 schema 做校验，字段缺失、类型不对就抛错。

**真实实现细节**。我定义一份 zod schema 描述期望结构（比如 `{ intent: enum, items: array }`），调用时优先用 `json_schema` 模式；拿到响应后用 `JSON.parse` 容错——先 `trim`，再尝试剥离 ```json 代码围栏，再解析。解析或校验失败，我不直接重试 N 次，而是把「你上一轮返回的 JSON 不符合要求，错误是 xxx，请修正」连同原始错误回灌给模型再要一次，通常第二次就对了。

**边界取舍**。schema 不要写太死，比如允许额外字段用 `.passthrough()`，否则模型多返回一个字段就校验失败来回拉锯。枚举值比自由字符串稳得多，能用 enum 就用 enum。另外结构化输出会增加一点延迟和 token，但对于「要进数据库的字段」值得；纯聊天场景就别强约束，免得模型被束缚。

**收尾**：我的经验是「参数约束保证 95% 成功，zod 兜底 4%，重试解决最后 1%」，上线后结构化解析失败率从 8% 降到千分之一以下。

@points
纯 prompt 约束不可靠，模型常加废话或包代码块，必须机制兜底
首选 response_format=json_schema 服务端强约束，这是最稳的一道保险
前端用 zod 定义 schema 做二次校验，类型/必填缺失立即暴露
失败重试要把错误原文回灌给模型修正，而不是无脑重试
schema 用 enum 替代自由字符串、用 passthrough 容忍额外字段，减少拉锯

@steps
定义 zod schema 描述期望结构，能用 enum 就别用自由字符串
请求时优先带 response_format=json_schema 让服务端强约束
拿到文本先 trim 并剥离 ```json 围栏，再 JSON.parse
用 schema.safeParse 校验，失败收集错误而非直接抛
把错误信息回灌模型再请求一次，通常二次即修正
对最终数据做字段归一化后提交，避免脏数据进业务库

@followups
json_schema 模式和 prompt 约束有什么区别？——前者是服务端在解码层强制，几乎不会格式错；后者只是软提示，模型可无视。
为什么不用 JSON.parse 直接莽？——模型常返回多余文本或代码围栏，不加清洗 parse 必抛，要先剥离再解析。
重试几次合适？——一般 2 次足够，超过说明 schema 设计或提示有问题，该改的是 prompt 不是次数。

@example
### 1. 用 zod 定义结构并做容错解析

```typescript
import { z } from 'zod'

// 期望模型返回的结构：明确枚举 + 数组，越具体越稳
const ReplySchema = z.object({
  intent: z.enum(['query', 'order', 'complaint']), // 枚举比自由字符串可靠
  items: z.array(z.object({ name: z.string(), qty: z.number() })),
  summary: z.string(),
}).passthrough() // 容忍模型多返回的字段，避免来回拉锯

type Reply = z.infer<typeof ReplySchema>

// 容错解析：先剥离代码围栏和前后废话，再 parse + 校验
export function parseStructured(raw: string): Reply {
  let text = raw.trim()
  // 去掉 ```json ... ``` 围栏（模型喜欢包一层）
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) text = fence[1].trim()
  // 兜底：截取第一个 { 到最后一个 } 之间的内容
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) text = text.slice(start, end + 1)

  const data = JSON.parse(text) // 这里仍可能抛，调用方负责捕获重试
  return ReplySchema.parse(data) // zod 校验，缺字段/类型错会抛 ZodError
}
```

### 2. 失败重试：把错误回灌模型修正

```typescript
// 带 schema 约束的请求，失败时把 ZodError 喂回模型再要一次
export async function askStructured(
  messages: { role: string; content: string }[],
  schema: object, // 后端 json_schema 用
): Promise<Reply> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          response_format: { type: 'json_schema', json_schema: { schema } },
        }),
      })
      const json = await res.json()
      return parseStructured(json.choices[0].message.content)
    } catch (err) {
      if (attempt === 1) throw err // 两次都失败才真正抛出
      // 把错误原文回灌，让模型知道哪错了，而不是无脑重试
      messages.push({
        role: 'user',
        content: `你上一次返回不符合要求，错误：${(err as Error).message}。请严格按 schema 重新返回。`,
      })
    }
  }
  throw new Error('unreachable')
}
```

## 05 · Function Calling 前端怎么落地

@id
ai-function-calling

@level
高级

@freq
3

@tags
FunctionCalling | 工具调用 | 多轮

@ask
Function Calling 你前端是怎么落地的？模型返回要调某个工具，你是怎么执行再把结果喂回去的？多轮循环怎么控制，怎么防止它无限调工具？

@oral
**先说结论**：Function Calling 前端落地的关键是「工具注册表 + 参数校验 + 多轮循环 + 终止条件」。模型不直接执行函数，它只返回「我想调哪个工具、参数是什么」的 JSON，前端负责真正执行并把结果回灌，反复循环直到模型给出最终回答。

**再说原理**。流程是：① 把工具定义（名称、描述、JSON Schema 参数）随消息发给模型；② 模型回 `tool_calls` 而不是普通文本；③ 前端逐个执行，把 `{ role: 'tool', tool_call_id, content }` 追加进消息；④ 再把整段消息发回去，模型要么继续调工具，要么输出最终答案。这个循环要在前端用 `while` 控制。

**真实实现细节**。我维护一个 `tools` 注册表，每个工具是 `{ name, description, parameters, handler }`，`handler` 是真正的前端函数（比如查本地日历、调内部 API、读浏览器存储）。收到 `tool_calls` 后，我用 zod 校验参数——模型给的参数经常类型错或漏字段，校验不过就直接把错误作为 tool 结果回灌，让模型自己改。执行完把结果拼回 messages 继续下一轮。

**防无限循环**。我设了 `maxTurns`（一般 5~8 轮）硬上限，超过就强制结束并提示「已超出工具调用上限」。另外对会改状态的工具（发消息、下单）必须让用户确认，不能模型说调就调。

**边界取舍**。工具描述写得越清楚，模型选对工具的概率越高，这是最划算的优化；参数 schema 该用 enum 就用 enum。前端执行工具还要注意异步——`handler` 返回 Promise，循环里要 `await`。安全上绝不让模型调用任意函数，只能调注册表里白名单的。

@points
模型只返回 tool_calls 描述「想调什么、参数」，真正执行在前端
工具注册表 + zod 校验参数，校验失败把错误回灌让模型自修
多轮循环用 while 控制，每轮把 tool 结果以 role:tool 追加回去
设 maxTurns 硬上限防无限循环，改状态工具需用户确认
工具描述与参数 schema 写清楚是性价比最高的准确率优化

@steps
定义 tools 注册表：name、description、parameters(schema)、handler
首轮把 tools 和用户消息一起发给模型
解析响应：有 tool_calls 就逐个用 zod 校验参数并执行 handler
把每个结果以 role:tool + tool_call_id 追加回 messages
重新发给模型进入下一轮，直到无 tool_calls 或达到 maxTurns
对改状态类工具插入用户确认节点，超轮数则终止并提示

@followups
为什么不直接让模型执行代码？——安全风险，模型可能执行任意危险操作，必须限定白名单工具且前端沙箱内执行。
tool_call_id 有什么用？——用来把工具结果和对应的调用配对，模型靠它知道哪次调用的返回值。
改状态的工具怎么防误触？——在 handler 前弹确认框或二次校验，且这类工具不进自动循环，需用户显式放行。

@example
### 1. 工具注册表与参数校验

```typescript
import { z } from 'zod'

// 单个工具：描述 + 参数 schema + 真正的前端处理函数
interface Tool {
  name: string
  description: string
  parameters: z.ZodTypeAny
  handler: (args: any) => Promise<string> // 返回字符串结果喂回模型
}

// 注册表：模型只能调这里的白名单工具
const tools: Tool[] = [
  {
    name: 'get_weather',
    description: '查询某城市当前天气，参数 city 为城市名',
    parameters: z.object({ city: z.string() }),
    handler: async (args) => {
      const r = await fetch(`/api/weather?city=${encodeURIComponent(args.city)}`)
      const d = await r.json()
      return `天气：${d.text}，温度 ${d.temp}℃` // 结果转成模型能读的字符串
    },
  },
  {
    name: 'create_todo',
    description: '创建一条待办，参数 title 为内容',
    parameters: z.object({ title: z.string().min(1) }),
    handler: async (args) => {
      // 改状态工具：真实项目里这里会先弹确认框
      localStorage.setItem('todo', args.title)
      return `已创建待办：${args.title}`
    },
  },
]
```

### 2. 多轮循环：执行工具并把结果回灌

```typescript
// 跑完整的 function calling 循环，直到模型给出最终文本或超轮数
export async function runWithTools(
  userMsg: string,
  maxTurns = 6,
): Promise<string> {
  const messages: any[] = [{ role: 'user', content: userMsg }]

  for (let turn = 0; turn < maxTurns; turn++) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        // 把注册表转成模型能识别的 OpenAI 风格工具定义
        tools: tools.map((t) => ({
          type: 'function',
          function: { name: t.name, description: t.description, parameters: t.parameters },
        })),
      }),
    })
    const msg = (await res.json()).choices[0].message

    if (!msg.tool_calls) return msg.content // 没有工具调用 = 最终回答，结束

    messages.push(msg) // 把模型的 tool_calls 也存进历史
    for (const call of msg.tool_calls) {
      const tool = tools.find((t) => t.name === call.function.name)
      if (!tool) continue
      let result: string
      try {
        const args = tool.parameters.parse(JSON.parse(call.function.arguments))
        result = await tool.handler(args) // 真正执行前端函数
      } catch (err) {
        result = `参数错误：${(err as Error).message}` // 校验失败回灌让模型自修
      }
      // 关键：以 role:tool 把结果和调用配对后追加
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: result,
      })
    }
    // 循环继续，把工具结果发回去让模型决定下一步
  }
  return '[已超出工具调用上限]' // 硬上限兜底，防止无限循环
}
```

## 06 · AI 回答里的 markdown 与代码高亮怎么安全渲染

@id
ai-markdown-render

@level
进阶

@freq
2

@tags
markdown | 高亮 | XSS

@ask
模型吐回来一大段 markdown，你是怎么渲染的？直接 innerHTML 塞进去不怕 XSS 吗？流式过程中一边出字一边渲染，你怎么保证既流畅又不被注入？

@oral
**先说结论**：绝不能直接 `dangerouslySetInnerHTML` 把模型输出塞进 DOM——模型输出不可信，里面可能夹 `<img onerror>` 或 `<script>` 之类的注入，尤其是 RAG 场景原文来自用户上传文档。正确链路是「markdown 解析 → 代码高亮 → 统一 sanitize → 再注入」，并且流式用增量渲染。

**再说原理**。markdown 渲染本身会把 ```` ``` ```` 代码块转成 `<pre><code>`，普通文本转段落。但如果直接用把原始 markdown 当 HTML 拼，或用的库默认不过滤，就会执行注入脚本。所以必须在最后一步用 sanitizer（如 DOMPurify）白名单过滤，只允许 `p、code、pre、a、strong` 等安全标签，禁掉 `onerror、javascript:` 这类危险属性。

**真实实现细节**。我选 `markdown-it` + `highlight.js`：先 `md.render(text)` 得到 HTML，配置 `highlight` 回调在渲染期就给代码块加高亮 class；然后过一道 `DOMPurify.sanitize(html, { ADD_ATTR: ['target'] })`，只允许安全标签和属性，顺便把外链 `a` 加 `rel="noopener"`。最后才 `dangerouslySetInnerHTML`。

**流式优化**。逐字渲染如果每帧都跑完整 markdown 解析，长文会卡（见 02 题）。我的折中：流式阶段先以纯文本打字机展示，等本轮 `[DONE]` 结束再一次性 markdown 渲染 + 高亮；如果一定要边出边渲染，就用「只重新解析变化尾部、复用已渲染头部的虚拟节点」或者限制最大重渲染频率。

**边界取舍**。sanitize 一定要在「高亮之后、注入之前」，顺序反了高亮加的 class 可能被误删或注入乘虚而入。代码高亮库要按需加载语言包，别全量引，否则包体暴涨。另外用户若需要复制代码，要给 `<pre>` 加复制按钮。

@points
模型/RAG 输出不可信，绝不能直接 dangerouslySetInnerHTML
标准链路：markdown 解析 → highlight 高亮 → DOMPurify 白名单 sanitize → 注入
sanitize 必须在高亮之后、注入之前，顺序错会留漏洞
流式渲染用「打字机纯文本 + 结束后再整体渲染」避免每帧重解析卡顿
高亮库按需引语言包，外链加 rel=noopener 防钓鱼

@steps
选 markdown-it + highlight.js，配置 highlight 回调在渲染期加高亮
md.render 得到原始 HTML，注意禁用 raw HTML 透传
用 DOMPurify.sanitize 白名单过滤，禁 on* 事件与 javascript: 协议
给外链 a 统一加 target=_blank rel=noopener
流式阶段先纯文本打字，DONE 后再整体渲染 markdown
为代码块附加复制按钮，提升可用性

@followups
DOMPurify 会不会误删高亮的 class？——不会，class 在白名单里；但要确保 sanitize 在加完高亮之后跑。
流式能不能每帧都渲染 markdown？——能但慢，长文建议结束后再整体渲染，或节流到每 200ms 一次。
markdown-it 的 html:true 能开吗？——不能，开了会直接透传原始 HTML，等于敞开门让注入进来。

@example
### 1. 安全渲染管线：解析 → 高亮 → sanitize

```typescript
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import DOMPurify from 'dompurify'

// 初始化：关闭 raw HTML 透传，配置代码高亮回调
const md = new MarkdownIt({
  html: false, // 关键：不把原文里的 HTML 当标签解析，防注入第一关
  linkify: true,
  highlight(code, lang) {
    // 渲染期就给代码块加 hljs 高亮 class，比事后处理更稳
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value
    }
    return hljs.highlightAuto(code).value
  },
})

// 把模型 markdown 安全地变成可注入的 HTML 字符串
export function renderMarkdownSafe(src: string): string {
  const rawHtml = md.render(src) // 第一步：markdown -> HTML（已禁止裸 HTML）
  // 第二步：白名单 sanitize，只留安全标签，砍掉 on* 和危险协议
  return DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['target'], // 允许外链新开页，但要配合下面补 rel
    FORBID_ATTR: ['onerror', 'onload'],
  })
}
```

### 2. React 中注入并给外链补安全属性

```typescript
import { useEffect, useRef } from 'react'

export function SafeMarkdown({ source }: { source: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const html = renderMarkdownSafe(source)
    const el = ref.current
    if (!el) return
    el.innerHTML = html // 此时 html 已 sanitize，可安全注入

    // 给所有外链补 rel=noopener，防 target=_blank 钓鱼
    el.querySelectorAll('a[target="_blank"]').forEach((a) => {
      a.setAttribute('rel', 'noopener noreferrer')
    })
    // 给代码块挂复制按钮
    el.querySelectorAll('pre').forEach((pre) => {
      const btn = document.createElement('button')
      btn.textContent = '复制'
      btn.onclick = () => navigator.clipboard.writeText(pre.textContent ?? '')
      pre.appendChild(btn) // 用 DOM API 而非拼接 HTML，避免二次注入
    })
  }, [source])

  return <div ref={ref} className="markdown-body" />
}
```

## 07 · AI 应用的体验优化：中断生成、虚拟列表与上下文裁剪

@id
ai-ux-optimize

@level
进阶

@freq
3

@tags
体验优化 | 中断 | 上下文

@ask
你的 AI 对话界面体验上做了哪些优化？聊天记录很长的时候列表卡不卡？上下文一直往上堆，token 爆炸或者模型忘事你怎么处理的？

@oral
**先说结论**：AI 聊天界面的体验优化集中在三点——「能随时中断」、「长列表不卡」、「上下文别无限膨胀」。这三件都和工程细节强相关，也是区分「套壳 demo」和「真做过产品」的地方。

**中断**。第一题讲过用 `AbortController.abort()` 断流，这里补充 UI：中断后要保留已生成的部分，并把那条消息标记为「已停止」，让用户能继续基于半截答案追问，而不是清空。同时要锁住输入框防重复发送。

**虚拟列表**。聊天记录上百条、每条又带 markdown 和代码块时，全量渲染 DOM 会爆。我用虚拟列表（`@tanstack/virtual` 或自写）只渲染可视区 + 缓冲区的几条消息，配合动态测量行高（消息长度不一）。关键坑：流式那条消息高度在变，要标记「正在生成」跳过它的虚拟化测量或用预估高度，否则会抖动。

**上下文裁剪**。这是最容易被忽视的。把完整历史无脑发给模型，token 既贵又会让模型「中间迷失」（lost in the middle）。我的策略是分三层：① 截断——超过模型窗口（如 32k）直接丢最旧的；② 摘要——把早期对话用一次模型调用压缩成摘要占位；③ 滑动窗口——只保留最近 N 轮 + 系统提示。前端负责维护这套消息栈，并在发送前估算 token（中文约 1 字≈1.5 token，用英文 BPE 近似也行），超了就触发裁剪并提示用户。

**边界取舍**。虚拟列表对「正在流式」的那条要特殊处理，否则跳动影响阅读；裁剪不能太激进，把用户刚说的关键约束删了模型就会跑偏，所以我保留最近 6 轮不做摘要。成本上，摘要本身也要消耗一次调用，只在历史真正很长时才启用。

@points
中断用 AbortController，中断后保留半截答案供继续追问，并锁输入防重发
长聊天记录必须用虚拟列表，只渲染可视区，动态测量行高
流式消息高度在变，要标记「生成中」避免虚拟化抖动
上下文三层裁剪：硬截断 + 早期摘要 + 滑动窗口保留最近轮
前端估算 token 超窗即裁剪，但最近若干轮不摘要以防丢失关键约束

@steps
中断：abort() 断流，保留已生成文本并标记「已停止」，锁输入框
长列表接入虚拟列表，只渲染可视区 + 缓冲区，动态测量行高
对正在生成的消息标记跳过虚拟化测量，用预估高度防抖动
维护消息栈，发送前估算 token，超窗触发裁剪
裁剪策略：先丢最旧、再对早期做摘要、始终保留最近 N 轮
超窗时提示用户「历史已压缩」，保证可预期

@followups
虚拟列表为什么对流式消息要特殊处理？——流式高度实时变化，虚拟化按固定测量会反复重排抖动，需预估高度或排除该项。
token 估算准吗？——不准但够用，中文按 1 字≈1.5 token 近似，精确交给后端计数。
摘要会丢失信息吗？——会，所以只摘要最早期且保留最近轮，关键约束放在系统提示里永不被裁。

@example
### 1. 前端 token 估算与上下文裁剪

```typescript
// 粗估 token 数：英文约 4 字符/token，中文约 1.5 字符/token
export function estimateTokens(text: string): number {
  const cjk = (text.match(/[一-鿿]/g) || []).length // 中文字符数
  const others = text.length - cjk // 非中文按字符算
  return Math.ceil(cjk * 1.5 + others / 4)
}

// 按窗口裁剪历史：保最近 keepRecent 轮，更早的做占位摘要标记
export function trimContext(
  messages: { role: string; content: string }[],
  maxTokens: number,
  keepRecent = 6,
): { messages: typeof messages; trimmed: boolean } {
  let total = messages.reduce((s, m) => s + estimateTokens(m.content), 0)
  if (total <= maxTokens) return { messages, trimmed: false }

  // 从最旧开始丢弃，但保留最近 keepRecent 轮不裁
  const result = [...messages]
  const dropFrom = 0
  const keepFrom = Math.max(0, result.length - keepRecent)
  while (total > maxTokens && result.length > keepFrom + 1) {
    const removed = result.splice(dropFrom, 1)[0] // 从头部丢最旧
    total -= estimateTokens(removed.content)
  }
  return { messages: result, trimmed: true }
}
```

### 2. 虚拟列表：只渲染可视区消息

```typescript
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'

// 聊天列表虚拟化：上万条消息也只渲染可视区，避免 DOM 爆炸
export function ChatList({ messages }: { messages: { id: string; text: string }[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // 预估行高，流式消息会动态测量修正
    overscan: 6, // 上下各多渲染 6 条做缓冲，滚动更顺
  })

  return (
    <div ref={parentRef} style={{ height: 600, overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((item) => (
          <div
            key={messages[item.index].id}
            style={{
              position: 'absolute',
              top: item.start,
              width: '100%',
            }}
          >
            {/* 真实项目里这里接 06 题的 SafeMarkdown */}
            {messages[item.index].text}
          </div>
        ))}
      </div>
    </div>
  )
}
```

## 08 · 端侧推理与 WebGPU：浏览器里直接跑模型可行吗

@id
ai-webgpu

@level
高级

@freq
2

@tags
WebGPU | WebLLM | 端侧推理

@ask
端侧推理你了解吗？WebGPU 现在能在浏览器里直接跑大模型了，你试过吗？它和调云端 API 比有什么优劣，什么场景值得上？

@oral
**先说结论**：浏览器里直接跑大模型已经可行，靠的是 WebGPU（取代老旧的 WebGL 做通用计算）+ WebLLM 这类运行时把 LLM 量化后搬到 GPU 显存里推理。它不是要取代云端，而是补齐「数据不出端、零延迟、零调用成本」的场景，但有明显天花板和坑。

**再说原理**。WebGPU 是浏览器新的图形/计算 API，能直接调用设备 GPU 做并行计算，比 WebGL 更适合矩阵运算。WebLLM 把 Llama、Phi 等模型量化成 3~4 bit 权重，WASM/WebGPU 混合调度，在本地 GPU 上跑 transformer 推理。首屏需要从 CDN 下载模型权重（几百 MB 到几 GB），之后推理全在本地。

**真实实现细节**。我用 `@mlc-ai/web-llm` 的 `CreateMLCEngine` 加载指定模型，传 `initProgressCallback` 把下载进度展示出来——这一步体验很关键，几十秒的静默下载用户会以为卡了。引擎就绪后 `engine.chat.completions.create({ messages, stream: true })` 接口和 OpenAI 几乎一致，所以上层流式渲染代码（01/02 题）可以完全复用。

**优劣对比**。优势：数据不出浏览器（隐私/合规强需求）、无每 token 成本、无网络往返延迟、可离线。劣势：首次下载大、占用显存（手机端很吃力）、模型能力远弱于云端大模型、不同设备 GPU 兼容性参差（要特性探测 + 降级到 WASM 或提示不支持）。

**边界取舍**。我只在三类场景推端侧：公司内部敏感文档问答（数据不出网）、离线工具、以及云端限流时的兜底。普通 C 端对话还是云端稳。另外必须做能力探测：用 `navigator.gpu` 判断 WebGPU 支持，不支持就自动切回云端 API，并给用户选项。

@points
WebGPU 提供浏览器 GPU 计算能力，WebLLM 把量化 LLM 搬到本地推理
接口与 OpenAI 兼容，上层流式渲染代码可直接复用
首屏需下载权重（数百 MB+），必须用进度回调避免用户以为卡死
优势是隐私/零成本/离线，劣势是下载大、占显存、能力弱于云端
必须特性探测 navigator.gpu，不支持则降级云端并给用户选择权

@steps
用 navigator.gpu 探测 WebGPU 支持，不支持则走云端降级
通过 WebLLM 的 CreateMLCEngine 加载量化模型，挂进度回调
引擎就绪后用兼容 OpenAI 的接口发消息并开启 stream
流式消费增量，复用打字机/渲染层（与云端一致）
推理结束释放引擎，避免长期占用 GPU 显存
提供「端侧/云端」切换开关，让用户按场景选择

@followups
端侧模型多大、效果如何？——常见 3~4bit 量化的 1B~3B 小模型，几百 MB 到 2GB，效果远不如云端大模型但够简单任务。
手机能跑吗？——显存是瓶颈，高端手机勉强小模型，低端机直接降级云端。
和云端怎么共存？——前端做路由：敏感/离线走端侧，复杂任务走云端，按能力和成本动态切换。

@example
### 1. WebGPU 能力探测与引擎加载

```typescript
import { CreateMLCEngine, MLCEngine } from '@mlc-ai/web-llm'

// 先探测 WebGPU 是否可用，不可用就告诉上层走云端
export function hasWebGPU(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}

// 初始化端侧引擎，进度回调用于展示权重下载百分比
export async function loadLocalModel(
  onProgress: (pct: number) => void,
): Promise<MLCEngine | null> {
  if (!hasWebGPU()) return null // 不支持直接返回 null，上层降级

  const engine = await CreateMLCEngine(
    'Llama-3.2-3B-Instruct-q4f32', // 量化后的 3B 模型，约 2GB 权重
    {
      initProgressCallback: (report) => {
        // report.progress 是 0~1，用来驱动下载进度条
        onProgress(Math.round(report.progress * 100))
      },
    },
  )
  return engine
}
```

### 2. 兼容 OpenAI 的流式调用（与云端同一套上层代码）

```typescript
// 端侧推理接口和 OpenAI 几乎一致，上层流式逻辑可完全复用
export async function localChat(
  engine: MLCEngine,
  messages: { role: string; content: string }[],
  onDelta: (text: string) => void,
): Promise<void> {
  const completion = await engine.chat.completions.create({
    messages,
    stream: true, // 同样支持流式，复用 01/02 题的渲染层
    temperature: 0.7,
  })

  for await (const chunk of completion) {
    const delta = chunk.choices[0]?.delta?.content ?? ''
    if (delta) onDelta(delta) // 和云端 streamChat 的 yield 完全同构
  }
}

// 顶层路由：优先端侧，失败或能力不够时降级云端
export async function chat(message: string, local: MLCEngine | null) {
  if (local) {
    try {
      return await streamViaLocal(local, message) // 隐私/离线场景
    } catch {
      // 端侧异常（显存不足等）自动回云端，用户体验不中断
    }
  }
  return await streamViaCloud(message) // 复杂任务走云端大模型
}
```
