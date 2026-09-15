---
id: engineering
name: 工程化与项目场景
en: Engineering & Scenarios
icon: git-branch
color: #7c5cff
order: 12
desc: Git 协作、监控、CI/CD、微前端与场景设计题，考的是真实落地能力。
---

## 01 · Git 协作：rebase 与 merge 的区别，团队该怎么用

@id
eng-git

@level
进阶

@freq
3

@tags
Git | rebase | 冲突处理

@ask
来聊聊 Git，rebase 和 merge 到底有什么区别？你们团队实际是怎么用的？我要是现在让你定一套协作规范，你会怎么定，哪些场景必须禁用 rebase？

@oral
**先说结论**：merge 和 rebase 最终都为了把两条分支的改动合到一起，区别只在「提交历史长什么样」。merge 会生成一个合并提交，保留分支真实分叉的拓扑；rebase 是把当前分支的提交「摘下来」重新 replay 到目标分支顶端，历史变成一条线，干净但没有「在哪合过」的痕迹。

**我们当时的做法**：主分支 `main`/`master` 绝对保护，只允许 `--no-ff merge`，保留发布记录可回溯；个人功能分支开发期用 `rebase` 把 `main` 的新提交垫到本地提交之前，保证本地历史线性、少噪音；合进主分支前必须 rebase 到最新 `main` 解决冲突，再提 MR。

**真实场景**：我们一个 12 人前端组，早期人人用 merge，主干历史全是 `Merge branch 'main'`，看 `git log` 像一团乱麻，定位「哪次发版引入 bug」很痛苦。切到「个人分支 rebase、主干 no-ff merge」后，提交图清爽了，发版出问题能直接 `git bisect` 二分定位。

**取舍与代价**：rebase 会改写提交 hash，所以铁律是「只 rebase 自己还没推远端或只有自己在用的分支」，推上去的、别人基于它开发的提交绝对不能 rebase，否则别人一 pull 全乱。我们也放弃了「完全线性历史」的追求，因为 no-ff merge 那一个节点对回溯价值更大。

**收尾**：规范落到 `.gitconfig` 别名 + MR 模板 + 保护分支设置，新人照着走就不会踩雷。

@points
merge 保留分叉拓扑并生成合并提交，rebase 改写提交历史得到线性记录
rebase 的本质是「摘下提交重新 replay」，因此会变更 commit hash
受保护的主干分支应用 no-ff merge 保留可追溯的发布节点
rebase 只用于未共享的个人分支，已推送且被他人依赖的提交严禁 rebase
冲突解决时机不同：merge 一次性解决，rebase 可能逐提交解决

@steps
先讲清两者产物差异（历史形状），不要只背定义
给出团队分层策略：个人分支 rebase、主干 no-ff merge
强调「改写 hash」带来的协作风险，引出禁用场景
结合真实痛点说明规范带来的收益（如 git bisect 定位）
点出落地手段：保护分支 + 别名 + MR 模板，让规范可执行

@followups
rebase 中途冲突了怎么办？——逐提交解决后 `git add` 再 `git rebase --continue`，想中止就 `git rebase --abort`
为什么已推送的分支不能 rebase？——别人基于旧 hash 开发，你改写后他 pull 会产生大量重复/冲突提交
`git merge --squash` 和 rebase 怎么选？——squash 把分支压成单提交再 merge，适合「这个功能就一个逻辑提交」的场景，历史更聚合

@example
### 1. 个人功能分支：开发期用 rebase 保持历史线性

```bash
# 切到功能分支，把主干最新代码垫到本地提交之前
git checkout feature/pay
git fetch origin                 # 先拉取远端最新，避免基于旧主干 rebase
git rebase origin/main           # 把 feature/pay 的提交 replay 到 main 顶端

# rebase 过程中遇到冲突：逐提交解决
# 编辑冲突文件，删除 <<<<<<< 和 >>>>>>> 标记，保留正确代码
git add src/pay/index.ts         # 标记冲突已解决
git rebase --continue            # 继续下一个提交；想放弃就 git rebase --abort

# 推送到远端（因为本地 hash 被改写，需强制推送自己的分支）
git push -f origin feature/pay   # 仅限自己独占的分支，绝不用于主干
```

### 2. 合入主分支：用 no-ff merge 保留发布节点

```bash
# 切回主干，用非快进合并，强制生成一个合并提交
git checkout main
git merge --no-ff feature/pay -m "feat(pay): 接入收银台，关联 #128"

# 结果：历史里能看到明确的「在哪合入、谁合入」的节点
# 对比 fast-forward：直接把 main 指针移到分支顶端，合并记录「消失」无法回溯
git push origin main
# 经验：主干保护分支在 Git 平台开启「禁止直接 push、必须走 MR + 至少 1 人评审」才真正奏效
```

### 3. 主干保护 + 回溯定位：git bisect 二分找 bug

```bash
# 假设 v2.1.0 正常、当前 HEAD 有 bug，二分定位引入问题的提交
git bisect start
git bisect bad HEAD             # 当前是坏的
git bisect good v2.1.0          # 这个标签是好的

# Git 会自动 checkout 中间版本，你测完告诉它好/坏
git bisect bad                  # 或 git bisect good
# 重复几轮后，Git 会输出「第一个坏提交」的 hash，精确到人、精确到改动

git bisect reset                # 结束二分，回到原分支
```

## 02 · 前端错误监控与性能上报体系怎么搭

@id
eng-monitor

@level
场景题

@freq
3

@tags
监控 | 错误上报 | sourcemap

