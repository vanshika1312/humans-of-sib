import { candidateAuth } from "@/auth-candidate";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export type CandidateSessionUser = {
  candidateId: string;
  email: string;
  fullName: string;
};

const DEFAULT_CANDIDATE_PATH = "/careers/jobs";

/** Only allow post-auth redirects onto the public candidate site. */
export function safeCandidateCallbackUrl(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.includes("\\") || v.includes("..")) {
    return DEFAULT_CANDIDATE_PATH;
  }
  const path = v.split("?")[0] ?? v;
  if (path === "/careers" || path.startsWith("/careers/")) return v;
  return DEFAULT_CANDIDATE_PATH;
}

/** Returns the signed-in careers-portal candidate, or null. */
export async function getCandidateSession(): Promise<CandidateSessionUser | null> {
  const session = await candidateAuth();
  const candidateId = session?.user?.candidateId;
  if (!candidateId || !session?.user?.email) return null;

  const candidate = await prisma.hiringCandidate.findUnique({
    where: { id: candidateId },
    select: { id: true, email: true, fullName: true },
  });
  if (!candidate) return null;

  return {
    candidateId: candidate.id,
    email: candidate.email,
    fullName: candidate.fullName,
  };
}

export async function requireCandidateSession(
  opts?: { callbackUrl?: string },
): Promise<CandidateSessionUser> {
  const me = await getCandidateSession();
  if (!me) {
    const cb = safeCandidateCallbackUrl(opts?.callbackUrl);
    redirect(`/careers/sign-in?callbackUrl=${encodeURIComponent(cb)}`);
  }
  return me;
}

export function isCandidatePortalSession(session: {
  user?: { candidateId?: string; email?: string | null } | null;
} | null): boolean {
  return Boolean(session?.user?.candidateId && session.user.email);
}
