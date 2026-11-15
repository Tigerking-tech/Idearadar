import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 创意雷达目前是免费、开源、无账号的项目。模板遗留的账号/计费/仪表盘页
 * （/signin /signup /account /dashboard /products）尚未实现，直接访问会看到
 * 带 $ 占位符的坏页。这里统一重定向到免费试用页，避免把用户带进死路。
 * 导航与所有 CTA 也已改为真实链接，此中间件仅作兜底。
 */
const LEGACY_PATHS = [
  "/signin",
  "/signup",
  "/account",
  "/dashboard",
  "/products",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (LEGACY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.redirect(new URL("/try", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/signin", "/signin/:path*",
    "/signup", "/signup/:path*",
    "/account", "/account/:path*",
    "/dashboard", "/dashboard/:path*",
    "/products", "/products/:path*",
  ],
};
