/** biome-ignore-all lint/suspicious/noExplicitAny: Recharts library relies on complex, dynamically typed props that are difficult to define accurately without sacrificing maintainability. */

import {
  type ComponentType,
  type Dispatch,
  type ElementType,
  Fragment,
  forwardRef,
  type HTMLAttributes,
  type MouseEvent,
  type OlHTMLAttributes,
  type SetStateAction,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { RiArrowLeftSLine, RiArrowRightSLine } from "@remixicon/react";
import {
  Area,
  CartesianGrid,
  Dot,
  Label,
  Line,
  AreaChart as RechartsAreaChart,
  Legend as RechartsLegend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useOnWindowResize } from "../../hooks/use-on-window-resize";
import {
  AvailableChartColors,
  type AvailableChartColorsKeys,
  constructCategoryColors,
  getColorClassName,
  getYAxisDomain,
  hasOnlyOneValueForKey,
} from "../../lib/chart-utils";
import { cx } from "../../lib/utils";

//#region Legend

interface LegendItemProps {
  name: string;
  color: AvailableChartColorsKeys;
  onClick?: (name: string, color: AvailableChartColorsKeys) => void;
  activeLegend?: string;
}

const LegendItem = ({ name, color, onClick, activeLegend }: LegendItemProps) => {
  const hasOnValueChange = Boolean(onClick);
  return (
    <li className="inline-flex">
      <button
        className={cx(
          // base
          "group inline-flex flex-nowrap items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-1 transition",
          hasOnValueChange
            ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
            : "cursor-default",
        )}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(name, color);
        }}
        type="button"
      >
        <span
          aria-hidden={true}
          className={cx(
            "h-0.75 w-3.5 shrink-0 rounded-full",
            getColorClassName(color, "bg"),
            activeLegend && activeLegend !== name ? "opacity-40" : "opacity-100",
          )}
        />
        <p
          className={cx(
            // base
            "truncate whitespace-nowrap text-xs",
            // text color
            "text-gray-700 dark:text-gray-300",
            hasOnValueChange && "group-hover:text-gray-900 dark:group-hover:text-gray-50",
            activeLegend && activeLegend !== name ? "opacity-40" : "opacity-100",
          )}
        >
          {name}
        </p>
      </button>
    </li>
  );
};

interface ScrollButtonProps {
  icon: ElementType;
  onClick?: () => void;
  disabled?: boolean;
}

const ScrollButton = ({ icon, onClick, disabled }: ScrollButtonProps) => {
  const Icon = icon;
  const [isPressed, setIsPressed] = useState(false);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    if (isPressed) {
      intervalRef.current = setInterval(() => {
        onClick?.();
      }, 300);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isPressed, onClick]);

  useEffect(() => {
    if (disabled) {
      clearInterval(intervalRef.current);
      setIsPressed(false);
    }
  }, [disabled]);

  return (
    <button
      className={cx(
        // base
        "group inline-flex size-5 items-center truncate rounded-sm transition",
        disabled
          ? "cursor-not-allowed text-gray-400 dark:text-gray-600"
          : "cursor-pointer text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-50",
      )}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        setIsPressed(true);
      }}
      onMouseUp={(e) => {
        e.stopPropagation();
        setIsPressed(false);
      }}
      type="button"
    >
      <Icon aria-hidden="true" className="size-full" />
    </button>
  );
};

interface LegendProps extends OlHTMLAttributes<HTMLOListElement> {
  categories: string[];
  colors?: AvailableChartColorsKeys[];
  onClickLegendItem?: (category: string, color: string) => void;
  activeLegend?: string;
  enableLegendSlider?: boolean;
}

type HasScrollProps = {
  left: boolean;
  right: boolean;
};

