"use client";

import { Button } from "@/components/ui/button";

export function DeleteLiaArticleButton({ action }: { action: () => Promise<void> }) {
  return (
    <form
      action={action}
      className="mt-6 pt-6 border-t border-ink-100"
      onSubmit={(e) => {
        if (!window.confirm("Delete this article?")) e.preventDefault();
      }}
    >
      <Button type="submit" variant="outline" className="text-rose-700 border-rose-200 hover:bg-rose-50">
        Delete article
      </Button>
    </form>
  );
}
