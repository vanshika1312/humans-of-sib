"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { submitRegularisationForm } from "../actions";

type Props = {
  defaultDateIso: string;
  maxDateIso: string;
};

export function RegularisationRequestForm({ defaultDateIso, maxDateIso }: Props) {
  const [fullDayPresent, setFullDayPresent] = useState(false);

  return (
    <form action={submitRegularisationForm} className="space-y-3">
      <input type="hidden" name="regFullDayPresent" value={fullDayPresent ? "1" : "0"} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="regDate">Date</Label>
          <Input
            id="regDate"
            name="regDate"
            type="date"
            required
            max={maxDateIso}
            defaultValue={defaultDateIso}
          />
        </div>
        <div>
          <Label htmlFor="regMode">Mode</Label>
          <Select id="regMode" name="regMode" defaultValue="OFFICE">
            <option value="OFFICE">🏢 Office</option>
            <option value="WFH">🏠 WFH</option>
          </Select>
        </div>
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
            standard <strong className="font-medium text-ink-600">09:00–18:00 IST</strong>. You don&apos;t need to enter
            times below.
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
