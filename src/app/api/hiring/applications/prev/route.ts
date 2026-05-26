import { requireAppViewer } from "@/lib/app-viewer";
import {
  findAdjacentHiringApplicationId,
  loadHiringApplicationNavCurrent,
  safeHiringApplicationNavFrom,
} from "@/lib/hiring-application-adjacent";

export const dynamic = "force-dynamic";

const RECRUITER_ROLES = ["CEO", "ADMIN", "HR"] as const;

export async function GET(req: Request) {
  const viewer = await requireAppViewer();
  if (!viewer) {
    return Response.json(
      { ok: false, error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!RECRUITER_ROLES.includes(viewer.role as (typeof RECRUITER_ROLES)[number])) {
    return Response.json(
      { ok: false, error: "Forbidden" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const url = new URL(req.url);
  const currentId = (url.searchParams.get("currentId") ?? "").trim();
  const from = safeHiringApplicationNavFrom(url.searchParams.get("from"));

  if (!currentId) {
    return Response.json(
      { ok: false, error: "Missing currentId" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const current = await loadHiringApplicationNavCurrent(currentId);
  if (!current) {
    return Response.json(
      { ok: false, error: "Application not found" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const prevId = await findAdjacentHiringApplicationId(current, from, "prev");

  return Response.json(
    { ok: true, prevId },
    { headers: { "Cache-Control": "no-store" } },
  );
}
