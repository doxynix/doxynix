import {
  type ComponentType,
  forwardRef,
  type HTMLAttributes,
  type MouseEvent,
  useRef,
  useState,
} from "react";
import {
  Pie,
  PieChart as ReChartsDonutChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
} from "recharts";

import {
  AvailableChartColors,
  type AvailableChartColorsKeys,
  constructCategoryColors,
  getColorClassName,
} from "../../lib/chart-utils";
import { cx } from "../../lib/utils";

const sumNumericArray = (arr: number[]): number => arr.reduce((sum, num) => sum + num, 0);

const parseData = (
  data: Record<string, any>[],
  categoryColors: Map<string, AvailableChartColorsKeys>,
  category: string,
) =>
  data.map((dataPoint) => {
    const rawCategoryValue = dataPoint[category];
    const fallbackColor: AvailableChartColorsKeys = AvailableChartColors[0] ?? "gray";
    const color: AvailableChartColorsKeys = categoryColors.get(rawCategoryValue) ?? fallbackColor;
    return {
      ...dataPoint,
      className: getColorClassName(color, "fill"),
      color,
    };
  });

const calculateDefaultLabel = (data: any[], valueKey: string): number =>
  sumNumericArray(data.map((dataPoint) => dataPoint[valueKey]));

const parseLabelInput = (
  labelInput: string | undefined,
  valueFormatter: (value: number) => string,
  data: any[],
  valueKey: string,
): string => labelInput ?? valueFormatter(calculateDefaultLabel(data, valueKey));

//#region Tooltip

type TooltipProps = Pick<ChartTooltipProps, "active" | "payload">;

type PayloadItem = {
  category: string;
  value: number;
  color: AvailableChartColorsKeys;
};

interface ChartTooltipProps {
  active: boolean | undefined;
  payload: PayloadItem[];
  valueFormatter: (value: number) => string;
}

