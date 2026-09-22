---
id: mobile
name: 移动端与跨端
en: Mobile & Cross-platform
icon: smartphone
color: #db2777
order: 15
part: 2
desc: 移动端适配、交互细节与跨端方案选型，H5 与混合开发岗位的必考项。
---

## 07 · H5 与原生怎么通信：JSBridge 的原理与实现

@id
mobile-jsbridge

@level
高级

@freq
3

@tags
JSBridge | 原生通信 | 混合开发

@ask
你们 H5 和原生到底怎么通信？iOS 和安卓是一套实现吗？JSBridge 你自己封装过没有——调过去的回调怎么对上号？要是原生那边一直不回你怎么办？还有，JS 调原生和原生调 JS 有什么区别？

@oral
**先说结论**：JSBridge 是我们在 WebView 里加的一层「RPC 协议」——H5 要用原生能力就发一次调用，原生处理完按同一个编号把结果回传。两端底层实现完全不同，但**必须共用同一份协议**，否则就是各写各的，后面没人敢改。

**两端机制不一样**。安卓主流是 `addJavascriptInterface` 往 `window` 注入一个对象，JS 直接调它的方法；再早还有用 `prompt` 拦截的方案，靠原生重写 `onJsPrompt` 取参数，好处是不用注入对象、极老的容器也能跑，代价是会阻塞 JS 线程、URL 长度有限、还容易和业务自己的弹窗打架。iOS 现在是 `WKScriptMessageHandler`，JS 侧 `webkit.messageHandlers.xxx.postMessage(...)`，原生在 `didReceive` 里接；更老的 UIWebView 才用 iframe 拼自定义 scheme 拦截，那套现在基本淘汰了。**能力检测要写全**，同一个包可能既跑在 WKWebView 里、也跑在普通浏览器里，注入对象不存在时必须能优雅失败，而不是抛一个没人看得懂的错。

**回调对上号靠的是 callbackId**，这是整个桥最核心的设计。每次调用生成一个唯一 id，JS 侧用一个 Map 存 id 到 resolve 的映射，原生处理完把同一个 id 带回来。**没有 id 一定会串号**——比如同时发起「选相册」和「扫一扫」，两个回调先后回来，你根本分不清谁是谁。

**异常路径得自己兜**。原生可能权限被拒、可能崩了、可能那个 handler 压根没注册，这些情况前端会永久 pending，用户看到的就是「点了没反应」。所以每个调用都要带超时，超时就 reject 并把 Map 里这条清掉——不清就是泄漏，Map 只增不减，跑久了越来越慢。原生侧同样要处理未注册的 handler，回一个错误码，不能默默丢掉。

**真实场景**：我们是电商 App，H5 用到桥的地方主要是扫一扫、选相册上传凭证、定位、跳原生页面带参数回来。踩过最典型的坑是**传图片用 base64**，一张 3MB 的图序列化成字符串过桥，低端安卓上直接卡死两秒；后来改成原生上传完只回一个文件路径，问题立刻没了。

**最后说两个边界**。一是线程模型：安卓的 `@JavascriptInterface` 方法跑在 JavaBridge 线程，iOS 的 `evaluateJavaScript` 必须在主线程，跨线程碰 UI 一定崩，所以我在原生侧统一 post 回主线程再处理。二是安全：桥等于给 H5 开了一扇门，handler 必须白名单 + 校验来源域名，敏感操作（支付、取用户信息）让原生再验一次登录态，别让「页面能调到什么」完全由前端说了算。

**收尾**：我的做法是协议一份、实现分平台、全部 Promise 化、全部带超时，业务调用方完全不需要知道自己跑在哪个系统上。

@points
JSBridge 的本质是一套 JSON 协议加 callbackId 映射，两端底层机制不同但协议必须统一
安卓用 @JavascriptInterface 注入对象，iOS 用 WKScriptMessageHandler，都比 prompt / iframe 拦截可靠
每次调用生成唯一 callbackId，JS 侧用 Map 保存 resolve 与定时器，原生按 id 回传结果
超时与异常必须兜住：未回调、handler 未注册、容器未注入都要 reject，并清理 Map 防泄漏
大对象不要过桥序列化，改成传文件路径；线程模型与 handler 白名单是上线前必须确认的边界

@steps
先只讲协议不讲实现：一次调用长什么样，handler、params、callbackId 各是什么
讲两端机制差异，说明为什么现在用注入对象和 messageHandler，prompt 方案的问题在哪
讲回调对号：callbackId + Map + Promise 化，顺带说清没有 id 会串号
讲异常路径：超时、handler 未注册、容器不支持，逐一给出处理方式
讲工程边界：序列化成本、线程模型、传文件不走 base64
收尾讲安全：白名单、来源校验、敏感操作让原生复核

@followups
prompt 拦截和注入对象怎么选？——prompt 不用注入对象、兼容极老容器，但会阻塞 JS 线程、URL 长度受限还容易和业务弹窗冲突，新项目直接用注入对象或 messageHandler
安卓上 @JavascriptInterface 为什么必须加注解？——不加注解 JS 根本看不到这个方法，而且是静默失效；4.2 之前就是因为这个出过远程代码执行漏洞
原生调 JS 要注意什么？——必须在主线程 evaluateJavaScript，并且页面可能已经销毁，回调里要先判断 webView 是否还活着
怎么防止普通网页乱调原生能力？——handler 白名单加来源域名校验，支付、取用户信息这类敏感操作让原生再验一次登录态

@example
### 1. JS 侧：一个把回调、超时、平台差异都收进去的封装

```javascript
// 对外只暴露 call()，业务方不需要知道自己跑在 iOS 还是安卓上
class JSBridge {
  constructor() {
    // callbackId -> { resolve, reject, timer }，是回调「对号入座」的唯一依据
    this.pending = new Map()
    this.seq = 0
    this.isAndroid = /android/i.test(navigator.userAgent)
  }

  // 唯一 id：时间戳 + 自增序号，避免同一毫秒内并发调用撞号
  genCallbackId() {
    return `cb_${Date.now()}_${(this.seq += 1)}`
  }

  call(handler, params = {}, { timeout = 5000 } = {}) {
    return new Promise((resolve, reject) => {
      const callbackId = this.genCallbackId()

      // 超时兜底：原生权限被拒 / 崩溃 / handler 未注册时都不会回调，
      // 不兜住 Promise 就永远 pending，用户感知就是「点了没反应」
      const timer = setTimeout(() => {
        this.pending.delete(callbackId) // 必须清理，Map 只增不减就是内存泄漏
        reject(new Error(`[JSBridge] ${handler} 响应超时`))
      }, timeout)

      this.pending.set(callbackId, { resolve, reject, timer })

      // 协议统一：handler 表示要调什么，params 是参数，callbackId 是回执编号
      const payload = JSON.stringify({ handler, params, callbackId })

      try {
        if (this.isAndroid) {
          // 安卓：原生用 addJavascriptInterface 注入的对象，同步调用即可
          window.NativeBridge.postMessage(payload)
        } else {
          // iOS：WKWebView 的 messageHandler 只接受对象，不能直接传字符串
          window.webkit.messageHandlers.nativeBridge.postMessage(JSON.parse(payload))
        }
      } catch (err) {
        // 容器没注入成功（比如在普通浏览器里打开了页面），立刻失败而不是干等超时
        clearTimeout(timer)
        this.pending.delete(callbackId)
        reject(new Error(`[JSBridge] 当前容器不支持 ${handler}`))
      }
    })
  }

  // 原生回传结果的统一入口，由原生侧 evaluateJavascript 调到这里
  handleResponse(response) {
    const res = typeof response === 'string' ? JSON.parse(response) : response
    const task = this.pending.get(res.callbackId)
    if (!task) return // 已经超时清理过，直接丢弃，避免重复 resolve

    clearTimeout(task.timer)
    this.pending.delete(res.callbackId)

    if (res.code === 0) task.resolve(res.data)
    else task.reject(new Error(res.message || 'native error'))
  }
}

// 挂到全局，原生侧通过 window.JSBridge.handleResponse 把结果送回来
window.JSBridge = new JSBridge()

// 业务侧调用：换平台不用改任何一行代码
window.JSBridge.call('openCamera', { maxCount: 3 }).then((data) => upload(data.files))
```

