import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Table } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sensorService } from "@/services/sensorService";

const METRICS = [
  { key: "temperature", label: "Nhiệt độ", unit: "°C", stroke: "#ef4444", fill: "#fecaca" },
  { key: "humidity", label: "Độ ẩm KK", unit: "%", stroke: "#3b82f6", fill: "#bfdbfe" },
  { key: "soil_moisture", label: "Độ ẩm đất", unit: "%", stroke: "#22c55e", fill: "#bbf7d0" },
  { key: "light", label: "Ánh sáng", unit: "lux", stroke: "#eab308", fill: "#fef08a" },
  { key: "gas", label: "Khí gas", unit: "ppm", stroke: "#f97316", fill: "#fed7aa" },
];

const CHART_HEIGHT = 300;
const HISTORY_LIMIT = 50;
const SKELETON_ROWS = 8;

function getCreatedAt(item) {
  return item?.created_at || item?.created_date || null;
}

function formatNumber(value) {
  if (value == null || value === "") return "--";
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return Number.isInteger(number) ? number.toString() : number.toFixed(1);
}

function formatRowTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return format(date, "dd/MM/yyyy HH:mm:ss");
}

function formatChartTick(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "HH:mm");
}

function ChartTooltip({ active, payload, metric }) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <div className="rounded-md border bg-popover text-popover-foreground shadow-sm px-3 py-2 text-xs">
      <div className="text-muted-foreground">
        {point.fullTime ? format(new Date(point.fullTime), "dd/MM/yyyy HH:mm:ss") : ""}
      </div>
      <div className="font-semibold mt-1">
        {metric.label}: {formatNumber(point.value)}
        {metric.unit ? ` ${metric.unit}` : ""}
      </div>
    </div>
  );
}

export default function History() {
  const [metricKey, setMetricKey] = useState("temperature");
  const metric = METRICS.find((m) => m.key === metricKey) || METRICS[0];

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["sensorData", "history"],
    queryFn: () => sensorService.listLatest(HISTORY_LIMIT),
    refetchOnMount: "always",
  });

  const orderedHistory = useMemo(() => {
    return [...history].sort((a, b) => {
      const ta = new Date(getCreatedAt(a) || 0).getTime();
      const tb = new Date(getCreatedAt(b) || 0).getTime();
      return ta - tb;
    });
  }, [history]);

  const chartData = useMemo(() => {
    return orderedHistory
      .map((item) => {
        const ts = getCreatedAt(item);
        const raw = item?.[metric.key];
        const number = raw == null || raw === "" ? null : Number(raw);
        const value = Number.isFinite(number) ? number : null;
        return value == null
          ? null
          : { fullTime: ts, time: formatChartTick(ts), value };
      })
      .filter(Boolean);
  }, [orderedHistory, metric.key]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Lịch sử cảm biến</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Theo dõi dữ liệu môi trường đã ghi nhận
        </p>
      </div>

      {/* Chart card */}
      <Card className="p-5 border-0 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="text-base font-semibold">Biểu đồ {metric.label}</h2>
          <div className="w-full sm:w-56">
            <Select value={metricKey} onValueChange={setMetricKey}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn chỉ số" />
              </SelectTrigger>
              <SelectContent>
                {METRICS.map((m) => (
                  <SelectItem key={m.key} value={m.key}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div
            className="flex items-center justify-center text-sm text-muted-foreground animate-pulse"
            style={{ height: CHART_HEIGHT }}
          >
            Đang tải dữ liệu...
          </div>
        ) : chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <AreaChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`history-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={metric.fill} stopOpacity={0.85} />
                  <stop offset="100%" stopColor={metric.fill} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={["auto", "auto"]}
                width={40}
              />
              <Tooltip content={<ChartTooltip metric={metric} />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={metric.stroke}
                strokeWidth={2}
                fill={`url(#history-${metric.key})`}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div
            className="flex items-center justify-center text-sm text-muted-foreground"
            style={{ height: CHART_HEIGHT }}
          >
            Chưa có dữ liệu
          </div>
        )}
      </Card>

      {/* Data table */}
      <Card className="p-5 border-0 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Table className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Bảng dữ liệu</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b">
                <th className="px-3 py-2.5">Thời gian</th>
                <th className="px-3 py-2.5">Nhiệt độ (°C)</th>
                <th className="px-3 py-2.5">Độ ẩm KK (%)</th>
                <th className="px-3 py-2.5">Độ ẩm đất (%)</th>
                <th className="px-3 py-2.5">Ánh sáng (lux)</th>
                <th className="px-3 py-2.5">Khí gas (ppm)</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: SKELETON_ROWS }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="border-b last:border-b-0 animate-pulse">
                    {Array.from({ length: 6 }).map((__, cellIdx) => (
                      <td key={cellIdx} className="px-3 py-3">
                        <div className="h-3 rounded bg-muted/70" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : history.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    Chưa có dữ liệu
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b last:border-b-0 transition-colors hover:bg-muted/50"
                  >
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                      {formatRowTime(getCreatedAt(item))}
                    </td>
                    <td className="px-3 py-2.5 font-medium">{formatNumber(item.temperature)}</td>
                    <td className="px-3 py-2.5 font-medium">{formatNumber(item.humidity)}</td>
                    <td className="px-3 py-2.5 font-medium">{formatNumber(item.soil_moisture)}</td>
                    <td className="px-3 py-2.5 font-medium">{formatNumber(item.light)}</td>
                    <td className="px-3 py-2.5 font-medium">{formatNumber(item.gas)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
