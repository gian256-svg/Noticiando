import { Search, ChevronDown } from "lucide-react";
import { useFeedStore } from "@/store/feedStore";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { id: "all", label: "Todos", emoji: "📂" },
  { id: "investments", label: "Invest.", emoji: "💰" },
  { id: "economy_br", label: "Economia BR", emoji: "🇧🇷" },
  { id: "economy_int", label: "Mercado INT", emoji: "🌍" },
  { id: "geopolitics", label: "Geopol.", emoji: "🗺️" },
  { id: "crypto", label: "Cripto", emoji: "₿" },
];

const PERIODS = [
  { id: "1h", label: "Última hora" },
  { id: "6h", label: "Últimas 6h" },
  { id: "24h", label: "Últimas 24h" },
  { id: "7d", label: "7 dias" },
];

export function FilterBar() {
  const { filters, setFilters, newsCount } = useFeedStore();

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-t border-border/50">
      {/* Category tabs */}
      <div className="flex items-center gap-0.5 flex-1 overflow-x-auto scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setFilters({ category: cat.id })}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 text-xs rounded-md whitespace-nowrap transition-all",
              filters.category === cat.id
                ? "bg-accent/15 text-accent font-medium"
                : "text-text-secondary hover:text-text-primary hover:bg-white/5"
            )}
          >
            <span>{cat.emoji}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Score slider */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-text-secondary whitespace-nowrap">Score ≥</span>
        <input
          type="range"
          min={0}
          max={90}
          step={10}
          value={filters.minScore}
          onChange={(e) => setFilters({ minScore: Number(e.target.value) })}
          className="w-16 accent-accent cursor-pointer"
        />
        <span className="text-xs text-accent font-medium w-5 text-right">
          {filters.minScore}
        </span>
      </div>

      {/* Period */}
      <div className="relative shrink-0">
        <select
          value={filters.period}
          onChange={(e) => setFilters({ period: e.target.value })}
          className="appearance-none bg-surface border border-border text-xs text-text-secondary rounded-md px-2.5 py-1 pr-6 cursor-pointer hover:border-accent/50 transition-colors focus:outline-none focus:border-accent"
        >
          {PERIODS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
      </div>

      {/* News count */}
      <span className="text-xs text-text-secondary shrink-0">
        {newsCount} notícias
      </span>

      {/* Search */}
      <button className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-white/5 rounded transition-colors shrink-0">
        <Search size={13} />
      </button>
    </div>
  );
}
