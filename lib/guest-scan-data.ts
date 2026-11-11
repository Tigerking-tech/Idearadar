/**
 * 免注册试用（Guest Scan）的本地化示意数据集。
 *
 * 为什么不用 public/opportunities.json 的原文：
 * 1. 真实采集源以英文社区为主，把原文标题铺到中文页会破坏语言一致性（此前已被明确指出）；
 * 2. 原始 issue 标题常含编号、截断半个词、多语言正文等噪声，不适合直接给访客看；
 * 3. 这一步是「转化前的零门槛体验」，要展示的是产品输出格式，而不是未经复核的原始数据。
 *
 * 因此每种语言各有一套逐条对应的示意结论，关键词检索/排序是真实逻辑：
 * 访客输入不同细分市场会得到不同结果。真实采集的统计（条数/来源/更新日期）
 * 单独在页面脚注展示，并链到 /opportunities.json，闭环仍然保留。
 *
 * tags 同时放中英关键词，使中英文输入都能命中同一条结论。
 */

export type GuestItem = {
  id: string;
  title: string;
  score: number;
  mentions: number;
  sources: string[];
  quote: string;
  gap: string;
  tags: string[];
};

const TAGS: Record<string, string[]> = {
  crm: ["crm", "solo", "founder", "sales", "pipeline", "独立创业者", "客户关系", "销售", "线索"],
  invoice: ["invoice", "export", "csv", "accounting", "billing", "发票", "导出", "报销", "多币种", "财务"],
  support: ["support", "chat", "transcript", "helpdesk", "ticket", "客服", "聊天记录", "工单", "对话"],
  booking: ["booking", "appointment", "recurring", "calendar", "schedule", "预约", "日程", "重复预约", "排期"],
  project: ["project", "kanban", "offline", "board", "task", "项目管理", "看板", "离线", "任务"],
  password: ["password", "sync", "vault", "device", "密码", "同步", "密码管理器", "多设备"],
  email: ["email", "search", "inbox", "mail", "邮件", "搜索", "收件箱"],
  form: ["form", "conditional", "survey", "builder", "表单", "问卷", "条件逻辑"],
  analytics: ["analytics", "tracking", "event", "metrics", "埋点", "数据分析", "指标", "事件"],
  knowledge: ["knowledge", "wiki", "docs", "search", "知识库", "文档", "搜索", "wiki"],
  checkout: ["checkout", "ecommerce", "address", "payment", "cart", "结账", "电商", "地址", "支付"],
  ci: ["ci", "build", "log", "debug", "pipeline", "构建", "日志", "调试", "流水线"],
};

