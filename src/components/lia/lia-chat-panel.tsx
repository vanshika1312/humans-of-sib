"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X, Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiaMarkdownLite } from "./lia-markdown-lite";
import { LiaSourceChips } from "./lia-source-chips";
import type { LiaSource } from "@/lib/lia-sources";

export type LiaChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  sources?: LiaSource[];
};

const EMPTY_INITIAL_MESSAGES: LiaChatMessage[] = [];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string | null;
  onConversationIdChange: (id: string | null) => void;
  initialMessages?: LiaChatMessage[];
  compact?: boolean;
  showFullPageLink?: boolean;
};

export function LiaChatPanel({
  open,
  onOpenChange,
  conversationId,
  onConversationIdChange,
  initialMessages = EMPTY_INITIAL_MESSAGES,
  compact = true,
  showFullPageLink = true,
}: Props) {
  const [messages, setMessages] = useState<LiaChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setMessages(initialMessages);
  }, [open, initialMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setError(null);
    setSending(true);
    setDraft("");

    const tempUserId = `temp-user-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempUserId, role: "USER", content: text }]);

    try {
      const res = await fetch("/api/lia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId }),
      });
      const json = (await res.json()) as {
        error?: string;
        conversationId?: string;
        answer?: string;
        sources?: LiaSource[];
      };
      if (!res.ok) {
        throw new Error(json.error || "Could not reach LIA.");
      }
      if (json.conversationId) onConversationIdChange(json.conversationId);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserId),
        { id: tempUserId, role: "USER", content: text },
        {
          id: `assistant-${Date.now()}`,
          role: "ASSISTANT",
          content: json.answer ?? "",
          sources: json.sources ?? [],
        },
      ]);
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== tempUserId));
      setDraft(text);
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }, [conversationId, draft, onConversationIdChange, sending]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  const panelClass = compact
    ? "absolute bottom-20 right-0 w-[min(92vw,400px)] h-[min(70vh,520px)]"
    : "flex-1 min-h-0 flex flex-col";

  const inner = (
    <div
      className={
        compact
          ? `${panelClass} rounded-2xl border border-white/30 bg-white/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden`
          : `${panelClass}`
      }
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-ink-100 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-8 rounded-lg brand-gradient flex items-center justify-center shrink-0">
            <Sparkles className="size-4 text-white" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-ink-800 text-sm">LIA</div>
            <div className="text-[10px] text-ink-400 truncate">Your HoS guide</div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {showFullPageLink && compact ? (
            <Link
              href={conversationId ? `/lia?c=${encodeURIComponent(conversationId)}` : "/lia"}
              className="text-[11px] font-medium text-sky-600 hover:underline px-2"
              onClick={() => onOpenChange(false)}
            >
              Open full page
            </Link>
          ) : null}
          {compact ? (
            <button
              type="button"
              aria-label="Close LIA"
              className="size-8 inline-flex items-center justify-center rounded-md hover:bg-ink-50 text-ink-500"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-200 bg-ink-50/50 px-4 py-6 text-center text-sm text-ink-500">
            <p className="font-medium text-ink-700 mb-1">Hi, I&apos;m LIA</p>
            <p>Ask about leave, attendance, Pulse, or how to use Humans of SIB.</p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={m.role === "USER" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  m.role === "USER"
                    ? "max-w-[90%] rounded-2xl rounded-br-md bg-sky-600 text-white px-3 py-2 text-sm"
                    : "max-w-[95%] rounded-2xl rounded-bl-md bg-ink-50 border border-ink-100 px-3 py-2"
                }
              >
                {m.role === "USER" ? (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                ) : (
                  <>
                    <LiaMarkdownLite text={m.content} />
                    <LiaSourceChips sources={m.sources ?? []} />
                  </>
                )}
              </div>
            </div>
          ))
        )}
        {sending ? (
          <div className="flex items-center gap-2 text-xs text-ink-400">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            LIA is thinking…
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {error ? (
        <p className="px-4 text-xs text-orange-700 shrink-0" role="alert">
          {error}
        </p>
      ) : null}

      <form
        className="p-3 border-t border-ink-100 flex gap-2 shrink-0"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask LIA…"
          rows={2}
          className="flex-1 resize-none rounded-xl border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300/60"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <Button type="submit" size="sm" variant="accent" disabled={sending || !draft.trim()} className="self-end">
          <Send className="size-4" aria-hidden />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  );

  if (!compact) return inner;

  return (
    <div className="fixed inset-0 z-[55] pointer-events-none">
      <div className="pointer-events-auto fixed bottom-6 right-4 md:right-6">{inner}</div>
    </div>
  );
}
