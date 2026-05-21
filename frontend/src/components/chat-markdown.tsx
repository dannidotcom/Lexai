import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ChatMarkdownProps {
  content: string;
  className?: string;
  streaming?: boolean;
}

function inlineFormat(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={key++} className="font-semibold text-gray-900">{token.slice(2, -2)}</strong>);
    } else {
      parts.push(
        <code key={key++} className="px-1 py-0.5 rounded bg-gray-100 text-[12px] font-mono text-sky-800">
          {token.slice(1, -1)}
        </code>,
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : [text];
}

function MarkdownBlock({ line }: { line: string }) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("### ")) {
    return <h4 className="text-[13px] font-semibold text-gray-800 mt-3 mb-1.5">{inlineFormat(trimmed.slice(4))}</h4>;
  }
  if (trimmed.startsWith("## ")) {
    return (
      <h3 className="text-[14px] font-semibold text-gray-900 mt-4 mb-2 pb-1 border-b border-gray-100 first:mt-0">
        {inlineFormat(trimmed.slice(3))}
      </h3>
    );
  }
  if (trimmed.startsWith("# ")) {
    return <h2 className="text-[15px] font-semibold text-gray-900 mt-4 mb-2 first:mt-0">{inlineFormat(trimmed.slice(2))}</h2>;
  }
  if (trimmed === "---" || trimmed === "***") {
    return <hr className="my-4 border-gray-200" />;
  }
  if (/^[-*]\s+/.test(trimmed)) {
    return (
      <li className="ml-4 list-disc pl-1 mb-1 min-w-0">{inlineFormat(trimmed.replace(/^[-*]\s+/, ""))}</li>
    );
  }
  if (/^\d+\.\s+/.test(trimmed)) {
    return (
      <li className="ml-4 list-decimal pl-1 mb-1 min-w-0">{inlineFormat(trimmed.replace(/^\d+\.\s+/, ""))}</li>
    );
  }
  return <p className="mb-2.5 last:mb-0 min-w-0">{inlineFormat(trimmed)}</p>;
}

export function ChatMarkdown({ content, className, streaming }: ChatMarkdownProps) {
  if (!content && !streaming) return null;

  const lines = content.split("\n");
  const nodes: ReactNode[] = [];
  let listBuffer: ReactNode[] = [];
  let listOrdered = false;
  let key = 0;

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const Tag = listOrdered ? "ol" : "ul";
    nodes.push(
      <Tag key={key++} className={cn("mb-2.5 space-y-0.5", listOrdered ? "list-decimal ml-4" : "list-disc ml-4")}>
        {listBuffer}
      </Tag>,
    );
    listBuffer = [];
    listOrdered = false;
  };

  for (const line of lines) {
    const isUl = /^[-*]\s+/.test(line.trim());
    const isOl = /^\d+\.\s+/.test(line.trim());

    if (isUl || isOl) {
      if (listBuffer.length && listOrdered !== isOl) flushList();
      listOrdered = isOl;
      listBuffer.push(<MarkdownBlock key={listBuffer.length} line={line} />);
      continue;
    }

    flushList();
    const block = <MarkdownBlock key={key++} line={line} />;
    if (block) nodes.push(block);
  }
  flushList();

  return (
    <div className={cn("chat-prose w-full min-w-0 text-[14px] md:text-[15px] leading-relaxed text-gray-700", className)}>
      {nodes}
      {streaming && <span className="stream-cursor" aria-hidden />}
    </div>
  );
}
