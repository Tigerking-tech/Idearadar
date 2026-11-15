# IdeaRadar

从公开讨论中挖「能判断要不要动手的机会简报」的开源、可自托管项目：采集合规公开源 → 过滤噪声 → LLM 二次去噪 → 把每条证据拆成 **8 段可决策机会简报**（具体场景 / 痛点 / 现在怎么凑合 / 第一性原理上的本质障碍 / 最小可造之物 / 最便宜的证伪动作 / 放弃信号 / 为何现在）→ 每段标注「证据 / 推断 / 假设」并可点回逐字原话核对 → 按人群分组的零输入灵感流。**当前实现以第 12 节为准，第 7–11 节是演进历史**。

**当前定位是免费、无账号、无订阅、无收银台的公开演示**：免注册 3 次只是浏览器 localStorage 的演示配额，完整采集数据在 `/opportunities.json` 一直开放，不存在注册解锁、付费套餐或按席位收费。代码基底来自 Creem 模板，但支付 / 订阅链路当前完全未启用（见第 3 节），全站可见文案已按「只描述已实现功能」逐页诚实化（见第 8 节末）。

## 1. 模板来源

基底是 Creem 官方文档指定的开源模板：

- **armitage-labs/creem-template** — <https://github.com/armitage-labs/creem-template>（Next.js App Router + Prisma/SQLite + better-auth + shadcn/ui + `creem` SDK，MIT）
- 官方文档：<https://docs.creem.io/code/sdks/templates>
- 备选对照（未采用）：`jpr5/creem-saas-boilerplate`（Next 16 + Supabase，带 demo mode）、`pacekit/creembase`（Supabase + `@creem_io/nextjs` 验签 + Playwright e2e）

选官方模板的原因（当时的历史判断）：Creem 接入链路完整且本地 SQLite 即可跑，不需要外部服务就能验证。产品现已转为免费、无收银台，该接入链路不再运行，模板仅作为 Next.js App Router 骨架保留。本环境 `git clone` 到 github.com 超时，最终通过 `api.github.com/repos/.../tarball` 取回源码（这也是第 6 节要做 GitHub workflow 兜底的现实原因）。

**保留但未启用的模板支付链路**：`app/api/checkout/route.ts`、`app/api/customerPortal/route.ts`、`app/api/products/route.ts`、`app/api/subscription/cancel/route.ts`、`app/api/webhook/route.ts`、`lib/creem.ts`、`prisma/schema.prisma`。当前产品不收款，这些路由与 `app/(auth)`、`app/(session)` 模板页仅为对照保留：可见导航与所有 CTA 已改指 `/try` 或 `/opportunities.json`，`SubscribeButton` / checkout 调用已删除，`middleware.ts` 把 `/signin`、`/signup`、`/account`、`/dashboard`、`/products` 统一 307 到 `/try`，`robots.ts` 亦将这些路径列为 private，用户不可达。

**修掉的模板遗留问题**：强制暗色主题、第三方统计脚本、缺失的 `@/config`、`signup` 页非法导出、失效的 waitlist 类型引用、缺失的 `feature.image`、未转义撇号导致的 ESLint 报错。

## 2. 快速开始

```bash
pnpm install
pnpm rebuild better-sqlite3 @prisma/client prisma   # pnpm 10 默认跳过构建脚本，需手动重建
pnpm exec prisma generate
cp .env.example .env.local
pnpm dev                                            # http://localhost:3000
```

其他命令：

```bash
pnpm build              # 生产构建
pnpm test:ingest        # node --test scripts/*.test.mjs，全量采集管线单测
pnpm ingest             # 手动跑一次多源采集
pnpm ingest:heat        # 抓 Google Trends 每日热榜，写外部搜索热度
pnpm ingest:promote     # 把高频扫描方向提升为 auto 赛道（带召回准入闸门）
pnpm ingest:denoise     # LLM 二次去噪（需 IDEARADAR_DENOISE=1 + token）
pnpm ingest:idea        # 生成 8 段可决策机会简报（需 IDEARADAR_IDEA=1 + token）
```

`IDEARADAR_LIVE_FEED=1` 让 `/try` 读取真实采集产物而非演示数据；本地 `.env.local` 已开启。LLM 相关开关：`IDEARADAR_TRANSLATE_TOKEN`（复用给翻译 / 去噪 / 机会简报 / 实时检索归纳 / 按需简报 `/api/brief`）、`IDEARADAR_DENOISE`、`IDEARADAR_IDEA`，均默认关闭以避免本地误调产生费用；云端 workflow 默认开启。密钥只放在 `.env.local` 或 GitHub Actions Secret，不入库。

## 3. 模板支付链路（当前未启用）

本节只说明代码基底里**存在但当前不运行**的东西，不是上线配置指引。产品现在免费、无账号、无订阅、无收银台，因此以下环境变量均不需要配置：

- `CREEM_API_KEY`、`CREEM_PRODUCT_PRO` / `CREEM_PRODUCT_TEAM`、`CREEM_WEBHOOK_SECRET`、`SUCCESS_URL`：模板 checkout / webhook 所用，当前没有任何入口会调用。
- 定价页三档卡片已改为普通链接：`Free trial → /try`、`Full dataset → /opportunities.json`、`Planned → /#how-it-works`（明确标「规划中、未实现」），不再创建 checkout 会话，也不再降级到注册页。
- 若将来真要恢复收款，**必须先办安全项**：模板的 `app/api/webhook/route.ts` 未做签名校验（模板 README 明确写了 "not taking security into account"）。按 <https://docs.creem.io/webhooks> 用 `CREEM_WEBHOOK_SECRET` 校验签名头并在写库前做幂等，再重新接通收款链路。本仓库保留模板原实现以便对照，未擅自猜测签名算法。

上线前仍需把 `NEXT_PUBLIC_SITE_URL` 改成真实域名（当前 `idearadar.app` 为占位）。

## 4. 页面结构

| 路径 | 内容 |
| --- | --- |
| `/` | 落地页：Hero / 数据条 / 实时采集预览 / 三步流程 / 示例证据链 / 对比 + ROI 计算器 / 数据源合规 / 定价 / FAQ / 底部 CTA |
| `/try`、`/zh/try` | 免注册试用页：不登录先免费扫 3 次（localStorage 记在本机，中英共用）；零输入灵感流（今日一点子高亮卡 + 按人群分组的机会卡 + 人/场景方向卡 + 快捷词）；**结果卡 = 可决策机会简报**：答案优先，先给「最小值得造的那个东西」，再默认展开 3 段（具体应用场景 / 痛点 / 第一性原理上的本质障碍），完整 8 段折叠在「完整简报」里；每段标「证据 / 推断 / 假设」，AI 推断带 claim 级「对照原话核对 ↗」内联锚点；验证清单（最便宜证伪动作 + 放弃信号 + 原帖链接）一键复制；顶部保留真实逐字原话、来源与可点开的原始讨论链接（`Signal.sourceUrl`，固定索引来自 `evidence[].url`、实时检索来自 `r.url`）；分数位是可核查的提及数，不是编造的 `85/100`；**固定索引（`idea.origin==="llm"`，60 条）才有完整简报**，实时检索默认不冒充点子，给「按需生成完整简报」按钮（独立 `/api/brief`，不占主检索 25s 预算）+ 8 个判断框架问题，失败时保留原话与框架；归纳短标题明确标注「AI 归纳（不是原话）」；「查看原文」按当前结果判断是否渲染；三个追问为 `更多细节` / `看同类线索`（可点）/ `回到方向卡`；方向卡按人群直取；弱/无命中走 `/api/scan` 现场检索并诚实标注；失败/证据不足不扣次数；3 次用完引导「浏览完整公开数据」或「回首页」，不再承诺注册 / 升级解锁 |
| `/pricing` | 独立定价页（SEO 落地页） |
| `/methodology` | GEO 语义页：真实采集管线（Collect / Filter / Denoise / Brief / Translate / Track）、8 段简报字段说明、数据源与合规边界、已知限制、Reddit 政策时间线、workflow 说明；明确列出「尚未实现」的功能，不再描述虚构的评分模型 / WTP / 竞品空白 |
| `/faq` | FAQ 独立页 |
| `/privacy`、`/terms` | 法务页 |
| `/sitemap.xml`、`/robots.txt` | 动态生成 |
| `/llms.txt`、`/llms-full.txt` | LLM 可读站点索引与完整上下文 |
| `/opportunities.json` | 采集产物（前端可读） |
| `/external-heat.json` | 外部搜索热度产物，抓取失败时 `status: unavailable` |

