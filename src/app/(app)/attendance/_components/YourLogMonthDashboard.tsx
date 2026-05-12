"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatTime } from "@/lib/utils";

export type AttendanceMode = "OFFICE" | "WFH";

export type YourLogDayKind = "pad" | "off" | "empty" | "on_time" | "late" | "half";

export type YourLogDayDetail = {
  id: string;
  dateIso: string;
  checkInIso: string | null;
  checkOutIso: string | null;
  mode: AttendanceMode;
  source: string;
  note: string | null;
  location: string | null;
  biometricCode: string | null;
  late: boolean;
  half: boolean;
};

export type YourLogDayCell = {
  kind: YourLogDayKind;
  /** Calendar day 1–31 when kind !== pad */
  day?: number;
  iso?: string;
  detail?: YourLogDayDetail | null;
};

export type YourLogMonthDashboardProps = {
  monthTitle: string;
  workingDaysInMonth: number;
  lateCount: number;
  onTimeCount: number;
  halfDayCount: number;
  halfDayDatesLabel: string;
  lateRatePct: number;
  monthYearLabel: string;
  weekdays: readonly string[];
  cells: YourLogDayCell[];
  /** Chronological list of late arrival days (same rule as payroll / summary count). */
  lateArrivalsReport: YourLogDayDetail[];
};

function modeLabel(mode: AttendanceMode) {
  if (mode === "WFH") return "🏠 WFH";
  return "🏢 Office";
}

function sourceShort(src: string) {
  if (src === "BIOMETRIC") return "Bio";
  if (src === "REGULARISED") return "Reg";
  return "App";
}

function sourceBadgeTone(src: string): "sky" | "sun" | "orange" | "ink" {
  if (src === "BIOMETRIC") return "orange";
  if (src === "REGULARISED") return "sun";
  return "sky";
}

function cellClasses(kind: YourLogDayKind): string {
  switch (kind) {
    case "pad":
      return "";
    case "off":
      return "rounded-lg border border-ink-100 bg-ink-50/80 text-ink-400 text-center py-2 text-sm";
    case "empty":
      return "rounded-lg border border-dashed border-ink-200/80 bg-white text-ink-400 text-center py-2 text-sm";
    case "on_time":
      return "rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-center py-2 text-sm font-medium shadow-sm cursor-pointer hover:ring-2 hover:ring-emerald-300/60";
    case "late":
      return "rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-center py-2 text-sm font-medium shadow-sm cursor-pointer hover:ring-2 hover:ring-rose-300/60";
    case "half":
      return "rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-center py-2 text-sm font-medium shadow-sm cursor-pointer hover:ring-2 hover:ring-amber-300/60";
    default:
      return "";
  }
}

