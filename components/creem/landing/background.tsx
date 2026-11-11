"use client";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
// import { useTheme } from "next-themes";
import React, { useId } from "react";

export const Background = () => {
  return (
    <div className="absolute inset-0 h-full w-full pointer-events-none z-0">
      {/* Terminal-like background with scanlines and grid */}
      <div className="absolute inset-0 h-full w-full bg-black opacity-90" />
      
      {/* Scanlines effect */}
      <div className="absolute inset-0 h-full w-full bg-[linear-gradient(to_bottom,rgba(128,128,128,0.03)_1px,transparent_1px)] bg-[size:100%_2px]" />
      
      {/* Grid pattern */}
      <div className="absolute inset-0 h-full w-full bg-[linear-gradient(to_right,rgba(128,128,128,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(128,128,128,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      
      {/* Terminal glow effect */}
      <div className="absolute inset-0 h-full w-full bg-[radial-gradient(circle_at_50%_50%,rgba(128,128,128,0.1),transparent_120%)]" />
      
      {/* Noise texture */}
      <div className="absolute inset-0 h-full w-full opacity-[0.15] [background-image:url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iLjA1Ii8+PC9zdmc+')]" />
    </div>
  );
};

const GridBlock = () => {
  return (
    <div className="flex flex-col items-start justify-center  w-60">
      <div className="flex items-center justify-center">
        <Dot />
        <SVG />
        {/* <Dot /> */}
      </div>
      <SVGVertical className="ml-3" />
    </div>
  );
};

const Dot = () => {
  return (
    <div className="h-6 w-6 bg-white dark:bg-neutral-900 flex items-center justify-center rounded-full">
      <div className="h-2 w-2 bg-neutral-200 dark:bg-neutral-700 rounded-full" />
    </div>
  );
};

const SVGVertical = ({ className }: { className?: string }) => {
  const width = 1;
  const height = 140;

  const id = useId();
  return (
    <motion.svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-neutral-100 dark:text-neutral-800", className)}
    >
      <path d="M0.5 0.5V479" stroke="currentColor" strokeWidth={2} />
      <motion.path
        d="M0.5 0.5V479"
        stroke={`url(#gradient-${id})`}
        strokeWidth={2}
      />

      <defs>
        <motion.linearGradient
          id={`gradient-${id}`}
          initial={{ x1: 2, y1: -200, x2: 2, y2: -100 }}
          animate={{ x1: 2, y1: 400, x2: 2, y2: 600 }}
          transition={{
            repeat: Infinity,
            duration: Math.random() * 2 + 1,
            delay: Math.floor(Math.random() * 6) + 5,
          }}
          gradientUnits="userSpaceOnUse"
        >
          <motion.stop offset="0%" stopColor="transparent" />
          <motion.stop offset="50%" stopColor="var(--neutral-200)" />
          <motion.stop offset="100%" stopColor="transparent" />
        </motion.linearGradient>
      </defs>
    </motion.svg>
  );
};

const SVG = ({ className }: { className?: string }) => {
  const width = 300;
  const height = 1;

  const id = useId();
  return (
    <motion.svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-neutral-100 dark:text-neutral-800", className)}
    >
      <path d="M0.5 0.5H479" stroke="currentColor" />
      <motion.path
        d="M0.5 0.5H479"
        stroke={`url(#gradient-${id})`}
        strokeWidth={1}
      />

      <defs>
        <motion.linearGradient
          id={`gradient-${id}`}
          initial={{ x1: -200, y1: 0, x2: -100, y2: 0 }}
          animate={{ x1: 400, y1: 0, x2: 600, y2: 0 }}
          transition={{
            repeat: Infinity,
            duration: Math.random() * 2 + 1,
            delay: Math.floor(Math.random() * 6) + 5,
          }}
          gradientUnits="userSpaceOnUse"
        >
          <motion.stop offset="0%" stopColor="transparent" />
          <motion.stop offset="50%" stopColor="var(--neutral-200)" />
          <motion.stop offset="100%" stopColor="transparent" />
        </motion.linearGradient>
      </defs>
    </motion.svg>
  );
};

// Use the below rect to debug linear gradient
{
  /* <motion.rect width={width} height={width} fill={`url(#gradient-${id})`} /> */
}