界面设计规范见 [DESIGN.md](./DESIGN.md)。设计 token 全部集中在 `app/globals.css`，切换视觉风格只需替换该文件。

## 5. SEO / GEO

**Google**

- `lib/seo.tsx` 统一 metadata：title / description / keywords / canonical / `metadataBase` / OG / Twitter card / robots 指令
- `app/sitemap.ts` 六对（12 条 URL）公开页面、`app/robots.ts` 站点规则与 sitemap/host
- 结构化数据（`@graph`）：`Organization`、`WebSite`、`SoftwareApplication`；首页/FAQ 页注入 `FAQPage`；子页注入 `BreadcrumbList`
- 自托管 Inter 字体 + 自有 `public/og.png`，无外部字体请求，不拖慢 LCP
- 全部营销页为服务端组件，正文进入初始 HTML；每页单一 `<h1>`，语义化 `<h2>/<h3>/<table>/<details>`
- FAQ 可见文字与 `FAQPage` JSON-LD 共用 `lib/faq.ts` 单一事实源

**GPT / Claude / Perplexity 等 LLM**

- `/llms.txt`（站点索引）+ `/llms-full.txt`（完整事实上下文：当前真实功能、采集管线、数据源与合规边界、Reddit 时间线、FAQ，以及显式单列的 `Not built yet / Planned (not built)` 清单）
- `robots.txt` 显式放行 `GPTBot`、`OAI-SearchBot`、`ChatGPT-User`、`ClaudeBot`、`anthropic-ai`、`PerplexityBot`、`Google-Extended`、`Applebot-Extended`、`CCBot`、`cohere-ai`、`YouBot`
- `<link rel="alternate" type="text/plain" href="/llms.txt">` 声明
- 事实性、可整段引用的正文（`/methodology`）；首页预览卡**改为构建时直接读 `data/opportunities.json`**，展示最近一次采集里提及数最高的 4 条「最小可造之物」（取自 v3 简报 `build` 派生的 `idea.headline`，中英各取一份），不再用静态示例冒充真实点子；证据区改展示 8 段简报里的场景 / 痛点 / 本质障碍 / 最小可造之物；不再展示编造的 `0–100` 示例分数（含证据区曾硬编码的 `88` 分）；首页 hero / steps / stats 改为「8 段可决策简报」诚实表述；未实现功能一律否定或标「规划中（未实现）」，避免 LLM 引用虚构数字与功能

## 6. 自动采集 workflow

文件：`.github/workflows/ingest.yml` + `scripts/ingest.mjs` + `scripts/ingest-lib.mjs` + `scripts/ingest.config.json`。

- 定时：每 6 小时在 GitHub 托管 runner 上运行；也支持 `workflow_dispatch` 手动触发。
- 流程：`node --test scripts/*.test.mjs` 全量单测 → recall 评估 → cooldown → 多源采集 → TokenHub `hy-mt2-plus` 批量翻译 → **LLM 二次去噪（`scripts/denoise.mjs`）** → **8 段机会简报生成（`scripts/idea.mjs`，缓存命中也重新归一化）** → Google Trends 外部热度 → 高频扫描方向提升（带准入闸门）→ 上传 artifact → 有变化时把数据产物提交回仓库（bot 提交带 `[skip ci]`，不会触发递归构建）。
- 有则提交的数据产物：`data/opportunities.json`、`public/opportunities.json`、`data/history.json`、`data/recall-eval.json`、`data/rejected.json`、`data/denoise.json`、`data/idea.json`、`data/external-heat.json`、`public/external-heat.json`、`data/query-scans.json`、`data/scan-candidates.json`。后两者是运行时产物，仓库初始可以没有。
- 纯函数评分层（`ingest-lib.mjs`）：频率 30% / 强度 20% / 近期性 15% / 跨源印证 20% / 显式付费意愿**词面命中** 15%，规则显式、可单测、可复现。这是采集端对候选条目的启发式排序权重，**不是**对外展示的 `0–100` 严重度评分，也不提取付费金额；普通人赛道走 `consumerMode` 的常青痛点口径（见第 7 节）。
- **默认启用的合规源**：Hacker News 官方 API、Stack Exchange 官方 API（技术站 + `consumerQa` 非技术站）、GitHub Issues 公开 API、可配置 RSS/Atom、第一方数据导入。`consumerQa` 走 Stack Exchange 2.3 官方接口的 `webapps` / `money` / `workplace` / `travel` / `superuser` / `pets`，`timeless=true` 不加 30 天窗口、按 `relevance` 抓常青痛点，服务于 4 个普通人赛道。
- **Reddit 默认关闭**：`ENABLE_REDDIT=false`。只有持有 Reddit 商业数据授权并配置 `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` 时才启用。Reddit 用户协议禁止未授权商业抓取。2026-10-31 起不再受理新的公开 API 申请，2027-01-12 起撤销未登记应用的权限，2027 年 3 月公开 Data API 全面终止；此后官方路径只剩与 Reddit 签商业数据协议，或迁入 Devvit（代码须运行在 Reddit 基础设施上、由 Reddit 决定开放哪些接口，做不了跨平台聚合的独立订阅产品）。
- **第三方抓取服务商不是「授权数据源」**：Apify、Bright Data、Anysite 售卖的是「代取公开页面数据」的服务，不是源平台的授权。Apify 自家 Reddit 抓取器页面明确声明未获 Reddit 授权或认证、不隶属于 Reddit，靠住宅代理 IP 轮换读取未登录访客可见页面。付费购买取数服务不等于取得平台的权利许可——服务商通过合同把 ToS 合规责任与数据控制者责任转移给使用方。Reddit 2026-09-30 公告正是以「大规模抓取与自动化滥用、AI 训练数据采集」为由分阶段关闭 RSS 与公开 API，并已于 2025 年起诉 Anthropic、Perplexity 及多家抓取服务商。因此本项目不把此类服务列为合规源；仅用于自用研究时，须放在独立、默认关闭的适配器内并显式标注「未授权抓取、风险自担」，不得作为对外收费产品的主数据源。
- **补充源的接入优先级**：第一方数据（客服工单、调研导出，零平台合规风险且竞品无法复制）→ 官方开放 API（HN、Stack Exchange、GitHub Issues、YouTube Data、News/GDELT）→ 需商业谈判（Reddit 商业数据协议；X 官方 API 免费档几乎不含读取额度、付费读取按次计费）→ 不接入（平台条款明确禁止自动化访问者，如 Amazon 评论，完整评论已移至登录墙后）。
- 本地网络受限不影响采集：任务跑在 GitHub runner 上；这也是上层「多源 + 数据自治」结论的工程落地。

推送到 GitHub 后，Actions 会自动开始抓取，云端 workflow 已多轮跑通（16 步全 success，含翻译、去噪、机会简报、数据提交）。**本沙箱网络现状**：`github.com` 的 git TLS 通道不稳定（常见 `GnuTLS recv error (-110)`），但 `api.github.com` 与 `codeload.github.com` 可达，因此代码推送走 GitHub REST API `base_tree` 通道：以远端最新 tree 为基线、只覆盖本次变更文件，保留 bot 的 `[skip ci]` 数据提交历史，避免把云端数据刷新覆盖掉。并发 push 被拒时 `Commit refreshed data` 步骤会 `fetch + rebase -X theirs` 后重试。

## 7. P0 / P1 / P2 架构（本轮落地）

### P0-1 方向沉淀的召回准入闸门 · `scripts/promote-niches.mjs`