### 2. 协议约定：请求与响应长什么样

```json
// 请求：H5 -> 原生
{
  "handler": "openCamera",          // 要调用的能力名，原生侧白名单里必须有它
  "params": { "maxCount": 3 },      // 参数，必须可 JSON 序列化
  "callbackId": "cb_1760000000000_1" // 回执编号，原生必须原样带回
}
```

```json
// 响应：原生 -> H5，由原生拼好后调 window.JSBridge.handleResponse
{
  "callbackId": "cb_1760000000000_1", // 与原请求一一对应，前端靠它找回 Promise
  "code": 0,                          // 0 成功，非 0 失败
  "data": { "files": ["file:///.../IMG_0001.jpg"] }, // 只回路径，不回 base64
  "message": ""                       // 失败时的原因，前端直接透出或转成提示文案
}
```

### 3. 安卓侧实现：注入对象 + 回传

```java
public class NativeBridge {
    private final WebView webView;

    public NativeBridge(WebView webView) {
        this.webView = webView;
    }

    // 方法必须加注解，否则 JS 静默调不到
    @JavascriptInterface
    public void postMessage(String payloadJson) {
        // 这里跑在 WebView 的 JavaBridge 线程，不是主线程，
        // 涉及 UI 或 WebView 的操作一律 post 回主线程
        new Handler(Looper.getMainLooper()).post(() -> dispatch(payloadJson));
    }

    private void dispatch(String payloadJson) {
        try {
            JSONObject req = new JSONObject(payloadJson);
            String handler = req.optString("handler");
            String callbackId = req.optString("callbackId");

            if ("openCamera".equals(handler)) {
                openCamera(callbackId);
            } else {
                // 未注册的 handler 也要回错误码，否则前端只能干等到超时
                callback(callbackId, 1, null, "handler not found: " + handler);
            }
        } catch (JSONException e) {
            // 协议都解析不出来，说明拿不到 callbackId，只能记日志排查
            Log.e("JSBridge", "非法协议: " + payloadJson);
        }
    }

    // 统一回传：拼成 response 协议，用 evaluateJavascript 调前端的方法
    private void callback(String callbackId, int code, JSONObject data, String message) {
        JSONObject res = new JSONObject();
        res.put("callbackId", callbackId);
        res.put("code", code);
        res.put("data", data == null ? JSONObject.NULL : data);
        res.put("message", message == null ? "" : message);
        // evaluateJavascript 比 loadUrl("javascript:") 更安全，也不会丢失返回值
        webView.evaluateJavascript("window.JSBridge.handleResponse(" + res + ")", null);
    }
}

// 注册必须发生在 loadUrl 之前，否则首屏调用的桥是空的
webView.addJavascriptInterface(new NativeBridge(webView), "NativeBridge");
```

### 4. iOS 侧实现：messageHandler + 回传

```swift
class BridgeHandler: NSObject, WKScriptMessageHandler {
    weak var webView: WKWebView?

    func userContentController(_ controller: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        // JS 侧传的是对象，这里天然就是字典，不需要再解析字符串
        guard let body = message.body as? [String: Any],
              let handler = body["handler"] as? String,
              let callbackId = body["callbackId"] as? String else { return }

        if handler == "openCamera" {
            openCamera { files in
                // 相机回调通常在子线程，必须切回主线程再碰 WebView
                DispatchQueue.main.async {
                    self.callback(callbackId: callbackId, code: 0,
                                  data: ["files": files], message: "")
                }
            }
        } else {
            callback(callbackId: callbackId, code: 1, data: nil,
                     message: "handler not found: \(handler)")
        }
    }

    private func callback(callbackId: String, code: Int,
                          data: [String: Any]?, message: String) {
        let res: [String: Any] = [
            "callbackId": callbackId,
            "code": code,
            "data": data ?? [:],
            "message": message,
        ]
        guard let jsonData = try? JSONSerialization.data(withJSONObject: res),
              let json = String(data: jsonData, encoding: .utf8) else { return }
        webView?.evaluateJavaScript("window.JSBridge.handleResponse(\(json))")
    }
}

// name 必须和前端 webkit.messageHandlers.nativeBridge 里的名字完全一致
let handler = BridgeHandler()
config.userContentController.add(handler, name: "nativeBridge")
```

## 08 · Hybrid 离线包与资源预加载怎么做

@id
mobile-offline-package

@level
场景题

@freq
2

@tags
离线包 | 预加载 | 版本管理

@ask
你们那个 H5 首屏后来优化到什么程度了？我听说离线包能把首屏压到几百毫秒，具体是怎么做的——包怎么下发、怎么校验、版本错了怎么退回上一版？别只讲概念，说说你们实际踩过什么坑。

@oral
**先说结论**：离线包本质是「把静态资源提前放到本地，让 WebView 用本地文件替换网络请求」，省掉的是 DNS、TLS 握手、请求往返和下载这几段时间。我们那个活动页在 4G 弱网下从 1.4 秒左右降到 400 毫秒上下，首屏白屏时间几乎只剩渲染。

**包里放什么，怎么组织**。里面是 HTML、CSS、JS、字体和首屏小图，配一个 manifest 描述包版本、文件列表与 md5、以及一个「兜底线上地址」。**图片我基本不打进包**，走 CDN，因为图片体积大、更新又频繁，打进包只会让下载和校验都变慢，包里只留首屏那几张关键小图。

**下发流程是四步**。App 启动后先拉一份配置（当前生效版本、包地址、灰度条件）→ 和本地版本号比对，不一致就下载，能用差分包就用差分 → 下载到临时目录，校验 md5 → 解压到 `version_108` 这样的独立目录，**最后才切换 current 指针**。这个顺序很关键，它保证用户中途杀进程、断网、空间不足时，旧版本依然完整可用，不会出现「包下了一半，页面打不开」。

**加载靠原生拦截资源请求**。命中本地文件就本地返回，没命中就回落到线上地址兜底。这里有个 iOS 的硬坑：**WKWebView 的网络栈跑在独立进程里，`NSURLProtocol` 拦不到 http 请求**，所以必须换自定义 scheme（比如 `app://`），用 `WKURLSchemeHandler` 接管。代价是页面里所有相对路径、fetch 请求都要跟着改成这个 scheme，我第一次改完就漏了接口域名的判断，导致本地包也去请求了自定义 scheme，直接失败。

**版本回滚是这块能不能上线的分水岭**。我们本地保留最近三个版本，线上配置一个基线版本；客户端启动后做白屏检测（根节点长时间没有内容）和 JS 错误上报，连续失败达到阈值就自动退回上一版，并把出问题的版本号上报，服务端按版本维度聚合，超过阈值直接把它从灰度里摘掉。**没有回滚能力的离线包就是定时炸弹**，因为一次错误的下发等于让全量用户白屏。

**最后说清边界**。第一，离线包和接口是两回事，动态数据照样要走网络，别指望首屏零请求；第二，**老包配新接口的兼容性要专门管**，接口必须向后兼容，实在不行就靠强更兜底；第三，收益和成本都集中在版本管理上——包下载得再快，不能灰度、不能回滚，我也不会上。

