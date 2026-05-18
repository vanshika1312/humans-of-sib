"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fanoutAnnouncement } from "@/lib/notifications";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function sessionUser() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;
  return prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
}

function revalidateNotifications() {
  revalidatePath("/notifications");
  revalidatePath("/home");
  revalidatePath("/my-tasks");
  revalidatePath("/feedback/ceo");
}

export async function markNotificationRead(id: string) {
  const me = await sessionUser();
  if (!me) throw new Error("Unauthorized");
  const notificationId = typeof id === "string" ? id.trim().slice(0, 191) : "";
  if (!notificationId.length) return;

  await prisma.notification.updateMany({
    where: { id: notificationId, userId: me.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidateNotifications();
}

export async function markAllNotificationsRead() {
  const me = await sessionUser();
  if (!me) throw new Error("Unauthorized");

  await prisma.notification.updateMany({
    where: { userId: me.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidateNotifications();
}

const announcementSchema = z.object({
  title: z.string().min(3).max(200),
  body: z.string().min(0).max(5000).optional(),
});

export async function postAnnouncement(formData: FormData) {
  const me = await sessionUser();
  if (!me) throw new Error("Unauthorized");
  if (!["CEO", "ADMIN", "HR"].includes(me.role)) throw new Error("Forbidden");

  const parsed = announcementSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    const err = parsed.error.flatten();
    throw new Error(err.fieldErrors.title?.[0] || err.fieldErrors.body?.[0] || err.formErrors[0] || "Invalid input");
  }

  await fanoutAnnouncement({
    title: parsed.data.title,
    body: parsed.data.body?.trim().length ? parsed.data.body.trim() : null,
    actorUserId: me.id,
  });

  revalidateNotifications();
}