高频方向不再「只看扫描次数」就变赛道。提升前必须满足：有 `data/scan-candidates.json` 里 score ≥ 55 的落盘证据（快速通道），或现场 `probeFn` 召回达 `GATE_MIN_RAW=3` 且 `GATE_MIN_ITEMS=1`。同时每轮回收零产出 auto 赛道，避免空转赛道稀释相关率。

| 环境变量 | 语义 |
| --- | --- |
| `IDEARADAR_PROMOTE_GATE=0` | 紧急回滚：完全关闭闸门，恢复「只看次数」旧行为 |
| `IDEARADAR_PROMOTE_PROBE=0` | 闸门仍开，但不做现场 probe，只认落盘高分证据；无证据方向 fail-closed 不提升 |

probe 只跑 `hn` / `so` 源白名单以避开 GitHub 限流；probe 抛错/超时同样 fail-closed，不拖垮整轮沉淀。

### P0-2 人工策展层 · `scripts/curation.json` + `applyCuration()`

可版本控制的规则文件替代后台：执行顺序固定为 `excludeTerms` → `rejectIds` → `minCorroboration` → `pinIds`。驳回记录写入 `data/rejected.json` 留痕，供每周人工复核。空规则不改变原有行为。

### P0-3 结构化机会卡 · `scripts/cards.mjs`

八维评分确定性生成，不调用大模型。**前 5 维**（需求强度 / 紧迫度 / 可构建性 / 变现信号 / 证据置信）由已采集证据推导；**后 3 维**（竞品格局 / 市场规模 / 留存复购）恒为 `null`，前端显示「未评估」而非 0 分，绝不猜测。风险标记、目标用户、最低成本验证均为可核查枚举值。可选 `IDEARADAR_CARD_INSIGHT=1` 开启一句话 LLM 洞察（默认关，用 `cardInsightKey` 增量缓存）。

### P1 扩源与外部量级

- `scripts/ingest.config.json` 的 `feeds` 改为结构化对象数组，新增源一律 `enabled:false` 默认关；`resolveFeeds()` 兼容历史字符串数组并拒绝非法协议。新增高信噪比 `dev-workflow` 赛道。
- `scripts/external-heat.mjs` 抓 Google Trends 每日热榜 RSS，与站内 `history.json` 多快照趋势**分口径**展示；抓取失败写 `status: unavailable`，前端不渲染任何假流量数字。
- `scripts/live-scan.mjs` 的 `/api/scan` 按需实时检索（HN / SO / GitHub 现场抓取 + 中文方向补英文同义词 + LLM 去噪聚类 + 规则降级）；高分候选经 `scan-store.mjs` 落盘，缩短「搜过 → 入库」延迟。

### P2 存储适配与商业化骨架（默认关闭）

- **`scripts/scan-store.mjs`**：默认 file 后端读写 `data/query-scans.json` / `data/scan-candidates.json`。配 `IDEARADAR_STORE_URL`（可选 `IDEARADAR_STORE_TOKEN`）走远端 REST（`GET/PUT {url}/{kind}`），解决 Vercel Serverless 文件系统不可持久的问题。任何远端失败/404/非法 JSON 都静默降级，不阻塞扫描。
- **`scripts/entitlement.mjs`**：凭证驱动的额度权益判定。`IDEARADAR_BILLING_ENABLED !== "1"` 时永远返回 guest、行为完全不变。开启后合法 API token → pro / 不限次，登录会话按 plan → pro / member，匿名 → guest。`/api/scan` 据此调整限流。
- 模板自带的 `better-auth` / Prisma / Creem 链路保留未改；当前只做到「额度判定接口」，尚未把 session / Subscription 表直接接进 `/api/scan`。

### 方案 C：LLM 二次去噪 · `scripts/denoise.mjs`

规则层（`NOISE_TITLE_RULES` + `curation.json`）拦不住「服务中断公告」「GitHub issue 模板」「功能规格清单」这类被词面命中的噪声，因此补一层语义判定。翻译之后独立成步，模型同时看到中英文标题、逐字引语、赛道与来源，逐条判定「是否真实用户抱怨」。

| 环境变量 | 语义 |
| --- | --- |
| `IDEARADAR_DENOISE=1` | 启用（脚本默认关，避免本地误调 API 产生费用）；云端 workflow 默认传 1，把仓库变量设为 0 可关闭 |
| `IDEARADAR_TRANSLATE_TOKEN` | 复用翻译密钥，不新增 Secret |
| `IDEARADAR_DENOISE_MAX_REJECT_RATIO` | 单轮驳回比例上限，默认 0.4；超过即整批回退保留，防模型抽风误杀 |
| `IDEARADAR_DENOISE_BATCH` | 每批条数，默认 5（8 条时实测易出现漏键 / JSON 截断） |

**不误杀优先（fail-open）**：只有模型显式返回 `keep:false` 才剔除。无 token、未启用、请求失败、非法 JSON、判定条数不足、漏键，一律保留原条目；失败批次不写缓存，下一轮自动重判。判定键用短序号 `k`（`p0`、`p1`…）而非采集长 id，避免超长 id 被模型截断后整批对不上。

**成本可控**：判定按 `denoiseKey`（= `translationKey`，id + 英文标题 + 引语）增量缓存到 `data/denoise.json`，稳定条目不重复调用。实测 45 条首轮 9 次请求 / 约 20s，第二轮仅 1 次请求 / 5 条待判。

**可复核、可翻案**：被剔除条目合并写入 `data/rejected.json`（`layer:"denoise"`、类别码、中文理由、按层统计），不覆盖人工策展层的驳回记录。发现误杀后把该 id 加进 `scripts/curation.json` 的 `forceKeepIds`，该条目将永不被去噪剔除；确认的噪声也可加进 `rejectIds` 由采集阶段硬驳回。当前 `forceKeepIds` 有 2 条实测误杀、`rejectIds` 有 1 条实测噪声。

**口径说明**：`history.json` 的趋势快照由采集阶段写入，统计的是「采集到的痛点数量」；去噪是展示层的质量过滤，不回写历史快照，两者口径不同，不要拿趋势计数直接对展示条数。

**实测效果**：46 条线上产物 → 人工策展驳回 1 条 → LLM 剔除 11 条（服务降级公告 ×2、接口待办模板、医疗/苹果行业新闻、Jira/PR 空模板、文档任务等）→ 最终 34 条。`Salesforce Bulk: a job is never recovered`、`Python Flask webhook ... no POST request`、`Expense - Not here page opens...` 等具体 bug 报告全部保留。模型偶发套话式误判与 JSON 截断仍然存在，靠安全阀 + `rejected.json` 周复核 + `forceKeepIds` 兜底，不代表判定 100% 准确。

### L0 → L1 → L2 → 治本：把「别人的 bug」改造成「你能做什么」

浏览器扮演零基础访客、宠物店老板、独立开发者实测后发现：三类人读完都没有灵感。根因不是 UI 细节，而是价值链断在「别人的技术 bug → 谁的痛点 → 你能做什么 → 第一步怎么验证」之间。四层改造已全部落地：

**L0 止血**：删掉「演示数据集 / 注册后才启动实时采集」等与真实实现矛盾的文案（试用页、FAQ、限制说明）；`竞品空白` 正名为 `识别到的信号`（该字段实际装的是信号标签，不是竞品分析）；方向卡与示例词去掉 CI / webhook / 埋点等技术黑话；中文页的 nicheLabel、来源名、gap 全部本地化，不再混入英文长句。

**L1 一句话机会**（`scripts/idea-core.mjs` + `scripts/idea.mjs`，**仅固定索引路径**）：每条证据改写成 `headline / who / why / step` 四段中英字段。实时检索路径不再把 `templateIdea()` 的万能套话渲染成「点子」（详见第 11 节）。prompt 明令只从给定标题与原话推导，禁止市场规模、营收、竞品名、预测数字；`step` 必须是能验证产品的最小 artifact，不允许「查官网 / 写博客 / 用 Excel 做模板 / 做市场调研」。fail-open 贯穿始终：无 token、未启用、请求失败、非法 JSON、漏判一律回退确定性模板，绝不阻塞流水线。