const Legend = forwardRef<HTMLOListElement, LegendProps>((props, ref) => {
  const {
    categories,
    colors = AvailableChartColors,
    className,
    onClickLegendItem,
    activeLegend,
    enableLegendSlider = false,
    ...other
  } = props;
  const scrollableRef = useRef<HTMLDivElement>(null);
  const scrollButtonsRef = useRef<HTMLDivElement>(null);
  const [hasScroll, setHasScroll] = useState<HasScrollProps | null>(null);
  const [isKeyDowned, setIsKeyDowned] = useState<string | null>(null);
  const intervalRef = useRef<any>(null);

  const checkScroll = useCallback(() => {
    const scrollable = scrollableRef.current;
    if (!scrollable) {
      return;
    }

    const hasLeftScroll = scrollable.scrollLeft > 0;
    const hasRightScroll = scrollable.scrollWidth - scrollable.clientWidth > scrollable.scrollLeft;

    setHasScroll({ left: hasLeftScroll, right: hasRightScroll });
  }, []);

  const scrollToTest = useCallback(
    (direction: "left" | "right") => {
      const element = scrollableRef.current;
      const scrollButtons = scrollButtonsRef.current;
      const scrollButtonsWith = scrollButtons?.clientWidth ?? 0;
      const width = element?.clientWidth ?? 0;

      if (element && enableLegendSlider) {
        element.scrollTo({
          behavior: "smooth",
          left:
            direction === "left"
              ? element.scrollLeft - width + scrollButtonsWith
              : element.scrollLeft + width - scrollButtonsWith,
        });
        setTimeout(() => {
          checkScroll();
        }, 400);
      }
    },
    [enableLegendSlider, checkScroll],
  );

  useEffect(() => {
    const keyDownHandler = (key: string) => {
      if (key === "ArrowLeft") {
        scrollToTest("left");
      } else if (key === "ArrowRight") {
        scrollToTest("right");
      }
    };
    if (isKeyDowned) {
      keyDownHandler(isKeyDowned);
      intervalRef.current = setInterval(() => {
        keyDownHandler(isKeyDowned);
      }, 300);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isKeyDowned, scrollToTest]);

  const keyDown = useCallback((e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      setIsKeyDowned(e.key);
    }
  }, []);

  const keyUp = useCallback((e: KeyboardEvent) => {
    e.stopPropagation();
    setIsKeyDowned(null);
  }, []);

  useEffect(() => {
    const scrollable = scrollableRef.current;
    if (enableLegendSlider) {
      checkScroll();
      scrollable?.addEventListener("keydown", keyDown);
      scrollable?.addEventListener("keyup", keyUp);
    }

    return () => {
      scrollable?.removeEventListener("keydown", keyDown);
      scrollable?.removeEventListener("keyup", keyUp);
    };
  }, [checkScroll, enableLegendSlider, keyDown, keyUp]);

  return (
    <ol className={cx("relative overflow-hidden", className)} ref={ref} {...other}>
      <div
        className={cx(
          "flex h-full",
          enableLegendSlider
            ? hasScroll?.right || hasScroll?.left
              ? "snap-mandatory items-center overflow-auto pr-12 pl-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              : ""
            : "flex-wrap",
        )}
        ref={scrollableRef}
      >
        {categories.map((category) => (
          <LegendItem
            activeLegend={activeLegend}
            color={colors[categories.indexOf(category)] ?? AvailableChartColors[0] ?? "gray"}
            key={category}
            name={category}
            onClick={onClickLegendItem}
          />
        ))}
      </div>
      {enableLegendSlider && (hasScroll?.right || hasScroll?.left) ? (
        <div
          className={cx(
            // base
            "absolute top-0 right-0 bottom-0 flex h-full items-center justify-center pr-1",
            // background color
            "bg-white dark:bg-gray-950",
          )}
        >
          <ScrollButton
            disabled={!hasScroll.left}
            icon={RiArrowLeftSLine}
            onClick={() => {
              setIsKeyDowned(null);
              scrollToTest("left");
            }}
          />
          <ScrollButton
            disabled={!hasScroll.right}
            icon={RiArrowRightSLine}
            onClick={() => {
              setIsKeyDowned(null);
              scrollToTest("right");
            }}
          />
        </div>
      ) : null}
    </ol>
  );
});

Legend.displayName = "Legend";

