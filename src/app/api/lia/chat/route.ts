import { NextResponse } from "next/server";
import { z } from "zod";
import { isLiaEnabled } from "@/lib/lia-config";
import { requireLiaApiViewer } from "@/lib/lia-api-auth";
import {
  runLiaChat,
  LiaRateLimitError,
  LiaProviderRateLimitError,
  LiaUnavailableError,
} from "@/lib/lia-chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().trim().min(1).max(191).optional().nullable(),
});

export async function POST(req: Request) {
  const viewer = await requireLiaApiViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isLiaEnabled()) {
    return NextResponse.json(
      { error: "LIA is not available. Ask HR or try again later." },
      { status: 503 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const result = await runLiaChat({
      userId: viewer.id,
      message: parsed.data.message,
      conversationId: parsed.data.conversationId ?? null,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof LiaRateLimitError || e instanceof LiaProviderRateLimitError) {
      return NextResponse.json({ error: e.message }, { status: 429 });
    }
    if (e instanceof LiaUnavailableError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    console.error("[lia/chat]", e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
