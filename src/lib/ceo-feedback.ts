import { prisma } from "@/lib/prisma";

const DEFAULT_CEO_INBOX_EMAIL = "prateek@skillinabox.in";

const ceoProfileSelect = {
  id: true,
  name: true,
  image: true,
  email: true,
  role: true,
} as const;

/** Primary CEO inbox owner — defaults to Prateek; override with CEO_INBOX_EMAIL. */
export async function getCeoInboxRecipient() {
  const email = (process.env.CEO_INBOX_EMAIL ?? DEFAULT_CEO_INBOX_EMAIL).trim().toLowerCase();

  const byEmail = await prisma.user.findFirst({
    where: { email, status: "ACTIVE" },
    select: ceoProfileSelect,
  });
  if (byEmail) return byEmail;

  return prisma.user.findFirst({
    where: { role: "CEO", status: "ACTIVE" },
    select: ceoProfileSelect,
    orderBy: { createdAt: "asc" },
  });
}

export async function getCeoInboxRecipientId(): Promise<string | null> {
  const ceo = await getCeoInboxRecipient();
  return ceo?.id ?? null;
}
