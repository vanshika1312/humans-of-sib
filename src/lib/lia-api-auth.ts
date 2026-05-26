import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type LiaApiViewer = {
  id: string;
  email: string;
  invitationPending: boolean;
};

export async function requireLiaApiViewer(): Promise<LiaApiViewer | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, invitationPending: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") return null;
  if (user.invitationPending) return null;
  return { id: user.id, email: user.email, invitationPending: user.invitationPending };
}
