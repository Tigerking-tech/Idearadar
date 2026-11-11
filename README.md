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
pnpm build          # 生产构建
pnpm test:ingest    # 采集评分纯函数单测
pnpm ingest         # 手动跑一次多源采集
```

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
| `/try`、`/zh/try` | 免注册试用页：不登录先免费扫 3 次，输入细分市场 → 关键词检索排序 → 输出评分卡（证据分 / 逐字原话 / 来源 / 竞品空白）；3 次额度用 localStorage 记在本机，中英共用，用完引导注册。结果为本地化演示数据集，页面已明确标注 |
| `/pricing` | 独立定价页（SEO 落地页） |
| `/methodology` | GEO 语义页：评分模型、术语定义、数据源合规、Reddit 政策时间线、workflow 说明 |
| `/faq` | FAQ 独立页 |
| `/privacy`、`/terms` | 法务页 |
| `/sitemap.xml`、`/robots.txt` | 动态生成 |
| `/llms.txt`、`/llms-full.txt` | LLM 可读站点索引与完整上下文 |
| `/opportunities.json` | 采集产物（前端可读） |

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
- 流程：先跑 `node --test scripts/ingest.test.mjs` 单测 → 再跑采集 → 上传 artifact → 有变化时把 `data/opportunities.json` 与 `public/opportunities.json` 提交回仓库。
- 纯函数评分层（`ingest-lib.mjs`）：频率 30% / 强度 20% / 近期性 15% / 跨源印证 20% / 显式付费意愿 15%，规则显式、可单测、可复现。
- **默认启用的合规源**：Hacker News 官方 API、Stack Exchange 官方 API、GitHub Issues 公开 API、可配置 RSS/Atom、第一方数据导入。
- **Reddit 默认关闭**：`ENABLE_REDDIT=false`。只有持有 Reddit 商业数据授权并配置 `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` 时才启用。Reddit 用户协议禁止未授权商业抓取。2026-10-31 起不再受理新的公开 API 申请，2027-01-12 起撤销未登记应用的权限，2027 年 3 月公开 Data API 全面终止；此后官方路径只剩与 Reddit 签商业数据协议，或迁入 Devvit（代码须运行在 Reddit 基础设施上、由 Reddit 决定开放哪些接口，做不了跨平台聚合的独立订阅产品）。
- **第三方抓取服务商不是「授权数据源」**：Apify、Bright Data、Anysite 售卖的是「代取公开页面数据」的服务，不是源平台的授权。Apify 自家 Reddit 抓取器页面明确声明未获 Reddit 授权或认证、不隶属于 Reddit，靠住宅代理 IP 轮换读取未登录访客可见页面。付费购买取数服务不等于取得平台的权利许可——服务商通过合同把 ToS 合规责任与数据控制者责任转移给使用方。Reddit 2026-09-30 公告正是以「大规模抓取与自动化滥用、AI 训练数据采集」为由分阶段关闭 RSS 与公开 API，并已于 2025 年起诉 Anthropic、Perplexity 及多家抓取服务商。因此本项目不把此类服务列为合规源；仅用于自用研究时，须放在独立、默认关闭的适配器内并显式标注「未授权抓取、风险自担」，不得作为对外收费产品的主数据源。
- **补充源的接入优先级**：第一方数据（客服工单、调研导出，零平台合规风险且竞品无法复制）→ 官方开放 API（HN、Stack Exchange、GitHub Issues、YouTube Data、News/GDELT）→ 需商业谈判（Reddit 商业数据协议；X 官方 API 免费档几乎不含读取额度、付费读取按次计费）→ 不接入（平台条款明确禁止自动化访问者，如 Amazon 评论，完整评论已移至登录墙后）。
- 本地网络受限不影响采集：任务跑在 GitHub runner 上；这也是上层「多源 + 数据自治」结论的工程落地。

推送到 GitHub 后，Actions 会自动开始抓取。**当前环境状态**：`git clone`/`git push` 到 `github.com` 超时，但 `api.github.com` 与 `codeload.github.com` 可达，因此推送走 GitHub REST API 通道（需要仓库写权限 token）。仓库文件已全部就位，拿到 token 后即可推送并启用 workflow；也可在任意可访问 github.com 的机器上 `git remote add origin && git push`。

## 7. 验证记录

| 项 | 结果 |
| --- | --- |
| `node --test scripts/ingest.test.mjs` | 9/9 通过 |
| TypeScript 解析器全量语法扫描 | 76 个 ts/tsx 文件，0 语法错误 |
| `pnpm exec tsc --noEmit` | 0 类型错误 |
| `pnpm build` | 通过，29 个页面静态预渲染 |
| 生产服务探活与抓取端点 | 全部 200 |
| 采集实跑（`INGEST_QUERY_LIMIT=1`） | 135 条原始记录 → 37 条抱怨 → 27 条候选，产物写入 `data/opportunities.json` |

采集结果接入首页「Live preview」的**统计脚注**（候选条数、数据源、更新日期），并链接到 `/opportunities.json` 供查看原始数据：GitHub Actions 每次刷新 JSON，重新部署后脚注数字随之变化，形成「自动抓取 → 网站」闭环。

**卡片里的 4 条评分条目是各语言自带的格式示意，不是采集原文**。原因：采集源以英文社区为主，原始标题放进中文页会破坏语言一致性；且原始 issue／新闻标题含多语言正文、工单噪声，硬截断会出现半个单词。营销页展示未经复核的原文反而降低可信度，因此竞品亦普遍用示意数据。真实采集输出只以可核查的数字与 JSON 端点呈现。

## 8. 已知限制

- 模板 webhook 未验签（见第 3 节），接入真实收款前必须补齐。
- 采集评分是启发式规则，输出是「候选机会」而非结论；`/opportunities.json` 为自动生成的待复核候选，包含原始数据标题（英文社区原文），不适合直接用于营销展示。
- 采集层已过滤新闻标题、发行公告、CI 日志、开发工单与多语言 issue，并按词边界截断标题；规则集中在 `ingest-lib.mjs` 的 `NOISE_TITLE_RULES`，由 14 条单测覆盖。
- `better-auth` 与 Prisma 使用模板默认配置，生产环境应换成 Postgres 并配置迁移。
- 站点域名 `idearadar.app` 为占位，上线前替换 `NEXT_PUBLIC_SITE_URL` 与 `public/llms*.txt` 中的绝对链接。
- 根布局为单一 root layout，`<html lang>` 固定为 `en`；中文页在容器上带 `lang="zh-CN"`，并另有中文 title / description / canonical / hreflang / `og:locale=zh_CN` / 中文 FAQPage 结构化数据。若要让 `<html lang>` 也随语言变化，需重构为双 root layout（route groups），会改动全部现有路由，当前未做。

## 9. 中英文双语

- **六对独立静态页**：`/`↔`/zh`、`/pricing`↔`/zh/pricing`、`/faq`↔`/zh/faq`、`/methodology`↔`/zh/methodology`、`/privacy`↔`/zh/privacy`、`/terms`↔`/zh/terms`，全部在构建时预渲染，正文直接出现在初始 HTML 中。语言切换用真实 `<a>` 链接而非前端文案替换，中文内容因此可被 Google 与 LLM 抓取；切换器停留在**同一页面的另一语言**，不会跳回首页。
- **单一事实源**：`lib/i18n.ts` 的 `EN_DICT` / `ZH_DICT` 覆盖首页全部区块、导航、页脚、公告条、交互组件、定价与 FAQ 文案；组件默认取 `EN_DICT`，英文页零改动。中文 FAQ 在 `lib/faq.ts` 的 `FAQ_ITEMS_ZH`，与 FAQPage 结构化数据共用。 Methodology／Privacy／Terms 的正文在各自 `/zh/*/page.tsx` 内，同为服务端静态渲染。
- **SEO / GEO**：每对页面互指 `hreflang`（`en-US` / `zh-CN` / `x-default`），`sitemap.xml` 为 12 条 URL 全部输出 hreflang，`llms.txt` 与 `llms-full.txt` 列出全部中文页。
- **中文站零英文正文**：产品名在中文页渲染为「创意雷达 / IdeaRadar」，技术术语（Creem、Reddit、API、CSV、MCP、GitHub 等）保留原文，其余叙述全部中文化；不再有「（English）」标注，也不再把英文采集原文铺到中文页。
- `<html lang>` 仍固定为 `en`（见第 8 节），中文页容器带 `lang="zh-CN"` 且中文 metadata／hreflang／OG locale／FAQPage 齐全。
- **线上与本地**：两者共用 `/workspace/rantradar` 的 `.next` 构建产物；`pnpm build` 后必须重启 3000 端口的发布服务（发布技能的 autostart 带 `restart:true`，或直接重跑 `publish.js`）才能让线上加载新构建，否则新路由会 500、旧页面仍是旧内容。链接与 sharecode 在重新发布后保持不变。
