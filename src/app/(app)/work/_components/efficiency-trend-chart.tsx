"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { EfficiencyTrendPoint } from "@/lib/work-tracking/snapshots";

export function EfficiencyTrendChart({ data }: { data: EfficiencyTrendPoint[] }) {
  const chartData = data.map((d) => ({
    date: d.date.slice(5),
    efficiency: d.efficiencyPct,
    eod: d.eodSubmitted ? 1 : 0,
    delivered: d.deliveredQuantity,
    assigned: d.assignedQuantity,
  }));

  if (chartData.every((d) => d.efficiency === 0 && d.eod === 0)) {
    return <p className="text-sm text-ink-500 py-8 text-center">No efficiency data yet. Complete assigned tasks and submit EODs.</p>;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#737373" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#737373" unit="%" />
          <Tooltip
            formatter={(value, _name, props) => {
              const p = props?.payload as { delivered?: number; assigned?: number } | undefined;
              const detail =
                p?.assigned != null && p.assigned > 0
                  ? `${p.delivered ?? 0}/${p.assigned} delivered`
                  : null;
              return [`${value ?? 0}%${detail ? ` (${detail})` : ""}`, "Efficiency"];
            }}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Line type="monotone" dataKey="efficiency" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
