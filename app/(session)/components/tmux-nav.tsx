"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface NavItem {
  path: string;
  label: string;
  index: number;
}

const navItems: NavItem[] = [
  { path: "/dashboard", label: "nvim", index: 1 },
  { path: "/products", label: "node", index: 2 },
  { path: "/account", label: "fish", index: 3 },
];

export function TmuxNav() {
  const pathname = usePathname();

  return (
    <div className="flex items-center h-8 bg-[#1c1c1c] border-b border-neutral-800">
      {navItems.map((item) => {
        const isActive = pathname === item.path;
        
        return (
          <Link
            key={item.path}
            href={item.path}
            className={cn(
              "px-3 h-full flex items-center text-sm font-mono transition-colors",
              "hover:bg-neutral-800/50",
              isActive ? "bg-black text-neutral-200" : "text-neutral-400"
            )}
          >
            {item.index} {item.label}
          </Link>
        );
      })}
    </div>
  );
} 