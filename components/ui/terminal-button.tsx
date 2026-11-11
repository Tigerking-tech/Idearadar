"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface TerminalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  prompt?: string;
  className?: string;
  command?: string;
  path?: string;
}

export function TerminalButton({
  children,
  prompt = "$",
  className,
  command,
  path,
  ...props
}: TerminalButtonProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  
  // If command and path are provided, use them. Otherwise, use children as plain text
  const text = React.useMemo(() => children?.toString() || "", [children]);
  const hasCommandAndPath = command && path;

  return (
    <button
      className={cn(
        "group relative px-6 py-3 bg-neutral-900/90 dark:bg-neutral-800/90 backdrop-blur-sm",
        "border border-neutral-800 dark:border-neutral-700",
        "rounded-lg font-mono text-sm text-neutral-200",
        "hover:border-neutral-700 dark:hover:border-neutral-600",
        "transition-colors duration-200",
        "flex items-center gap-2",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      {/* Terminal prompt */}
      <span className="text-[#ffbe98] dark:text-[#ffbe98] opacity-80 shrink-0">
        {prompt}
      </span>

      <div className="relative flex items-center gap-1.5">
        {hasCommandAndPath ? (
          <>
            <span className="text-white">{command}</span>
            <span className="text-[#ffbe98]">{path}</span>
          </>
        ) : (
          <span className="text-white">{text}</span>
        )}
        {/* Blinking cursor block that stops on hover */}
        <motion.span
          className="w-2 h-4 bg-white ml-0.5"
          animate={isHovered ? { opacity: 1 } : { opacity: [1, 1, 0, 0] }}
          transition={isHovered ? {} : {
            duration: 1,
            repeat: Infinity,
            repeatType: "loop",
            ease: "linear",
          }}
        />
      </div>

      {/* Terminal glow effect */}
      <div className="absolute inset-0 rounded-lg bg-black/[0.03] dark:bg-black/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
    </button>
  );
} 