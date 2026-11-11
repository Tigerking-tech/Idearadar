# IdeaRadar — 像素级对标设计规范

> 复刻的是**布局、栅格、字号层级、配色体系、组件形态与交互流程**这些通用设计语言；
> 品牌名、Logo（自绘 SVG）、全部文案、示例数据均为自有内容。未使用任何竞品素材图、Logo 或复制其文案。

## 1. 对标对象

| 角色 | 产品 | 取其什么 |
| --- | --- | --- |
| 主对标 | PainPointMap | 首屏信息架构、紫蓝渐变公告条、居中超粗双行标题、双 CTA、三列数据条、Without/With 对比、三档定价、FAQ |
| 次对标 | PainOnSocial | 极浅网格底、左对齐超大标题＋渐变强调词、右侧「扫描结果」评分条卡片、顶部细导航＋黑色 CTA 的密度 |
| 产品差异层 | BigIdeasDB / DDMarketer | 证据链展示（原文引用、来源链接、跨平台印证数）、竞品短板地图、质量闸门说明 |
| 商业模式层 | Octolens | 持续监控 + 告警 + API/MCP 的表达，而非「一次性点子清单」 |

参考截图存档于构建时的临时目录，不进入仓库（避免再分发竞品页面）。

## 2. 设计 Token

| Token | 值 | 用途 |
| --- | --- | --- |
| `--rr-indigo` | `#5b4bf5` | 主色、按钮、进度条、强调 |
| `--rr-indigo-dark` | `#4a3ade` | 主按钮 hover |
| `--rr-violet` | `#a855f7` | 渐变终点、标题渐变 |
| `--rr-ink` | `#0b0b12` | 标题正文 |
| `--rr-slate` | `#5c6273` | 副文案 |
| `--rr-muted` | `#8b90a0` | 标签、脚注 |
| `--rr-line` | `#e8e9f0` | 描边、分隔线 |
| `--rr-soft` | `#f3f2ff` | 浅色标签底 |
| 渐变公告条 | `#4f46e5 → #6d4bf6 → #a855f7` | 顶部 38px 条 |
| 标题渐变 | `#5b4bf5 → #8b5cf6 → #a855f7` | `background-clip: text` |
| 字体 | Inter 可变字重 400–900（自托管 `/fonts/inter-latin.woff2`） | 全站 |
| 标题 | `clamp(42px,6vw,76px)` / 800 / `-0.05em` / `1.04` | Hero H1 |
| 区块标题 | `clamp(30px,3.6vw,44px)` / 800 / `-0.04em` | H2 |
| 正文 | 18px / 1.7 | Hero 副文案 |
| 圆角 | 卡片 14px，按钮 10px，胶囊 999px | 全站 |
| 主按钮阴影 | `0 8px 22px rgba(91,75,245,.26)` | CTA |
| 容器 | `max-width:1200px`，左右 24px | 全站 |
| 区块间距 | 88px（移动端 64px） | Section |

## 3. 首屏逐块对照

| 序 | 竞品区块 | 本项目实现 | 文件 |
| --- | --- | --- | --- |
| 1 | 渐变公告条（文案＋白色小 CTA＋关闭） | `AnnouncementBar`，可关闭 | `interactive.tsx` |
| 2 | Sticky 白底导航（左 Logo／中链接／右 CTA） | `SiteHeader` + 自绘雷达 Logo | `chrome.tsx` |
| 3 | 小胶囊标签 | `rr-eyebrow` | `sections.tsx` |
| 4 | 居中超粗双行标题，第二行紫蓝渐变 | `Hero` | `sections.tsx` |
| 5 | 灰色副文案 + 主/次双按钮 | `Hero` | `sections.tsx` |
| 6 | 三列大数字统计条 | `StatsBar`（数字均为可验证的产品事实，不编造社会证明） | `sections.tsx` |
| 7 | 网格底 + 左对齐巨标题 + 右侧评分条卡片 | `LivePreview`，评分条数据来自定时采集的真实 JSON | `sections.tsx` |
| 8 | How it works 三步卡片 | `HowItWorks` | `sections.tsx` |
| 9 | 示例输出 / 竞品地图卡片 | `EvidenceSection` | `sections.tsx` |
| 10 | Without / With 对比 | `ComparisonSection` | `sections.tsx` |
| 11 | ROI 滑块 | `RoiCalculator` | `interactive.tsx` |
| 12 | 数据源合规网格 | `DataSourcesSection`（差异化层） | `sections.tsx` |
| 13 | 三档定价，中间高亮 + Most popular 徽章 | `PricingSection` | `sections.tsx` |
| 14 | FAQ 折叠 | `FaqSection`，原生 `<details>` 无需 JS 即可抓取 | `sections.tsx` |
| 15 | 渐变底部 CTA | `FinalCta` | `sections.tsx` |
| 16 | 四列页脚 | `SiteFooter` | `chrome.tsx` |

## 4. 交互清单

| 交互 | 实现 | 是否依赖客户端 JS |
| --- | --- | --- |
| 关闭顶部公告条 | `useState` | 是 |
| 移动端汉堡菜单 | `useState` | 是 |
| ROI 双滑块实时计算 | `useState`，纯函数计算 | 是 |
| FAQ 展开/收起 | 原生 `<details>` | 否（爬虫可读） |
| 订阅按钮 | 有 Creem 产品 ID 时 `fetch /api/checkout` 后跳转；未配置时降级到注册页 | 是 |
| 锚点导航 | 原生 `#id` + `scroll-behavior: smooth` | 否 |
| 卡片 hover 抬升 | CSS transition | 否 |

## 5. 可抓取性约束（与 SEO/GEO 的交叉）

- 首页为服务端组件，全部正文进入初始 HTML；客户端组件仍会预渲染初始内容。
- 每页仅一个 `<h1>`，区块用 `<h2>`，卡片用 `<h3>`。
- FAQ 可见文本与 `FAQPage` 结构化数据共用 `lib/faq.ts` 单一事实源。
- 示例数据一律显式标注 illustrative / sample，实时采集数据标注来源与更新时间。
- 设计 token 全部集中在 `app/globals.css`；切换到另一竞品视觉只需替换该文件。
