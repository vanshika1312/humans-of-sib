import type { WinRewardType } from "@/generated/prisma";
import { descriptionWithRecipientMention } from "@/lib/mentions";
import { createNotification } from "@/lib/notifications";

export function displayNameForMention(user: {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
}) {
  const fromParts = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return user.name?.trim() || fromParts || "Team member";
}

export function winDescriptionWithRecipientTag(
  description: string | undefined,
  recipient: { id: string; name: string | null; firstName: string | null; lastName: string | null },
) {
  return descriptionWithRecipientMention(
    description,
    recipient.id,
    displayNameForMention(recipient),
  );
}

export async function notifyWinRecipient(args: {
  recipientUserId: string;
  actorUserId: string;
  winId: string;
  title: string;
  rewardLabel?: string | null;
  rewardType: WinRewardType;
  variant: "celebration" | "nomination" | "certificate";
}) {
  if (args.recipientUserId === args.actorUserId) return;

  const titles = {
    celebration: "You were celebrated on the Win Wall",
    nomination: "You were nominated for a win",
    certificate: "Your certificate was shared on the Win Wall",
  };

  const rewardBit = args.rewardLabel?.trim();
  const body = rewardBit ? `${rewardBit} — ${args.title}` : args.title;

  try {
    await createNotification({
      userId: args.recipientUserId,
      kind: "WIN_RECOGNITION",
      title: titles[args.variant],
      body,
      href: "/wins?tab=wall",
      actorUserId: args.actorUserId,
      meta: { winId: args.winId, rewardType: args.rewardType, variant: args.variant },
    });
  } catch {
    // non-critical
  }
}
