import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import "./components.css"

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  return (
    <div
      className={cn(
        "flex gap-4 mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300",
        role === "user" ? "justify-end" : "justify-start"
      )}
    >
      {role === "assistant" && (
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold shrink-0 mt-1">
          V
        </div>
      )}

      <div
        className={cn(
          "max-w-[80%] md:max-w-[70%] px-4 py-3 rounded-2xl",
          role === "user"
            ? "bg-user-message text-foreground rounded-br-sm"
            : "bg-bot-message border-2 border-bot-message-border text-foreground rounded-bl-sm"
        )}
      >
        {role === "assistant" ? (
          <div className="markdown text-sm leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkBreaks]}
              components={{
                p: (props) => (
                  <p className="mb-2">{props.children}</p>
                ),
                ul: (props) => (
                  <ul className="list-disc pl-5 mb-2">{props.children}</ul>
                ),
                ol: (props) => (
                  <ol className="list-decimal pl-5 mb-2">{props.children}</ol>
                ),
                li: (props) => <li className="mb-1">{props.children}</li>,
                strong: (props) => (
                  <strong className="font-semibold">{props.children}</strong>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {content}
          </p>
        )}
      </div>

      {role === "user" && (
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-medium shrink-0 mt-1">
          U
        </div>
      )}
    </div>
  );
}
