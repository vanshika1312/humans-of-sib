"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Soft refresh so recruiter stage changes show up without a full reload. */
export function ApplicationsLiveRefresh({ intervalMs = 20000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = window.setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
