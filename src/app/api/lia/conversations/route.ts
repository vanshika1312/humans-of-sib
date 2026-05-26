import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isLiaEnabled } from "@/lib/lia-config";
import { requireLiaApiViewer } from "@/lib/lia-api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await requireLiaApiViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isLiaEnabled()) {
    return NextResponse.json(
      { error: "LIA is not available." },
      { status: 503 },
    );
  }

  const conversations = await prisma.liaConversation.findMany({
    where: { userId: viewer.id },
    orderBy: { updatedAt: "desc" },
    take: 40,
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, role: true, createdAt: true },
      },
    },
  });

  return NextResponse.json({
    conversations: conversations.map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      preview: c.messages[0]?.content?.slice(0, 120) ?? null,
    })),
  });
}