@points
离线包是用本地文件替换网络请求，省掉 DNS、TLS、往返和下载，弱网下首屏收益最明显
包结构是静态资源加 manifest（版本号、文件 md5、兜底线上地址），体积大的图片留在 CDN
更新流程：拉配置 → 差分下载 → md5 校验 → 解压到新版本目录 → 原子切换指针
加载依赖 WebView 拦截，安卓用 shouldInterceptRequest，iOS 必须用 WKURLSchemeHandler 配自定义 scheme
回滚是上线前提：本地保留多个版本，白屏或报错达阈值自动退回并上报，让服务端摘掉问题版本

@steps
先量化收益，说清离线包省的是哪几段耗时，而不是笼统讲「变快了」
讲包结构与 manifest 字段，解释为什么图片不进包
讲更新流程，重点在「先解压再切指针」这个原子性设计
讲加载：两种原生拦截方式，重点说明 iOS 为什么必须走自定义 scheme
讲回滚与灰度：保留历史版本、白屏与报错上报、服务端摘除
收尾讲边界：动态数据仍走接口，接口兼容性要和包版本一起管理

@followups
增量更新怎么做？——文件级 diff 只下发变化的文件，或二进制 bsdiff 生成 patch；文件级更简单也更稳，因为打包后文件名带 hash，改一个文件只影响很少几个产物
WKWebView 上为什么 NSURLProtocol 拦不到 http 请求？——网络栈在独立进程里，NSURLProtocol 不生效，只能用自定义 scheme 加 WKURLSchemeHandler，私有 API 有审核风险不要碰
用户更新过程中杀掉 App 会怎么样？——新版解压到独立目录、最后才切指针，旧版本始终完整，重启后重新走一遍更新流程就行
怎么判断某个离线包「坏了」？——客户端上报启动后的白屏检测和 JS 错误，服务端按版本聚合，超阈值就把该版本从配置里摘掉

@example
### 1. 离线包包结构与 manifest

```bash
# 打包产物：一个 zip，解压后是下面这个结构
h5-pkg-108.zip
├── manifest.json          # 包的身份证：版本、文件清单、校验值、兜底地址
├── index.html             # 入口页面
├── assets/
│   ├── index.a1b2c3.js    # 文件名带 hash，配合文件级 diff 做增量
│   ├── index.d4e5f6.css
│   └── logo.png           # 只放首屏关键小图，大图一律走 CDN
└── fallback.json          # 本地加载失败时的回落信息（线上地址 + 备用版本）
```

```javascript
// manifest.json 的实际内容（这里用 JS 对象写法，方便逐行注释）
{
  "appId": "mall-h5",            // 业务标识，一个 App 里可以有多个离线包
  "version": 108,                // 版本号单调递增，比对更新的唯一依据
  "minAppVersion": "7.2.0",      // 低于这个壳版本不适用，防止老壳加载新包
  "entry": "index.html",         // 入口文件，WebView 首次加载就取它
  "files": [                     // 文件清单，用于完整性校验和增量比对
    { "path": "index.html", "md5": "9f2c...", "size": 2048 },
    { "path": "assets/index.a1b2c3.js", "md5": "77ab...", "size": 182344 }
  ],
  "fallbackUrl": "https://m.example.com/mall/", // 本地文件缺失时回落线上
}
```

### 2. 更新流程：校验通过才切换，切换是原子的

```typescript
// 一次完整的离线包更新，任何一步失败都保持旧版本可用
export async function updateOfflinePackage(meta: PackageMeta) {
  const localVersion = await getLocalVersion(meta.appId)
  if (localVersion >= meta.version) return { updated: false } // 已经是最新，直接跳过

  const tmpDir = `${PKG_ROOT}/tmp_${meta.version}`

  // 1. 下载：优先差分包，只带变化文件；失败再退回全量包
  const zipPath = await downloadPackage(meta, localVersion)

  // 2. 校验：md5 不一致说明下载被截断或 CDN 返回了错误页，直接丢弃
  if ((await md5File(zipPath)) !== meta.zipMd5) {
    await removeDir(tmpDir)
    throw new Error(`[离线包] 校验失败 version=${meta.version}`)
  }

  // 3. 解压到临时目录，此时线上生效的仍然是旧版本
  await unzipTo(zipPath, tmpDir)

  // 4. 逐文件核对 manifest，防止解压过程出错导致的半包
  const manifest = await readJson(`${tmpDir}/manifest.json`)
  for (const file of manifest.files) {
    const actual = await md5File(`${tmpDir}/${file.path}`)
    if (actual !== file.md5) {
      await removeDir(tmpDir)
      throw new Error(`[离线包] 文件损坏: ${file.path}`)
    }
  }

  // 5. 原子切换：先把临时目录改名成正式版本目录，再写 current 指针。
  //    这一步之后新版本才真正生效，前面任何一步失败都不会影响线上
  const finalDir = `${PKG_ROOT}/${meta.version}`
  await renameDir(tmpDir, finalDir)
  await writeCurrentPointer(meta.appId, meta.version)

  // 6. 清理：只保留最近三个版本，多了占空间，少了没得回滚
  await pruneOldVersions(meta.appId, 3)

  return { updated: true, version: meta.version }
}
```

### 3. 加载与回滚：命中本地就返回，出问题退回上一版

```java
// 安卓：在 shouldInterceptRequest 里把命中离线包的请求换成本地文件
@Override
public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
    String url = request.getUrl().toString();
    // 只拦静态资源，接口请求必须放行，否则动态数据全拿不到
    if (!isStaticAsset(url)) return null;

    File local = resolveInPackage(url);   // 用 URL 路径去当前生效版本目录里找文件
    if (local != null && local.exists()) {
        // 命中本地：直接读文件流返回，不再走网络
        return new WebResourceResponse(guessMime(local), "utf-8", new FileInputStream(local));
    }
    // 没命中就返回 null，交回给系统正常发起网络请求（线上兜底）
    return null;
}

// 注意：这个方法跑在子线程，不要在里面做耗时 IO 之外的 UI 操作
```

```javascript
// 前端侧的回滚逻辑：白屏检测 + 错误上报，达到阈值就退回上一版
let blankTimer = null

// 启动后 3 秒内根节点还是空的，就认为当前离线包有问题
blankTimer = setTimeout(() => {
  const root = document.getElementById('app')
  if (root && root.childElementCount === 0) {
    // 先上报，带着版本号和 UA，服务端才能按版本聚合
    reportError({ type: 'blank_screen', version: __PKG_VERSION__ })
    // 再通知原生退回上一版，下次启动就不再用这个包了
    window.JSBridge.call('rollbackOfflinePackage', { version: __PKG_VERSION__ })
  }
}, 3000)

// 正常渲染出来了就清掉定时器，别误判
window.addEventListener('load', () => clearTimeout(blankTimer))

// 原生侧的 rollbackOfflinePackage 实现：
// 客户端本地保留 2~3 个版本，把 current 指针改回上一个，并拉黑出问题的版本号；
// 服务端收到上报后按版本聚合，超阈值就把该版本从灰度配置里摘掉
```

## 09 · 跨端方案怎么选：React Native、Flutter、uni-app、Taro 的取舍

@id
mobile-cross-platform

@level
场景题

@freq
3

@tags
跨端 | ReactNative | Flutter | uni-app

@ask
跨端方案这么多，你们当时为什么选了那个？当时对比了哪些，最后放弃的是什么？我换个问法——如果现在让你重新选一次，你还会选它吗？什么情况下你会劝人别用跨端？