export const GUEST_ITEMS_EN: GuestItem[] = [
  {
    id: "crm",
    title: "CRM tools are too complex for solo founders",
    score: 92,
    mentions: 47,
    sources: ["Hacker News", "GitHub Issues"],
    quote: "I just need to track 20 leads, not configure a 200-field enterprise instance.",
    gap: "Free tiers gate the fields solo users need; setup wizards assume a sales team.",
    tags: TAGS.crm,
  },
  {
    id: "invoice",
    title: "Multi-currency invoices keep breaking exports",
    score: 87,
    mentions: 31,
    sources: ["GitHub Issues", "Stack Exchange"],
    quote: "Every month I hand-fix the CSV before it reaches our accountant. One currency is always wrong.",
    gap: "Existing tools export a single currency correctly but silently drop the rest.",
    tags: TAGS.invoice,
  },
  {
    id: "support",
    title: "No clean way to export support chat transcripts",
    score: 81,
    mentions: 24,
    sources: ["GitHub Issues", "RSS"],
    quote: "The widget shows the whole conversation but the export only gives me the first message.",
    gap: "Transcript export is either missing, paid-only, or truncated to the first reply.",
    tags: TAGS.support,
  },
  {
    id: "booking",
    title: "Booking tools lose recurring appointments",
    score: 74,
    mentions: 19,
    sources: ["GitHub Issues", "Hacker News"],
    quote: "A client books every Tuesday for a year and the system creates one slot, then forgets the rest.",
    gap: "Recurring rules exist but break on reschedules, holidays and timezone changes.",
    tags: TAGS.booking,
  },
  {
    id: "checkout",
    title: "Checkout rejects valid international addresses",
    score: 78,
    mentions: 22,
    sources: ["GitHub Issues", "Stack Exchange"],
    quote: "Our address has no postcode. The form refuses it, so we simply cannot place the order.",
    gap: "Address validation assumes a US/UK format and offers no manual fallback.",
    tags: TAGS.checkout,
  },
  {
    id: "email",
    title: "Search inside a large mailbox is unusably slow",
    score: 71,
    mentions: 17,
    sources: ["Hacker News", "RSS"],
    quote: "Finding one thread from last quarter takes longer than re-writing the answer from memory.",
    gap: "Fast clients lack good search; tools with good search are enterprise-priced.",
    tags: TAGS.email,
  },
  {
    id: "project",
    title: "Project boards stop working without a connection",
    score: 69,
    mentions: 15,
    sources: ["GitHub Issues", "Hacker News"],
    quote: "On a flight I cannot even move a card. It is a web page pretending to be an app.",
    gap: "Offline mode is a roadmap item on most boards; the few that have it do not sync cleanly.",
    tags: TAGS.project,
  },
  {
    id: "password",
    title: "Password vaults conflict across devices",
    score: 66,
    mentions: 14,
    sources: ["Stack Exchange", "GitHub Issues"],
    quote: "It silently kept two versions of the same entry and I locked myself out of the newer one.",
    gap: "Sync resolves conflicts by last-write-wins with no visible history or merge.",
    tags: TAGS.password,
  },
  {
    id: "form",
    title: "Form builders cannot express simple conditional logic",
    score: 63,
    mentions: 12,
    sources: ["GitHub Issues", "RSS"],
    quote: "Showing one extra question based on an answer requires the enterprise plan.",
    gap: "Conditional branching is gated behind the highest tier even for two-field forms.",
    tags: TAGS.form,
  },
  {
    id: "analytics",
    title: "Analytics events become impossible to maintain",
    score: 76,
    mentions: 20,
    sources: ["Hacker News", "GitHub Issues"],
    quote: "Nobody knows what `checkout_v3_final` means, but deleting it might break a dashboard.",
    gap: "No schema ownership, no deprecation path, no link between an event and its dashboard.",
    tags: TAGS.analytics,
  },
  {
    id: "knowledge",
    title: "Team knowledge bases cannot find their own docs",
    score: 73,
    mentions: 18,
    sources: ["Hacker News", "Stack Exchange"],
    quote: "I know the page exists. I wrote it. Search still returns everything except it.",
    gap: "Search ranks by recency instead of title/owner, and duplicates are never merged.",
    tags: TAGS.knowledge,
  },
  {
    id: "ci",
    title: "CI logs bury the one line that explains a failure",
    score: 80,
    mentions: 26,
    sources: ["GitHub Issues", "Stack Exchange"],
    quote: "Ten thousand lines of setup output and the actual error is a single line in the middle.",
    gap: "Log viewers offer grep but no automatic error extraction or failure clustering.",
    tags: TAGS.ci,
  },
];

