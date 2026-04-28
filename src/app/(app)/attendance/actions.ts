"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

function today() { const d = new Date(); d.setHours(0,0,0,0); return d; }

export async function checkIn(mode: "OFFICE" | "WFH" | "FIELD", note?: string) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User not found");

  await prisma.attendance.upsert({
    where: { userId_date: { userId: user.id, date: today() } },
    update: { checkIn: new Date(), mode, note: note || undefined },
    create: { userId: user.id, date: today(), checkIn: new Date(), mode, note: note || undefined },
  });

  revalidatePath("/attendance");
  revalidatePath("/home");
}

export async function checkOut() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User not found");

  await prisma.attendance.update({
    where: { userId_date: { userId: user.id, date: today() } },
    data: { checkOut: new Date() },
  });
  revalidatePath("/attendance");
  revalidatePath("/home");
}

export async function submitCheckInForm(formData: FormData) {
  const mode = (formData.get("mode") || "OFFICE") as "OFFICE" | "WFH" | "FIELD";
  const note = String(formData.get("note") || "").trim() || undefined;
  await checkIn(mode, note);
}

export async function submitCheckOut() {
  await checkOut();
}