@ask
你做过前端监控吗？线上出了个白屏，你怎么第一时间知道、怎么定位到具体代码行？性能数据你们又上报了哪些，怎么保证不影响主流程？

@oral
**先说结论**：监控体系要分两层——错误监控保「不白屏、出事能定位」，性能监控保「体验达标、能量化优化」。核心是把 `window.onerror`、`unhandledrejection`、资源加载失败、接口异常全兜住，再靠 sourcemap 把压缩后的堆栈反解成源码行号。

**我们的做法**：封装一个轻量 SDK，监听全局错误和资源错误，Vue 项目额外用 `errorHandler` / `warnHandler` 接住框架内异常；上报走 `navigator.sendBeacon`，页面卸载时也能可靠发出，且是异步不阻塞。每条错误带 `userId`、`路由`、`SDK 版本`、`deviceInfo`，方便聚类。

**真实场景**：我们曾经有个白屏告警，监控平台 1 分钟内收到 300+ 同堆栈报错，sourcemap 反解定位到 `list.vue:42` 一个 `undefined.map`。我们立刻查到是后端给新字段为 `null`，前端没兜底。从发现到发版热修约 25 分钟，靠的就是堆栈直连源码。

**取舍与代价**：sourcemap 不能跟着业务 bundle 部署到生产（等于泄露源码），我们放到私有 OSS + 通过错误上报的 `fileName:line:column` 在**服务端**反解，前端只传压缩堆栈。性能数据用 `requestIdleCallback` 攒批上报，每批最多 10 条、间隔 5s，避免抢占主线程；首屏、FCP、LCP、长任务都采，但对低端机降采样。

**收尾**：监控不是接上就完，要配告警阈值和值班，否则数据只是摆设。

@points
错误捕获分全局（onerror/unhandledrejection）、资源、框架（errorHandler）、接口四类
sourcemap 不上生产，存私有服务，由后端按行列号反解压缩堆栈
上报优先 sendBeacon，卸载也能发；平时用空闲时间攒批，避免阻塞主线程
错误要带上下文（用户/路由/版本/设备）才能聚类定位
监控必须配告警与降采样，否则高流量下自身成负担

@steps
先说明监控分层目标：错误保可用、性能保体验
列出捕获入口：全局错误、Promise、资源、框架、接口
讲 sourcemap 离线反解方案，点出安全风险
讲上报通道选型（sendBeacon + 空闲攒批）与性能保护
落到告警闭环：阈值、聚类、值班，否则只是数据堆砌

@followups
压缩后堆栈怎么还原成源码行？——上报时带 `file:line:column`，后端用 source-map 库的 `SourceMapConsumer` 反查原始位置
sendBeacon 大小有限制怎么办？——单条约 64KB，超了就分片或改用 `fetch(keepalive:true)`
Vue 的异步错误漏捕获怎么补？——`app.config.errorHandler` 接框架内错误，再统一走同一上报函数

@example
### 1. 错误监控 SDK 核心：兜底所有崩溃入口

```javascript
// 全局 JS 运行时错误（同步抛错、资源加载以外的脚本错误）
window.addEventListener('error', (e) => {
  // e.error 是 Error 对象，有 stack；资源加载失败时会进这里但 e.error 为 null
  if (e.error) report('js', { message: e.message, stack: e.error.stack, col: e.colno, row: e.lineno })
}, true) // 第三个参数 true 才能在捕获阶段拿到资源加载错误

// 未被 catch 的 Promise 拒绝，最常见的「接口异常没兜底」就漏这里
window.addEventListener('unhandledrejection', (e) => {
  report('promise', { message: e.reason?.message || String(e.reason) })
})

// 资源（图片/script/link）加载失败，error 事件不冒泡，只能捕获阶段拦
window.addEventListener('error', (e) => {
  if (e.target && (e.target.src || e.target.href)) {
    report('resource', { url: e.target.src || e.target.href })
  }
}, true)
```

### 2. Vue 接入框架错误 + 统一上报通道

```javascript
import { createApp } from 'vue'

// Vue 内部渲染/生命周期里的错误会走到这里，不会触发 window.onerror
app.config.errorHandler = (err, instance, info) => {
  report('vue', { message: err.message, stack: err.stack, info })
}
app.config.warnHandler = (msg) => {
  report('vue-warn', { message: msg }) // 开发告警，生产可关
}

// 统一上报：优先 sendBeacon，卸载也不丢；失败降级 fetch
function report(type, payload) {
  const body = JSON.stringify({
    type,
    ...payload,
    uid: getUserID(),
    route: location.pathname,
    sdk: '1.4.2',
    ua: navigator.userAgent,
    t: Date.now(),
  })
  if (navigator.sendBeacon) navigator.sendBeacon('/log', body)
  else fetch('/log', { method: 'POST', body, keepalive: true })
}
```

### 3. 后端用 sourcemap 反解压缩堆栈（Node 侧）

```javascript
const { SourceMapConsumer } = require('source-map')
const fs = require('fs')

async function mapStack(stack, file, line, column) {
  // 线上 bundle 对应的 .map 文件存在私有 OSS，绝不随业务下发
  const raw = fs.readFileSync(`./maps/${file}.map`, 'utf8')
  const consumer = await new SourceMapConsumer(raw)
  // 把压缩后的行列号，映射回开发时写的那一行
  const pos = consumer.originalPositionFor({ line, column })
  return `${pos.source}:${pos.line}:${pos.column} -> ${pos.name}`
}
// 注意：.map 文件只在构建时生成、存私有服务，线上业务包里绝不能带，否则等于把源码开源
```