interface ChartLegendProps {
  payload: any;
  categoryColors: Map<string, AvailableChartColorsKeys>;
  setLegendHeight: Dispatch<SetStateAction<number>>;
  activeLegend?: string;
  onClick?: (category: string, color: string) => void;
  enableLegendSlider?: boolean;
  legendPosition?: "left" | "center" | "right";
  yAxisWidth?: number;
}

const ChartLegend = ({
  payload,
  categoryColors,
  setLegendHeight,
  activeLegend,
  onClick,
  enableLegendSlider,
  legendPosition,
  yAxisWidth,
}: ChartLegendProps) => {
  const legendRef = useRef<HTMLDivElement>(null);

  useOnWindowResize(() => {
    const calculateHeight = (height: number | undefined) => (height ? height + 15 : 60);
    setLegendHeight(calculateHeight(legendRef.current?.clientHeight));
  });

  const legendPayload = payload.filter((item: any) => item.type !== "none");

  const paddingLeft = legendPosition === "left" && yAxisWidth ? yAxisWidth - 8 : 0;

  return (
    <div
      className={cx(
        "flex items-center",
        { "justify-center": legendPosition === "center" },
        { "justify-start": legendPosition === "left" },
        { "justify-end": legendPosition === "right" },
      )}
      ref={legendRef}
      style={{ paddingLeft: paddingLeft }}
    >
      <Legend
        activeLegend={activeLegend}
        categories={legendPayload.map((entry: any) => entry.value)}
        colors={legendPayload.map((entry: any) => categoryColors.get(entry.value))}
        enableLegendSlider={enableLegendSlider}
        onClickLegendItem={onClick}
      />
    </div>
  );
};

//#region Tooltip

type TooltipProps = Pick<ChartTooltipProps, "active" | "payload" | "label">;

type PayloadItem = {
  category: string;
  value: number;
  index: string;
  color: AvailableChartColorsKeys;
  type?: string;
  payload: any;
};

interface ChartTooltipProps {
  active: boolean | undefined;
  payload: PayloadItem[];
  label: string | number | undefined;
  valueFormatter: (value: number) => string;
}

