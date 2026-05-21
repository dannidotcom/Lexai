import { cn } from "@/lib/utils";

interface ChatUserMessageProps {
  content: string;
  className?: string;
}

/** Affiche un message utilisateur (texte simple ou situation + question en analyse). */
export function ChatUserMessage({ content, className }: ChatUserMessageProps) {
  const analyzeMatch = content.match(
    /^Situation\n([\s\S]*?)\n\nQuestion juridique\n([\s\S]*)$/,
  );

  if (analyzeMatch) {
    const [, situation, question] = analyzeMatch;
    return (
      <div className={cn("space-y-2 max-w-[96%] md:max-w-[90%] lg:max-w-[85%] min-w-0", className)}>
        <div className="bg-sky-500/95 rounded-2xl rounded-tr-sm px-3 py-3 md:px-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-100 mb-1">Situation</p>
          <p className="text-[14px] md:text-[15px] text-white whitespace-pre-wrap leading-relaxed break-words [overflow-wrap:anywhere]">{situation}</p>
        </div>
        <div className="bg-sky-600 rounded-2xl rounded-tr-sm px-3 py-3 md:px-4 shadow-sm ml-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-100 mb-1">Question juridique</p>
          <p className="text-[14px] md:text-[15px] text-white whitespace-pre-wrap leading-relaxed break-words [overflow-wrap:anywhere]">{question}</p>
        </div>
      </div>
    );
  }

  if (content.startsWith("Situation\n") && !content.includes("Question juridique")) {
    return (
      <div className={cn("max-w-[96%] md:max-w-[90%] lg:max-w-[85%] min-w-0 bg-sky-500 rounded-2xl rounded-tr-sm px-3 py-3 md:px-4 shadow-sm", className)}>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-100 mb-1">Situation</p>
        <p className="text-[14px] md:text-[15px] text-white whitespace-pre-wrap leading-relaxed break-words [overflow-wrap:anywhere]">
          {content.replace(/^Situation\n/, "")}
        </p>
      </div>
    );
  }

  if (content.startsWith("Question juridique\n")) {
    return (
      <div className={cn("max-w-[96%] md:max-w-[90%] lg:max-w-[85%] min-w-0 bg-sky-600 rounded-2xl rounded-tr-sm px-3 py-3 md:px-4 shadow-sm", className)}>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-100 mb-1">Question juridique</p>
        <p className="text-[14px] md:text-[15px] text-white whitespace-pre-wrap leading-relaxed break-words [overflow-wrap:anywhere]">
          {content.replace(/^Question juridique\n/, "")}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("max-w-[96%] md:max-w-[90%] lg:max-w-[85%] min-w-0 bg-sky-500 rounded-2xl rounded-tr-sm px-3 py-3 md:px-4 shadow-sm", className)}>
      <p className="text-[14px] md:text-[15px] text-white whitespace-pre-wrap leading-relaxed break-words [overflow-wrap:anywhere]">{content}</p>
    </div>
  );
}