## 03 · CI/CD 与灰度发布在前端怎么落地

@id
eng-cicd

@level
场景题

@freq
3

@tags
CI/CD | 流水线 | 灰度

@ask
你们前端是怎么做持续集成和发布的？如果新版本上线后指标异常，你怎么快速止损？灰度是怎么做的，前端这边能控制吗？

@oral
**先说结论**：前端 CI/CD 的价值是把「构建—测试—部署」标准化、去人工化，再用灰度把「一次全量」拆成「小流量验证」，出问题能秒级回滚而不是回滚整站。

**我们的做法**：MR 合入 `main` 触发 CI：先 `pnpm install`、lint、类型检查、单测，全过才进构建，产物带 `git sha` 版本号上传 OSS。发布走「构建物与线上环境解耦」——构建出静态包 + 一个 `manifest.json` 记录版本，CDN 上多版本共存，切换由网关/配置中心控制，所以回滚只是改指针，秒级完成。

**真实场景**：我们有次改了埋点 SDK，发布 5% 灰度后发现某渠道崩溃率涨了 3 倍。因为灰度路由按用户 `userId` 取模，我们直接把灰度比例从 5% 调到 0%，2 分钟内全量用户回退到上一版本，再把坏版本修掉重新灰度。整站其他功能零影响。

**取舍与代价**：全量 CI 检查会让每次合入等 8-12 分钟，我们权衡后把重型 E2E 移到夜间跑，白天只跑 lint+类型+单测，换取反馈速度。灰度我们放弃「按地域」这种粗粒度，改用「按用户分桶」（一致性哈希），保证同一用户刷新不会在版本间跳变，体验稳定。

**收尾**：CI 是「质量门禁」，灰度是「风险闸门」，两者配合才敢小步快跑。

@points
CI 把 install/lint/类型/单测/构建串成门禁，不过不让合、不让发
构建物与线上解耦，多版本共存于 CDN，发布=切指针，回滚秒级
灰度按用户分桶做一致性哈希，避免同一用户版本跳变
止损靠调低灰度比例而非回滚整站，其他功能不受影响
重型 E2E 移出白天流水线，白天保速度、夜间保覆盖

@steps
先讲 CI 触发链：合入→检查→构建→产物上传，强调门禁作用
说明构建物多版本共存 + manifest 指针切换的发布模型
给出灰度分桶（用户哈希取模）的具体控制方式
讲异常止损：下调灰度比例到 0 即可秒级回退
点出速度与覆盖的取舍：白天轻量、夜间重型

@followups
前端怎么做灰度，后端不参与？——前端构建多份入口 HTML，网关按用户分桶返回不同 index.html，或配置中心下发版本开关
回滚要重新构建吗？——不用，旧版本包还在 CDN，改 manifest 指针即可，几秒生效
CI 太慢怎么优化？——依赖缓存 + 并行 job + 把慢测试挪到非阻塞的夜间任务

@example
### 1. CI 流水线：lint / 类型 / 单测 / 构建（GitLab CI 风格）

```yaml
# .gitlab-ci.yml —— 合入 main 触发，分阶段跑，前一步失败后续不执行
stages:
  - test
  - build
  - deploy

lint-and-test:
  stage: test
  script:
    - pnpm install --frozen-lockfile   # 锁版本，保证他人/CI 装到完全一致依赖
    - pnpm lint                        # ESLint + Stylelint 卡代码风格
    - pnpm type-check                  # vue-tsc 跑类型检查，类型错直接红
    - pnpm test -- --run               # 单测，CI 下不监听
  only:
    - main

build:
  stage: build
  script:
    - pnpm build                       # Vite 构建，产物写入 dist/
    - echo "{\"version\": \"$CI_COMMIT_SHA\"}" > dist/manifest.json  # 写入本次版本号
    - ossutil cp -r dist/ oss://fe-cdn/$CI_COMMIT_SHA/  # 按 sha 存多版本，互不覆盖
  only:
    - main
```

### 2. 灰度与回滚：配置中心下发版本指针

```yaml
# 配置中心 gray-config.yaml —— 控制各渠道灰度比例，运营可热改无需发版
gray:
  pay-revamp:
    enabled: true
    ratio: 0.05            # 当前灰度 5%，异常时改 0 即全量回退上一稳定版
    bucketBy: userId       # 按用户一致性哈希分桶，同用户不跳版本
    stableVersion: "a1b2c3" # 上一稳定版 sha，ratio=0 时全量走它
    canaryVersion: "d4e5f6" # 本次灰度新版 sha
```

### 3. 网关按分桶返回不同入口（Nginx 示意）

```nginx
# 用 userId 哈希把 5% 流量导到灰度版 index.html
map $cookie_uid $index_version {
    default        /stable/index.html;   # 默认稳定版
    # 这里简化：真实由配置中心下发的 lua 脚本按 ratio 计算返回哪个版本
}

server {
    location = /index.html {
        # 灰度逻辑在 lua 里读取配置中心的 gray.ratio 动态决定
        content_by_lua_file /etc/nginx/gray.lua;
    }
}
// 注：真实灰度比例与分桶规则由配置中心下发，lua 读取后决定返回 stable 还是 canary 的 index.html
```

## 04 · 团队规范怎么落地：ESLint、Prettier、Husky 与提交规范

@id
eng-lint

@level
进阶

@freq
2

@tags
代码规范 | ESLint | 提交规范

