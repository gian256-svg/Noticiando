import { cn } from "@/lib/utils";

const SOURCE_BG: Record<string, string> = {
  "InfoMoney": "bg-blue-500/20 text-blue-300 border-blue-500/20",
  "Valor Econômico": "bg-emerald-500/20 text-emerald-300 border-emerald-500/20",
  "Bloomberg": "bg-blue-600/20 text-blue-300 border-blue-600/20",
  "Reuters": "bg-orange-500/20 text-orange-300 border-orange-500/20",
  "Financial Times": "bg-pink-500/20 text-pink-300 border-pink-500/20",
  "Wall Street Journal": "bg-blue-400/20 text-blue-300 border-blue-400/20",
  "CNN Brasil": "bg-red-500/20 text-red-300 border-red-500/20",
  "Forbes Brasil": "bg-yellow-500/20 text-yellow-300 border-yellow-500/20",
  "Exame": "bg-purple-500/20 text-purple-300 border-purple-500/20",
  "G1 Economia": "bg-red-400/20 text-red-300 border-red-400/20",
  "Folha Mercado": "bg-blue-400/20 text-blue-200 border-blue-400/20",
  "Investing.com Brasil": "bg-teal-500/20 text-teal-300 border-teal-500/20",
  "BBC Business": "bg-red-600/20 text-red-300 border-red-600/20",
  "The Guardian Economy": "bg-slate-400/20 text-slate-300 border-slate-400/20",
  "Reuters Markets": "bg-orange-500/20 text-orange-300 border-orange-500/20",
};

function getChipClass(source: string): string {
  return SOURCE_BG[source] ?? "bg-white/10 text-white/60 border-white/10";
}

interface SourceChipsProps {
  sources: string[];
  maxVisible?: number;
  variant?: "default" | "overlay";
}

export function SourceChips({ sources, maxVisible = 3, variant = "default" }: SourceChipsProps) {
  const visible = sources.slice(0, maxVisible);
  const overflow = sources.length - maxVisible;

  if (variant === "overlay") {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {visible.map((source) => (
          <span key={source} className="inline-flex items-center text-[9px] font-semibold text-white/80 bg-black/30 px-1.5 py-0.5 rounded-full border border-white/10">
            {source.split(" ")[0]}
          </span>
        ))}
        {overflow > 0 && (
          <span className="text-[9px] text-white/60 bg-black/30 px-1.5 py-0.5 rounded-full">
            +{overflow}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visible.map((source) => (
        <span
          key={source}
          className={cn(
            "inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded-full border",
            getChipClass(source)
          )}
        >
          {source.split(" ")[0]}
        </span>
      ))}
      {overflow > 0 && (
        <span className="text-[9px] text-text-muted bg-white/5 px-1.5 py-0.5 rounded-full border border-white/5">
          +{overflow}
        </span>
      )}
    </div>
  );
}
