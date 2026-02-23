import { cn } from "@/shared/lib/utils";

type SpotlightProps = {
  className?: string;
  fill?: string;
};

export const Spotlight = ({ className, fill }: SpotlightProps) => {
  return (
    <svg
      fill="none"
      viewBox="0 0 3787 2842"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        "animate-spotlight pointer-events-none absolute z-0 h-[169%] w-[138%] opacity-0 lg:w-[84%]",
        className
      )}
    >
      <g filter="url(#filter)">
        <ellipse
          cx="1924.71"
          cy="273.501"
          fill={fill ?? "white"}
          fillOpacity="0.21"
          rx="1924.71"
          ry="273.501"
          transform="matrix(-0.822377 -0.568943 -0.568943 0.822377 3631.88 2291.09)"
        ></ellipse>
      </g>
      <defs>
        <filter
          id="filter"
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
          height="2840.26"
          width="3785.16"
          x="0.860352"
          y="0.838989"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix"></feFlood>
          <feBlend
            in="SourceGraphic"
            in2="BackgroundImageFix"
            mode="normal"
            result="shape"
          ></feBlend>
          <feGaussianBlur
            result="effect1_foregroundBlur_1065_8"
            stdDeviation="151"
          ></feGaussianBlur>
        </filter>
      </defs>
    </svg>
  );
};