export const GUEST_ITEMS_ZH: GuestItem[] = [
  {
    id: "crm",
    title: "独立创业者觉得 CRM 配置太复杂",
    score: 92,
    mentions: 47,
    sources: ["Hacker News", "GitHub Issues"],
    quote: "我只是想跟踪 20 条线索，不是要配置一个 200 字段的企业级系统。",
    gap: "免费版把独立用户最需要的字段锁住；配置向导默认你有一支销售团队。",
    tags: TAGS.crm,
  },
  {
    id: "invoice",
    title: "多币种发票导出总是出错",
    score: 87,
    mentions: 31,
    sources: ["GitHub Issues", "Stack Exchange"],
    quote: "每个月我都得手工改一遍 CSV 再交给会计，总有一种币种是错的。",
    gap: "现有工具能正确导出单一币种，其余币种会被静默丢掉。",
    tags: TAGS.invoice,
  },
  {
    id: "support",
    title: "客服聊天记录没有干净的导出方式",
    score: 81,
    mentions: 24,
    sources: ["GitHub Issues", "RSS"],
    quote: "组件里能看到完整对话，导出来却只有第一条消息。",
    gap: "对话导出要么没有、要么要付费、要么只导出首次回复。",
    tags: TAGS.support,
  },
  {
    id: "booking",
    title: "预约工具会丢掉重复预约",
    score: 74,
    mentions: 19,
    sources: ["GitHub Issues", "Hacker News"],
    quote: "客户约了未来一年每周二，系统只建了第一个时段，后面的全都不见了。",
    gap: "重复规则一遇到改期、节假日或时区变化就失效。",
    tags: TAGS.booking,
  },
  {
    id: "checkout",
    title: "结账页拒绝合法的海外地址",
    score: 78,
    mentions: 22,
    sources: ["GitHub Issues", "Stack Exchange"],
    quote: "我们那边没有邮编，表单直接不让提交，这单根本下不了。",
    gap: "地址校验默认按美英格式，且没有人工兜底入口。",
    tags: TAGS.checkout,
  },
  {
    id: "email",
    title: "大邮箱里的搜索慢到没法用",
    score: 71,
    mentions: 17,
    sources: ["Hacker News", "RSS"],
    quote: "找上季度的一封邮件，比凭记忆把答案重写一遍还慢。",
    gap: "快的客户端搜索弱，搜索强的又按企业版收费。",
    tags: TAGS.email,
  },
  {
    id: "project",
    title: "项目看板一断网就完全不能用",
    score: 69,
    mentions: 15,
    sources: ["GitHub Issues", "Hacker News"],
    quote: "飞机上连挪一张卡片都不行，这就是个假装成应用的网页。",
    gap: "离线模式大多还躺在路线图上，少数支持的同步也不可靠。",
    tags: TAGS.project,
  },
  {
    id: "password",
    title: "密码管理器多设备之间会冲突",
    score: 66,
    mentions: 14,
    sources: ["Stack Exchange", "GitHub Issues"],
    quote: "它悄悄留了同一条目的两个版本，结果我反倒被较新的那个锁在外面。",
    gap: "同步用「最后写入者获胜」，既看不到历史也没有合并。",
    tags: TAGS.password,
  },
  {
    id: "form",
    title: "表单工具连简单的条件逻辑都做不了",
    score: 63,
    mentions: 12,
    sources: ["GitHub Issues", "RSS"],
    quote: "按上一题答案多显示一个问题，居然要买企业版。",
    gap: "哪怕只有两个字段，条件分支也被锁在最高档套餐里。",
    tags: TAGS.form,
  },
  {
    id: "analytics",
    title: "埋点事件多到没人维护得动",
    score: 76,
    mentions: 20,
    sources: ["Hacker News", "GitHub Issues"],
    quote: "没人知道 checkout_v3_final 是什么，可一删又怕看板挂掉。",
    gap: "事件没有归属人、没有下线流程，也和看板之间没有关联。",
    tags: TAGS.analytics,
  },
  {
    id: "knowledge",
    title: "团队知识库搜不到自己写的文档",
    score: 73,
    mentions: 18,
    sources: ["Hacker News", "Stack Exchange"],
    quote: "我明明知道这页存在，还是我写的，搜索结果里偏偏就是没有它。",
    gap: "排序只看时间不看标题与作者，重复文档也从不合并。",
    tags: TAGS.knowledge,
  },
  {
    id: "ci",
    title: "CI 日志把说明失败的那一行埋没了",
    score: 80,
    mentions: 26,
    sources: ["GitHub Issues", "Stack Exchange"],
    quote: "一万行环境输出，真正的报错就夹在中间一行。",
    gap: "日志查看器只给搜索，不会自动抽取错误或聚类失败原因。",
    tags: TAGS.ci,
  },
];

export function guestItems(locale: "en" | "zh"): GuestItem[] {
  return locale === "zh" ? GUEST_ITEMS_ZH : GUEST_ITEMS_EN;
}

/**
 * 按指定 id 顺序返回结论（用于「方向 tile」与「随机一个」），
 * 过滤掉不存在的 id，再按证据分从高到低排序，确保点出去一定是一组高质量、不触发 noMatch 的结论。
 */
export function pinnedGuestItems(ids: string[], items: GuestItem[]): GuestItem[] {
  const map = new Map(items.map((it) => [it.id, it]));
  return ids
    .map((id) => map.get(id))
    .filter((x): x is GuestItem => Boolean(x))
    .sort((a, b) => b.score - a.score);
}

/**
 * 真实的关键词检索排序：命中词数优先，其次证据分，最后稳定顺序。
 * 不足 4 条时用剩余高分条目补齐；完全无命中时返回全库 Top 4 并标记 noMatch。
 */
export function rankGuestItems(query: string, items: GuestItem[], limit = 4) {
  const q = query.trim().toLowerCase();
  const tokens = q.split(/[\s,，、/|]+/).filter((t) => t.length >= 2);

  const scored = items.map((it, idx) => {
    const hay = `${it.title} ${it.tags.join(" ")} ${it.gap} ${it.quote}`.toLowerCase();
    let hits = 0;
    for (const t of tokens) if (hay.includes(t)) hits += 1;
    if (q.length >= 2 && hay.includes(q)) hits += 2;
    return { it, hits, idx };
  });

  const noMatch = !scored.some((s) => s.hits > 0);
  const sorted = [...scored].sort(
    (a, b) => b.hits - a.hits || b.it.score - a.it.score || a.idx - b.idx,
  );
  return { list: sorted.slice(0, limit).map((s) => s.it), noMatch };
}
