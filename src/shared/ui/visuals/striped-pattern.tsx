import React, { useId } from "react";

import { cn } from "@/shared/lib/utils";

interface StripedPatternProps extends React.SVGProps<SVGSVGElement> {
  direction?: "left" | "right";
}

export function StripedPattern({
  className,
  direction = "left",
  height = 10,
  width = 10,
  ...props
}: Readonly<StripedPatternProps>) {
  const id = useId();
  const w = Number(width);
  const h = Number(height);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 -z-50 h-full w-full stroke-[0.5]",
        className
      )}
      {...props}
    >
      <defs>
        <pattern id={id} height={h} patternUnits="userSpaceOnUse" width={w}>
          {direction === "left" ? (
            <>
              <line stroke="currentColor" x1="0" x2={w} y1={h} y2="0" />
              <line stroke="currentColor" x1={-w} x2="0" y1={h} y2="0" />
              <line stroke="currentColor" x1={w} x2={w * 2} y1={h} y2="0" />
            </>
          ) : (
            <>
              <line stroke="currentColor" x1="0" x2={w} y1="0" y2={h} />
              <line stroke="currentColor" x1={-w} x2="0" y1="0" y2={h} />
              <line stroke="currentColor" x1={w} x2={w * 2} y1="0" y2={h} />
            </>
          )}
        </pattern>
      </defs>
      <rect fill={`url(#${id})`} height="100%" width="100%" />
    </svg>
  );
}
