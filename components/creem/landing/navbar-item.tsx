"use client";

import { Link } from "next-view-transitions";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Props = {
  href: string;
  children: ReactNode;
  active?: boolean;
  className?: string;
  target?: "_blank";
};

export function NavBarItem({
  children,
  href,
  active,
  target,
  className,
}: Props) {
  const pathname = usePathname();

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-center text-muted-foreground  text-sm leading-[110%] px-4 py-2 rounded-md hover:text-black hover:text-primary",
        (active || pathname?.includes(href)) &&
        "text-primary",
        className
      )}
      target={target}
    >
      {children}
    </Link>
  );
}