- 开关 `IDEARADAR_IDEA=1`（脚本默认关，云端 workflow 默认开，复用 `IDEARADAR_TRANSLATE_TOKEN`）
- 增量缓存 `data/idea.json`，键为 `ideaKey`（id + 原文哈希 + `IDEA_VERSION`）；版本升级自动重算
- **批次大小 = 1**：实测 `hy-mt2-plus` 一批多条时会把 `items` 数组只包第一条就提前闭合、其余摊平成外层字段，15 批只采纳 15 条；改单条后 60/60 全由 LLM 生成、`status=ok`
- `extractIdeaRecords()` 用 `{}` 栈扫描逐个抠出合法对象，救「数组少逗号 / 尾部少括号 / JSON 后多吐一段」；`normalizeIdea()` 兼容模型把 `step` 写成纯字符串
- 只有 LLM 结果才算缓存命中；模板兜底留待下轮重试，避免一次 429 让该条永远停在套话

**L2 交互重构**（`components/marketing/guest-scan.tsx`）：首页从「按分数排的技术 bug 流」改成按 `idea.persona` 分组的灵感流（`groupByPersona()`），首屏一张「今天就能琢磨的一个点子」高亮卡；结果卡把一句话机会置顶，八维机会卡、逐字原话、信号标签、外部热度收进「看原文证据」折叠区；三个追问都是确定性本地动作，不假装有 AI、不额外消耗额度：`更多细节`（展开证据，含可点原始链接）、`看同类线索`（同人群其他线索，有原始链接的条目可点）、`回到方向卡`（滚回方向卡）。方向卡绑定 persona 直取该人群的机会，不再靠关键词兜底串到别的赛道。

**治本：面向普通人的合规数据源**。技术社区（HN / Stack Overflow / GitHub Issues）天然写给开发者，普通人读不懂。新增 `consumerQa` 连接器，配合 `consumerMode`（宽松噪音判定、求助/中文抱怨规则、常青痛点评分口径，不按 30 天 recency 与多源印证过度惩罚）与 `cleanExcerpt()`（剥离 issue 模板 / 贡献指南套话，避免标题与「逐字原话」张冠李戴）。

> **合规边界（明说，不假装接了）**：电商 / 本地生活评论（淘宝、京东、大众点评、小红书等）没有合规公开 API，硬爬有 ToS 风险，本项目不接；App Store 评论 RSS 实测 0 条且不适合做主源。连接器已做成可插拔（`CONNECTORS` + `niche.sources` 白名单），将来拿到授权可单独新增，不影响现有链路。

**已知短板（如实记录）**：手动输入一个完全在固定索引之外的方向时走 `/api/scan` 现场检索，规则降级模式仍可能召回 HN 新闻 / 闲聊；`callLlm` 已改为宽松 JSON 解析以提高 LLM 归纳命中率，但该路径质量仍低于整理好的固定索引，前端明确标注 `实时检索 / AI 筛选` 与「尚未进入固定索引」，不把原始讨论伪装成已验证的点子；该路径的结果卡不再展示模板四段套话，而以真实原话 + 来源 + 外链为主（见第 11 节）。

## 8. 验证记录

| 项 | 结果 |
| --- | --- |
| `node --test scripts/*.test.mjs` | 207/207 通过（含 `idea.test.mjs` 24 项、`denoise.test.mjs` 21 项、`live-scan.test.mjs` 25 项、`translate-insight.test.mjs` 7 项） |
| `pnpm exec tsc --noEmit` | 0 类型错误 |
| `pnpm build` | 通过，29 个路由正常构建 |
| 真实 TokenHub 去噪（46 条线上产物，5 轮迭代） | 覆盖率 45/45、`status=ok`、剔除 11 条噪声 + 1 条人工驳回，最终 34 条；`forceKept=2` 翻案生效 |
| 去噪增量缓存（端到端） | 首轮 9 请求 / 45 条；第二轮 `cached=30 judged=5 requests=1`，零重复调用 |
| `IDEARADAR_DENOISE` 默认关闭 | 零副作用：不请求、不写任何文件 |
| `IDEARADAR_PROMOTE_PROBE=0 node scripts/promote-niches.mjs` | `added=0 gate=true`，零产出 auto 赛道不再被加回 |
| 快速证据通道（真实 `/api/scan` 候选数据、临时目录） | 有证据 `added=1 / via=evidence / probeCalls=0`；无证据 `added=0 / via=no-evidence` |
| `POST /api/scan` | 200，`mode=llm`、score 75 高分候选、`entitlement={enabled:false,tier:guest}` |
| 浏览器逐角色回归（`/zh/try`） | 零基础访客 / 宠物店老板 / 独立开发者三角色实测；今日一点子、人群分组、一句话机会、三个追问、查看原文、方向卡人群直取、3 次配额与耗尽引导、320/360/390px 窄屏通过；控制台 0 error |
| 真实 TokenHub 一句话机会 | v2 单条批次 60/60 全 LLM 生成、`status=ok`、零模板；增量重跑 `cached=59 generated=1 requests=1` |
| 方向卡人群直取 | 点「养宠物、记照护的人」返回宠物/照护相关点子，不再串到收支、Outlook 等别的赛道 |
| 中文页英文残留 | 新赛道 nicheLabel、来源名、gap 全部本地化；`consumerQa` → 日常问答 |
| 全站逐页浏览器体检 | 19 个页面逐页抓取文案 / 链接 / 按钮并逐项点击，汇总「文案承诺 vs 真实实现」清单：功能本身可用，但首页「工作原理」、定价、FAQ、方法论、隐私、条款、`llms*.txt` 承诺了一整套未实现功能（竞品空白图 / 市场空白分 / WTP 原话 / CSV 导入 / `0–100` 评分 / 数据保留 7 天 / 导出 / 监控告警 / Webhook·API·MCP / 5 席位 / 共享工作台），「登录」「升级专业版」还指向坏的 Creem 模板页 |
| 营销文案诚实化 | 重写 `lib/i18n.ts`、`lib/faq.ts`、`config.ts`、`lib/seo.tsx`、8 个独立页、方法论 / 隐私 / 条款 6 页、`llms.txt` / `llms-full.txt`：只描述当前真实实现，未上线功能统一标「规划中（未实现）」或明确否定；删除 `SubscribeButton` 与 checkout 死代码，ROI `toolCost` 由 49 改为 0，定价 CTA 改普通 `<Link>`，导航「登录」改指 `/opportunities.json`，预览卡改真实点子 + 真实提及数 |
| 坏模板页兜底 | `middleware.ts` 把 `/signin` `/signup` `/account` `/dashboard` `/products` 统一 307 → `/try`；本地 curl 5/5 命中，可见导航与 CTA 不再引用这些坏页 |
| SSR 可见文案扫描 | 去掉 `<script>` / `<style>` 后逐词核对可见文本，无虚构承诺；剩余命中均为「（未实现）」「不编造 severity score」「目前还没有」等诚实否定句 |
| 全站交互复检 | 导航 / 语言切换 / FAQ 折叠 / 定价 CTA / 试用页方向卡·随机·快捷词·手动输入·3 次配额 `3→2→1→0`·耗尽引导·三个追问·查看原文 12/12 通过（语言切换初次假阴性已单独复测）；试用页 6/6；320/360/390px 无溢出；控制台 0 error |
| 结果卡产品经理视角改造（本轮） | 浏览器复现用户截图场景：`85/100` 无解释、「谁在痛=有这类麻烦的人」、模板四段`100%`套话、「查看译文」点了无变化、证据区 `links=[]`；定位根因：实时检索 `buildSignals()` 无条件套 `templateIdea()`、归纳标题冒充原标题、`evidence[].url` 未送到前端、首页证据区硬编码 `88` 分。改造为真实原话+外链主角、模板不冒充点子、分数改提及数、站点级文案双路径诚实化 |
| 结果卡改造后浏览器全量复检 | 20/20 通过：固定索引（真实原话/可点外链/提及数/LLM 四段/原文切换有反馈）、实时检索（废话四段消失/归纳标注/外链/无假按钮/诚实说明）、首页 88 分与套话清除、390px 无溢出、控制台 0 error；`node --test` 209/209、`tsc` 0、`build` 通过 |
| polish 后最终验证（上一轮收尾） | `node --test scripts/*.test.mjs` 207/207、`pnpm exec tsc --noEmit` 0 错误、`pnpm build` 通过（29 路由）；重启 `pnpm start` 后 12 个正常页 200、5 个坏模板页 307 → `/try`；SSR 可见文案扫描 7/7 新文案生效，虚构承诺词命中全部落在「（未实现）」「没有…」「规划中的想法，不是已上线的功能」否定语境；浏览器逐项复检 28/28（含首页新 hero、真实预览卡、定价 featured 落在第一档免费试用、中英 CTA 链接全 200、3 次配额 `3→2→1→0`、方向卡 / 随机 / 三个追问 / 看原文证据 / 耗尽引导、语言切换、FAQ 折叠、390px 无溢出、控制台 0 error）；终稿截图目视核对首页 / 工作原理三步 / 定价三档，均无虚构承诺 |

