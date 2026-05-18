import { useScriptStore } from "@/store/scriptStore";
import { cn } from "@/lib/utils";

const DURATIONS = [30, 45, 60];

export function FormatSelector() {
  const { duration, setDuration } = useScriptStore();

  return (
    <div className="flex items-center gap-1 p-0.5 bg-background/80 rounded-lg border border-border/50">
      {DURATIONS.map((d) => (
        <button
          key={d}
          onClick={() => setDuration(d)}
          className={cn(
            "px-3 py-1.5 text-[11px] font-medium rounded-md transition-all",
            duration === d
              ? "bg-accent text-white shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          )}
        >
          {d}s
        </button>
      ))}
    </div>
  );
}
