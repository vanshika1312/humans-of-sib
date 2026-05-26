import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isLiaEnabled } from "@/lib/lia-config";
import { requireLiaApiViewer } from "@/lib/lia-api-auth";
import type { LiaSource } from "@/lib/lia-sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSources(raw: unknown): LiaSource[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x) => x && typeof x === "object")
    .map((x) => x as { title?: unknown; href?: unknown; external?: unknown })
    .filter((x) => typeof x.title === "string" && typeof x.href === "string")
    .map((x) => ({
      title: x.title as string,
      href: x.href as string,
      external: Boolean(x.external),
    }));
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const viewer = await requireLiaApiViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isLiaEnabled()) {
    return NextResponse.json({ error: "LIA is not available." }, { status: 503 });
  }

  const { id } = await ctx.params;

  const conversation = await prisma.liaConversation.findFirst({
    where: { id, userId: viewer.id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    },
    messages: conversation.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      sources: m.role === "ASSISTANT" ? parseSources(m.sourcesJson) : [],
      createdAt: m.createdAt.toISOString(),
    })),
  });
}