采集结果接入首页「Live preview」：卡片展示最近一次采集的 4 条真实一句话点子，右侧为真实提及数（`mentions`）与按最大值归一化的相对热度条；下方**统计脚注**给出候选条数、数据源、更新日期，并链接到 `/opportunities.json` 供查看原始数据。不再使用编造的示例痛点与 `92/87/81/74` 分数。GitHub Actions 每次刷新 JSON，重新部署后数字随之变化，形成「自动抓取 → 网站」闭环。

**中文标题与逐字原话来自采集端批量 AI 翻译**（TokenHub `hy-mt2-plus`，`response_format: json_object`），前端 SSR 直接输出中文 HTML，可点「查看原文」核对英文原文。翻译失败或 429 只 warn、不阻塞采集，此时保留英文原文。这是与早期「格式示意数据」版本的本质区别。

## 9. 已知限制

- 模板 webhook 未验签（见第 3 节）；当前不收款、该链路未启用，将来恢复收款前必须补齐。
- 采集评分是启发式规则，输出是「候选机会」而非结论。
- **相关度仍不是 100%，但已由方案 C 显著缓解**：规则层（`NOISE_TITLE_RULES` + `curation.json`）拦不住服务中断公告、issue 模板、功能规格清单，`scripts/denoise.mjs` 的 LLM 二次去噪补上语义判定（见第 7 节）。模型仍会偶发套话式误判或输出截断，靠「fail-open 保留 + 0.4 安全阀 + `rejected.json` 周复核 + `forceKeepIds` 翻案」兜底，不能当作精确过滤器使用。
- **LLM 去噪有 API 成本与不确定性**：默认关闭（`IDEARADAR_DENOISE=1` 开启）；云端 workflow 默认开启，把仓库变量设为 0 即停。每轮只判新增条目（增量缓存），但模型偶发 JSON 截断会让该批当轮保留、下轮自动重判。
- **`history.json` 与展示条数口径不同**：趋势快照在采集阶段写入，去噪不回写历史，趋势计数会高于实际展示条数。
- 采集层已过滤新闻标题、发行公告、CI 日志、多语言 issue，并按词边界截断标题；规则集中在 `ingest-lib.mjs` 的 `NOISE_TITLE_RULES`。
- `better-auth` 与 Prisma 仍是模板默认配置、当前未被任何可见流程调用（无注册 / 无登录 / 无会话）；若将来恢复账号体系，生产环境应换成 Postgres 并配置迁移。
- 若部署到 Vercel Serverless，本地文件写入不持久：必须配 `IDEARADAR_STORE_URL` 走远端 REST，否则方向记录与候选证据每次请求都会丢。
- 计费 / 权益默认关闭（`IDEARADAR_BILLING_ENABLED` 未设），`/api/scan` 一律按 guest 20 次/10 分钟处理。当前产品没有账号、订阅或付费套餐，`scripts/entitlement.mjs` 只是预留骨架，不是已上线的商业化能力。
- Google Trends RSS 在部分网络（含本沙箱）不可达，此时外部热度 `status: unavailable`，前端不渲染热度行；这是设计内的诚实降级，不是故障。
- `data/scan-candidates.json` 由 `/api/scan` 在检出 score ≥ 55 候选时才生成，仓库初始可不含该文件。
- 站点域名 `idearadar.app` 为占位，上线前替换 `NEXT_PUBLIC_SITE_URL` 与 `public/llms*.txt` 中的绝对链接。
- 根布局为单一 root layout，`<html lang>` 固定为 `en`；中文页在容器上带 `lang="zh-CN"`，并另有中文 title / description / canonical / hreflang / `og:locale=zh_CN` / 中文 FAQPage 结构化数据。若要让 `<html lang>` 也随语言变化，需重构为双 root layout（route groups），会改动全部现有路由，当前未做。

- **实时检索路径质量低于固定索引**：输入库外方向走 `/api/scan`，规则降级时可能召回 HN 新闻 / issue 规格文档 / 闲聊。该路径**不再生成一句话点子**：`buildSignals()` 只保留真实原标题、逐字原话、`r.url` 来源链接，以及明确标注「AI 归纳（不是原话）」的归纳短标题；结果卡直接展示这些真实内容并如实说明「还没生成具体点子」，不拿 `templateIdea()` 的万能套话充数。已把 `callLlm` 改成宽松 JSON 解析提升归纳命中率，但该路径质量仍低于整理好的固定索引。
- **`hy-mt2-plus` 是翻译专用模型**，JSON 结构能力弱：一句话机会靠「单条批次 + 栈式对象提取 + 字符串字段容错」把成功率拉到 60/60；换模型或改 prompt 必须重新实测，单条解析失败时回退模板并下轮自动重试。
- **普通人赛道来自 Stack Exchange 非技术站点的公开问答**，内容偏「提问」而非「抱怨」；一句话机会是把提问改写成「可以做的小工具」，属于启发式建议而非已验证需求，不能当作市场规模或需求结论。
- **全站文案已逐页诚实化（本轮完成，不再是待办）**：此前首页「工作原理」、定价、FAQ、方法论、隐私、条款、`llms*.txt` 承诺的竞品空白图 / 市场空白分 / WTP 原话 / 导入客服工单与 CSV / `0–100` 严重度评分 / 数据保留 7 天 / CSV·JSON 导出 / 持续监控告警 / Webhook·API·MCP / 5 席位 / 共享工作台 / 注册升级解锁，均为**未实现功能**，现已全部改为否定表述或「规划中（未实现）」；`Creem`、`$49`、`$199`、`Upgrade to Pro` 等收款承诺从可见文案与 GEO 文档中清除。逐页体检、替换与 SSR 扫描记录见第 8 节。
- `lib/i18n.ts` 的 `demoTag` / `foot` **不是待清理的残留文案**：它们是 `live=false`（关闭实时数据、回退演示数据集）时的诚实标注分支，由 `guest-scan.tsx` 按 `live ? footLive : foot`、`live ? liveTag : demoTag` 渲染。开启 `IDEARADAR_LIVE_FEED` 后首屏不显示，但刻意保留，删掉会让演示数据被误认为真实采集结果。

## 10. 中英文双语