const ChartTooltip = ({ active, payload, valueFormatter }: ChartTooltipProps) => {
  if (active && payload.length) {
    return (
      <div
        className={cx(
          // base
          "rounded-md border text-sm shadow-md",
          // border color
          "border-gray-200 dark:border-gray-800",
          // background color
          "bg-white dark:bg-gray-950",
        )}
      >
        <div className={cx("space-y-1 px-4 py-2")}>
          {payload.map(({ value, category, color }) => (
            <div
              className="flex items-center justify-between space-x-8"
              key={`${category}-${value}`}
            >
              <div className="flex items-center space-x-2">
                <span
                  aria-hidden="true"
                  className={cx("size-2 shrink-0 rounded-full", getColorClassName(color, "bg"))}
                />
                <p
                  className={cx(
                    // base
                    "whitespace-nowrap text-right",
                    // text color
                    "text-gray-700 dark:text-gray-300",
                  )}
                >
                  {category}
                </p>
              </div>
              <p
                className={cx(
                  // base
                  "whitespace-nowrap text-right font-medium tabular-nums",
                  // text color
                  "text-gray-900 dark:text-gray-50",
                )}
              >
                {valueFormatter(value)}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const renderInactiveShape = (props: any) => {
  const {
    cx: coordX,
    cy: coordY,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    className,
  } = props;

  return (
    <Sector
      className={className}
      cx={coordX}
      cy={coordY}
      endAngle={endAngle}
      fill=""
      innerRadius={innerRadius}
      opacity={0.3}
      outerRadius={outerRadius}
      startAngle={startAngle}
      style={{ outline: "none" }}
    />
  );
};

type DonutChartVariant = "donut" | "pie";

type BaseEventProps = {
  eventType: "sector";
  categoryClicked: string;
  [key: string]: number | string;
};

type DonutChartEventProps = BaseEventProps | null | undefined;

interface DonutChartProps extends HTMLAttributes<HTMLDivElement> {
  data?: Record<string, any>[];
  category: string;
  value: string;
  colors?: AvailableChartColorsKeys[];
  variant?: DonutChartVariant;
  valueFormatter?: (value: number) => string;
  label?: string;
  showLabel?: boolean;
  showTooltip?: boolean;
  onValueChange?: (value: DonutChartEventProps) => void;
  tooltipCallback?: (tooltipCallbackContent: TooltipProps) => void;
  customTooltip?: ComponentType<TooltipProps>;
}

const DonutChart = forwardRef<HTMLDivElement, DonutChartProps>(
  (
    {
      data = [],
      value,
      category,
      colors = AvailableChartColors,
      variant = "donut",
      valueFormatter = (val: number) => val.toString(),
      label,
      showLabel = false,
      showTooltip = true,
      onValueChange,
      tooltipCallback,
      customTooltip,
      className,
      ...other
    },
    forwardedRef,
  ) => {
    const CustomTooltip = customTooltip;
    const [activeIndex, setActiveIndex] = useState<number | undefined>();
    const isDonut = variant === "donut";
    const parsedLabelInput = parseLabelInput(label, valueFormatter, data, value);

    const categories = Array.from(new Set(data.map((item) => item[category])));
    const categoryColors = constructCategoryColors(categories, colors);

    const prevActiveRef = useRef<boolean | undefined>(undefined);
    const prevCategoryRef = useRef<string | undefined>(undefined);

    const handleShapeClick = (
      itemData: any,
      itemIndex: number,
      event: MouseEvent<SVGGraphicsElement>,
    ) => {
      event.stopPropagation();
      if (!onValueChange) {
        return;
      }

      if (activeIndex === itemIndex) {
        setActiveIndex(undefined);
        onValueChange(null);
      } else {
        setActiveIndex(itemIndex);
        onValueChange({
          categoryClicked: itemData.payload[category],
          eventType: "sector",
          ...itemData.payload,
        });
      }
    };

    return (
      <div
        className={cx("h-40 w-40", className)}
        ref={forwardedRef}
        tremor-id="tremor-raw"
        {...other}
      >
        <ResponsiveContainer className="size-full">
          <ReChartsDonutChart
            margin={{ bottom: 0, left: 0, right: 0, top: 0 }}
            onClick={
              onValueChange && activeIndex !== undefined
                ? () => {
                    setActiveIndex(undefined);
                    onValueChange(null);
                  }
                : undefined
            }
          >
            {showLabel && isDonut && (
              <text
                className="fill-gray-700 dark:fill-gray-300"
                dominantBaseline="middle"
                textAnchor="middle"
                x="50%"
                y="50%"
              >
                {parsedLabelInput}
              </text>
            )}
            <Pie
              className={cx(
                "stroke-white dark:stroke-gray-950 [&_.recharts-pie-sector]:outline-hidden",
                onValueChange ? "cursor-pointer" : "cursor-default",
              )}
              cx="50%"
              cy="50%"
              data={parseData(data, categoryColors, category)}
              dataKey={value}
              endAngle={-270}
              innerRadius={isDonut ? "75%" : "0%"}
              isAnimationActive={false}
              nameKey={category}
              onClick={handleShapeClick}
              outerRadius="100%"
              shape={renderInactiveShape}
              startAngle={90}
              stroke=""
              strokeLinejoin="round"
              style={{ outline: "none" }}
            />
            {showTooltip && (
              <Tooltip
                content={({ active, payload }) => {
                  const cleanPayload = payload.map((item: any) => ({
                    category: item.payload[category],
                    color: categoryColors.get(item.payload[category]) ?? "gray",
                    value: item.value,
                  }));

                  const payloadCategory: string = cleanPayload[0]?.category;

                  if (
                    tooltipCallback &&
                    (active !== prevActiveRef.current ||
                      payloadCategory !== prevCategoryRef.current)
                  ) {
                    tooltipCallback({
                      active,
                      payload: cleanPayload,
                    });
                    prevActiveRef.current = active;
                    prevCategoryRef.current = payloadCategory;
                  }

                  return active ? (
                    CustomTooltip ? (
                      <CustomTooltip active={active} payload={cleanPayload} />
                    ) : (
                      <ChartTooltip
                        active={active}
                        payload={cleanPayload}
                        valueFormatter={valueFormatter}
                      />
                    )
                  ) : null;
                }}
                isAnimationActive={false}
                wrapperStyle={{ outline: "none" }}
              />
            )}
          </ReChartsDonutChart>
        </ResponsiveContainer>
      </div>
    );
  },
);

DonutChart.displayName = "DonutChart";

export { DonutChart, type DonutChartEventProps, type TooltipProps };
