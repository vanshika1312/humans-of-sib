"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyTextButton({
  label,
  text,
  copiedLabel,
}: {
  label: string;
  text: string;
  copiedLabel?: string;
}) {
  const [done, setDone] = useState(false);

  async function handle() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    }
  }

  return (
    <Button type="button" size="sm" variant="outline" onClick={() => void handle()}>
      {done ? copiedLabel ?? "Copied" : label}
    </Button>
  );
}