- **六对独立静态页**：`/`↔`/zh`、`/pricing`↔`/zh/pricing`、`/faq`↔`/zh/faq`、`/methodology`↔`/zh/methodology`、`/privacy`↔`/zh/privacy`、`/terms`↔`/zh/terms`，全部在构建时预渲染，正文直接出现在初始 HTML 中。语言切换用真实 `<a>` 链接而非前端文案替换，中文内容因此可被 Google 与 LLM 抓取；切换器停留在**同一页面的另一语言**，不会跳回首页。
- **单一事实源**：`lib/i18n.ts` 的 `EN_DICT` / `ZH_DICT` 覆盖首页全部区块、导航、页脚、公告条、交互组件、定价与 FAQ 文案，以及机会卡八维、外部热度、会员额度标签；组件默认取 `EN_DICT`，英文页零改动。中文 FAQ 在 `lib/faq.ts` 的 `FAQ_ITEMS_ZH`，与 FAQPage 结构化数据共用。Methodology／Privacy／Terms 的正文在各自 `/zh/*/page.tsx` 内，同为服务端静态渲染。
- **SEO / GEO**：每对页面互指 `hreflang`（`en-US` / `zh-CN` / `x-default`），`sitemap.xml` 为 12 条 URL 全部输出 hreflang，`llms.txt` 与 `llms-full.txt` 列出全部中文页。
- **中文站零英文正文**：产品名在中文页渲染为「创意雷达 / IdeaRadar」，技术术语（Reddit、API、CSV、GitHub 等）保留原文，其余叙述全部中文化；不再有「（English）」标注。`Creem` 等收款相关词已从全部可见文案与 `llms*.txt` 中移除（支付链路当前未启用，见第 3 节）。
- `<html lang>` 仍固定为 `en`（见第 9 节），中文页容器带 `lang="zh-CN"` 且中文 metadata／hreflang／OG locale／FAQPage 齐全。
- **线上与本地**：两者共用 `/workspace/rantradar` 的 `.next` 构建产物；`pnpm build` 后必须重启 3000 端口的发布服务（发布技能的 autostart 带 `restart:true`，或直接重跑 `publish.js`）才能让线上加载新构建，否则新路由会 500、旧页面仍是旧内容。链接与 sharecode 在重新发布后保持不变。

## 11. 结果卡「证据优先」改造（产品经理视角）

用户以真实用户视角反馈：结果卡「点不开看详情」「什么是填报压力」「那个点子是个废话，做什么产品都是做个最小 MVP 找 3 个人试用」。浏览器实测 + 代码定位发现是价值链问题，不是单个按钮坏了：

1. **点子是写死的模板，不是点子**：`scripts/live-scan.mjs` 的 `buildSignals()` 对实时检索结果 `100%` 无条件调用 `templateIdea()`，`signals` 硬编码 `["seeking","manual"]`、`persona` 恒为 `general`，四段话对所有方向几乎相同（「有这类麻烦的人」「还不够省心」「先做一个最小版本，找 3 个人试用」）。前端却把它当「一句话机会」正经展示，还配 `85/100`。
2. **抽象归纳词冒充原标题**：「填报压力」这类 LLM 归纳短语被塞进 `title`，真实原标题藏在 `titleOriginal`；`quote` 也是 LLM 改写文字却标成「逐字原话」。
3. **点开是假的**：「查看原文证据」折叠里 `links=[]`——数据在 `evidence[].url`（60/60 条都有）、实时检索在 `r.url`，但 `Signal` 映射层没把 url 送到前端，首页「100% 可点回原始讨论」无法兑现；「看同类机会」是 0 链接纯文字；「查看译文」因扫了全库 `signals` 而常驻，点了 headline 无变化。
4. **数字与标签制造虚假权威**：`85/100` 无解释且所有实时检索结果都一样；`mode=llm` 标「大模型归纳」，但四段机会文案其实是模板；首页证据区还硬编码了一个 `88` 分 +「画张草图找 3 个人」套话。

改造（两条路径分工，不再一刀切）：

| 路径 | 数据 | 结果卡呈现 |
| --- | --- | --- |
| 固定索引（60 条，采集端 LLM 生成） | `idea.origin==="llm"` | 真实逐字原话 + 提及数 + 可点原始讨论链接为主视图；仍展示 LLM 四段点子并标注「AI 归纳、起步只是建议」 |
| 实时检索（库外方向 `/api/scan`） | `idea.origin==="template"` | **不展示模板四段**，改为真实原话 + `r.url` 外链 + 明确标注「AI 归纳（不是原话）」的归纳短标题，并诚实说明「这条还没生成具体点子」 |

- `Signal` 新增 `sourceUrl` / `summaryTitle`；`mapOpportunity()` 从 `evidence[0].url` 取链接，`buildSignals()` 从 `r.url` 取并只保留真实标题/原话，归纳短语降级为 `summaryTitle`。
- 前端按 `idea.origin` 分支渲染；`85/100` → 真实提及数；「查看原文」按当前结果判断（`hasResultTranslations`），不再因全库 `signals` 误显示；同类线索可点；按钮改名 `更多细节 / 看同类线索 / 回到方向卡`。
- 首页 evidence 区块去掉硬编码 `88` 分与「找 3 个人」套话，改为「全程能点回来源」；hero / steps / stats / config / seo / `llms*.txt` 统一为「双路径」诚实表述。
- 新增 `rr-clue-*` 样式与 `live-scan.test.mjs` 的 4 项防回归测试（真实标题/原话、`sourceUrl`、归纳标注、非法 url 丢弃、`origin=template`）。

验证：`209/209` 单测、`tsc` 0 错误、`build` 通过；浏览器 20/20 复检（固定索引 + 实时检索 + 首页 + 390px 窄屏 + 控制台），终稿截图目视确认。记录见第 8 节。

### 11.1 收尾：页面级 metadata 与统计条的诚实化

上一轮把正文改成「双路径」后，仍有一组最显眼的位置没跟上：

- 英文首页 `<title>` 仍是 `IdeaRadar — One-line business ideas from real public discussions`，中文首页是「一句话就能看懂的点子」，与「实时检索路径不产出点子」冲突。`/`、`/try`、`/zh`、`/zh/try` 四个页面的 title 与 description 全部改为「逐字原话 + 可点来源 + 索引方向另附点子」的表述。
- 试用页 title 的「3 idea scans / 看点子 3 次」改为「3 free scans / 3 次免费检索」，不把主路径简称说成全站承诺。
- 统计条两个硬编码 `100%`（「逐字原话，一键点回来源」「可点回原始讨论」）与 hero 的「不编数字」自相矛盾，也与结果卡 `clue.noLink`（「这条没有可点的原始链接」）兜底冲突。改为 `0 个编造的分数或市场规模估算` / `1 次点击回到原帖（有链接时）`；`steps` 第 2/3 步与 `evidence.traceText` 里的「每条结果都给出链接」改为「有就给、没有会明说」。
- 目视检查还发现：固定索引 LLM 点子的「最小起步」偶有「做一个简单的导出工具，找 2 个用户测试使用」这类建议，与「找 3 个人试用」是同一类套话。这是 `data/idea.json` 里已有的 LLM 产出，本轮**未重生成 60 条点子**；前端已标注「起步动作只是建议、不是已验证结论」，但内容质量仍是已知限制（见第 9 节）。

验证：`209/209` 单测、`tsc` 0 错误、`build` 通过；浏览器 31（页面级）+ 20（双路径结果卡）+ 18（配额与交互）= 69 项逐项点过；线上 6 页 200、虚构承诺词扫描 0 命中；终稿截图逐张目视确认。代码经 REST `base_tree` 推送到远端 `main`，线上发布服务重启后自动加载新构建，sharecode 不变。

### 11.2 「对方原话」可读性改造（客户视角逐条读结果）

用户截图圈出结果卡「对方原话」是 `Can&#x27;t find an arxiv...` + `打开CSDN APP Copyright © 1999-2020, All Rights Reserved 阅读量 539 收藏 20 10赞 码龄6年`，并指出「你就是没有把自己当成产品经理和客户，仔细检查使用我的每一个功能」。此前几轮的浏览器回归只验了「有没有 quote 元素 / 有没有外链」，**从没验过 quote 是不是人话、是不是痛点**，这是真正的漏检。

以客户身份对 4 个方向逐条读结果，定位到 5 层叠加问题：

