"use client";

import { useRef } from "react";
import { useInView } from "framer-motion";

/**
 * InViewDiv Component
 * 
 * A wrapper component that only renders its children when they enter the viewport.
 * Uses Framer Motion's useInView hook for intersection detection.
 * 
 * @component
 * @param {Object} props
 * @param {React.ReactNode} props.children - Content to be rendered when in view
 * @param {Object} props.props - Additional props passed to the container div
 * 
 * @example
 * <InViewDiv>
 *   <h1>This appears when scrolled into view</h1>
 * </InViewDiv>
 */
export function InViewDiv({
  children,
  ...props
}: { children: React.ReactNode } & any) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Trigger when 40% of the element is visible
  let isInView = useInView(containerRef, { once: true, amount: 0.4 });

  return (
    <div ref={containerRef} {...props}>
      {isInView ? children : null}
    </div>
  );
}
