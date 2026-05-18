import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScriptOutputProps {
  script: string;
  isGenerating: boolean;
}

export function ScriptOutput({ script, isGenerating }: ScriptOutputProps) {
  if (isGenerating && !script) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2">
        <Loader2 size={18} className="text-accent animate-spin" />
        <p className="text-xs text-text-secondary">Gerando roteiro...</p>
      </div>
    );
  }

  if (!script) return null;

  return (
    <div className="space-y-0">
      <pre
        className={cn(
          "text-xs leading-relaxed whitespace-pre-wrap font-sans text-text-primary/90",
          "selection:bg-accent/30",
          isGenerating && "after:content-['▋'] after:animate-pulse after:text-accent"
        )}
      >
        {script}
      </pre>
    </div>
  );
}
