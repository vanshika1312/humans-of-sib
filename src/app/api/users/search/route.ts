import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ns(v: unknown, max: number) {
  return (typeof v === "string" ? v.trim() : "").slice(0, max);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ensure session maps to a real app user.
  const me = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = ns(req.nextUrl.searchParams.get("q"), 80);
  if (!q.length) return NextResponse.json({ users: [] });

  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 8,
    select: { id: true, name: true, firstName: true, lastName: true, image: true, email: true },
  });

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      name: (u.name ?? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()) || u.email,
      image: u.image,
    })),
  });
}

