import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Renders job-description markdown: **bold**, *italic*, bullets, and numbered lists. */
export function JobDescriptionBody({ text, className }: { text: string; className?: string }) {
  const blocks = splitBlocks(text.replace(/\r\n/g, "\n"));
  if (blocks.length === 0) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {blocks.map((block, i) => {
        if (block.type === "ul") {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1.5">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol key={i} className="list-decimal pl-5 space-y-1.5">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i} className="leading-relaxed">
            {block.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 ? <br /> : null}
                {renderInline(line)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

type Block =
  | { type: "p"; lines: string[] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

const BULLET_RE = /^\s*(?:[-*•]|–)\s+(.*)$/;
const NUMBERED_RE = /^\s*\d+[.)]\s+(.*)$/;

function splitBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length === 0) return;
    blocks.push({ type: "p", lines: para });
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    blocks.push(list);
    list = null;
  };

  for (const line of lines) {
    const bullet = line.match(BULLET_RE);
    if (bullet) {
      flushPara();
      if (!list || list.type !== "ul") {
        flushList();
        list = { type: "ul", items: [] };
      }
      list.items.push(bullet[1]);
      continue;
    }
    const numbered = line.match(NUMBERED_RE);
    if (numbered) {
      flushPara();
      if (!list || list.type !== "ol") {
        flushList();
        list = { type: "ol", items: [] };
      }
      list.items.push(numbered[1]);
      continue;
    }
    if (line.trim() === "") {
      flushPara();
      flushList();
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return blocks;
}

function renderInline(text: string): ReactNode {
  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;

  const pushText = (s: string) => {
    if (s) nodes.push(s);
  };

  while (i < text.length) {
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        nodes.push(
          <strong key={key++} className="font-semibold text-ink-800">
            {text.slice(i + 2, end)}
          </strong>,
        );
        i = end + 2;
        continue;
      }
    }
    if (text.startsWith("__", i)) {
      const end = text.indexOf("__", i + 2);
      if (end !== -1) {
        nodes.push(
          <strong key={key++} className="font-semibold text-ink-800">
            {text.slice(i + 2, end)}
          </strong>,
        );
        i = end + 2;
        continue;
      }
    }
    if (text[i] === "*" && text[i + 1] !== "*") {
      const end = text.indexOf("*", i + 1);
      if (end !== -1) {
        nodes.push(
          <em key={key++} className="italic">
            {text.slice(i + 1, end)}
          </em>,
        );
        i = end + 1;
        continue;
      }
    }

    let next = text.length;
    const star = text.indexOf("*", i + 1);
    const under = text.indexOf("__", i + 1);
    if (star !== -1) next = Math.min(next, star);
    if (under !== -1) next = Math.min(next, under);
    pushText(text.slice(i, next));
    i = next;
  }

  return nodes.length === 1 ? nodes[0] : nodes;
}
