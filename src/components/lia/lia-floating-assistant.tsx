"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { LiaChatPanel } from "./lia-chat-panel";

export function LiaFloatingAssistant() {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  return (
    <>
      <div className="fixed bottom-6 right-4 md:right-6 z-[54] pointer-events-auto">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex items-center gap-2 rounded-full shadow-lg px-4 h-12 font-semibold text-sm text-white brand-gradient hover:opacity-95 transition-opacity",
            open && "ring-2 ring-sky-300 ring-offset-2",
          )}
          aria-expanded={open}
          aria-label={open ? "Close LIA" : "Open LIA assistant"}
        >
          <Sparkles className="size-4" aria-hidden />
          LIA
        </button>
      </div>

      <LiaChatPanel
        open={open}
        onOpenChange={setOpen}
        conversationId={conversationId}
        onConversationIdChange={setConversationId}
        compact
        showFullPageLink
      />
    </>
  );
}
