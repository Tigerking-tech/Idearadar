# IdeaRadar

从真实用户抱怨中挖商机的 SaaS：采集公开讨论 → 聚类抱怨 → 0–100 证据评分 → 竞品短板地图 → 持续监控与告警。自己用，也对外开放订阅收费（Creem 作为 Merchant of Record）。

## 1. 模板来源

基底是 Creem 官方文档指定的开源模板：

- **armitage-labs/creem-template** — <https://github.com/armitage-labs/creem-template>（Next.js App Router + Prisma/SQLite + better-auth + shadcn/ui + `creem` SDK，MIT）
- 官方文档：<https://docs.creem.io/code/sdks/templates>
- 备选对照（未采用）：`jpr5/creem-saas-boilerplate`（Next 16 + Supabase，带 demo mode）、`pacekit/creembase`（Supabase + `@creem_io/nextjs` 验签 + Playwright e2e）

选官方模板的原因：Creem 接入链路完整且本地 SQLite 即可跑，不需要外部服务就能验证。本环境 `git clone` 到 github.com 超时，最终通过 `api.github.com/repos/.../tarball` 取回源码（这也是第 4 项要做 GitHub workflow 兜底的现实原因）。

**保留的支付链路**：`app/api/checkout/route.ts`、`app/api/customerPortal/route.ts`、`app/api/products/route.ts`、`app/api/subscription/cancel/route.ts`、`app/api/webhook/route.ts`、`lib/creem.ts`、`prisma/schema.prisma`。

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
```

`IDEARADAR_LIVE_FEED=1` 让 `/try` 读取真实采集产物而非演示数据；本地 `.env.local` 已开启。密钥（`IDEARADAR_TRANSLATE_TOKEN` 等）只放在 `.env.local` 或 GitHub Actions Secret，不入库。

## 3. Creem 配置

1. 在 Creem 后台开启 Test Mode，创建 API Key → `CREEM_API_KEY`。
2. 创建两个订阅产品（Pro / Team），把 Product ID 填入 `CREEM_PRODUCT_PRO` / `CREEM_PRODUCT_TEAM`。定价页 Pro / Team 按钮会自动创建 checkout 会话并跳转；未配置时降级到注册页，本地演示不会报错。免费版按钮不进支付链路，直接指向免注册试用页 `/try`（中文 `/zh/try`）。
3. 配置 Webhook 指向 `/api/webhook`，设置 `CREEM_WEBHOOK_SECRET`、`SUCCESS_URL`。
4. 上线前把 `NEXT_PUBLIC_SITE_URL` 改成真实域名。

> **上线前必办的安全项**：模板的 `app/api/webhook/route.ts` 未做签名校验（模板 README 明确写了 "not taking security into account"）。上线接收真实付款前，必须按 <https://docs.creem.io/webhooks> 用 `CREEM_WEBHOOK_SECRET` 校验签名头，并在写库前做幂等处理。本仓库保留模板原实现以便对照，未擅自猜测签名算法。

## 4. 页面结构

| 路径 | 内容 |
| --- | --- |
| `/` | 落地页：Hero / 数据条 / 实时采集预览 / 三步流程 / 示例证据链 / 对比 + ROI 计算器 / 数据源合规 / 定价 / FAQ / 底部 CTA |
| `/try`、`/zh/try` | 免注册试用页：不登录先免费扫 3 次（localStorage 记在本机，中英共用）；零输入发现流（实时信号卡、方向卡、快捷词、随机方向）；本地强命中秒出，弱/无命中走 `/api/scan` 按需实时检索；结果含证据评分、逐字原话、来源、竞品空白、可折叠八维机会卡、外部搜索热度；无结果/失败/证据不足不扣次数；3 次用完引导注册或对比套餐 |
| `/pricing` | 独立定价页（SEO 落地页） |
| `/methodology` | GEO 语义页：评分模型、术语定义、数据源合规、Reddit 政策时间线、workflow 说明 |
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
- `app/sitemap.ts` 六个公开页面、`app/robots.ts` 站点规则与 sitemap/host
- 结构化数据（`@graph`）：`Organization`、`WebSite`、`SoftwareApplication`；首页/FAQ 页注入 `FAQPage`；子页注入 `BreadcrumbList`
- 自托管 Inter 字体 + 自有 `public/og.png`，无外部字体请求，不拖慢 LCP
- 全部营销页为服务端组件，正文进入初始 HTML；每页单一 `<h1>`，语义化 `<h2>/<h3>/<table>/<details>`
- FAQ 可见文字与 `FAQPage` JSON-LD 共用 `lib/faq.ts` 单一事实源

**GPT / Claude / Perplexity 等 LLM**

- `/llms.txt`（站点索引）+ `/llms-full.txt`（完整事实上下文：评分权重表、数据源清单、Reddit 时间线、定价表、FAQ）
- `robots.txt` 显式放行 `GPTBot`、`OAI-SearchBot`、`ChatGPT-User`、`ClaudeBot`、`anthropic-ai`、`PerplexityBot`、`Google-Extended`、`Applebot-Extended`、`CCBot`、`cohere-ai`、`YouBot`
- `<link rel="alternate" type="text/plain" href="/llms.txt">` 声明
- 事实性、可整段引用的正文（`/methodology`），示例数据一律标注 illustrative，避免 LLM 引用虚构数字

## 6. 自动采集 workflow

文件：`.github/workflows/ingest.yml` + `scripts/ingest.mjs` + `scripts/ingest-lib.mjs` + `scripts/ingest.config.json`。

- 定时：每 6 小时在 GitHub 托管 runner 上运行；也支持 `workflow_dispatch` 手动触发。
- 流程：`node --test scripts/*.test.mjs` 全量单测 → recall 评估 → cooldown → 多源采集 → TokenHub `hy-mt2-plus` 批量翻译 → Google Trends 外部热度 → 高频扫描方向提升（带准入闸门）→ 上传 artifact → 有变化时把数据产物提交回仓库（bot 提交带 `[skip ci]`，不会触发递归构建）。
- 有则提交的数据产物：`data/opportunities.json`、`public/opportunities.json`、`data/history.json`、`data/recall-eval.json`、`data/rejected.json`、`data/external-heat.json`、`public/external-heat.json`、`data/query-scans.json`、`data/scan-candidates.json`。后两者是运行时产物，仓库初始可以没有。
- 纯函数评分层（`ingest-lib.mjs`）：频率 30% / 强度 20% / 近期性 15% / 跨源印证 20% / 显式付费意愿 15%，规则显式、可单测、可复现。
- **默认启用的合规源**：Hacker News 官方 API、Stack Exchange 官方 API、GitHub Issues 公开 API、可配置 RSS/Atom、第一方数据导入。
- **Reddit 默认关闭**：`ENABLE_REDDIT=false`。只有持有 Reddit 商业数据授权并配置 `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` 时才启用。Reddit 用户协议禁止未授权商业抓取。2026-10-31 起不再受理新的公开 API 申请，2027-01-12 起撤销未登记应用的权限，2027 年 3 月公开 Data API 全面终止；此后官方路径只剩与 Reddit 签商业数据协议，或迁入 Devvit（代码须运行在 Reddit 基础设施上、由 Reddit 决定开放哪些接口，做不了跨平台聚合的独立订阅产品）。
- **第三方抓取服务商不是「授权数据源」**：Apify、Bright Data、Anysite 售卖的是「代取公开页面数据」的服务，不是源平台的授权。Apify 自家 Reddit 抓取器页面明确声明未获 Reddit 授权或认证、不隶属于 Reddit，靠住宅代理 IP 轮换读取未登录访客可见页面。付费购买取数服务不等于取得平台的权利许可——服务商通过合同把 ToS 合规责任与数据控制者责任转移给使用方。Reddit 2026-09-30 公告正是以「大规模抓取与自动化滥用、AI 训练数据采集」为由分阶段关闭 RSS 与公开 API，并已于 2025 年起诉 Anthropic、Perplexity 及多家抓取服务商。因此本项目不把此类服务列为合规源；仅用于自用研究时，须放在独立、默认关闭的适配器内并显式标注「未授权抓取、风险自担」，不得作为对外收费产品的主数据源。
- **补充源的接入优先级**：第一方数据（客服工单、调研导出，零平台合规风险且竞品无法复制）→ 官方开放 API（HN、Stack Exchange、GitHub Issues、YouTube Data、News/GDELT）→ 需商业谈判（Reddit 商业数据协议；X 官方 API 免费档几乎不含读取额度、付费读取按次计费）→ 不接入（平台条款明确禁止自动化访问者，如 Amazon 评论，完整评论已移至登录墙后）。
- 本地网络受限不影响采集：任务跑在 GitHub runner 上；这也是上层「多源 + 数据自治」结论的工程落地。

推送到 GitHub 后，Actions 会自动开始抓取。**当前环境状态**：`git clone`/`git push` 到 `github.com` 超时，但 `api.github.com` 与 `codeload.github.com` 可达，因此推送走 GitHub REST API 通道（需要仓库写权限 token）。仓库文件已全部就位，拿到 token 后即可推送并启用 workflow；也可在任意可访问 github.com 的机器上 `git remote add origin && git push`。

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

## 8. 验证记录

| 项 | 结果 |
| --- | --- |
| `node --test scripts/*.test.mjs` | 11 个测试文件，160/160 通过 |
| `pnpm exec tsc --noEmit` | 0 类型错误 |
| `pnpm build` | 通过，29 个路由正常构建 |
| `IDEARADAR_PROMOTE_PROBE=0 node scripts/promote-niches.mjs` | `added=0 gate=true`，零产出 auto 赛道不再被加回 |
| 快速证据通道（真实 `/api/scan` 候选数据、临时目录） | 有证据 `added=1 / via=evidence / probeCalls=0`；无证据 `added=0 / via=no-evidence` |
| `POST /api/scan` | 200，`mode=llm`、score 75 高分候选、`entitlement={enabled:false,tier:guest}` |
| 浏览器逐项回归（`/try` 与 `/zh/try`） | 方向卡、快捷词、随机、手动输入回车、查看原文切换、机会卡展开、3 次配额与耗尽引导、320/360/390px 窄屏，全部通过；控制台 0 error 0 warning |

采集结果接入首页「Live preview」的**统计脚注**（候选条数、数据源、更新日期），并链接到 `/opportunities.json` 供查看原始数据：GitHub Actions 每次刷新 JSON，重新部署后脚注数字随之变化，形成「自动抓取 → 网站」闭环。

**中文标题与逐字原话来自采集端批量 AI 翻译**（TokenHub `hy-mt2-plus`，`response_format: json_object`），前端 SSR 直接输出中文 HTML，可点「查看原文」核对英文原文。翻译失败或 429 只 warn、不阻塞采集，此时保留英文原文。这是与早期「格式示意数据」版本的本质区别。

## 9. 已知限制

- 模板 webhook 未验签（见第 3 节），接入真实收款前必须补齐。
- 采集评分是启发式规则，输出是「候选机会」而非结论。
- **真实采集产物仍含新闻/工单噪声**（例如服务中断新闻、GitHub issue 模板、开发工单标题被词面命中归入赛道）。`scripts/curation.json` 的 `excludeTerms` 目前只覆盖少量明显 fad 词，需要按周复核 `data/rejected.json` 与线上结果持续人工扩充；这是当前相关度的主要短板，不是代码缺陷。
- 采集层已过滤新闻标题、发行公告、CI 日志、多语言 issue，并按词边界截断标题；规则集中在 `ingest-lib.mjs` 的 `NOISE_TITLE_RULES`。
- `better-auth` 与 Prisma 使用模板默认配置，生产环境应换成 Postgres 并配置迁移。
- 若部署到 Vercel Serverless，本地文件写入不持久：必须配 `IDEARADAR_STORE_URL` 走远端 REST，否则方向记录与候选证据每次请求都会丢。
- 计费 / 权益默认关闭（`IDEARADAR_BILLING_ENABLED` 未设），`/api/scan` 一律按 guest 20 次/10 分钟处理。
- Google Trends RSS 在部分网络（含本沙箱）不可达，此时外部热度 `status: unavailable`，前端不渲染热度行；这是设计内的诚实降级，不是故障。
- `data/scan-candidates.json` 由 `/api/scan` 在检出 score ≥ 55 候选时才生成，仓库初始可不含该文件。
- 站点域名 `idearadar.app` 为占位，上线前替换 `NEXT_PUBLIC_SITE_URL` 与 `public/llms*.txt` 中的绝对链接。
- 根布局为单一 root layout，`<html lang>` 固定为 `en`；中文页在容器上带 `lang="zh-CN"`，并另有中文 title / description / canonical / hreflang / `og:locale=zh_CN` / 中文 FAQPage 结构化数据。若要让 `<html lang>` 也随语言变化，需重构为双 root layout（route groups），会改动全部现有路由，当前未做。

## 10. 中英文双语

- **六对独立静态页**：`/`↔`/zh`、`/pricing`↔`/zh/pricing`、`/faq`↔`/zh/faq`、`/methodology`↔`/zh/methodology`、`/privacy`↔`/zh/privacy`、`/terms`↔`/zh/terms`，全部在构建时预渲染，正文直接出现在初始 HTML 中。语言切换用真实 `<a>` 链接而非前端文案替换，中文内容因此可被 Google 与 LLM 抓取；切换器停留在**同一页面的另一语言**，不会跳回首页。
- **单一事实源**：`lib/i18n.ts` 的 `EN_DICT` / `ZH_DICT` 覆盖首页全部区块、导航、页脚、公告条、交互组件、定价与 FAQ 文案，以及机会卡八维、外部热度、会员额度标签；组件默认取 `EN_DICT`，英文页零改动。中文 FAQ 在 `lib/faq.ts` 的 `FAQ_ITEMS_ZH`，与 FAQPage 结构化数据共用。Methodology／Privacy／Terms 的正文在各自 `/zh/*/page.tsx` 内，同为服务端静态渲染。
- **SEO / GEO**：每对页面互指 `hreflang`（`en-US` / `zh-CN` / `x-default`），`sitemap.xml` 为 12 条 URL 全部输出 hreflang，`llms.txt` 与 `llms-full.txt` 列出全部中文页。
- **中文站零英文正文**：产品名在中文页渲染为「创意雷达 / IdeaRadar」，技术术语（Creem、Reddit、API、CSV、MCP、GitHub 等）保留原文，其余叙述全部中文化；不再有「（English）」标注。
- `<html lang>` 仍固定为 `en`（见第 9 节），中文页容器带 `lang="zh-CN"` 且中文 metadata／hreflang／OG locale／FAQPage 齐全。
- **线上与本地**：两者共用 `/workspace/rantradar` 的 `.next` 构建产物；`pnpm build` 后必须重启 3000 端口的发布服务（发布技能的 autostart 带 `restart:true`，或直接重跑 `publish.js`）才能让线上加载新构建，否则新路由会 500、旧页面仍是旧内容。链接与 sharecode 在重新发布后保持不变。