@ask
你们团队代码规范是怎么真正落地的，而不是停在 README 里？ESLint 和 Prettier 打架怎么处理？Commit 信息你们怎么约束的？

@oral
**先说结论**：规范落地的关键不是「写文档」，而是把它变成「不遵守就过不去的卡点」——用 Husky 把 lint 和格式化挂到 git 钩子上，用 commitlint 卡提交信息，用 CI 做最后兜底，三层一起才真有人遵守。

**我们的做法**：Prettier 负责「格式」（引号、分号、换行），ESLint 负责「质量」（未用变量、any、危险 API），两者用 `eslint-config-prettier` 关掉 ESLint 里和格式重叠的规则，避免打架。Husky 在 `pre-commit` 跑 `lint-staged` 只检查暂存文件，快；`commit-msg` 钩子跑 commitlint 校验 `type(scope): subject` 格式。

**真实场景**：我们组 15 人，以前靠 code review 人工纠格式，PR 里一半评论是「这里少了分号」。接上 Husky + lint-staged 后，提交时自动 fix，reviewer 把精力放到逻辑上，PR 平均往返从 3 轮降到 1 轮。commit 规范后，`git log --grep="fix(pay)"` 能直接捞出支付相关修复，发版CHANGELOG 自动生成。

**取舍与代价**：pre-commit 全量 lint 在大仓库会卡 10 秒以上，所以我们只 lint 暂存文件（lint-staged），且 `pre-commit` 只做 fix 不动类型检查——类型检查放到 CI，避免本地太慢劝退。commitlint 规则我们也放宽，只强制 `type` 和长度，不卡太死，否则有人会绕过钩子。

**收尾**：规范要「自动修 + 卡得住 + 不折磨人」三者平衡，否则一定会有人 `--no-verify`。

@points
Prettier 管格式、ESLint 管质量，用 eslint-config-prettier 关重叠规则避免冲突
Husky 挂 git 钩子：pre-commit 跑 lint-staged 只查暂存文件
commitlint 约束 type(scope): subject，配合 conventional-changelog 出 CHANGELOG
lint-staged 只检查改动文件，保证本地钩子快、不被绕过
CI 做兜底类型检查，本地只 fix 不卡重型检查，平衡速度与质量

@steps
先讲分层目标：自动修格式、卡质量、约束提交
点出 ESLint 与 Prettier 职责划分和冲突解法
给出 Husky + lint-staged 的「只查暂存」提速策略
讲 commitlint 规范与 CHANGELOG 自动化的收益
强调体验平衡：本地轻、CI 重，否则被人绕过

@followups
ESLint 和 Prettier 同时格式化谁说了算？——Prettier 为准，eslint-config-prettier 关掉 ESLint 格式规则，只留质量规则
lint-staged 和 husky 什么关系？——husky 管理钩子触发时机，lint-staged 决定「只跑暂存文件」的范围
有人 `git commit --no-verify` 绕过怎么办？——CI 再加一道 ESLint 门禁，本地能绕、远端绕不掉

@example
### 1. ESLint 配置：关掉与 Prettier 重叠的规则

```json
{
  "root": true,
  "extends": [
    "eslint:recommended",
    "plugin:vue/vue3-recommended",
    "@typescript-eslint/recommended",
    "prettier"                // 关键：关掉所有和 Prettier 冲突的格式规则
  ],
  "plugins": ["@typescript-eslint", "vue"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn", // 禁止 any，但先给 warn 不阻断，逐步清零
    "no-console": "warn",                         // 生产代码留 console 给个警告
    "vue/multi-word-component-names": "error"     // 组件名必须多词，防冲突
  }
}
```

### 2. Husky + lint-staged：只检查暂存文件，本地快

```json
// package.json 片段：lint-staged 只针对本次改动的文件跑规则
{
  "lint-staged": {
    "*.{ts,vue,js}": [
      "eslint --fix",          // 自动修复可修项（格式、简单质量）
      "prettier --write"       // 统一格式化
    ],
    "*.{css,scss,md}": ["prettier --write"]
  }
}
```

```bash
# .husky/pre-commit —— 钩子触发 lint-staged
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
npx lint-staged               # 只校验 git add 进来的文件，大仓库也只要 1~2 秒
```

### 3. commitlint 约束提交信息格式

```javascript
// commitlint.config.js —— 强制 type(scope): subject 约定式提交
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2, 'always',
      ['feat', 'fix', 'refactor', 'perf', 'test', 'docs', 'chore', 'style'],
    ],
    'subject-max-length': [2, 'always', 100], // 主题不超过 100 字，太长说明拆得不够细
  },
}
// 经验：规则先用 warn 灰度跑两周、让团队适应后再升 error，能显著降低推行阻力
```

```bash
# .husky/commit-msg —— 提交信息不符合规范直接拒绝
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
npx --no-install commitlint --edit "$1"
```

## 05 · monorepo 的取舍：pnpm workspace 与 Turborepo

@id
eng-monorepo

@level
高级

@freq
2

@tags
monorepo | pnpm | Turborepo

@ask
你们项目为什么上 monorepo？用 pnpm workspace 还是 Lerna，Turborepo 又解决了什么？什么情况下你反而不建议用 monorepo？

@oral
**先说结论**：monorepo 不是为了「酷」，而是当多个包/应用**强耦合、要共享类型与构建产物、且版本要一起走**时才划算。我们用 pnpm workspace 管依赖、Turborepo 管任务编排，核心价值是「跨包改一处、相关构建自动联动，且只跑受影响的」。