@oral
**先说结论**：跨端没有最优解，只有「约束条件下的最优解」。我判断时看四个约束：**要覆盖哪些端、团队现有技术栈、交互复杂度、以及交付时间和后续维护成本**。这四个里面，「要覆盖哪些端」是权重最高的，因为它直接决定你还有没有得选。

**先把五条路线定位清楚**。React Native 是一套 React 代码出 iOS 和安卓，组件映射到原生控件，能直接调原生能力，业务型 App 很合适，团队会 React 就几乎没有学习成本。Flutter 是自绘引擎，性能和一致性最好，动画特别稳，代价是要学 Dart、空包体积 10MB 起步，而且和小程序生态完全无关。uni-app 和 Taro 本质都是「编译到多端」，最大价值是**能同时出 H5、小程序和 App**，在国内业务里小程序几乎是绕不开的，这就是它们最硬的卖点。小程序原生体验最好，但只活在微信里。

**说我们当时的选择**。项目是电商，要求 App、微信小程序、还有一堆 H5 活动页，运营一个月改两次页面。我选了 Taro，原因是团队都是 React 背景、一套代码能同时出小程序和 H5。**放弃 Flutter 是因为团队没人写 Dart，而且它对小程序诉求毫无帮助；放弃 RN 是因为它出不来小程序**，我们不可能维护两套业务代码。至于转盘抽奖这种重动画的活动页，我们单独用 H5 写，不硬塞进跨端框架——这点很重要，别为了「一套代码」的洁癖把体验做坏。

**代价我也得说清**。编译层一定会有坑：某些小程序 API 要写平台判断、复杂动画要降级、构建时间随页面数线性变长、框架大版本升级有兼容成本。我们的处理办法是把平台差异全部收敛到一个 `platform` 目录，业务代码只 import 统一出口，绝不散落 `if (process.env.TARO_ENV === 'weapp')`。

**反过来讲什么时候别用跨端**：如果只做 App、不碰小程序、又要求高性能动画（IM、音视频、游戏化），我会选 RN 或 Flutter；如果只是想在 App 里嵌几个 H5 页面，那根本不需要跨端框架，写好 H5 就够了——这是最容易被忽略、也最省钱的一个选项。

**收尾**：我的判断顺序是「端 → 团队 → 交互复杂度 → 维护周期」，其中小程序是第一变量，因为它决定了 RN 和 Flutter 还进不进得来牌桌。

@points
跨端选型的判断顺序是：要覆盖的端 → 团队技术栈 → 交互复杂度 → 交付与维护成本
RN 出 App 双端且能调原生，适合 React 团队做业务型 App，但出不了小程序
Flutter 自绘渲染性能与一致性最好，代价是 Dart 学习成本和包体积，且与小程序生态无关
uni-app / Taro 的核心价值是同时覆盖 H5 与小程序，国内业务里小程序往往是决定性变量
只嵌 H5、或只做单端高性能页面时，不用跨端框架反而更省成本，这是常被忽略的选项

@steps
先给判断框架，把「端」放在第一位，说明为什么它权重最高
逐条点评五条路线的定位与代价，不要只夸不贬
讲自己项目的真实约束与选择，明确说出放弃了什么、为什么放弃
讲落地时的代价：编译层坑、平台判断、构建变慢、升级成本
讲反面案例：什么场景下我会劝人别用跨端
收尾用一句话给出可复用的决策顺序

@followups
RN 的新架构解决了什么问题？——旧的 Bridge 通信是异步批量序列化、高频交互会抖，新架构用 JSI 让 JS 直接持有原生对象引用，配合 Fabric 渲染和 TurboModules 降低通信开销，长列表和手势跟手性明显改善
Taro 和 uni-app 怎么选？——语法上 Taro 是 React、uni-app 是 Vue，按团队技术栈选；生态上 uni-app 的插件市场更成熟，Taro 对 RN 和鸿蒙的支持路线更清晰，我们团队是 React 所以选 Taro
Flutter 能出小程序吗？——不能直接出，只有第三方转译方案且体验和生态都受限，所以「要小程序」这条一旦成立，Flutter 基本就出局了
跨端项目的平台差异怎么管？——收敛到单独一层做统一出口，业务代码只依赖这层抽象，绝不在页面里散落平台判断，否则后期改一个平台要全仓搜索

@example
### 1. 五条路线横向对比

| 方案 | 产物端 | 语言 | 渲染方式 | 性能 | 包体积 | 小程序 | 原生能力 | 适合场景 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| React Native | iOS / Android | JS + React | 原生控件，新架构走 Fabric | 接近原生 | 中 | 不支持 | 好，社区库多 | 业务型 App，React 团队 |
| Flutter | iOS / Android / Web / 桌面 | Dart | Skia 自绘，不依赖原生控件 | 最好，动画稳 | 大，空包 10MB+ | 不支持 | 需写 Platform Channel | 重交互、动画、音视频 |
| uni-app | H5 / 小程序 / App | Vue | 编译为各端原生产物 | 一般 | 小 | 支持 | 依赖插件市场 | Vue 团队做多端业务 |
| Taro | H5 / 小程序 / RN / 鸿蒙 | React | 编译为各端产物 | 一般，RN 端更好 | 小 | 支持 | 部分，需平台封装 | React 团队做多端业务 |
| 小程序原生 | 仅微信小程序 | JS + WXML | 双线程 + WebView 渲染 | 端内最好 | 最小 | 仅此一端 | 仅微信能力 | 只服务微信的产品 |

选型的判定顺序建议是：先圈定必须覆盖的端 → 淘汰掉出不了这些端的方案 → 再看团队技术栈 → 最后看交互复杂度和维护周期。

### 2. 落地目录：平台差异只允许出现在一层里

```bash
# 真实项目结构（Taro 多端：App + 微信小程序 + H5 活动页）
src/
├── app.config.ts          # 全局配置：页面路由、分包、tabBar
├── pages/                 # 页面，全部按「一套代码多端编译」来写
│   ├── home/              # 首页，三端共用
│   ├── detail/            # 商品详情
│   └── order/             # 订单列表
├── components/            # 业务组件，跨端共用，禁止出现平台判断
├── platform/              # 平台差异层，所有 if 判断只准写在这里
│   ├── index.ts           # 统一出口，业务侧永远 import 这里
│   ├── share.ts           # 分享：小程序用 onShareAppMessage，App 走 JSBridge
│   ├── payment.ts         # 支付：小程序用 wx.requestPayment，App 走原生支付
│   └── storage.ts         # 存储：小程序用 sync API，H5 用 localStorage
└── config/
    ├── index.ts           # 构建配置，按 process.env.TARO_ENV 分支
    └── dev.ts / prod.ts   # 环境区分，接口域名与 sourcemap 开关
```

```typescript
// platform/index.ts：对外只暴露能力，不暴露平台。业务代码零感知
import * as weapp from './impl.weapp'
import * as h5 from './impl.h5'
import * as app from './impl.app'

// 用编译期常量做静态分支，未命中的实现会被打包工具直接摇掉
const impl = process.env.TARO_ENV === 'weapp' ? weapp : process.env.TARO_ENV === 'h5' ? h5 : app

// 业务侧永远只用这一层，将来新增端只改这一个文件
export const shareService = impl.shareService // 分享：三端行为差异最大的一块
export const paymentService = impl.paymentService // 支付：小程序和 App 完全两套
export const storage = impl.storage // 存储：小程序同步 API，H5 走 localStorage
```

### 3. 构建配置：把「端」当成构建维度