| 层 | 现象 | 根因 | 修复 |
| --- | --- | --- | --- |
| 1 | `Can&#x27;t`、`app&#x2F;website` 乱码 | `normalizeText()` 只解 5 个命名实体，不解十六进制/十进制数字实体；HN Algolia 的 `comment_text` 就是这种编码 | 补数字实体（十六进制→十进制）、常见命名实体解码，先摘 `<script>/<style>` 块；不二次解码 `&amp;#x27;` |
| 2 | 整页 CSDN 页脚被当成原话 | 实时检索 `buildSignals()` 直接 `r.text.slice(0,400)`，绕过采集管线的 `cleanExcerpt()` | 新增 `cleanQuote()`：从第一个网页样板标记处截断、去掉 markdown 表格/标题/加粗/纯 URL/末尾残破引导符，只留用户自己说的那句；`scoreRows` 与 `buildSignals` 都改用它，并把清洗后的文本回写 `text`，让喂给 LLM 的也是干净文本 |
| 3 | `Show HN: Omelo` 产品推销帖 | `NOISE_RE` 只拦招聘 | 拦 `Show HN / Launch HN / Product Hunt` 等发布帖 |
| 4 | `BUILD SUCCEEDED` 日志、`**Epic name:**`、`## User story / Done when`、`[Tool]` 工具征集、`please build me a doggy day care app` | 只要正文够长、命中一个检索词就进结果 | `TASK_DOC_RE` 拦明确的任务单结构标记（保留 `Problem: CSV 打不开通讯录` 这类真痛点）；`PLAN_DOC_RE` 拦「目标用户/核心痛点/适用企业」这类别人写好的产品企划 |
| 5 | PRD、功能提案、产品宣传仍占着「对方原话」 | 无痛点信号也照样出结果 | `REAL_PAIN_RE` + `extractSignals(quote, {consumerMode:true}).hasComplaint` 双重判定；没有痛点/求助信号就整条丢弃，让前端走诚实空态，不拿需求文档凑数。刻意不用 `painHits` 做闸门——它的 `\bissue\b` 会把「父 Issue 1」工单编号当成抱怨 |

另外把 HN 结果的 `url` 从 `story_url`（论文页/产品落地页，常带付费墙）改成 `news.ycombinator.com/item?id=...` 讨论页，兑现「点开原始讨论」。

客户视角 4 轮实测（同样 5 个方向，逐条读原话）的演进：

| 轮次 | 「导出通讯录」 | 「宠物店」 | 「论文里的专业表格」 |
| --- | --- | --- | --- |
| 修复前 | 混入中文 issue 模板 | `Show HN` 推销帖 | 乱码 + CSDN 页脚 + 论文标题（截图中的问题） |
| 第 1 轮（解实体+截样板） | 干净但仍有需求单 | 构建日志 / Epic / User story | 内容日历草稿 |
| 第 2 轮（任务单闸门） | 干净但仍有 PRD | 游戏设计文档 / GIS 方案 | 功能提案 |
| 第 4 轮（痛点闸门+企划闸门） | **5 条全是真人痛点/求助**（Facebook 导出、CSV 导出公式注入、「I'm always frustrated」） | 真人技术求助 | HN 新闻讨论（弱相关） |

**仍存在的限制（如实保留，未用规则硬凑）**：中文方向 → 英文检索词映射粗糙、`hits>=1` 就算相关，导致「论文里的专业表格」「发票导出」「宠物预约」仍会给出弱相关结果（学术出版讨论、SQL join 问题、智能机吐槽）；数据源是 HN / StackOverflow / GitHub Issues，天然以开发者内容为主，普通人赛道偏窄。这是数据源与相关性问题，不是文案或清洗规则能解决的，见第 9 节「治本」方向。

验证：`220/220` 单测（新增 11 项防回归：实体解码、样板截断、`Show HN`/任务单/企划/无痛点剔除、真痛点保留、`buildSignals` 双保险）、`tsc` 0 错误、`build` 通过；浏览器 13/13 逐项点过（截图方向 + 真人痛点方向，结果卡无乱码/样板/markdown 标记、外链可点、390px 无溢出、控制台 0 error），结果卡元素截图逐张目视确认。

## 12. 可决策机会简报 v3（产品经理视角的成体系重构）

用户明确指出「你就是没有把自己当成产品经理和客户」：结果卡点不开、看不懂「填报压力」这类抽象词、所谓点子是「做个最小 MVP 然后找 3 个人使用」这种万能废话，并要求「具体应用场景是什么、客户痛点到底是什么、从第一性原理看哪个点子能解决客户问题」，同时要求**跨行业博采众长**（UI 借鉴 A、交互借鉴 B、信息收集借鉴 C、信息整合输出参考 D、创新落地借鉴 F），「不要我说一个你再做一个」。本节记录的是成体系重构，不是逐点补丁。

### 12.1 病根诊断

产品把「别人的一条帖子」当成了交付物，而用户要的是「一个能判断值不值得动手的决定」。价值链断在：真实原话（证据）→ 谁在什么场景卡住 → 本质障碍 → 因此最小可造之物 → 怎么最快证伪 → 每步都能点回证据。旧结果卡只有原话和四段模板，中间四环全缺。

### 12.2 跨行业借鉴矩阵（不是口头参考，全部落到实现）

| 借鉴对象 | 借鉴什么 | 落到本项目的哪里 |
| --- | --- | --- |
| **A · UI**：Linear / Stripe / Notion | 卡片化、一屏一焦点、格式塔分组、克制、单一主按钮 | 结果卡答案优先，核心 3 段默认展开，其余折叠；`.rr-brief-row` 用左侧色条区分证据/推断/假设 |
| **B · 交互**：Perplexity + Typeform | claim 级内联引用、渐进深度、连续追问、教学式空态 | 每段 AI 推断带「对照原话核对 ↗」锚点；完整 8 段进 `<details>`；无简报时给 8 个判断框架问题而非「暂无点子」；`/api/brief` 做按需深度 |
| **C · 信息收集**：AnswerThePublic / Glimpse / 差评挖掘 | 按「抱怨 / 求助 / 想要」意图聚合，而非按技术赛道 | `scoreRows(..., {strict:true})` 收紧泛词弱命中，`consumerQa` 生活站提权 +8，实时检索站点扩到 `webapps/money/workplace/travel/pets` |
| **D · 信息整合输出**：投资 one-pager / 机会评估 memo | 问题、证据、为何现在、最便宜测试、**停止条件**，`[证据]/[假设]` 标注 | 8 段简报含 `test` / `stopIf` / `whyNow`；每段标注证据/推断/假设；验证清单一键复制 |
| **F · 方法论**：JTBD / 第一性原理 / 机会树 / Mom Test | `When… I want… so I can…`，拆到根本真理再重建解法 | `jobStory` 用 JTBD 句式；`rootObstacle` 要求剥掉表象；`build` 必须是消除该障碍的最小可造之物；`FILLER_RE` 拦万能套话 |

**创新点**：把 Perplexity 的 claim 级引用用在「机会判断」而非事实问答；把投资 memo 的**停止条件**引入灵感工具；验证清单可勾选/可复制。

### 12.3 数据模型 v3（`scripts/idea-core.mjs`）

`IDEA_VERSION` 升到 `3`，`Idea.brief` 为 8 段双语结构化简报：`jobStory` / `pain` / `workaround` / `rootObstacle` / `build` / `test` / `stopIf` / `whyNow`。旧四段 `headline / who / why / step` 从简报派生（首页 feed、今日点子、同类线索等既有调用点自动获得具体信息）。`templateIdea()` 改为 `brief: null`，不再冒充完整简报。`FILLER_RE` 硬闸门拦截「做个最小版本找 3 个人试用」「build an MVP」「市场规模」等套话与编造数字；`cleanBriefText()` 清理 `<具体用户>` 等 JTBD 占位符。`IDEA_SYSTEM_PROMPT` 要求模型以资深 PM 身份、仅依据给定原话生成，禁止编造市场规模 / 用户数 / 竞品 / 营收 / 百分比 / 时间性理由。

