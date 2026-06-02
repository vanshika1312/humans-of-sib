"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { MockEmployeeJourney } from "../_data/mockEmployeeData";

type Props = {
  growthCurve: MockEmployeeJourney["growthCurve"];
  seniorityLabels: MockEmployeeJourney["seniorityLabels"];
};

function GrowthTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { designation: string; dateLabel: string } }[];
}) {
  if (!active || !payload?.[0]) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-ink-100 bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-semibold text-ink-700">{p.designation}</div>
      <div className="mt-0.5 text-ink-400">{p.dateLabel}</div>
    </div>
  );
}

export function GrowthGraph({ growthCurve, seniorityLabels }: Props) {
  const data = useMemo(
    () =>
      growthCurve.map((p) => ({
        ...p,
        dateLabel: formatDate(p.date),
        ts: new Date(p.date).getTime(),
      })),
    [growthCurve],
  );

  const maxLevel = Math.max(...growthCurve.map((p) => p.seniorityLevel), 4);

  return (
    <Card aria-label="Career growth over time">
      <CardHeader>
        <CardTitle>Growth trajectory</CardTitle>
        <CardDescription>Designation seniority over your tenure</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-44 w-full md:h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(0,0,0,0.06)"
                vertical={false}
              />
              <XAxis
                dataKey="ts"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(ts) =>
                  new Date(ts).toLocaleDateString("en-IN", {
                    month: "short",
                    year: "2-digit",
                  })
                }
                tick={{ fontSize: 10, fill: "#737373" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0.5, maxLevel + 0.5]}
                ticks={Object.keys(seniorityLabels).map(Number)}
                tickFormatter={(v) => seniorityLabels[v] ?? ""}
                width={120}
                tick={{ fontSize: 9, fill: "#737373" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<GrowthTooltip />} />
              <Line
                type="stepAfter"
                dataKey="seniorityLevel"
                stroke="#29b6e8"
                strokeWidth={2}
                dot={{ r: 4, fill: "#29b6e8", strokeWidth: 0 }}
                activeDot={{ r: 6, fill: "#f26522" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