```typescript
// config/index.ts：同一份代码，不同端产出不同产物
export default defineConfig((merge, { command, mode }) => {
  // TARO_ENV 决定目标平台，是本地开发和 CI 共同的入口参数
  const env = process.env.TARO_ENV || 'weapp'

  const base = {
    projectName: 'mall',
    date: '2026-9-22',
    designWidth: 750, // 设计稿宽度，配合 px 转 rem/rpx 做移动端适配
    sourceRoot: 'src',
    outputRoot: `dist/${env}`, // 按平台分目录，避免多端产物互相覆盖
  }

  // 小程序端：必须开分包，否则主包体积超限直接被拒
  if (env === 'weapp') {
    return merge({}, base, {
      mini: {
        postcss: {
          pxtransform: { enable: true, config: { selectorBlackList: ['van-'] } },
          // 设计稿是 750，但组件库按 375 出图，所以要单独排除组件库前缀
        },
      },
      subPackages: ['pages/activity', 'pages/user'], // 活动页和用户中心拆进分包
    })
  }

  // H5 端：走浏览器基线和 CDN 资源路径
  if (env === 'h5') {
    return merge({}, base, {
      h5: {
        publicPath: 'https://cdn.example.com/mall/', // 静态资源走 CDN
        staticDirectory: 'static',
        esnextModules: ['taro-ui'], // 需要按 ES 模块转译的依赖
      },
      // 构建基线要和最低支持内核对齐，不能按最新浏览器写代码
      targets: { chrome: '61', ios: '11' },
    })
  }

  return merge({}, base, {})
})
```

## 10 · 小程序的双线程架构与 setData 性能问题

@id
mobile-miniprogram

@level
进阶

@freq
3

@tags
小程序 | 双线程 | setData

@ask
小程序为什么非要做成双线程？setData 到底慢在哪一步？什么样的 setData 写法会把页面写卡，你举个你见过的例子。还有，几万条数据的长列表你们是怎么撑住的？

@oral
**先说结论**：小程序把**逻辑层**和**渲染层**拆成两个独立的运行环境——逻辑层跑 JS（iOS 上是 JavaScriptCore，安卓上是 V8），渲染层是 WebView，中间由原生层做消息中转。好处有两个：JS 里写出死循环也卡不住渲染、而且不允许你直接操作 DOM，页面表现完全由数据驱动。代价就是**每次跨线程通信都要序列化再传输**，这正是 setData 慢的根源。

**把 setData 的成本拆成三段**。第一段，你在逻辑层调用的数据会被序列化成字符串；第二段，字符串通过原生层跨线程传到渲染层；第三段，渲染层反序列化后做 diff，再把差异应用到 DOM 上。所以它天然和**数据体积**强相关，而且这三段都在主线程之外排队，数据越大延迟越明显。这是个量级问题：一次 setData 传到 1MB 这个级别会明显掉帧，几十 KB 在低端安卓上已经能感觉出来。

**优化手段按收益排序**。第一，**只传变化的那一小块**，用路径写法 `this.setData({ 'list[3].status': 1 })`，而不是把整个 list 重新传一遍——这是收益最大的一条。第二，数据分片，长列表按分页或分块追加，别一次性灌上千条。第三，**和渲染无关的数据不要放进 data**，比如只用于计算的标记位、缓存的对象，放在页面实例的普通属性上就行，`data` 越小 diff 越快。第四，高频事件做节流合帧，scroll、input、拖拽这类不要每次触发都 setData。第五，用自定义组件把更新圈在组件内部，父组件 setData 不要顺手把整个子树的数据都带上。

**说个真实例子**。我们的订单列表最早是一次性 setData 800 条，低端安卓上滑动明显白屏；后来改成路径更新加标记 `list[i].loading`、分页追加、滚动节流，滑动掉帧基本消失。还有搜索框实时联想，之前每次 input 都 setData，改成本地变量存值 + 200ms 节流后才提交渲染，输入立刻跟手了。

**边界也要说清**。路径写法不是万能的——一次 setData 里塞几十条不同路径，diff 的次数反而变多，可能比传整体还慢。所以最优解是「合并成一次 setData，但里面只带真正变化的字段」；另外 setData 的回调函数是异步执行的，别指望 setData 之后立刻能读到更新后的 DOM。

@points
小程序用逻辑层与渲染层双线程隔离，中间由原生层中转，既不阻塞渲染也不允许直接操作 DOM
setData 的三段成本是序列化、跨线程传输、渲染层反序列化与 diff，都和数据体积正相关
只传变化字段（路径写法）是收益最大的优化，数据分片与节流合帧紧随其后
与渲染无关的数据不要放进 data，data 越小 diff 越快，实例属性是干净的去处
路径写法不是越多越好，一次 setData 塞大量路径反而更慢，应合并成一次且只带变化字段

@steps
先讲架构分层与它换来的两个好处，说明这是设计取舍不是缺陷
把 setData 拆成序列化、跨线程传输、渲染层 diff 三段，解释为什么和体积强相关
按收益给出五条优化手段，第一条重点讲路径写法
用一个自己项目里的长列表案例，说明改造前后的差异
讲边界：路径不是越多越好、setData 是异步的
收尾强调原则——减少数据量、减少调用次数，离屏数据不进 data

@followups
为什么小程序不让直接操作 DOM？——渲染层和逻辑层不同线程，直接操作会让两边状态不一致，而且小程序要保证多端一致与安全可控，所以统一走数据驱动
setData 能用回调判断渲染完成吗？——回调只表示这次的更新流程走完了，具体渲染时机由框架决定，需要精确测量得用自渲染完成后的节点查询
长列表一定要做虚拟列表吗？——几百条以内可以不虚拟，几千条以上必须做，或者用官方的可回收列表组件，否则节点数和内存都会爆
小程序分包能解决什么？——解决主包体积超限导致的审核与启动问题，把低频页面拆进分包按需下载，和 setData 性能是两件不同的事

@example
### 1. 双线程架构与一次 setData 的完整链路

```bash
# 逻辑层（JSCore / V8）                原生层（微信客户端）            渲染层（WebView）
# ------------------                  ----------------              ---------------
# this.setData({ ... })   ──①序列化──>  native 中转   ──②跨线程传输──>  ③反序列化
#                                                                        │
#                                                                    ④diff + 渲染
#                                                                        │
#                     <────────────────⑤事件回传（tap / input）───────────
#
# 关键点：①③ 是 JSON 序列化与反序列化，②是跨线程通信，
# 三步的成本都随数据体积增长，这就是「少传数据」比「少调一次」更重要的原因。
```

```javascript
// 逻辑层代码：能拿到数据，但拿不到 DOM，所有更新只能通过 setData 表达
Page({
  data: {
    list: [], // 参与渲染的数据，越精简越好
  },

  onLoad() {
    // 与渲染无关的东西绝不放进 data：放在实例属性上，完全不参与 diff
    this.cache = new Map()
    this.scrollLocked = false
  },

  onScroll(e) {
    // scroll 触发极其频繁，不做节流会直接把渲染层压垮
    if (this.scrollLocked) return
    this.scrollLocked = true
    setTimeout(() => {
      // 这里只写影响渲染的字段，且每次只调一次 setData
      this.setData({ scrollTop: e.detail.scrollTop })
      this.scrollLocked = false
    }, 100)
  },
})
```

### 2. setData 的反例与正例

```javascript
// 反例一：把整个 list 重新传一遍。哪怕只改了第 10 条的 status，
// 也要序列化 800 条数据跨线程传输，低端安卓上直接掉帧
this.setData({ list: newList })

// 反例二：循环里反复 setData。每一次都是一轮完整的序列化 + 通信，
// 循环一百次就是一百次跨线程往返，比一次传大数组还慢
newList.forEach((item, i) => {
  this.setData({ [`list[${i}].selected`]: item.selected })
})

// 反例三：把只用于计算的字段也塞进 data，
// 它们完全不参与渲染，却每次都要跟着序列化和 diff
this.setData({ tempPriceCache: bigObject, list: newList })
```

