import { useId, type SVGProps } from "react";

import { cn } from "@/shared/lib/cn";

/**
 *  DotPattern Component Props
 *
 * @param {number} [width=16] - The horizontal spacing between dots
 * @param {number} [height=16] - The vertical spacing between dots
 * @param {number} [x=0] - The x-offset of the entire pattern
 * @param {number} [y=0] - The y-offset of the entire pattern
 * @param {number} [cx=1] - The x-offset of individual dots
 * @param {number} [cy=1] - The y-offset of individual dots
 * @param {number} [cr=1] - The radius of each dot
 * @param {string} [className] - Additional CSS classes to apply to the SVG container
 */
interface DotPatternProps extends SVGProps<SVGSVGElement> {
  [key: string]: unknown;
  className?: string;
  cr?: number;
  cx?: number;
  cy?: number;
  height?: number;
  width?: number;
  x?: number;
  y?: number;
}

/**
 * DotPattern Component
 *
 * A React component that creates a static dot pattern background using SVG.
 * The pattern automatically adjusts to fill its container.
 *
 * @component
 *
 * @see DotPatternProps for the props interface.
 *
 * @example
 * // Basic usage
 * <DotPattern />
 *
 * // With custom spacing
 * <DotPattern
 *   width={20}
 *   height={20}
 *   className="opacity-50"
 * />
 *
 * @notes
 * - Uses useId for unique pattern IDs
 * - Dots color can be controlled via the fill color utility classes
 */

export function DotPattern({
  className,
  cr = 1,
  cx = 1,
  cy = 1,
  height = 16,
  width = 16,
  x = 0,
  y = 0,
  ...props
}: Readonly<DotPatternProps>) {
  const id = useId();

  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full fill-neutral-400/80",
        className
      )}
      {...props}
    >
      <defs>
        <pattern
          id={id}
          height={height}
          patternContentUnits="userSpaceOnUse"
          patternUnits="userSpaceOnUse"
          width={width}
          x={x}
          y={y}
        >
          <circle id="pattern-circle" cx={cx} cy={cy} r={cr} />
        </pattern>
      </defs>
      <rect fill={`url(#${id})`} height="100%" strokeWidth={0} width="100%" />
    </svg>
  );
}
