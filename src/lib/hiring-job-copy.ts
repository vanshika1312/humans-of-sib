import type { HiringJobWorkArrangement } from "@/generated/prisma";

export const WORK_ARRANGEMENT_LABEL: Record<HiringJobWorkArrangement, string> = {
  REMOTE: "Remote",
  HYBRID: "Hybrid",
  ON_SITE: "On-site",
};

export const WORK_ARRANGEMENT_OPTIONS: { value: HiringJobWorkArrangement; label: string }[] = [
  { value: "REMOTE", label: WORK_ARRANGEMENT_LABEL.REMOTE },
  { value: "HYBRID", label: WORK_ARRANGEMENT_LABEL.HYBRID },
  { value: "ON_SITE", label: WORK_ARRANGEMENT_LABEL.ON_SITE },
];

export function isWorkArrangement(value: string): value is HiringJobWorkArrangement {
  return value === "REMOTE" || value === "HYBRID" || value === "ON_SITE";
}
