/** biome-ignore-all lint/suspicious/noExplicitAny: Recharts library relies on complex, dynamically typed props that are difficult to define accurately without sacrificing maintainability. */
import { forwardRef, type HTMLAttributes, useId } from "react";
import { Fragment } from "react/jsx-runtime";
import {
  Area,
  Bar,
  Line,
  AreaChart as RechartsAreaChart,
  BarChart as RechartsBarChart,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import {
  AvailableChartColors,
  type AvailableChartColorsKeys,
  constructCategoryColors,
  getColorClassName,
  getYAxisDomain,
} from "../../lib/chart-utils";
import { cx } from "../../lib/utils";

//#region SparkAreaChart

interface SparkAreaChartProps extends HTMLAttributes<HTMLDivElement> {
  data?: Record<string, any>[];
  categories?: string[];
  index: string;
  colors?: AvailableChartColorsKeys[];
  autoMinValue?: boolean;
  minValue?: number;
  maxValue?: number;
  connectNulls?: boolean;
  type?: "default" | "stacked" | "percent";
  fill?: "gradient" | "solid" | "none";
}

const SparkAreaChart = forwardRef<HTMLDivElement, SparkAreaChartProps>((props, forwardedRef) => {
  const {
    data = [],
    categories = [],
    index,
    colors = AvailableChartColors,
    autoMinValue = false,
    minValue,
    maxValue,
    connectNulls = false,
    type = "default",
    className,
    fill = "gradient",
    ...other
  } = props;

  const categoryColors = constructCategoryColors(categories, colors);
  const yAxisDomain = getYAxisDomain(autoMinValue, minValue, maxValue);
  const stacked = type === "stacked" || type === "percent";
  const areaId = useId();

  const getFillContent = (fillType: SparkAreaChartProps["fill"]) => {
    switch (fillType) {
      case "none": {
        return <stop stopColor="currentColor" stopOpacity={0} />;
      }
      case "gradient": {
        return (
          <>
            <stop offset="5%" stopColor="currentColor" stopOpacity={0.4} />
            <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
          </>
        );
      }
      case "solid":
      case undefined:
      default: {
        return <stop stopColor="currentColor" stopOpacity={0.3} />;
      }
    }
  };

  return (
    <div
      className={cx("h-12 w-28", className)}
      ref={forwardedRef}
      tremor-id="tremor-raw"
      {...other}
    >
      <ResponsiveContainer>
        <RechartsAreaChart
          data={data}
          margin={{
            bottom: 1,
            left: 1,
            right: 1,
            top: 1,
          }}
          stackOffset={type === "percent" ? "expand" : undefined}
        >
          <XAxis dataKey={index} hide />
          <YAxis domain={yAxisDomain} hide={true} />

          {categories.map((category) => {
            const categoryId = `${areaId}-${category.replaceAll(/[^a-zA-Z0-9]/g, "")}`;
            return (
              <Fragment key={category}>
                <defs>
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
                    {getFillContent(fill)}
                  </linearGradient>
                </defs>
                <Area
                  className={cx(
                    getColorClassName(categoryColors.get(category) ?? "gray", "stroke"),
                  )}
                  connectNulls={connectNulls}
                  dataKey={category}
                  dot={false}
                  fill={`url(#${categoryId})`}
                  isAnimationActive={false}
                  name={category}
                  stackId={stacked ? "stack" : undefined}
                  stroke=""
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity={1}
                  strokeWidth={2}
                  type="linear"
                />
              </Fragment>
            );
          })}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
});

SparkAreaChart.displayName = "SparkAreaChart";

//#region SparkLineChart

interface SparkLineChartProps extends HTMLAttributes<HTMLDivElement> {
  data?: Record<string, any>[];
  categories?: string[];
  index: string;
  colors?: AvailableChartColorsKeys[];
  autoMinValue?: boolean;
  minValue?: number;
  maxValue?: number;
  connectNulls?: boolean;
}

const SparkLineChart = forwardRef<HTMLDivElement, SparkLineChartProps>((props, forwardedRef) => {
  const {
    data = [],
    categories = [],
    index,
    colors = AvailableChartColors,
    autoMinValue = false,
    minValue,
    maxValue,
    connectNulls = false,
    className,
    ...other
  } = props;

  const categoryColors = constructCategoryColors(categories, colors);
  const yAxisDomain = getYAxisDomain(autoMinValue, minValue, maxValue);

  return (
    <div
      className={cx("h-12 w-28", className)}
      ref={forwardedRef}
      tremor-id="tremor-raw"
      {...other}
    >
      <ResponsiveContainer>
        <RechartsLineChart
          data={data}
          margin={{
            bottom: 1,
            left: 1,
            right: 1,
            top: 1,
          }}
        >
          <XAxis dataKey={index} hide />
          <YAxis domain={yAxisDomain} hide={true} />
          {categories.map((category) => (
            <Line
              className={cx(getColorClassName(categoryColors.get(category) ?? "gray", "stroke"))}
              connectNulls={connectNulls}
              dataKey={category}
              dot={false}
              isAnimationActive={false}
              key={category}
              name={category}
              stroke=""
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity={1}
              strokeWidth={2}
              type="linear"
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
});

SparkLineChart.displayName = "SparkLineChart";

//#region SparkBarChart

interface BarChartProps extends HTMLAttributes<HTMLDivElement> {
  data?: Record<string, any>[];
  index: string;
  categories?: string[];
  colors?: AvailableChartColorsKeys[];
  autoMinValue?: boolean;
  minValue?: number;
  maxValue?: number;
  barCategoryGap?: string | number;
  type?: "default" | "stacked" | "percent";
}

const SparkBarChart = forwardRef<HTMLDivElement, BarChartProps>((props, forwardedRef) => {
  const {
    data = [],
    categories = [],
    index,
    colors = AvailableChartColors,
    autoMinValue = false,
    minValue,
    maxValue,
    barCategoryGap,
    type = "default",
    className,
    ...other
  } = props;

  const categoryColors = constructCategoryColors(categories, colors);

  const yAxisDomain = getYAxisDomain(autoMinValue, minValue, maxValue);
  const stacked = type === "stacked" || type === "percent";

  return (
    <div
      className={cx("h-12 w-28", className)}
      ref={forwardedRef}
      tremor-id="tremor-raw"
      {...other}
    >
      <ResponsiveContainer>
        <RechartsBarChart
          barCategoryGap={barCategoryGap}
          data={data}
          margin={{
            bottom: 1,
            left: 1,
            right: 1,
            top: 1,
          }}
          stackOffset={type === "percent" ? "expand" : undefined}
        >
          <XAxis dataKey={index} hide />
          <YAxis domain={yAxisDomain} hide={true} />

          {categories.map((category) => (
            <Bar
              className={cx(getColorClassName(categoryColors.get(category) ?? "gray", "fill"))}
              dataKey={category}
              fill=""
              isAnimationActive={false}
              key={category}
              name={category}
              stackId={stacked ? "stack" : undefined}
              type="linear"
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
});

SparkBarChart.displayName = "SparkBarChart";

export { SparkAreaChart, SparkBarChart, SparkLineChart };
