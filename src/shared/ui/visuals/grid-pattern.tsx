import { useId } from "react";

import { cn } from "@/shared/lib/utils";

interface GridPatternProps extends React.SVGProps<SVGSVGElement> {
  [key: string]: unknown;
  className?: string;
  height?: number;
  squares?: Array<[x: number, y: number]>;
  strokeDasharray?: string;
  width?: number;
  x?: number;
  y?: number;
}

export function GridPattern({
  className,
  height = 40,
  squares,
  strokeDasharray = "0",
  width = 40,
  x = -1,
  y = -1,
  ...props
}: Readonly<GridPatternProps>) {
  const id = useId();

  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full fill-gray-400/30 stroke-gray-400/30",
        className
      )}
      {...props}
    >
      <defs>
        <pattern id={id} height={height} patternUnits="userSpaceOnUse" width={width} x={x} y={y}>
          <path d={`M.5 ${height}V.5H${width}`} fill="none" strokeDasharray={strokeDasharray} />
        </pattern>
      </defs>
      <rect fill={`url(#${id})`} height="100%" strokeWidth={0} width="100%" />
      {squares && (
        <svg x={x} y={y} className="overflow-visible">
          {squares.map(([x, y]) => (
            <rect
              key={`${x}-${y}`}
              height={height - 1}
              strokeWidth="0"
              width={width - 1}
              x={x * width + 1}
              y={y * height + 1}
            />
          ))}
        </svg>
      )}
    </svg>
  );
}