**我们的做法**：根目录 `pnpm-workspace.yaml` 声明 `packages/*`，各子包用 `workspace:*` 互相引用，pnpm 的硬链接让依赖只装一份、杜绝幽灵依赖。Turborepo 给每个包的 `build`/`test` 标输入输出缓存，用「管道哈希」判断哪些任务因上游变更需要重跑，其余直接命中缓存。

**真实场景**：我们有 `ui` 组件库、`utils` 工具包、`web` 主站三个包同仓。改了 `utils` 一个函数，以前各包分别 build 要 6 分钟；Turborepo 算出只有依赖 `utils` 的 `web` 需要重 build，`ui` 命中缓存，总时长降到 40 秒，CI 直接省一大截。

**取舍与代价**：我们**放弃**了「按包独立发版节奏」——monorepo 里包版本容易一起涨，对想独立版本治理的团队是负担。而且仓库一大，clone 和 IDE 索引变重，新人不适应。我反而建议在「多应用但技术栈差异大、发布节奏完全独立」时别用 monorepo，拆成多仓 + 私有 npm 包更清爽。

**收尾**：monorepo 是组织成本的再分配，不是银弹，要在「协作收益」和「仓库臃肿」间拿平衡。

@points
monorepo 适合强耦合、共享类型/产物、版本同节奏的多包场景
pnpm workspace 用硬链接去重依赖、workspace:* 引用本地包、杜绝幽灵依赖
Turborepo 按任务输入输出做哈希缓存，只重跑受影响任务，显著提速
代价是版本易一起涨、仓库重、新人门槛高
强独立、技术栈差异大的团队更适合多仓 + 私有包

@steps
先界定 monorepo 的适用边界，别一上来就吹
讲 pnpm workspace 的依赖去重与本地包引用机制
讲 Turborepo 的任务缓存与受影响重跑逻辑
给真实提速数据体现收益
主动讲代价与不适用场景，展示取舍判断

@followups
pnpm 怎么解决幽灵依赖？——依赖装到全局 store 再硬链接到 node_modules/.pnpm，子包只能 import 自己声明过的包
Turborepo 缓存怎么失效？——任务的输入文件或上游包变更导致哈希变化，对应任务及下游全部重跑
monorepo 一定要 Turborepo 吗？——不一定，npm/yarn workspace 也能管依赖，Turborepo 补的是「任务编排与缓存」这一层

@example
### 1. pnpm workspace：声明工作区与本地包引用

```yaml
# pnpm-workspace.yaml —— 根目录声明哪些目录是工作区成员
packages:
  - 'packages/*'          # 所有子包，如 ui / utils / hooks
  - 'apps/*'              # 所有应用，如 web / admin
  - '!**/test/**'         # 排除测试目录，避免被当成包
```

```json
// packages/web/package.json —— 用 workspace:* 引用同仓其他包
{
  "name": "@app/web",
  "dependencies": {
    "@app/utils": "workspace:*",   // 直接链到本地 utils 源码，改了即时生效，无需发版
    "@app/ui": "workspace:^1.0.0"  // 也可用版本范围，发布时再解析为真实版本
  }
}
```

### 2. Turborepo：任务编排与缓存配置

```json
// turbo.json —— 定义哪些任务、输入输出是什么、能否缓存
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],     // 先构建依赖它的上游包（如 web 依赖 utils 先 build）
      "outputs": ["dist/**"],       // 这些产物进缓存，命中就跳过
      "cache": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": [],               // 测试无产物，只缓存「是否通过」的结果
      "cache": true
    }
  }
}
```

```bash
# 只构建 web 及其受影响的依赖，未受影响的包直接读缓存
pnpm turbo run build --filter=@app/web
# 改动 utils 后，turbo 哈希判定：utils 变了 → 依赖它的 web 重跑，ui 命中缓存
```

### 3. 根目录统一脚本入口

```json
// 根 package.json —— 用 filter 精确定位要操作的包
{
  "scripts": {
    "build:web": "turbo run build --filter=@app/web",
    "test:changed": "turbo run test --since=main",  // 只测相对 main 有改动的包，提速
    "clean": "turbo run clean && rm -rf node_modules"
  }
}
// 经验：CI 里加 --filter 只构建本次 MR 影响的包，超大 monorepo 能砍掉 70% 无效构建
```

## 06 · 微前端是什么，qiankun 的沙箱与样式隔离怎么做的

@id
eng-micro-frontend

@level
高级

@freq
3

@tags
微前端 | qiankun | 沙箱

@ask
讲讲微前端，你们为什么用？qiankun 是怎么做到多个子应用互不干扰的——JS 沙箱和样式隔离具体怎么实现的？有什么坑？

@oral
**先说结论**：微前端是把「一个巨石应用」拆成「多个可独立开发、部署、运行的技术栈无关子应用」，靠一个基座（主应用）来编排。我们用 qiankun 主要解决「老 jQuery 系统和新 Vue 系统要共存、团队要独立发版」的问题。隔离靠两层：JS 沙箱管全局变量，样式隔离管 CSS 污染。

**我们的做法**：qiankun 默认用 `Proxy` 做 JS 沙箱——每个子应用加载时给它一个伪造的 `window`，子应用读写的全局变量都落在自己的沙箱里，卸载时整体丢弃，不会污染基座。样式隔离默认给子应用容器加 `data-qiankun` 前缀做「 scoped 式」重写，再配合 `strictStyleIsolation` 用 Shadow DOM 彻底隔离。

