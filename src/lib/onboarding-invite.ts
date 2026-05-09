import { randomBytes } from "crypto";

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function newOnboardingSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function onboardingInviteExpiry(): Date {
  return new Date(Date.now() + INVITE_TTL_MS);
}
