"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiaChatPanel, type LiaChatMessage } from "./lia-chat-panel";
import { relativeTime } from "@/lib/utils";

type ConversationRow = {
  id: string;
  title: string;
  updatedAt: string;
  preview: string | null;
};

export function LiaPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("c");

  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(selectedId);
  const [initialMessages, setInitialMessages] = useState<LiaChatMessage[]>([]);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/lia/conversations", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { conversations?: ConversationRow[] };
      setConversations(json.conversations ?? []);
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadThread = useCallback(async (id: string) => {
    setLoadingThread(true);
    try {
      const res = await fetch(`/api/lia/conversations/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = (await res.json()) as {
        messages?: Array<{
          id: string;
          role: "USER" | "ASSISTANT";
          content: string;
          sources?: LiaChatMessage["sources"];
        }>;
      };
      setInitialMessages(
        (json.messages ?? []).map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          sources: m.sources,
        })),
      );
    } finally {
      setLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    setConversationId(selectedId);
    if (selectedId) void loadThread(selectedId);
    else setInitialMessages([]);
  }, [selectedId, loadThread]);

  const startNewChat = () => {
    setConversationId(null);
    setInitialMessages([]);
    router.push("/lia");
  };

  const selectConversation = (id: string) => {
    router.push(`/lia?c=${encodeURIComponent(id)}`);
  };

  const onConversationIdChange = (id: string | null) => {
    setConversationId(id);
    if (id) {
      router.replace(`/lia?c=${encodeURIComponent(id)}`);
      void loadList();
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 min-h-[calc(100vh-12rem)]" data-app-fullwidth>
      <aside className="w-full lg:w-72 shrink-0 flex flex-col gap-2">
        <Button type="button" variant="accent" className="w-full justify-center gap-2" onClick={startNewChat}>
          <Plus className="size-4" /> New chat
        </Button>
        <div className="rounded-xl border border-ink-100 bg-white overflow-hidden flex-1 min-h-[200px] max-h-[40vh] lg:max-h-none lg:min-h-[480px]">
          {loadingList ? (
            <div className="p-4 flex items-center gap-2 text-sm text-ink-400">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : conversations.length === 0 ? (
            <p className="p-4 text-sm text-ink-500">No conversations yet.</p>
          ) : (
            <ul className="divide-y divide-ink-50 overflow-y-auto max-h-full">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => selectConversation(c.id)}
                    className={`w-full text-left px-3 py-3 hover:bg-ink-50 transition-colors ${
                      conversationId === c.id ? "bg-sky-50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <MessageSquare className="size-4 text-ink-400 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-ink-700 truncate">{c.title}</div>
                        {c.preview ? (
                          <div className="text-xs text-ink-400 truncate mt-0.5">{c.preview}</div>
                        ) : null}
                        <div className="text-[10px] text-ink-300 mt-1">
                          {relativeTime(new Date(c.updatedAt))}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <div className="flex-1 min-h-[480px] rounded-2xl border border-ink-100 bg-white flex flex-col overflow-hidden relative">
        {loadingThread && selectedId ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 text-sm text-ink-400">
            <Loader2 className="size-5 animate-spin mr-2" /> Loading chat…
          </div>
        ) : null}
        <LiaChatPanel
          key={conversationId ?? "new"}
          open
          onOpenChange={() => {}}
          conversationId={conversationId}
          onConversationIdChange={onConversationIdChange}
          initialMessages={initialMessages}
          compact={false}
          showFullPageLink={false}
        />
      </div>
    </div>
  );
}