**真实场景**：我们把一个 8 年前用 jQuery + 全局 `$` 写的内核，和新的 Vue3 报表系统并存在一个页面。沙箱让老应用的 `window.xxxConfig` 不会窜到 Vue 侧，Shadow DOM 让老系统的 `body { font-size: 14px }` 这种全局样式不影响新模块。两团队各自发版，互不等对方。

**取舍与代价**：`strictStyleIsolation`（Shadow DOM）隔离最干净，但老代码里大量 `document.querySelector('body')`、弹窗挂到 `body` 的逻辑会失效，我们**放弃**了严格模式，只用默认 scoped 前缀 + 约定「子应用样式都包在自己根选择器下」。Proxy 沙箱在 IE 不支持，但我们目标浏览器已弃 IE 所以无碍；另外沙箱有启动开销，子应用多了首屏会慢，我们用预加载缓解。

**收尾**：微前端不是银弹，通信、沙箱、样式都要额外治理，能单体就别微前端。

@points
微前端解决巨石应用拆分、技术栈共存、团队独立发版问题
qiankun JS 沙箱用 Proxy 伪造 window，子应用全局变量隔离、卸载即弃
样式隔离默认 scoped 前缀重写，strictStyleIsolation 走 Shadow DOM 更彻底
Shadow DOM 会让依赖 body/全局选择器的老代码失效，需权衡取舍
沙箱有启动开销，子应用多要预加载；能单体就别上微前端

@steps
先讲微前端要解决什么（共存/独立发版），别只背定义
讲 JS 沙箱 Proxy 机制：伪造 window、隔离全局、卸载清理
讲样式两种隔离方案及强度差异
用一个真实老新共存的例子佐证
点出坑：Shadow DOM 兼容老代码、沙箱开销、预加载

@followups
qiankun 怎么知道子应用加载完？——子应用 entry 加载后，执行导出的 bootstrap/mount/unmount 生命周期钩子，基座据此管理
多实例沙箱和单实例沙箱区别？——单实例同时间只有一个子应用活跃（省内存），多实例可并存但不同时激活，qiankun2 默认多实例
子应用间怎么通信？——用基座的 globalState 或 initGlobalState 发订阅，或走自定义事件/共享 store，避免直接耦合

@example
### 1. 基座注册子应用：路由匹配 + 沙箱 + 样式隔离

```javascript
import { registerMicroApps, start } from 'qiankun'

// 基座（主应用）注册子应用，按路由前缀把请求分发给对应子应用
registerMicroApps([
  {
    name: 'legacy-jquery',                 // 老系统：jQuery 写的，独立技术栈
    entry: '//localhost:7100',            // 子应用入口 HTML，可被基座拉取执行
    container: '#subapp',                 // 挂载到基座的这个 DOM 节点
    activeRule: '/legacy',                // 访问 /legacy 开头路由时激活它
  },
  {
    name: 'report-vue3',                  // 新系统：Vue3 报表
    entry: '//localhost:7200',
    container: '#subapp',
    activeRule: '/report',
  },
])

// 启动 qiankun：开启沙箱（JS 隔离）与样式隔离
start({
  sandbox: { strictStyleIsolation: false }, // 用默认 scoped 前缀，兼容老代码挂 body 的写法
  prefetch: 'all',                          // 预加载其他子应用静态资源，切换更快
})
```

### 2. Proxy 沙箱核心思路（qiankun 内部简化版）

```javascript
// 每个子应用一个 fakeWindow，所有全局读写落在它身上，不影响真实 window
function createSandbox() {
  const fakeWindow = {}                 // 子应用专属的「假 window」
  const proxy = new Proxy(fakeWindow, {
    get(target, key) {
      // 读：优先读沙箱内变量，没有才透传到真实 window（如 document）
      return key in target ? target[key] : window[key]
    },
    set(target, key, value) {
      target[key] = value               // 写：只写进沙箱，绝不动真实 window
      return true
    },
  })
  return {
    proxy,
    clear: () => { for (const k in fakeWindow) delete fakeWindow[k] }, // 卸载时清空
  }
}
// 注：多实例沙箱下每个子应用一份 fakeWindow，互不干扰；单实例则共享一份，内存更省但同时间只能一个活跃
```

### 3. 子应用导出生命周期（Vue3 为例）

```javascript
import { createApp } from 'vue'
import App from './App.vue'

// qiankun 要求子应用导出这三个钩子，基座在对应时机调用
let app = null
export async function bootstrap() {
  console.log('子应用 bootstrap：只执行一次，做全局初始化')
}
export async function mount(props) {
  // props 里可拿到基座下发的 globalState、路由等
  app = createApp(App)
  app.mount(props.container.querySelector('#app'))
}
export async function unmount() {
  app.unmount()            // 卸载时销毁实例，配合沙箱清空，干净退出不残留
  app = null
}
```

## 07 · 怎么设计一个组件库：目录结构、构建与按需加载

@id
eng-component-lib

@level
场景题

@freq
3

@tags
组件库 | 按需加载 | 设计系统

@ask
如果让你从零设计一套前端组件库，你会怎么规划目录和构建？怎么做到按需加载，又怎么保证主题可定制、类型完整？

@oral
**先说结论**：组件库设计的核心是「每个组件独立、可单独打包、对外暴露完整 TS 类型、样式可换肤」，构建上用库模式（Vite Library Mode）出 ESM + 类型声明，按需加载靠「每个组件一个入口 + 副作用标记」实现。

