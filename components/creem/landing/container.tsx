import { cn } from "@/lib/utils";
import React from "react";

/**
 * Container Component
 * 
 * A responsive container component that centers content and applies consistent padding.
 * Uses Tailwind's max-width utilities for a standardized layout.
 * 
 * @component
 * @param {Object} props
 * @param {React.ReactNode} props.children - Content to be contained
 * @param {string} [props.className] - Additional CSS classes to apply
 * 
 * @example
 * <Container className="py-8">
 *   <h1>Centered Content</h1>
 * </Container>
 */
export const Container = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn(`max-w-7xl mx-auto px-4`, className)}>{children}</div>
  );
};