function LateArrivalsReportModal({
  rows,
  monthYearLabel,
  onClose,
  onOpenDay,
}: {
  rows: YourLogDayDetail[];
  monthYearLabel: string;
  onClose: () => void;
  onOpenDay: (iso: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <Card
        className="relative z-10 w-full max-w-lg shadow-lg max-h-[85vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="your-log-late-report-title"
        onClick={(e) => e.stopPropagation()}
      >
        <CardContent className="pt-4 pb-4 flex flex-col min-h-0 gap-3">
          <div className="flex items-start justify-between gap-2 shrink-0">
            <div>
              <h3 id="your-log-late-report-title" className="text-base font-semibold text-ink-800">
                Late arrivals
              </h3>
              <p className="text-xs text-ink-500 mt-0.5">{monthYearLabel}</p>
              <p className="text-[11px] text-ink-500 mt-2">
                Mon–Sat working days only. Late = first check-in after 10:10 IST (same as payroll).
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" className="shrink-0 h-8 text-xs" onClick={onClose}>
              Close
            </Button>
          </div>
          {rows.length === 0 ? (
            <p className="text-sm text-ink-600 py-4">No late arrivals recorded this month.</p>
          ) : (
            <ul className="overflow-y-auto space-y-2 pr-1 -mr-1 min-h-0 flex-1 max-h-[min(60vh,28rem)]">
              {rows.map((d) => {
                const label = formatDate(new Date(d.dateIso + "T00:00:00.000Z"), {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                });
                return (
                  <li
                    key={d.id}
                    className="rounded-lg border border-ink-100 bg-ink-50/40 px-3 py-2.5 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium text-ink-800">{label}</div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={() => {
                          onOpenDay(d.dateIso);
                          onClose();
                        }}
                      >
                        Day details
                      </Button>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-2 items-center">
                      <Badge tone={d.mode === "WFH" ? "sun" : "sky"}>{modeLabel(d.mode)}</Badge>
                      <Badge tone={sourceBadgeTone(d.source)}>{sourceShort(d.source)}</Badge>
                      {d.half ? <Badge tone="sun">½ day (hours)</Badge> : null}
                      <span className="text-xs text-ink-600 tabular-nums">
                        <span className="text-rose-700 font-semibold">
                          In {d.checkInIso ? formatTime(new Date(d.checkInIso)) : "—"}
                        </span>
                        <span className="text-ink-400"> · </span>
                        <span>
                          out {d.checkOutIso ? formatTime(new Date(d.checkOutIso)) : "—"}
                        </span>
                      </span>
                    </div>
                    {d.note ? (
                      <p className="text-[11px] text-ink-500 italic mt-1.5 truncate" title={d.note}>
                        &quot;{d.note}&quot;
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DetailModal({
  cell,
  onClose,
}: {
  cell: YourLogDayCell;
  onClose: () => void;
}) {
  const d = cell.detail;
  const label =
    cell.iso &&
    (() => {
      try {
        return formatDate(new Date(cell.iso + "T00:00:00.000Z"), {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });
      } catch {
        return cell.iso;
      }
    })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <Card
        className="relative z-10 w-full max-w-md shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="your-log-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 id="your-log-detail-title" className="text-base font-semibold text-ink-800">
              {label ?? "Day details"}
            </h3>
            <Button type="button" variant="ghost" size="sm" className="shrink-0 h-8 text-xs" onClick={onClose}>
              Close
            </Button>
          </div>
          {!d ? (
            <p className="text-sm text-ink-600">No attendance recorded for this day.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge tone={d.mode === "WFH" ? "sun" : "sky"}>{modeLabel(d.mode)}</Badge>
                <Badge tone={sourceBadgeTone(d.source)}>{sourceShort(d.source)}</Badge>
                {d.late ? (
                  <Badge tone="orange" title="Check-in after 10:10 IST (Mon–Sat)">
                    Late
                  </Badge>
                ) : null}
                {d.half ? <Badge tone="sun">½ day (hours)</Badge> : null}
              </div>
              <p className="text-ink-700">
                <span className="text-ink-500">In · out</span>{" "}
                <span className="font-medium tabular-nums">
                  {d.checkInIso ? formatTime(new Date(d.checkInIso)) : "—"} →{" "}
                  {d.checkOutIso ? formatTime(new Date(d.checkOutIso)) : "—"}
                </span>
              </p>
              {d.location ? (
                <p className="text-ink-600">
                  <span className="text-ink-500">Location</span> {d.location}
                </p>
              ) : null}
              {d.biometricCode ? (
                <p className="text-ink-600">
                  <span className="text-ink-500">Device code</span>{" "}
                  <span className="font-mono text-xs">{d.biometricCode}</span>
                </p>
              ) : null}
              {d.note ? (
                <p className="text-ink-600 italic border-t border-ink-100 pt-2">&quot;{d.note}&quot;</p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function YourLogMonthDashboard(props: YourLogMonthDashboardProps) {
  const {
    monthTitle,
    workingDaysInMonth,
    lateCount,
    onTimeCount,
    halfDayCount,
    halfDayDatesLabel,
    lateRatePct,
    monthYearLabel,
    weekdays,
    cells,
    lateArrivalsReport,
  } = props;

  const [selected, setSelected] = useState<YourLogDayCell | null>(null);
  const [lateReportOpen, setLateReportOpen] = useState(false);

  function openDayByIso(iso: string) {
    const cell = cells.find((c) => c.iso === iso && c.kind !== "pad");
    if (cell) {
      setSelected(cell);
    }
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          className="rounded-xl border border-ink-100 bg-white px-4 py-3 shadow-sm text-left transition hover:border-rose-200 hover:bg-rose-50/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
          onClick={() => {
            setSelected(null);
            setLateReportOpen(true);
          }}
          aria-haspopup="dialog"
          aria-expanded={lateReportOpen}
          aria-label={`Late arrivals: ${lateCount} of ${workingDaysInMonth} working days. Open report.`}
        >
          <p className="text-xs font-medium text-ink-500 uppercase tracking-wider">Late arrivals</p>
          <p className="text-2xl font-semibold tabular-nums text-rose-700 mt-1">{lateCount}</p>
          <p className="text-xs text-ink-500 mt-0.5">of {workingDaysInMonth} working days</p>
          <p className="text-[10px] text-rose-600/90 mt-1 font-medium">Tap for report →</p>
        </button>
        <div className="rounded-xl border border-ink-100 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-medium text-ink-500 uppercase tracking-wider">On-time days</p>
          <p className="text-2xl font-semibold tabular-nums text-emerald-700 mt-1">{onTimeCount}</p>
          <p className="text-xs text-ink-500 mt-0.5">of {workingDaysInMonth} working days</p>
        </div>
        <div className="rounded-xl border border-ink-100 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-medium text-ink-500 uppercase tracking-wider">Punch half-days</p>
          <p className="text-2xl font-semibold tabular-nums text-amber-700 mt-1">{halfDayCount}</p>
          <p className="text-xs text-ink-600 mt-0.5 line-clamp-2" title={halfDayDatesLabel || undefined}>
            {halfDayCount === 0 ? "—" : halfDayDatesLabel}
          </p>
        </div>
        <div className="rounded-xl border border-ink-100 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-medium text-ink-500 uppercase tracking-wider">Late rate</p>
          <p className="text-2xl font-semibold tabular-nums text-ink-800 mt-1">{lateRatePct}%</p>
          <p className="text-xs text-ink-500 mt-0.5">{monthYearLabel}</p>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-xs font-bold text-ink-500 uppercase tracking-wider mb-2">{monthTitle}</h3>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {weekdays.map((w) => (
            <div key={w} className="text-center text-[10px] sm:text-xs font-semibold text-ink-400 py-1">
              {w}
            </div>
          ))}
          {cells.map((cell, i) => {
            if (cell.kind === "pad") {
              return <div key={`pad-${i}`} className="min-h-[2.5rem]" />;
            }
            const dayNum = cell.day ?? 0;
            const clickable =
              cell.kind === "on_time" || cell.kind === "late" || cell.kind === "half" || cell.kind === "empty";

            if (!clickable) {
              return (
                <div key={cell.iso ?? `${cell.kind}-${dayNum}`} className={cellClasses(cell.kind)}>
                  {dayNum}
                </div>
              );
            }

            return (
              <button
                key={cell.iso ?? `day-${dayNum}`}
                type="button"
                className={`${cellClasses(cell.kind)} w-full min-h-[2.5rem]`}
                onClick={() => {
                  setLateReportOpen(false);
                  setSelected(cell);
                }}
                aria-label={`${dayNum}${cell.kind === "empty" ? ", no attendance" : ", view details"}`}
              >
                {dayNum}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-ink-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-emerald-50 border border-emerald-200" />
            On time
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-rose-50 border border-rose-200" />
            Late
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-amber-50 border border-amber-200" />
            Half-day
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-ink-50 border border-ink-100" />
            Off / Sunday
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-dashed border-ink-200 bg-white" />
            No punch
          </span>
        </div>

        <p className="mt-3 text-[11px] text-ink-400">
          Same rules as payroll: Mon–Sat working days; Sunday off. Late = first check-in after 10:10 IST. Half-day =
          hours between policy thresholds when both punches exist. Tap a day for times and source.
        </p>
      </div>

      {lateReportOpen ? (
        <LateArrivalsReportModal
          rows={lateArrivalsReport}
          monthYearLabel={monthYearLabel}
          onClose={() => setLateReportOpen(false)}
          onOpenDay={openDayByIso}
        />
      ) : null}
      {selected ? <DetailModal cell={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}
