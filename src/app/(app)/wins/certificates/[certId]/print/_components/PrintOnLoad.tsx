"use client";

import { useEffect } from "react";

export function PrintOnLoad() {
  useEffect(() => {
    const t = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}
