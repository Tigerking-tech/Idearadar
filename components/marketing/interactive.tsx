"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { EN_DICT, switchTargets, type Dict, type Locale } from "@/lib/i18n";

type AnnouncementDict = Dict["announcement"];
type NavDict = Dict["nav"];
type RoiDict = Dict["roi"];
type LangDict = Dict["lang"];

/** 顶部渐变公告条（对标竞品首屏顶部条），带关闭交互 */
export function AnnouncementBar({ d = EN_DICT.announcement }: { d?: AnnouncementDict }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <div className="rr-announce" role="region" aria-label={d.region}>
      <div className="rr-container rr-announce-inner">
        <span>{d.text}</span>
        <Link href={d.ctaHref} className="rr-announce-cta">
          {d.cta}
        </Link>
        <button
          type="button"
          className="rr-announce-close"
          aria-label={d.dismiss}
          onClick={() => setVisible(false)}
        >
          ×
        </button>
      </div>
    </div>
  );
}

/**
 * 语言切换器：两个真实的 <a> 链接，指向各自独立的静态页面。
 * 不做前端文案替换——中文版必须有独立 URL 才能被 Google / LLM 抓取。
 */
export function LanguageSwitcher({ locale, d = EN_DICT.lang }: { locale: Locale; d?: LangDict }) {
  const pathname = usePathname() || "/";
  const targets = switchTargets(locale, pathname);
  return (
    <div className="rr-lang" aria-label={d.aria}>
      <Link
        href={targets.en}
        hrefLang="en"
        lang="en"
        className={locale === "en" ? "is-active" : ""}
        aria-current={locale === "en" ? "true" : undefined}
        title={d.switchTo}
      >
        {d.en}
      </Link>
      <Link
        href={targets.zh}
        hrefLang="zh-CN"
        lang="zh-CN"
        className={locale === "zh" ? "is-active" : ""}
        aria-current={locale === "zh" ? "true" : undefined}
        title={d.switchTo}
      >
        {d.zh}
      </Link>
    </div>
  );
}

/** 移动端菜单 */
export function MobileMenu({ d = EN_DICT.nav }: { d?: NavDict }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={d.menu}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 grid place-items-center rounded-lg border border-[#e8e9f0] text-lg"
      >
        {open ? "×" : "☰"}
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-[68px] z-50 bg-white border-b border-[#e8e9f0] shadow-lg px-6 py-4">
          <nav className="flex flex-col gap-1" aria-label={d.aria}>
            {d.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="py-2.5 text-sm font-medium text-[#4a4f5e]"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link href={d.ctaHref} className="rr-btn rr-btn-primary rr-btn-sm mt-3 rr-btn-block">
              {d.cta}
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
}

/** ROI 交互计算器：对标竞品的滑块区块，内容在服务端 HTML 中同样可读 */
export function RoiCalculator({ d = EN_DICT.roi }: { d?: RoiDict }) {
  const [hours, setHours] = useState(10);
  const [rate, setRate] = useState(50);
  const manualCost = hours * rate * 4;
  const toolCost = 49;
  const saved = Math.max(0, manualCost - toolCost);

  return (
    <div className="rr-card p-7 md:p-9">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-8">
        <div>
          <h3 className="rr-h3">{d.title}</h3>
          <p className="rr-note mt-1">{d.subtitle}</p>
        </div>
        <span className="rr-chip rr-chip-blue self-start">{d.chip}</span>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-7">
          <label className="block">
            <span className="flex justify-between text-sm font-medium mb-3">
              {d.hours} <strong>{hours}h</strong>
            </span>
            <input
              type="range"
              min={2}
              max={30}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="w-full accent-[#5b4bf5]"
              aria-label={d.hoursAria}
            />
          </label>
          <label className="block">
            <span className="flex justify-between text-sm font-medium mb-3">
              {d.rate} <strong>${rate}</strong>
            </span>
            <input
              type="range"
              min={20}
              max={200}
              step={5}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="w-full accent-[#5b4bf5]"
              aria-label={d.rateAria}
            />
          </label>
        </div>

        <div className="rounded-xl bg-[#faf9ff] border border-[#e8e4ff] p-6">
          <div className="flex justify-between text-sm py-2">
            <span className="text-[#5c6273]">{d.manualCost}</span>
            <strong>${manualCost.toLocaleString()}</strong>
          </div>
          <div className="flex justify-between text-sm py-2">
            <span className="text-[#5c6273]">{d.toolCost}</span>
            <strong>${toolCost}</strong>
          </div>
          <div className="rr-divider my-3" />
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-semibold">{d.youSave}</span>
            <span className="rr-gradient-text text-3xl font-extrabold tracking-tight">
              ${saved.toLocaleString()}{d.savedSuffix}
            </span>
          </div>
          <p className="rr-note mt-3">{d.note}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * 订阅按钮：真实对接模板自带的 Creem checkout route。
 * 配置 CREEM_PRODUCT_PRO / CREEM_PRODUCT_TEAM 后直接创建结账会话并跳转；
 * 未配置时降级到注册页，本地演示不会报错。
 */
export function SubscribeButton({
  productId,
  fallbackHref = "/signup",
  label,
  loadingLabel = "Opening checkout…",
  variant = "primary",
  block = false,
}: {
  productId?: string;
  fallbackHref?: string;
  label: string;
  loadingLabel?: string;
  variant?: "primary" | "outline";
  block?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const cls = `rr-btn ${variant === "primary" ? "rr-btn-primary" : "rr-btn-outline"} ${block ? "rr-btn-block" : ""}`;

  if (!productId) {
    return (
      <Link href={fallbackHref} className={cls}>
        {label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={cls}
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/checkout?product_id=${encodeURIComponent(productId)}`);
          const data = await res.json();
          if (data?.checkoutUrl) {
            window.location.href = data.checkoutUrl;
          } else {
            window.location.href = fallbackHref;
          }
        } catch {
          window.location.href = fallbackHref;
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? loadingLabel : label}
    </button>
  );
}