```javascript
// 正例一：路径更新，只把真正变化的字段送过线程
this.setData({
  'list[3].status': 1, // 只传这一个值，体积从几十 KB 降到几十字节
  'list[3].statusText': '已发货',
})

// 正例二：需要批量更新时，合并成一次 setData，只带变化字段
const patch = {}
changedItems.forEach((item, i) => {
  patch[`list[${i}].selected`] = item.selected // 组装成一个 patch 对象
})
this.setData(patch) // 只通信一次，跨线程往返开销最小

// 正例三：与渲染无关的数据放在实例属性上，压根不进 data
this.priceCache.set(skuId, price) // 不触发任何 setData
```

### 3. 长列表：分页追加 + 局部更新

```javascript
Page({
  data: {
    list: [], // 只存当前已经渲染出来的数据，不存全量
    loadingMore: false,
  },

  // 分页追加：每次只把新一页的数据接上去，而不是重新拼整个数组
  async loadMore() {
    if (this.data.loadingMore || !this.hasMore) return
    this.setData({ loadingMore: true }) // 只更新一个布尔值，成本极低

    const page = await fetchOrders(this.pageNo++)
    this.hasMore = page.hasMore
    this.pageNo = page.pageNo

    // 追加用 concat 生成新数组，路径写法在这里不适用（长度变了），
    // 但好处是只传这一页的数据，不是全量
    this.setData({
      list: this.data.list.concat(page.items),
      loadingMore: false,
    })
  },

  // 单项状态变化用路径更新，避免为了改一个字段重传整个列表
  onItemTap(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ [`list[${index}].selected`]: true })
  },
})

// 如果列表要渲染几千条，光靠分页不够，还要上「只渲染可视区域」的虚拟列表，
// 或者直接用官方提供的可回收列表组件，让节点数量和内存都控制在一个常数级
```

## 11 · WebView 内核差异与常见兼容性坑

@id
mobile-webview-compat

@level
进阶

@freq
2

@tags
WebView | 内核 | 兼容性

@ask
安卓 WebView 和 iOS 的 WKWebView 差别在哪？你们线上有没有那种「只有某个机型才出」的 bug？怎么定位的？还有，你们的最低支持内核版本是怎么定的？

@oral
**先说结论**：最大的区别是**内核版本碎片化**。iOS 只有 WKWebView，内核跟着系统版本走，行为相对统一，最低也就到 iOS 11、12；安卓这边可能同时存在系统 WebView、X5 内核、厂商自研内核，Chrome 内核版本从 53 一路到 120 都有，同一个页面在不同机型上其实是不同的浏览器。所以安卓的兼容策略要按「最低版本」来写，而不是按「主流机型」写。

**常见的坑我分三类**。CSS 这一类：老内核不支持 flex 的 `gap`、`aspect-ratio`、`inset`，`position: sticky` 在某些 WebView 里配合 overflow 会失效，圆角加 overflow 裁剪在部分安卓上裁不掉子元素；还有 iOS 上输入框字体小于 16px 会触发自动放大，页面直接跳一下。JS 这一类：可选链和空值合并要 Chrome 80 以上、`IntersectionObserver`、`ResizeObserver`、`AbortController`、`Promise.allSettled` 都能踩到，所以构建目标必须显式声明并按需引 polyfill，不能指望 babel 默认值。存储这一类：某些安卓 WebView 的隐私模式下 `localStorage` 直接抛异常，`sessionStorage` 也可能不可用，所以我封装的存储层一定是 try/catch 加内存兜底。

**怎么定位**。真机远程调试为主：安卓用 Chrome 的 `chrome://inspect`，X5 内核用微信开发者工具里的 vConsole，iOS 用 Safari 的 Web Inspector。线上问题就靠错误上报，**UA 和内核版本必须一起带上**，不然报了一堆错也不知道是谁的；带上之后能按机型聚合，一眼就能看出是某个内核版本的问题。我的经验是，绝大多数「偶发 bug」不是逻辑错，而是我们对内核能力的假设和实际不一致。

**降级策略上我有个明确原则：能力检测优先于 UA 判断**。先判断 API 存不存在，不存在就走兜底分支，这是最稳的；UA 判断只用来处理那些「API 存在但行为不一致」的差异，比如某些内核的 CSS 表现。另外我会把页面能力分成两层：**基线能力**必须可用（下单、支付、表单提交），**增强能力**可以降级（动画、毛玻璃、视差），降级永远只影响增强部分，不能让核心流程挂掉。

**最低内核版本怎么定**：看用户数据，通常覆盖到 98% 以上的机型就够，把它写进 browserslist 和构建配置，让转译和 polyfill 自动按这个基线来。**这比事后按机型打补丁靠谱得多**——先定基线再写代码，成本最低。

@points
安卓内核碎片化严重（系统 WebView / X5 / 厂商内核，版本跨度极大），iOS 只有 WKWebView 且随系统走
兼容坑集中在三类：CSS 能力缺失、JS API 缺失与语法不支持、存储 API 在隐私模式下抛异常
定位靠真机远程调试加线上错误上报，上报必须带 UA 与内核版本才能按机型聚合
能力检测优先于 UA 判断，UA 只用于处理「API 存在但行为不一致」的差异
把能力分成基线与增强两层，降级只影响增强部分，并用 browserslist 把最低内核版本固化成构建基线

@steps
先讲清楚两端内核碎片化的差异，说明安卓要按最低版本设计
按 CSS / JS / 存储三类列举真实踩到的坑，每条都给出规避写法
讲定位手段：真机远程调试 + 带 UA 的错误上报 + 按机型聚合
讲降级原则：能力检测优先，UA 判断只做补充
讲能力分层：基线必须可用、增强可以降级
收尾落到工程化：把最低内核版本写进 browserslist，让构建自动兜住大部分问题

@followups
为什么建议能力检测而不是判断 UA？——UA 会被伪装和修改，而且新版内核可能补齐了 API 却保留了旧 UA；能力检测直接测 API 是否存在，结论才是可信的
iOS 输入框聚焦时页面自动放大怎么解决？——输入框 font-size 至少设成 16px，或者用 viewport 的 maximum-scale 兜底，但更推荐前者，不牺牲无障碍
polyfill 全量引进来是不是就稳了？——成本是体积，按 browserslist 精确计算需要补哪些是更好的做法，全量引入在弱网下反而拖慢首屏
线上报错怎么快速判断是内核问题？——上报里带上 UA、内核版本、页面路径，按版本维度做聚合，如果某个版本错误率明显偏高就基本可以确认

@example
### 1. 内核判断与能力降级

```javascript
// UA 只用来处理「API 存在但行为不一致」的差异，不能当作能力判断的依据
function parseEnv() {
  const ua = navigator.userAgent
  return {
    isIOS: /iPhone|iPad|iPod/i.test(ua),
    isAndroid: /Android/i.test(ua),
    // 安卓内核版本：Chrome/xx 是系统 WebView，X5 内核会有 MQQBrowser 或 XWEB 标记
    chromeVersion: Number((/Chrome\/(\d+)/.exec(ua) || [])[1] || 0),
    isX5: /MQQBrowser|XWEB/i.test(ua),
    // iOS 版本：WKWebView 的能力跟着系统走，端能力差异主要看这里
    iosVersion: Number((/OS (\d+)_/.exec(ua) || [])[1] || 0),
  }
}

const env = parseEnv()

// 能力检测优先：API 不存在就走兜底，而不是猜内核
const canObserve = typeof IntersectionObserver !== 'undefined'

// 存储层必须 try/catch：部分安卓隐私模式或 WebView 设置下 localStorage 会直接抛异常，
// 而且是不能被 try 之外的东西兜住的同步异常
export const storage = {
  get(key) {
    try {
      return localStorage.getItem(key)
    } catch (err) {
      return this.memory.get(key) ?? null // 内存兜底，至少保证本次会话可用
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value)
    } catch (err) {
      this.memory.set(key, value) // 写不进去也不要让业务逻辑中断
    }
  },
  memory: new Map(),
}
```