const ChartTooltip = ({ active, payload, label, valueFormatter }: ChartTooltipProps) => {
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
        <div className={cx("border-inherit border-b px-4 py-2")}>
          <p
            className={cx(
              // base
              "font-medium",
              // text color
              "text-gray-900 dark:text-gray-50",
            )}
          >
            {label}
          </p>
        </div>
        <div className={cx("space-y-1 px-4 py-2")}>
          {payload.map(({ value, category, color }) => (
            <div
              className="flex items-center justify-between space-x-8"
              key={`${category}-${value}`}
            >
              <div className="flex items-center space-x-2">
                <span
                  aria-hidden="true"
                  className={cx(
                    "h-0.75 w-3.5 shrink-0 rounded-full",
                    getColorClassName(color, "bg"),
                  )}
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

//#region AreaChart

interface ActiveDot {
  index?: number;
  dataKey?: string;
}

type BaseEventProps = {
  eventType: "dot" | "category";
  categoryClicked: string;
  [key: string]: number | string;
};

type AreaChartEventProps = BaseEventProps | null | undefined;

interface AreaChartProps extends HTMLAttributes<HTMLDivElement> {
  data?: Record<string, any>[];
  index: string;
  categories?: string[];
  colors?: AvailableChartColorsKeys[];
  valueFormatter?: (value: number) => string;
  startEndOnly?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  showGridLines?: boolean;
  yAxisWidth?: number;
  intervalType?: "preserveStartEnd" | "equidistantPreserveStart";
  showTooltip?: boolean;
  showLegend?: boolean;
  autoMinValue?: boolean;
  minValue?: number;
  maxValue?: number;
  allowDecimals?: boolean;
  onValueChange?: (value: AreaChartEventProps) => void;
  enableLegendSlider?: boolean;
  tickGap?: number;
  connectNulls?: boolean;
  xAxisLabel?: string;
  yAxisLabel?: string;
  type?: "default" | "stacked" | "percent";
  legendPosition?: "left" | "center" | "right";
  fill?: "gradient" | "solid" | "none";
  tooltipCallback?: (tooltipCallbackContent: TooltipProps) => void;
  customTooltip?: ComponentType<TooltipProps>;
}

const AreaChart = forwardRef<HTMLDivElement, AreaChartProps>((props, ref) => {
  const {
    data = [],
    categories = [],
    index,
    colors = AvailableChartColors,
    valueFormatter = (value: number) => value.toString(),
    startEndOnly = false,
    showXAxis = true,
    showYAxis = true,
    showGridLines = true,
    yAxisWidth = 56,
    intervalType = "equidistantPreserveStart",
    showTooltip = true,
    showLegend = true,
    autoMinValue = false,
    minValue,
    maxValue,
    allowDecimals = true,
    connectNulls = false,
    className,
    onValueChange,
    enableLegendSlider = false,
    tickGap = 5,
    xAxisLabel,
    yAxisLabel,
    type = "default",
    legendPosition = "right",
    fill = "gradient",
    tooltipCallback,
    customTooltip,
    ...other
  } = props;
  const CustomTooltip = customTooltip;
  const paddingValue = (!showXAxis && !showYAxis) || (startEndOnly && !showYAxis) ? 0 : 20;
  const [legendHeight, setLegendHeight] = useState(60);
  const [activeDot, setActiveDot] = useState<ActiveDot | undefined>();
  const [activeLegend, setActiveLegend] = useState<string | undefined>();
  const categoryColors = constructCategoryColors(categories, colors);

  const yAxisDomain = getYAxisDomain(autoMinValue, minValue, maxValue);
  const hasOnValueChange = Boolean(onValueChange);
  const stacked = type === "stacked" || type === "percent";
  const areaId = useId();

  const prevActiveRef = useRef<boolean | undefined>(undefined);
  const prevLabelRef = useRef<string | number | undefined>(undefined);

  const ticks =
    startEndOnly && data.length > 0
      ? [String(data[0]?.[index]), String(data.at(-1)?.[index])]
      : undefined;

  const getFillContent = ({
    fillType,
    activeDot: currentActiveDot,
    activeLegend: currentActiveLegend,
    category,
  }: {
    fillType: AreaChartProps["fill"];
    activeDot: ActiveDot | undefined;
    activeLegend: string | undefined;
    category: string;
  }) => {
    const stopOpacity =
      currentActiveDot || (currentActiveLegend && currentActiveLegend !== category) ? 0.1 : 0.3;

    switch (fillType) {
      case "none": {
        return <stop stopColor="currentColor" stopOpacity={0} />;
      }
      case "gradient": {
        return (
          <>
            <stop offset="5%" stopColor="currentColor" stopOpacity={stopOpacity} />
            <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
          </>
        );
      }
      case "solid":
      case undefined:
      default: {
        return <stop stopColor="currentColor" stopOpacity={stopOpacity} />;
      }
    }
  };

  function valueToPercent(value: number) {
    return `${(value * 100).toFixed(0)}%`;
  }

  function onDotClick(itemData: any, event: MouseEvent) {
    event.stopPropagation();

    if (!onValueChange) {
      return;
    }
    if (
      (itemData.index === activeDot?.index && itemData.dataKey === activeDot?.dataKey) ||
      (hasOnlyOneValueForKey(data, itemData.dataKey) &&
        activeLegend &&
        activeLegend === itemData.dataKey)
    ) {
      setActiveLegend(undefined);
      setActiveDot(undefined);
      onValueChange(null);
    } else {
      setActiveLegend(itemData.dataKey);
      setActiveDot({
        dataKey: itemData.dataKey,
        index: itemData.index,
      });
      onValueChange({
        categoryClicked: itemData.dataKey,
        eventType: "dot",
        ...itemData.payload,
      });
    }
  }

  function onCategoryClick(dataKey: string) {
    if (!onValueChange) {
      return;
    }
    if (
      (dataKey === activeLegend && !activeDot) ||
      (hasOnlyOneValueForKey(data, dataKey) && activeDot?.dataKey === dataKey)
    ) {
      setActiveLegend(undefined);
      onValueChange(null);
    } else {
      setActiveLegend(dataKey);
      onValueChange({
        categoryClicked: dataKey,
        eventType: "category",
      });
    }
    setActiveDot(undefined);
  }

  return (
    <div className={cx("h-80 w-full", className)} ref={ref} tremor-id="tremor-raw" {...other}>
      <ResponsiveContainer>
        <RechartsAreaChart
          data={data}
          margin={{
            bottom: xAxisLabel ? 30 : undefined,
            left: yAxisLabel ? 20 : undefined,
            right: yAxisLabel ? 5 : undefined,
            top: 5,
          }}
          onClick={
            onValueChange && (activeLegend || activeDot)
              ? () => {
                  setActiveDot(undefined);
                  setActiveLegend(undefined);
                  onValueChange(null);
                }
              : undefined
          }
          stackOffset={type === "percent" ? "expand" : undefined}
        >
          {showGridLines ? (
            <CartesianGrid
              className={cx("stroke-1 stroke-gray-200 dark:stroke-gray-800")}
              horizontal={true}
              vertical={false}
            />
          ) : null}
          <XAxis
            axisLine={false}
            className={cx(
              // base
              "text-xs",
              // text fill
              "fill-gray-500 dark:fill-gray-500",
            )}
            dataKey={index}
            fill=""
            hide={!showXAxis}
            interval={startEndOnly ? "preserveStartEnd" : intervalType}
            minTickGap={tickGap}
            padding={{ left: paddingValue, right: paddingValue }}
            stroke=""
            tick={{ transform: "translate(0, 6)" }}
            tickLine={false}
            ticks={ticks}
          >
            {xAxisLabel && (
              <Label
                className="fill-gray-800 font-medium text-sm dark:fill-gray-200"
                offset={-20}
                position="insideBottom"
              >
                {xAxisLabel}
              </Label>
            )}
          </XAxis>
          <YAxis
            allowDecimals={allowDecimals}
            axisLine={false}
            className={cx(
              // base
              "text-xs",
              // text fill
              "fill-gray-500 dark:fill-gray-500",
            )}
            domain={yAxisDomain}
            fill=""
            hide={!showYAxis}
            stroke=""
            tick={{ transform: "translate(-3, 0)" }}
            tickFormatter={type === "percent" ? valueToPercent : valueFormatter}
            tickLine={false}
            type="number"
            width={yAxisWidth}
          >
            {yAxisLabel && (
              <Label
                angle={-90}
                className="fill-gray-800 font-medium text-sm dark:fill-gray-200"
                offset={-15}
                position="insideLeft"
                style={{ textAnchor: "middle" }}
              >
                {yAxisLabel}
              </Label>
            )}
          </YAxis>
          <Tooltip
            animationDuration={100}
            content={({ active, payload, label }) => {
              const cleanPayload: TooltipProps["payload"] = payload.map((item: any) => ({
                category: item.dataKey,
                color: categoryColors.get(item.dataKey) ?? "gray",
                index: item.payload[index],
                payload: item.payload,
                type: item.type,
                value: item.value,
              }));

              if (
                tooltipCallback &&
                (active !== prevActiveRef.current || label !== prevLabelRef.current)
              ) {
                tooltipCallback({ active, label, payload: cleanPayload });
                prevActiveRef.current = active;
                prevLabelRef.current = label;
              }

              return showTooltip && active ? (
                CustomTooltip ? (
                  <CustomTooltip active={active} label={label} payload={cleanPayload} />
                ) : (
                  <ChartTooltip
                    active={active}
                    label={label}
                    payload={cleanPayload}
                    valueFormatter={valueFormatter}
                  />
                )
              ) : null;
            }}
            cursor={{ stroke: "#d1d5db", strokeWidth: 1 }}
            isAnimationActive={true}
            offset={20}
            position={{ y: 0 }}
          />

          {showLegend ? (
            <RechartsLegend
              content={({ payload }) => (
                <ChartLegend
                  activeLegend={activeLegend}
                  categoryColors={categoryColors}
                  enableLegendSlider={enableLegendSlider}
                  legendPosition={legendPosition}
                  onClick={
                    hasOnValueChange
                      ? (clickedLegendItem: string) => onCategoryClick(clickedLegendItem)
                      : undefined
                  }
                  payload={payload}
                  setLegendHeight={setLegendHeight}
                  yAxisWidth={yAxisWidth}
                />
              )}
              height={legendHeight}
              verticalAlign="top"
            />
          ) : null}
          {categories.map((category) => {
            const categoryId = `${areaId}-${category.replaceAll(/[^a-zA-Z0-9]/g, "")}`;
            return (
              <Fragment key={category}>
                <defs key={category}>
                  <linearGradient
                    className={cx(
                      getColorClassName(categoryColors.get(category) ?? "gray", "text"),
                    )}
                    id={categoryId}
                    key={category}
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    {getFillContent({
                      activeDot: activeDot,
                      activeLegend: activeLegend,
                      category: category,
                      fillType: fill,
                    })}
                  </linearGradient>
                </defs>
                <Area
                  activeDot={(dotProps: any) => {
                    const {
                      cx: cxCoord,
                      cy: cyCoord,
                      stroke,
                      strokeLinecap,
                      strokeLinejoin,
                      strokeWidth,
                      dataKey,
                    } = dotProps;
                    return (
                      <Dot
                        className={cx(
                          "stroke-white dark:stroke-gray-950",
                          onValueChange ? "cursor-pointer" : "",
                          getColorClassName(categoryColors.get(dataKey) ?? "gray", "fill"),
                        )}
                        cx={cxCoord}
                        cy={cyCoord}
                        fill=""
                        onClick={(_, event) => onDotClick(dotProps, event)}
                        r={5}
                        stroke={stroke}
                        strokeLinecap={strokeLinecap}
                        strokeLinejoin={strokeLinejoin}
                        strokeWidth={strokeWidth}
                      />
                    );
                  }}
                  className={cx(
                    getColorClassName(categoryColors.get(category) ?? "gray", "stroke"),
                  )}
                  dataKey={category}
                  dot={(dotProps: any) => {
                    const {
                      stroke,
                      strokeLinecap,
                      strokeLinejoin,
                      strokeWidth,
                      cx: cxCoord,
                      cy: cyCoord,
                      dataKey,
                      index: dotIndex,
                    } = dotProps;

                    if (
                      (hasOnlyOneValueForKey(data, category) &&
                        !(activeDot || (activeLegend && activeLegend !== category))) ||
                      (activeDot?.index === dotIndex && activeDot?.dataKey === category)
                    ) {
                      return (
                        <Dot
                          className={cx(
                            "stroke-white dark:stroke-gray-950",
                            onValueChange ? "cursor-pointer" : "",
                            getColorClassName(categoryColors.get(dataKey) ?? "gray", "fill"),
                          )}
                          cx={cxCoord}
                          cy={cyCoord}
                          fill=""
                          key={dotIndex}
                          r={5}
                          stroke={stroke}
                          strokeLinecap={strokeLinecap}
                          strokeLinejoin={strokeLinejoin}
                          strokeWidth={strokeWidth}
                        />
                      );
                    }
                    return <Fragment key={dotIndex} />;
                  }}
                  fill={`url(#${categoryId})`}
                  isAnimationActive={false}
                  key={category}
                  name={category}
                  stackId={stacked ? "stack" : undefined}
                  stroke=""
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity={activeDot || (activeLegend && activeLegend !== category) ? 0.3 : 1}
                  strokeWidth={2}
                  type="linear"
                />
              </Fragment>
            );
          })}
          {/* hidden lines to increase clickable target area */}
          {onValueChange
            ? categories.map((category) => (
                <Line
                  className={cx("cursor-pointer")}
                  connectNulls={connectNulls}
                  dataKey={category}
                  fill="transparent"
                  key={category}
                  legendType="none"
                  name={category}
                  onClick={(lineProps: any, event) => {
                    event.stopPropagation();
                    const { name } = lineProps;
                    onCategoryClick(name);
                  }}
                  stroke="transparent"
                  strokeOpacity={0}
                  strokeWidth={12}
                  tooltipType="none"
                  type="linear"
                />
              ))
            : null}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
});

AreaChart.displayName = "AreaChart";

export { AreaChart, type AreaChartEventProps, type TooltipProps };
