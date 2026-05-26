export function LiaMarkdownLite({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter(Boolean);
  if (blocks.length === 0) return <p className="text-sm text-ink-600 whitespace-pre-wrap">{text}</p>;

  return (
    <div className="space-y-2 text-sm text-ink-700">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const isList = lines.every((l) => /^[-*•]\s/.test(l.trim()) || l.trim() === "");
        if (isList) {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1">
              {lines
                .filter((l) => l.trim())
                .map((l, j) => (
                  <li key={j}>{l.replace(/^[-*•]\s+/, "")}</li>
                ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap leading-relaxed">
            {block}
          </p>
        );
      })}
    </div>
  );
}
