import { Settings, TrendingUp, Flame, Clock } from "lucide-react";
import { useFeedStore } from "@/store/feedStore";
import { useConfigStore } from "@/store/configStore";
import { cn } from "@/lib/utils";
// @ts-ignore
import LogoImage from "@/assets/logo.png";

const CATEGORIES = [
  { id: "all", label: "Todos os temas", icon: "✦", color: "text-text-secondary" },
  { id: "investments", label: "Investimentos", icon: "💰", color: "text-violet-400" },
  { id: "economy_br", label: "Economia BR", icon: "🇧🇷", color: "text-emerald-400" },
  { id: "economy_int", label: "Mercado INT", icon: "🌍", color: "text-blue-400" },
  { id: "geopolitics", label: "Geopolítica", icon: "🗺️", color: "text-orange-400" },
  { id: "crypto", label: "Cripto", icon: "₿", color: "text-yellow-400" },
];

const PERIODS = [
  { id: "1h", label: "Última hora" },
  { id: "6h", label: "Últimas 6h" },
  { id: "24h", label: "Últimas 24h" },
  { id: "7d", label: "7 dias" },
];

export function Sidebar() {
  const { filters, setFilters, newsCount, crawlerStatus, filteredNews, lastRefreshed } = useFeedStore();
  const { setSettingsOpen } = useConfigStore();

  const hotCount = filteredNews.filter((n) => n.viral_score >= 75).length;

  return (
    <div className="w-[220px] shrink-0 h-full flex flex-col bg-surface/60 border-r border-border/60 overflow-hidden">
      {/* Logo */}
      <div className="h-12 flex items-center gap-2.5 px-5 app-drag border-b border-border/40 shrink-0">
        <img src={LogoImage} className="w-[22px] h-[22px] rounded-md object-cover border border-white/10 app-no-drag shrink-0" alt="Logo" />
        <span className="font-semibold text-xs text-text-primary tracking-wide app-no-drag">Noticiando</span>
        <LiveDot status={crawlerStatus} />
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">

        {/* Categories */}
        <div>
          <SectionLabel>Categorias</SectionLabel>
          <nav className="mt-2 space-y-0.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFilters({ category: cat.id })}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all",
                  filters.category === cat.id
                    ? "bg-accent/15 text-accent"
                    : "text-text-secondary hover:text-text-primary hover:bg-white/[0.05]"
                )}
              >
                <span className={cn("text-sm leading-none", filters.category === cat.id ? "opacity-100" : cat.color)}>
                  {cat.icon}
                </span>
                <span className="truncate">{cat.label}</span>
                {cat.id === "all" && newsCount > 0 && (
                  <span className={cn(
                    "ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                    filters.category === cat.id ? "bg-accent/20 text-accent" : "bg-white/5 text-text-secondary"
                  )}>
                    {newsCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Score filter */}
        <div>
          <SectionLabel>Score mínimo</SectionLabel>
          <div className="mt-3 px-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-text-secondary">Mostrar a partir de</span>
              <span className={cn(
                "text-[11px] font-bold tabular-nums",
                filters.minScore >= 75 ? "text-red-400" : filters.minScore >= 50 ? "text-accent" : "text-text-secondary"
              )}>
                {filters.minScore}+
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={10}
              value={filters.minScore}
              onChange={(e) => setFilters({ minScore: Number(e.target.value) })}
              className="w-full h-1 accent-accent cursor-pointer rounded-full"
            />
            <div className="flex justify-between mt-1.5 text-[9px] text-text-muted">
              <span>0</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>
        </div>

        {/* Period */}
        <div>
          <SectionLabel>Período</SectionLabel>
          <div className="mt-2 grid grid-cols-2 gap-1">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setFilters({ period: p.id })}
                className={cn(
                  "px-2 py-1.5 text-[10px] rounded-lg font-medium transition-all text-center",
                  filters.period === p.id
                    ? "bg-accent/15 text-accent border border-accent/25"
                    : "text-text-secondary hover:text-text-primary hover:bg-white/5 border border-transparent"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div>
          <SectionLabel>Resumo</SectionLabel>
          <div className="mt-2 space-y-1.5">
            <StatRow icon={TrendingUp} label="Notícias" value={String(newsCount)} color="text-text-secondary" />
            <StatRow icon={Flame} label="Virais (75+)" value={String(hotCount)} color="text-red-400" />
            <StatRow icon={Clock} label="Atualização"
              value={crawlerStatus === "crawling" ? "Buscando..." : crawlerStatus === "error" ? "Erro" : "Live"}
              color={crawlerStatus === "error" ? "text-red-400" : "text-live"}
            />
            {lastRefreshed && (
              <div className="px-3 pt-0.5">
                <span className="text-[9px] text-text-muted">
                  Atualizado às {lastRefreshed.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border/40 shrink-0">
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-text-secondary hover:text-text-primary hover:bg-white/5 transition-all"
        >
          <Settings size={13} />
          Configurações
        </button>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-bold text-text-muted uppercase tracking-[0.12em] px-3">
      {children}
    </p>
  );
}

function StatRow({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.02]">
      <Icon size={11} className={color} />
      <span className="text-[10px] text-text-secondary flex-1">{label}</span>
      <span className={cn("text-[10px] font-semibold tabular-nums", color)}>{value}</span>
    </div>
  );
}

function LiveDot({ status }: { status: "idle" | "crawling" | "error" }) {
  return (
    <span
      className={cn(
        "ml-auto w-1.5 h-1.5 rounded-full shrink-0 app-no-drag",
        status === "error" ? "bg-red-500" : "bg-live",
        status === "crawling" && "animate-pulse"
      )}
    />
  );
}
