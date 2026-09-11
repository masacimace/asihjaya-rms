"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Label,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
export type SalesTrendPoint = {
  dateKey: string;
  label: string;
  revenue: number;
  transactionCount: number;
  itemSold: number;
};

const chartConfig = {
  revenue: {
    label: "Penjualan",
    color: "var(--accent)",
  },
} satisfies ChartConfig;

function formatMoney(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactMoney(value: number) {
  if (value <= 0) return "0";

  if (value >= 1_000_000_000) {
    return `${new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: value >= 10_000_000_000 ? 0 : 1,
    }).format(value / 1_000_000_000)}M`;
  }

  if (value >= 1_000_000) {
    return `${new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: value >= 10_000_000 ? 0 : 1,
    }).format(value / 1_000_000)}Jt`;
  }

  if (value >= 1_000) {
    return `${new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: 0,
    }).format(value / 1_000)}Rb`;
  }

  return formatInteger(value);
}

function getRoundedChartMax(value: number) {
  if (value <= 0) return 5_000_000;

  const step = value >= 50_000_000 ? 10_000_000 : 5_000_000;

  return Math.ceil(value / step) * step;
}

export function SalesTrendChart({
  points,
  averageRevenue,
  hasRevenue,
  bestLabel,
}: {
  points: SalesTrendPoint[];
  averageRevenue: number;
  hasRevenue: boolean;
  bestLabel: string;
}) {
  const bestPoint = points.reduce(
    (selected, point) => (point.revenue > selected.revenue ? point : selected),
    points[0] ?? {
      dateKey: "",
      label: "-",
      revenue: 0,
      transactionCount: 0,
      itemSold: 0,
    },
  );
  const maxAxisValue = getRoundedChartMax(
    Math.max(...points.map((point) => point.revenue), averageRevenue, 0),
  );

  return (
    <div className="relative mt-5 min-w-0">
      {!hasRevenue ? (
        <div className="pointer-events-none absolute inset-x-4 top-1/2 z-10 -translate-y-1/2 rounded-2xl border border-dashed border-[var(--border)] bg-white/90 px-4 py-5 text-center sm:inset-x-12">
          <p className="text-sm font-medium text-neutral-900">
            Belum ada penjualan pada periode ini.
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Transaksi completed akan otomatis muncul di grafik.
          </p>
        </div>
      ) : null}

      <ChartContainer
        config={chartConfig}
        className="h-[260px] w-full min-w-0 sm:h-[300px] xl:h-[320px]"
      >
        <AreaChart
          accessibilityLayer
          data={points}
          margin={{ top: 16, right: 12, bottom: 4, left: 0 }}
        >
          <defs>
            <linearGradient
              id="salesRevenueGradient"
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="var(--color-revenue)"
                stopOpacity={0.24}
              />
              <stop
                offset="100%"
                stopColor="var(--color-revenue)"
                stopOpacity={0.02}
              />
            </linearGradient>
          </defs>

          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeOpacity={0.9}
          />

          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tickMargin={10}
            minTickGap={28}
            interval="preserveStartEnd"
            tick={{ fill: "var(--muted)", fontSize: 10 }}
          />

          <YAxis
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            width={44}
            tickCount={5}
            tickFormatter={formatCompactMoney}
            tick={{ fill: "var(--muted)", fontSize: 10 }}
            domain={[0, maxAxisValue]}
          />

          {averageRevenue > 0 ? (
            <ReferenceLine
              y={averageRevenue}
              stroke="var(--accent)"
              strokeDasharray="5 6"
              strokeOpacity={0.5}
              strokeWidth={1.25}
            >
              <Label
                value={`Rata-rata ${formatCompactMoney(averageRevenue)}`}
                position="insideTopRight"
                fill="var(--muted)"
                fontSize={10}
              />
            </ReferenceLine>
          ) : null}

          <ChartTooltip
            cursor={{
              stroke: "var(--accent)",
              strokeDasharray: "4 5",
              strokeOpacity: 0.3,
            }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as
                | SalesTrendPoint
                | undefined;

              if (!active || !point) {
                return null;
              }

              const isBestPoint =
                hasRevenue && point.dateKey === bestPoint.dateKey;

              return (
                <div className="min-w-44 rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-xs shadow-lg">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-neutral-900">
                      {point.label}
                    </p>
                    {isBestPoint ? (
                      <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                        {bestLabel}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-2 grid gap-1.5">
                    <div className="flex items-center justify-between gap-5">
                      <span className="text-[var(--muted)]">Penjualan</span>
                      <span className="font-semibold tabular-nums text-neutral-950">
                        {formatMoney(point.revenue)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-5">
                      <span className="text-[var(--muted)]">Transaksi</span>
                      <span className="font-medium tabular-nums text-neutral-800">
                        {formatInteger(point.transactionCount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-5">
                      <span className="text-[var(--muted)]">Item terjual</span>
                      <span className="font-medium tabular-nums text-neutral-800">
                        {formatInteger(point.itemSold)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }}
          />

          <Area
            type="monotone"
            dataKey="revenue"
            stroke="var(--color-revenue)"
            strokeWidth={2.5}
            fill="url(#salesRevenueGradient)"
            activeDot={{
              r: 6,
              fill: "var(--accent)",
              stroke: "white",
              strokeWidth: 3,
            }}
            dot={(dotProps) => {
              const {
                cx,
                cy,
                payload,
              } = dotProps as {
                cx?: number;
                cy?: number;
                payload?: SalesTrendPoint;
              };

              if (
                typeof cx !== "number" ||
                typeof cy !== "number" ||
                !payload
              ) {
                return <g />;
              }

              const isBestPoint =
                hasRevenue && payload.dateKey === bestPoint.dateKey;

              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={isBestPoint ? 5 : 3.25}
                  fill={isBestPoint ? "var(--accent)" : "white"}
                  stroke="var(--accent)"
                  strokeWidth={isBestPoint ? 2.5 : 1.75}
                />
              );
            }}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
