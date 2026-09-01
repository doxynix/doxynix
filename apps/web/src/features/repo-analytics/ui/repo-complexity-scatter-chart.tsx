"use client";

import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import type { RepoMetricsItem } from "@/entities/repo/model/repo.types";

type NonNullRouterOutput = NonNullable<RepoMetricsItem>;

type HotspotSignal = NonNullRouterOutput["architecture"]["hotspotSignals"][number];

type Props = {
  data: HotspotSignal[];
};

export function ComplexityScatterChart({ data }: Readonly<Props>) {
  const chartData = data.map((item) => ({
    fullPath: item.path,
    name: item.path.split("/").pop(),
    x: item.lines,
    y: item.complexity,
    z: item.score,
  }));

  return (
    <div className="h-100 w-full pt-4">
      <ResponsiveContainer height="100%" width="100%">
        <ScatterChart margin={{ bottom: 20, left: 0, right: 20, top: 20 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />

          <XAxis
            axisLine={false}
            dataKey="x"
            fontSize={12}
            label={{
              fill: "var(--muted-foreground)",
              fontSize: 10,
              offset: 0,
              position: "bottom",
              value: "Lines of Code",
            }}
            name="Lines"
            stroke="var(--muted-foreground)"
            tickLine={false}
            type="number"
          />

          <YAxis
            axisLine={false}
            dataKey="y"
            fontSize={12}
            label={{
              angle: -90,
              fill: "var(--muted-foreground)",
              fontSize: 10,
              position: "insideLeft",
              value: "Complexity",
            }}
            name="Complexity"
            stroke="var(--muted-foreground)"
            tickLine={false}
            type="number"
          />

          <ZAxis dataKey="z" range={[50, 400]} type="number" />

          <Tooltip
            content={({ active, payload }) => {
              if (active != null && payload != null && payload.length !== 0) {
                const data = payload[0]?.payload;
                return (
                  <div className="rounded-md border border-border bg-popover p-2 shadow-md">
                    <p className="font-mono text-[10px] text-blue-400">{data.name}</p>
                    <div className="mt-1 flex flex-col gap-1">
                      <p className="text-foreground text-xs">
                        Complexity: <span className="font-bold">{data.y}</span>
                      </p>
                      <p className="text-foreground text-xs">
                        Lines: <span className="font-bold">{data.x}</span>
                      </p>
                      <p className="text-orange-500 text-xs">
                        Risk Score: <span className="font-bold">{data.z}</span>
                      </p>
                    </div>
                  </div>
                );
              }
              return null;
            }}
            cursor={{ strokeDasharray: "3 3" }}
          />

          <ReferenceLine
            label={{ fill: "#ef4444", fontSize: 10, value: "High Complexity" }}
            stroke="#ef4444"
            strokeDasharray="3 3"
            y={15}
          />
          <ReferenceLine
            label={{ fill: "#f59e0b", fontSize: 10, value: "Large File" }}
            stroke="#f59e0b"
            strokeDasharray="3 3"
            x={300}
          />

          <Scatter data={chartData} name="Files">
            {chartData.map((entry, index) => (
              <Cell
                className="cursor-crosshair opacity-80 transition-opacity hover:opacity-100"
                fill={entry.y > 15 ? "var(--destructive)" : "var(--primary)"}
                key={`cell-${index}`}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
