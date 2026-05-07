"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import {
  getRegularisationDaySnapshot,
  submitRegularisationForm,
  type RegularisationDaySnapshot,
} from "../actions";

type Props = {
  defaultDateIso: string;
  maxDateIso: string;
};

export function RegularisationRequestForm({ defaultDateIso, maxDateIso }: Props) {
  const [dateIso, setDateIso] = useState(defaultDateIso);
  const [fullDayPresent, setFullDayPresent] = useState(false);
  const [snapshot, setSnapshot] = useState<RegularisationDaySnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    void getRegularisationDaySnapshot(dateIso).then((snap) => {
      if (!cancelled) setSnapshot(snap);
    });
    return () => {
      cancelled = true;
    };
  }, [dateIso]);

  return (
    <form action={submitRegularisationForm} className="space-y-4">
      <input type="hidden" name="regFullDayPresent" value={fullDayPresent ? "1" : "0"} />

      <div>
        <Label htmlFor="regDate">Date to correct</Label>
        <p className="text-xs text-ink-500 mb-1.5">The calendar day you want this regularisation to apply to.</p>
        <Input
          id="regDate"
          name="regDate"
          type="date"
          required
          max={maxDateIso}
          value={dateIso}
          onChange={(e) => setDateIso(e.target.value)}
        />
      </div>

      <div className="rounded-lg border border-ink-200 bg-white px-3 py-3 space-y-2">
        <div className="text-xs font-semibold text-ink-500 uppercase tracking-wide">Current record</div>
        <p className="text-xs text-ink-500">
          What the system shows for you on this day right now (before this request is approved).
        </p>
        {snapshot === null && <p className="text-sm text-ink-400 italic">Loading…</p>}
        {snapshot?.ok === false && (
          <p className="text-sm text-ink-500">Couldn&apos;t load your record. Refresh and try again.</p>
        )}
        {snapshot?.ok === true && !snapshot.hasRow && (
          <p className="text-sm text-ink-700">{snapshot.summaryLine}</p>
        )}
        {snapshot?.ok === true && snapshot.hasRow && (
          <div className="space-y-2 text-sm">
            <dl className="grid gap-1.5 sm:grid-cols-2">
              <div className="flex gap-2 sm:contents">
                <dt className="text-ink-500 shrink-0 sm:min-w-[5.5rem]">Mode</dt>
                <dd className="font-medium text-ink-800">{snapshot.modeLabel}</dd>
              </div>
              <div className="flex gap-2 sm:contents">
                <dt className="text-ink-500 shrink-0 sm:min-w-[5.5rem]">Source</dt>
                <dd className="font-medium text-ink-800">{snapshot.sourceLabel}</dd>
              </div>
              <div className="flex gap-2 sm:col-span-2 sm:contents">
                <dt className="text-ink-500 shrink-0 sm:min-w-[5.5rem]">Punches</dt>
                <dd className="font-medium text-ink-800">
                  {snapshot.checkInLabel || snapshot.checkOutLabel
                    ? `${snapshot.checkInLabel ?? "—"} → ${snapshot.checkOutLabel ?? "—"}`
                    : "—"}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-sky-200/80 bg-sky-50/40 px-3 py-3 space-y-3">
        <div>
          <div className="text-xs font-semibold text-ink-500 uppercase tracking-wide">Requested outcome</div>
          <p className="text-xs text-ink-500 mt-0.5">
            If approved, your row for that day will be updated to match this — work location, punches, and source will
            show as regularised.
          </p>
        </div>

        <div>
          <Label htmlFor="regMode">Mode after approval</Label>
          <Select id="regMode" name="regMode" defaultValue="OFFICE" className="mt-1.5">
            <option value="OFFICE">🏢 Office</option>
            <option value="WFH">🏠 WFH</option>
          </Select>
        </div>

        <label className="flex items-start gap-2.5 rounded-lg border border-ink-100 bg-ink-50/60 p-3 cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sky-300/40">
          <input
            type="checkbox"
            className="mt-1 size-4 rounded border-ink-200 text-sky-600"
            checked={fullDayPresent}
            onChange={(e) => setFullDayPresent(e.target.checked)}
          />
          <span className="text-sm text-ink-700 leading-snug">
            <span className="font-medium">Count as full day present</span>
            <span className="block text-xs text-ink-500 mt-1">
              For late arrival or early leave when you were actually present all day — approval replaces punches with
              standard <strong className="font-medium text-ink-600">10:00–19:30 IST</strong>. You don&apos;t need to
              enter times below.
            </span>
          </span>
        </label>

        {!fullDayPresent && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="regCheckIn">Check-in time</Label>
              <Input id="regCheckIn" name="regCheckIn" type="time" required />
            </div>
            <div>
              <Label htmlFor="regCheckOut">Check-out time</Label>
              <Input id="regCheckOut" name="regCheckOut" type="time" />
            </div>
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="reason">Why does this need fixing?</Label>
        <Textarea id="reason" name="reason" required placeholder="e.g. Biometric showed late but I was on time" />
      </div>
      <Button type="submit" variant="outline">
        Submit regularisation
      </Button>
    </form>
  );
}
