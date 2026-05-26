"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea, Label } from "@/components/ui/input";
import { submitPulse } from "../actions";

const FACES = [
  { v: 1, e: "😩", l: "Tough" },
  { v: 2, e: "😕", l: "Meh" },
  { v: 3, e: "😐", l: "Okay" },
  { v: 4, e: "🙂", l: "Good" },
  { v: 5, e: "🤩", l: "Great" },
] as const;

type Props = {
  initialScore?: number;
  initialComment?: string;
  hasExisting: boolean;
};

export function PulseSubmissionForm({ initialScore, initialComment, hasExisting }: Props) {
  const [selected, setSelected] = useState<number | undefined>(initialScore);

  return (
    <form action={submitPulse} className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {FACES.map((f) => (
          <label
            key={f.v}
            className={`cursor-pointer rounded-xl p-3 text-center border-2 transition-colors ${
              selected === f.v ? "border-sky-500 bg-sky-50" : "border-ink-100 hover:border-ink-200"
            }`}
          >
            <input
              type="radio"
              name="score"
              value={f.v}
              checked={selected === f.v}
              onChange={() => setSelected(f.v)}
              className="sr-only"
              required
            />
            <div className="text-3xl">{f.e}</div>
            <div className="text-xs font-medium text-ink-600 mt-1">{f.l}</div>
          </label>
        ))}
      </div>
      <div>
        <Label htmlFor="comment">Why? (optional, just for you)</Label>
        <Textarea
          id="comment"
          name="comment"
          rows={3}
          defaultValue={initialComment ?? ""}
          placeholder="Anything specific making this week this way?"
        />
      </div>
      <Button type="submit" className="w-full" variant="accent">
        {hasExisting ? "Update pulse" : "Submit pulse"}
      </Button>
    </form>
  );
}