`scripts/idea.mjs` 的 `MAX_TOKENS` 提到 2600，`extractIdeaRecords()` 新增 `recoverBriefRecord()` 按字段逐段恢复 `hy-mt2-plus` 尾部漏引号的畸形输出。固定索引 60 条用真实 LLM 全量重生成：`60/60 origin=llm`、`60/60` 带 `brief`、`0` 套话。

### 12.4 缓存治本（本轮修的一个真根因）

上一轮只清理了 `data/opportunities.json` / `public/opportunities.json` 的占位符，但 **`data/idea.json` 缓存是在 `cleanBriefText()` 加入前写入的，仍含 24 处占位符**；而 `generateIdeas()` 缓存命中时直接 `out[i].idea = hit`，绕过了 `normalizeIdea()` → 下次 workflow 命中缓存就会把脏简报原封不动带回前端，变成「修一次又冒出来」的假修复。

修复：缓存命中统一走 `normalizeIdea(hit, item)`，让占位符清理 / 套话闸门 / 旧四段派生对缓存同样生效；清理后的结果写回缓存（自愈）；`origin` 回退成 `template` 的历史脏缓存重新生成。v2 旧四段缓存的 `pick()` 也共用 `cleanBriefText()`。补 2 项防回归单测（缓存占位符清理 + 不合格缓存重生成），并修复了改动引入的 v2 缓存兼容性回归。三个数据文件用同一套归一化一次性自愈，`0` 占位符、`60` 条 `llm`、`0` 降级，字段完整性经 git 版本逐项比对无损。

### 12.5 实时检索路径（`scripts/live-scan.mjs` + `scripts/connectors.mjs`）

`scoreRows(rows, terms, {strict:true})`：要求至少命中一个**实义词**（长度 ≥4 且不在 `GENERIC_TOKENS` 停用表，或中文 ≥2 字），挡掉「搜『专业表格』却因 `data` 命中一堆无关帖」；`consumerQa` 生活站加 8 分提到主路径；实时检索 `consumerQa` 站点从 3 个扩到 5 个。补 2 项单测（strict 拦泛词弱命中、生活站提权且非 strict 不受影响）。

### 12.6 按需深度 `/api/brief`（借鉴 Perplexity progressive depth）

主检索 `/api/scan` 有 25s 总超时且已叠加扩词 + 归纳两次 LLM 调用，再塞 8 段简报会超时并加剧 429。因此独立成 `POST /api/brief`：输入只有真实标题 + 真实原话（密钥只在服务端读取），IP 内存限流 60s 20 次，14s 超时，429 退避一次，`extractIdeaRecords()` + `normalizeBrief()` 过套话闸门，任何失败返回 `{brief:null}` 让前端保留判断框架（fail-open）。前端结果卡在无简报时给「生成完整简报」按钮，成功后把简报写回该条 `Signal.idea`。

### 12.7 结果卡 UI（`components/marketing/guest-scan.tsx` + `app/globals.css` + `lib/i18n.ts`）

答案优先（kicker + `build` 作为 headline + 提及数）→ 真实逐字原话 / 来源 / 原始链接（带 `evidenceId` 锚点）→ 有简报时默认展开核心 3 段、完整 8 段折叠、每段标证据/推断/假设、claim 级「对照原话核对 ↗」、验证清单可复制；无简报时不消极空话，给 8 个判断框架问题 + 按需生成按钮。原标题 / 趋势 / 信号 / 结构卡收进二级「更多细节」。三个追问改为「同类线索 / 再读原话 / 换个方向」。中英 `brief` 字典块一一对应。

### 12.8 全站文案与 GEO 对齐（消除「文案 vs 实现」不一致）

- 首页预览卡曾把字典里写死的 4 条 v2 标题标成「来自最近一次采集的四个真实点子」，数据一变就对不上。改为**构建时直接读 `data/opportunities.json`**，取提及数最高的 4 条 `idea.headline`（v3 派生自 `build`、已清洗、中英各一份），数据文件缺失时才回退字典示例。
- 首页 hero / stats / preview / steps / evidence、中英页面 metadata、`config.ts`、`lib/seo.tsx`（`SoftwareApplication.featureList`）、`lib/faq.ts`（页面正文与 `FAQPage` JSON-LD 共用）、中英 `/methodology`、`llms.txt`、`llms-full.txt` 全部改成「8 段可决策机会简报」定位，并如实说明 `/api/brief` 是内部接口而非对外 API 产品。
- 首页示例证据区改展示真实第一条简报的**场景 / 痛点 / 本质障碍 / 最小可造之物**，并明确标注原话是 GitHub issue 需求清单片段、8 段是 AI 推断、是判断起点而非已验证需求。

### 12.9 浏览器实测后追加的召回治理

用浏览器真跑实时检索时，仍撞上用户反复反馈的「搜 A 出一堆不相关」：搜「宠物店」返回 `pets.stackexchange.com` 的「怎么养懒猴」，搜「发票导出」返回 SQL join 与讨薪邮件。逐层打印管线中间产物后定位到 4 个叠加根因，都不是改文案能解决的：

1. **扩词结果被整批截掉（真 bug）**：`expandQuery()` 把 `base = [原文, ...词典泛词]` 放前面再 `slice(0, 3)`，base 本身就占满 3 个，LLM 扩出的具体英文短语（如 `invoice export failed`）全被丢弃 —— 等于白调一次模型，检索仍只用 `invoice` / `billing` 这类泛词。改为「原文 → LLM 具体短语 → 词典泛词兜底」，上限放宽到 5。修复后「预约改期」召回到真正相关的改期流程故障，「导出通讯录」召回到 `Contacts Export Feature`。
2. **模型没被要求显式判「是不是同一件事」**：改写中英归纳 prompt，要求每条输出 `relevant` 布尔值，并明确「方向说 A、记录讲 B，即使共享同一个泛词也算不相关」（举例：开店经营 vs 养野生动物）。`summarizeWithLlm()` 丢弃 `relevant:false`；模型没给该字段时 fail-open 保留，避免误杀。
3. **「全不相关」仍会通过规则降级把脏记录放回来**：原来归纳返回 `null` 就降级 `rules` 展示全部 scored。现在严格区分 `[]`（调用成功但全不相关）与 `null`（调用失败）：`[]` 时 `buildSignals()` 返回空、`runLiveScan()` 返回 `mode: no-evidence`，前端显示「没找到足够证据 / 本次没有消耗试用次数」，不再拿弱相关内容充数。
4. **Epic / P0 编号式需求规格被当成「对方逐字原话」**：实测「预约改期」第一条是 `P0 FREE AI 06: ... Parent epic: Deliverable ... cost boundaries` 的 PRD。`TASK_DOC_RE` 补 `^P\d+`、`Parent epic`、`Deliverable`、`cost boundaries`、JIRA 式编号等标记，保留真实痛点描述。

补 6 项防回归单测。真实 `/api/scan` 复测：有相关证据的方向（导出通讯录 / 预约改期）能出结果，没有的方向（发票导出 / 宠物店 / 露营装备租赁）给诚实空态，不再摆一条不相关的帖子。

### 12.10 验证

`240/240` 单测、`pnpm exec tsc --noEmit` 0 错误、`pnpm build` 通过；`/api/brief` 用真实 TokenHub 链路 5.2s 返回 8 段完整简报（无占位符、无套话）；浏览器逐项 **42/42 通过**（12 个中英页面文案、首页动态预览卡、固定索引结果卡的 8 段简报 / claim 级锚点 / 验证清单复制 / 三个追问、实时检索判断框架 + 真实点击「生成完整简报」、3 次配额 3→2→1→0、320/360/390px 无溢出、控制台 0 error）；15 个正常页 200、5 个坏页 307 → `/try`。

**仍如实保留的限制**：实时检索召回受公开源质量影响、波动较大，很多方向会落到诚实空态；中文→英文检索词映射仍粗糙、数据源天然偏开发者，普通人赛道偏窄；固定索引的简报是 LLM 基于单条公开记录做的推断，可能出错（正因如此才标注证据/推断/假设并允许点回原话核对）；模板 Creem 路由源码仍在仓库但用户不可达。