**我们的做法**：目录按 `components/Button`、`components/Modal` 平铺，每个组件自带 `index.ts` 入口和样式；根 `index.ts` 只做「纯再导出」且不引样式（样式作为 sideEffects 单独引入），这样打包工具才能 tree-shaking。构建用 Vite `lib` 模式，按组件多入口输出 `es/button.js` 等，配 `vite-plugin-dts` 生成 `.d.ts`。主题用 CSS 变量（`--color-primary`）做令牌，换肤只改根变量。

**真实场景**：我们内部 4 个业务线共用一套 UI，之前全量引入导致首屏多 80KB。改成按需后，报表页只 import 了 Table/Form/Input，gzip 体积降了 62%。主题方面，B 端客户要白标，我们靠覆盖 `--brand` 变量 10 行 CSS 就换完主色，不用改组件。

**取舍与代价**：我们放弃了「单包单版本」的极简，接受「组件多了构建矩阵变复杂」——用脚本批量生成多入口配置。样式方案在「CSS-in-JS」和「CSS 变量 + 独立 css 文件」间选了后者，因为前者有运行时开销、SSR 麻烦，而变量方案零运行时、好做按需。类型我们坚持手写而非 any，代价是初期慢，但接入方的 TS 提示价值远超投入。

**收尾**：组件库是「给别人用的产品」，API 稳定和类型完整比炫技重要。

@points
目录平铺、组件自包含入口与样式，根 index 纯再导出便于 tree-shaking
Vite Library Mode 多入口构建 + vite-plugin-dts 出 ESM 与类型声明
按需加载 = 每组件独立入口 + 样式标为 sideEffects 单独引入
主题用 CSS 变量做令牌，换肤只覆盖根变量，零运行时
类型手写完整优先 any，API 稳定与类型正确是组件库生命线

@steps
先讲目录与「纯再导出」的 tree-shaking 友好设计
讲构建：库模式多入口 + dts 插件出类型
讲按需加载的实现：组件级入口 + sideEffects 标记
讲主题：CSS 变量令牌化，零运行时换肤
点出在样式方案（CSS 变量 vs CSS-in-JS）和类型上的取舍

@followups
为什么根 index 不能引样式？——引了样式会产生副作用，打包工具不敢 tree-shake，导致全量打包
vite-plugin-dts 做什么？——扫组件源码生成 .d.ts 类型声明，让使用方拿到 TS 提示
Babel 插件（如 babel-plugin-import）还必要吗？——Vite 下靠原生 ESM 按需即可，老 webpack 项目才需要该插件把 import 改成具体路径

@example
### 1. 组件库目录结构与根入口（纯再导出）

```typescript
// src/index.ts —— 只再导出，绝不 import 任何 .css，保证可被 tree-shaking
export { default as Button } from './components/Button'
export { default as Modal } from './components/Modal'
export { default as Table } from './components/Table'
// 样式由使用方按需单独引入：import '@lib/es/button/style.css'
```

```typescript
// src/components/Button/index.ts —— 单个组件入口，自带样式导出开关
import './style.css'   // 这行让「引入 Button」时也带样式；按需工具可把它拆到 sideEffects
import Button from './Button.vue'
export default Button
export * from './types' // 导出 Props 类型，使用方拿到完整提示
```

### 2. Vite 库模式构建配置（多入口 + 类型）

```typescript
// vite.config.ts —— 库模式：按组件输出多份 ESM，配 dts 出类型声明
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [vue(), dts({ rollupTypes: true })], // 生成并聚合 .d.ts 类型
  build: {
    lib: {
      entry: {
        button: 'src/components/Button/index.ts', // 每个组件一个入口 → 按需加载基础
        modal: 'src/components/Modal/index.ts',
        table: 'src/components/Table/index.ts',
      },
      formats: ['es'],                            // 现代项目用 ESM，tree-shaking 友好
      fileName: (name) => `es/${name}.js`,        // 输出 es/button.js 等
    },
    rollupOptions: {
      external: ['vue'],                          // vue 作为外部依赖，不打包进组件库
      output: { preserveModules: false },
    },
  },
})
```

### 3. 主题令牌：CSS 变量换肤，零运行时

```css
/* theme.css —— 把设计令牌全部变量化，换肤只覆盖根节点 */
:root {
  --color-primary: #7c5cff;   /* 主色，白标客户改这一行即可整站换色 */
  --radius-base: 6px;
  --font-size-base: 14px;
}

/* Button.vue 只消费变量，不写死颜色 */
.btn-primary {
  background: var(--color-primary);
  border-radius: var(--radius-base);
  font-size: var(--font-size-base);
}
```

```json
// package.json —— 标记样式为副作用，配合构建让按需引入能带上 css
{
  "sideEffects": ["**/*.css"],   // 告诉打包工具：css 是有副作用的，不能随便摇掉
  "peerDependencies": { "vue": "^3.3.0" }
}
// 经验：组件库发版用 changeset 管理版本与 changelog，谁改了哪个组件一目了然，避免破坏性更新偷偷上线
```

## 08 · 讲一个你负责过的复杂项目：怎么拆解和推进

@id
eng-project-story

@level
场景题

@freq
3

@tags
项目复盘 | 难点 | 量化结果

@ask
讲一个你独立负责或主导的比较复杂的项目，当时最大的难点是什么，你怎么拆解和推进的，最后量化结果怎么样？

@oral
**先说结论**：我主导过最复杂的是「把公司老报表系统从日均 2 万条数据、卡顿严重的单页，重构成可插拔的低代码报表平台」。难点不是写代码，而是「在业务不停、数据不丢的前提下平滑迁移」，以及「把模糊需求拆成可交付的模块」。

