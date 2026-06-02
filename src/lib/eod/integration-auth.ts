import type { NextRequest } from "next/server";

export function eodIntegrationEnabled(): boolean {
  return Boolean(process.env.EOD_INTEGRATION_SECRET?.trim());
}

export function verifyEodIntegrationRequest(req: NextRequest): boolean {
  const secret = process.env.EOD_INTEGRATION_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}