### 2. 常见 CSS 兼容写法

```css
/* flex gap：Chrome 84 起支持，老内核上直接不生效，用 margin 兜底 */
.list {
  display: flex;
  gap: 8px; /* 新内核用 gap，代码更干净 */
}

/* 兜底写法：用相邻兄弟选择器加 margin，老内核也能拿到间距 */
.list > .item + .item {
  margin-left: 8px;
}

/* aspect-ratio 同样是新特性，老内核用 padding-top 撑比例 */
.cover {
  aspect-ratio: 4 / 3;
}

.cover-fallback {
  position: relative;
  width: 100%;
  padding-top: 75%; /* 高 / 宽 = 3 / 4，用百分比撑高度 */
}

.cover-fallback > img {
  position: absolute;
  inset: 0; /* inset 在部分老内核不识别，需要拆成 top/right/bottom/left */
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* iOS 上输入框 font-size 小于 16px 会触发聚焦自动缩放，整页跳一下 */
.search-input {
  font-size: 16px; /* 别再写 14px，省这一点字号的代价是页面乱跳 */
}

/* 动态视口单位：100vh 在 iOS 上不随地址栏变化，优先用 dvh 并保留兜底 */
.page {
  min-height: 100vh; /* 老内核兜底 */
  min-height: 100dvh; /* iOS 15.4+ / Chrome 108+ 才认，认的会覆盖上一行 */
}
```

### 3. 用 browserslist 把最低内核版本固化成构建基线

```javascript
// package.json 里的 browserslist：这是整个兼容策略的单一事实来源，
// babel 转译、autoprefixer 补前缀、按需 polyfill 都读它
{
  "browserslist": [
    "ios >= 11",        // iOS 11 对应 WKWebView 基线，覆盖到老设备
    "android >= 5",     // 安卓 5 起系统 WebView 可升级，但仍有 53 这类旧内核
    "chrome >= 53",     // 按最低内核写，而不是按当前主流版本
    "not dead"          // 排除已经停止维护的版本
  ]
}
```

```javascript
// babel 配置：只对基线缺失的能力做按需 polyfill，避免全量引入把包撑大
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        // usage 会扫描代码里真正用到的 API，只补缺的那些
        useBuiltIns: 'usage',
        corejs: 3,
        // 直接对齐 browserslist，不用再单独维护一份 targets
        targets: undefined,
        bugfixes: true,
      },
    ],
  ],
}
```

## 12 · 移动端性能优化：首屏、图片与长列表

@id
mobile-performance

@level
场景题

@freq
3

@tags
移动端性能 | 首屏 | 长列表

@ask
移动端性能你一般怎么优化？首屏具体动了哪些地方？图片这块你们是怎么做的——是不是还在用一张大图缩着显示？还有，几千条数据的长列表你怎么渲染，别跟我说分页就完了。

@oral
**先说结论**：我按三层来做——**首屏、渲染、资源**。首屏排第一，因为移动端掉一档直接影响转化；渲染层解决的是「列表滚不滚得动」；资源层最典型的就是图片。而且顺序一定是**先量化再优化**，用真机看 LCP、看滚动掉帧，找到真正的瓶颈再动手，而不是上来就全站虚拟滚动。

**首屏我做四件事**。第一，减少关键路径：首屏 HTML 走 SSR 或预渲染直出，关键 CSS 内联到 HTML 里，非关键 JS 用 async 或者动态 import 拆出去。第二，资源分级：首屏需要的样式和脚本 preload，详情页组件、图表库这类非首屏的一律拆包懒加载。第三，网络层：接口并行而不是串行，首屏数据用一个聚合接口拿回来，别让页面瀑布式发五个请求，域名该 preconnect 就 preconnect。第四，感知优化：骨架屏先把结构占出来，让用户「先看到轮廓，再看到内容」。我们商品详情页从 2.4 秒降到 1.1 秒，主要就是这三件事：SSR 直出、接口聚合、按路由拆包。

**图片这块我踩过最多**。核心是**永远不要用一张大图缩小显示**，那是纯粹的流量浪费。做法是：按 CSS 宽度乘 DPR 生成图片地址，用 `srcset` 加 `sizes` 让浏览器自己挑，或者干脆走图片处理服务按参数裁剪，比如 OSS 和 COS 都支持在 URL 上加参数指定宽高和格式。格式上优先 WebP，用 `<picture>` 给不支持的浏览器兜底 JPEG。加载上只给首屏那几张图开 `loading="eager"` 和 `fetchpriority="high"`，剩下全部 lazy，**而且必须写死宽高比**，否则滚动时高度跳动会把 CLS 搞得很难看。

**长列表要分情况**。几百条以内直接渲染完全没问题，几千条就必须虚拟滚动或者让框架做节点回收。虚拟滚动的原理其实很简单：算出可视区对应的索引区间（`scrollTop` 除以行高），用一个撑高的占位元素把滚动条撑到正确长度，再只渲染区间内那几十个节点，用 `transform` 或者绝对定位把它们放到正确位置。不定高的列表要复杂一些，要么预估高度再动态测量修正，要么用 `IntersectionObserver` 做增量渲染。**列表里的图片一定要 lazy 加占位高度**，否则图片加载完高度变化，虚拟滚动的计算就全乱了，会出现跳动甚至白屏。

**最后说取舍**。虚拟滚动不是越多越好，它会让 Ctrl+F 搜索、整页截图、锚点定位都变复杂，列表不长的时候反而增加维护成本；骨架屏的高度要尽量贴近真实内容，差太多的话从骨架切到内容会跳一下，观感更差。

**收尾**：我的顺序是先测再改——先看 LCP 卡在哪一段、滚动掉帧卡在哪个函数，再决定动谁；盲目优化最容易把代码搞复杂，收益还不明显。

@points
优化顺序是先量化后动手，按首屏、渲染、资源三层定位瓶颈，看 LCP 与真机滚动掉帧
首屏四件事：SSR 或预渲染直出、关键 CSS 内联、非首屏资源拆包懒加载、接口聚合减少瀑布请求
图片按宽度乘 DPR 生成多倍图或走图片服务裁剪，禁止大图缩小显示，并用 WebP 加 picture 兜底
只给首屏图开 eager 与高优先级，其余 lazy，且宽高比必须写死以避免 CLS
长列表几百条以内不必虚拟化，几千条用虚拟滚动或节点回收，且列表图必须有占位高度

@steps
先给三层框架和「先量化后优化」的原则，避免一上来就报方案
讲首屏的四个动作，并给一个自己项目的量化结果
讲图片：多倍图与图片服务、格式、加载策略、占位高度
讲长列表：先判断量级，再讲虚拟滚动的索引计算与占位撑高
补充不定高列表的处理与列表图的注意事项
收尾讲取舍：虚拟滚动与骨架屏的代价，以及为什么不能盲目上