**拆解与推进**：我先用「依赖分析 + 价值排序」把项目切成四块——①数据接入层（统一清洗/分页，先不动 UI）、②渲染层（虚拟列表替换全量 DOM）、③配置化 schema（把 30 个写死报表抽象成 JSON 描述）、④权限与导出。每块独立排期、独立验证，先上「数据层+虚拟列表」让最痛的卡顿先消失，再逐步替换配置层。

**真实场景与数据**：上线前列表首屏 8 秒、滚动掉帧到 12fps；虚拟列表 + 分页后首屏 1.2 秒、滚动稳 60fps，但初期为了快，我**放弃**了「一次性配置化」，先用手写映射顶上，导致前两周新报表上线仍要改代码。等数据层稳了才补 schema 引擎，第三周起新报表 0 代码上线。

**取舍与代价**：迁移我选「双写并行」而非「停机切换」——老系统照常跑，新系统同步接一份流量做影子验证，确认无差异再切 5% 真实流量。代价是多写一套同步适配、多养一个月双系统，但换来了「零事故迁移」。最终报表开发效率提升约 70%，客诉相关工单降了 45%。

**收尾**：复杂项目拼的不是技术深度，是「敢先交半套、用节奏换风险」的推进力。

@points
复杂项目先靠依赖分析与价值排序拆模块，每块独立排期独立验证
优先解决最痛点（卡顿）建立信任，再补长期架构（配置化）
迁移选双写并行+影子验证，用额外成本换零事故，而非停机切换
为速度阶段性放弃完美方案（先手写映射），待地基稳再抽象
结果要量化（首屏、fps、效率、工单），复盘才有说服力

@steps
先一句话定位项目与核心难点（平滑迁移 + 需求拆解）
讲拆解方法：依赖分析、价值排序、分块独立排期
讲推进节奏：先交最痛部分建立信任，再补长期架构
讲关键取舍：双写并行换零事故、阶段性放弃完美
用量化数据收尾，证明推进有效

@followups
怎么说服业务方接受分阶段、不一步到位？——拿「先解决卡顿」的可见收益当筹码，把大需求拆成可 Demo 的小里程碑
双写并行数据不一致怎么发现？——影子流量比对新老输出 diff，超阈值告警，上线前全量对齐
如果重来你会改什么？——更早把 schema 引擎抽象出来，减少手写映射期的技术债累积

@example
### 1. 模块拆解：依赖分析与价值排序

```typescript
// 把模糊需求拆成带依赖关系与优先级的模块清单（实际用看板管理）
interface Module {
  id: string
  dependsOn: string[]   // 依赖哪些模块先完成
  pain: number          // 业务痛点权重，越高越优先
  deliverable: string
}

const modules: Module[] = [
  { id: 'data-layer', dependsOn: [], pain: 9, deliverable: '统一清洗+分页，不动 UI' },
  { id: 'virtual-list', dependsOn: ['data-layer'], pain: 10, deliverable: '替换全量 DOM，先消卡顿' },
  { id: 'schema-engine', dependsOn: ['data-layer'], pain: 6, deliverable: '报表 JSON 化，0 代码上线' },
  { id: 'auth-export', dependsOn: ['virtual-list'], pain: 5, deliverable: '权限与导出' },
]
// 推进顺序：data-layer → virtual-list（先止血）→ schema-engine / auth-export
```

### 2. 渲染层：虚拟列表替换全量 DOM（性能关键）

```typescript
// 用定高虚拟滚动，只渲染视口内行，十万条也不掉帧
function useVirtual(rows: Ref<any[]>, rowHeight = 40, viewport = 600) {
  const scrollTop = ref(0)
  const start = computed(() => Math.floor(scrollTop.value / rowHeight))
  const visibleCount = Math.ceil(viewport / rowHeight) + 2 // 多渲染 2 行缓冲
  const slice = computed(() => rows.value.slice(start.value, start.value + visibleCount))
  return { scrollTop, slice, totalHeight: rows.value.length * rowHeight }
}
// 上线前全量渲染首屏 8s / 12fps；改造后首屏 1.2s / 稳定 60fps
// 关键点：buffer 行要算进 totalHeight 的偏移，否则快速滚动会出现白边
```

### 3. 平滑迁移：双写并行 + 影子流量比对

```nginx
# 网关层把真实流量复制一份到新系统做影子验证，不影响用户
# 老系统返回真实结果，新系统只记录 diff，不对外响应
location /api/report {
    proxy_pass http://legacy-report;            # 老系统：真实响应
    mirror /api/report-shadow;                  # 镜像一份请求给新系统
}
location /api/report-shadow {
    internal;                                   # 仅内部调用，用户无感
    proxy_pass http://new-report;               # 新系统：跑同份数据，比对输出
}
# 比对逻辑：老新输出 diff 超阈值 → 告警，确认无差异才切 5% 灰度真实流量
# 注意：影子流量只读数不写，新系统任何副作用都要用 mock 隔离，避免脏数据
```

### 4. 量化结果（复盘汇报用）

```text
迁移前：首屏 8.0s，滚动 12fps，新报表上线需改代码 ~1.5 人日
迁移后：首屏 1.2s，滚动 60fps，新报表 0 代码上线
效率：报表开发效率 +70%（配置化后）
质量：报表相关客诉工单 -45%
风险：双写并行 1 个月，零事故完成切换
```