@followups
LCP 慢到底怎么定位？——先看 LCP 元素是什么，再拆时间轴：TTFB 长说明服务端或网络问题，资源加载长说明图片或阻塞资源有问题，渲染延迟长说明主线程被长任务占住了
虚拟滚动能解决所有列表性能问题吗？——不能，它只解决节点数量问题，如果单项渲染很重（复杂图表、大图）依然会卡，需要配合组件拆分和懒渲染
骨架屏效果不好是什么原因？——最常见的骨架高度与真实内容差距太大，切换时布局跳动；其次是骨架本身太重，反而增加了首屏渲染成本
图片走 CDN 加参数裁剪会不会影响缓存？——不会，不同参数对应不同 URL，本身就是独立的缓存键；但要注意别让参数组合无限发散，否则 CDN 命中率会下降

@example
### 1. 图片适配：多倍图与图片服务

```html
<!-- 用 picture 描边格式与倍图：浏览器自己挑最合适的一张，别让 JS 去算 -->
<picture>
  <!-- 优先 WebP，体积通常比 JPEG 小 25% 以上；不支持的内核会跳过这段 -->
  <source
    type="image/webp"
    srcset="
      /img/goods-320.webp 320w,
      /img/goods-640.webp 640w,
      /img/goods-960.webp 960w
    "
    sizes="(max-width: 375px) 100vw, 375px"
  />
  <!-- 兜底 JPEG：老内核走到这里，保证任何情况下都有图可显示 -->
  <img
    src="/img/goods-640.jpg"
    srcset="/img/goods-320.jpg 320w, /img/goods-640.jpg 640w, /img/goods-960.jpg 960w"
    sizes="(max-width: 375px) 100vw, 375px"
    width="375"
    height="281"
    alt="商品主图"
    loading="lazy"
    decoding="async"
  />
</picture>
```

```css
/* 图片容器必须写死宽高比，否则图片加载完高度一变，后面的内容全部下移 */
.goods-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  padding-top: 75%; /* 老内核兜底，两个都写，认 aspect-ratio 的会用上面那条 */
  background: #f5f6f8; /* 占位底色，避免加载期间是一片白 */
  overflow: hidden;
}

.goods-cover img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover; /* 不变形裁剪，商品图必用 */
}

/* 首屏那张图要优先加载，其余全部 lazy，这条策略比图片压缩收益更直接 */
.hero-img {
  content-visibility: auto; /* 屏幕外的内容跳过渲染，长页面收益明显 */
}
```

```typescript
// 走图片服务按需裁剪：宽度按 CSS 宽度乘 DPR 算，避免下发用不上的大图
const OSS_PROCESS = (w: number, format = 'webp') =>
  `?x-oss-process=image/resize,w_${w}/format,${format}/quality,80`

export function buildImageUrl(origin: string, cssWidth: number) {
  // 上限按 3 倍算：DPR 再高也很难看出差别，再大只是浪费流量
  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  const width = Math.ceil((cssWidth * dpr) / 100) * 100 // 取整到百，提高 CDN 缓存命中率
  return origin + OSS_PROCESS(width)
}

// 列表页调用：CSS 宽度 120px 的缩略图，在 DPR=3 的机型上取 400 宽，而不是原图 2000 宽
const thumb = buildImageUrl(item.cover, 120)
```

### 2. 长列表虚拟滚动的最小实现

```javascript
// 核心只有两件事：算出可视区对应哪几项，然后只渲染这几项
class VirtualList {
  constructor({ container, itemHeight, renderItem }) {
    this.container = container // 外层滚动容器，必须固定高度
    this.itemHeight = itemHeight // 定高列表是前提，不定高需要额外做测量
    this.renderItem = renderItem // 单项渲染函数，返回 HTML 字符串或节点

    this.data = []
    this.range = { start: 0, end: 0 }

    // 撑高的占位元素：它的高度等于「总条数 × 行高」，
    // 这样滚动条的长度和真实列表一致，滚动位置才不会错
    this.phantom = document.createElement('div')
    this.phantom.style.position = 'relative'

    // 真正渲染的那几十个节点放在这里，用 transform 整体偏移到可视位置
    this.viewport = document.createElement('div')
    this.viewport.style.position = 'absolute'
    this.viewport.style.left = '0'
    this.viewport.style.right = '0'
    this.viewport.style.top = '0'

    this.phantom.appendChild(this.viewport)
    this.container.appendChild(this.phantom)

    // 滚动用 rAF 节流：scroll 触发极其频繁，直接同步渲染必然掉帧
    let ticking = false
    this.container.addEventListener('scroll', () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        this.update()
        ticking = false
      })
    })
  }

  setData(data) {
    this.data = data
    // 总高度决定滚动条长度，这一步没做对的话滑到底会差一大截
    this.phantom.style.height = `${data.length * this.itemHeight}px`
    this.update()
  }

  update() {
    const scrollTop = this.container.scrollTop
    const visibleCount = Math.ceil(this.container.clientHeight / this.itemHeight)

    // 首尾各多渲染一项，避免快速滚动时出现白边
    const start = Math.max(0, Math.floor(scrollTop / this.itemHeight) - 1)
    const end = Math.min(this.data.length, start + visibleCount + 2)

    // 区间没变就不重新渲染，滚动过程中大部分帧都会命中这个分支
    if (start === this.range.start && end === this.range.end) return
    this.range = { start, end }

    // 只渲染区间内的节点，数量级从几千降到几十
    this.viewport.innerHTML = this.data
      .slice(start, end)
      .map((item, i) => this.renderItem(item, start + i))
      .join('')

    // 用 transform 把这一屏内容平移到正确位置，走合成层不触发重排
    this.viewport.style.transform = `translateY(${start * this.itemHeight}px)`
  }
}

// 用法：容器必须有确定高度，否则 clientHeight 为 0，算出可视条数是 0，页面会空白
const list = new VirtualList({
  container: document.querySelector('.list-container'),
  itemHeight: 88,
  renderItem: (item) => `<div class="cell" style="height:88px">${item.title}</div>`,
})
list.setData(await fetchOrders())
```

### 3. 首屏关键路径：预连接、分级加载与骨架屏

```html
<!-- 关键路径的第一步：把后面要用到的域名提前握手，省掉 DNS 和 TLS 的往返 -->
<link rel="preconnect" href="https://cdn.example.com" crossorigin />
<link rel="dns-prefetch" href="https://api.example.com" />

<!-- 首屏必需的样式直接内联，避免多一次阻塞渲染的请求 -->
<style>
  .skeleton {
    background: linear-gradient(90deg, #f2f3f5 25%, #e8eaed 37%, #f2f3f5 63%);
    background-size: 400% 100%;
    animation: shimmer 1.2s ease infinite;
  }
  @keyframes shimmer {
    from { background-position: 100% 50%; }
    to { background-position: 0 50%; }
  }
</style>

<!-- 首屏必需品用 preload 提前拿，非首屏的脚本一律 defer 交给空闲时间 -->
<link rel="preload" as="script" href="/js/home.js" />
<script defer src="/js/detail-panel.js"></script>
```

```javascript
// 首屏数据用一个聚合接口拿回来，避免组件各自发请求造成瀑布式等待
async function bootstrap() {
  // 串行两个接口要 2 个 RTT，聚合成一个只需要 1 个 RTT
  const { user, banners, recommend } = await fetch('/api/home-bootstrap').then((r) => r.json())

  renderHeader(user)
  renderBanners(banners)
  renderRecommend(recommend)

  // 上面三条渲染都完成了，骨架才该被替换掉；提前替换会闪一下
  document.querySelector('.skeleton-wrap')?.remove()
}

// 非首屏模块等空闲时间再加载，不跟首屏抢主线程和带宽
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => import('./below-the-fold'), { timeout: 2000 })
} else {
  // 兜底：不支持空闲回调的内核用定时器错峰加载
  setTimeout(() => import('./below-the-fold'), 1500)
}
```
