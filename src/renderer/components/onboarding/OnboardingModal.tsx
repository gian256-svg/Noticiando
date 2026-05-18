import { useState } from "react";
import { Sparkles, ArrowRight, Zap, Globe, TrendingUp } from "lucide-react";
import { useConfigStore } from "@/store/configStore";
import { cn } from "@/lib/utils";

const CATEGORY_OPTIONS = [
  { id: "investments", label: "Investimentos BR", emoji: "💰", default: true },
  { id: "economy_int", label: "Mercado Internacional", emoji: "🌍", default: true },
  { id: "geopolitics", label: "Geopolítica", emoji: "🗺️", default: true },
  { id: "economy_br", label: "Economia BR", emoji: "🇧🇷", default: true },
  { id: "crypto", label: "Cripto", emoji: "₿", default: false },
  { id: "general", label: "Geral", emoji: "📰", default: false },
];

export function OnboardingModal() {
  const { setOnboarded, setActiveCategories } = useConfigStore();
  const [categories, setCategories] = useState(
    CATEGORY_OPTIONS.filter((c) => c.default).map((c) => c.id)
  );

  const toggle = (id: string) =>
    setCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );

  const handleStart = () => {
    setActiveCategories(categories);
    setOnboarded(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="w-[460px] bg-surface border border-border/60 rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.6)] animate-fade-in overflow-hidden">
        {/* Hero */}
        <div className="px-8 pt-8 pb-6 text-center border-b border-border/50">
          <div className="w-14 h-14 rounded-2xl bg-accent/15 border border-accent/25 flex items-center justify-center mx-auto mb-4">
            <Sparkles size={24} className="text-accent" />
          </div>
          <h1 className="text-xl font-bold text-text-primary mb-1">Noticiando</h1>
          <p className="text-xs text-text-secondary">Grupo Primo · Content Intelligence</p>

          {/* Feature pills */}
          <div className="flex items-center justify-center gap-2 mt-5 flex-wrap">
            <FeaturePill icon={Zap} label="Score viral em tempo real" />
            <FeaturePill icon={Globe} label="14 fontes monitoradas" />
            <FeaturePill icon={TrendingUp} label="Roteiros via myhub" />
          </div>
        </div>

        {/* Categories */}
        <div className="px-8 py-6">
          <p className="text-xs font-semibold text-text-primary mb-1">
            Quais categorias monitorar?
          </p>
          <p className="text-[11px] text-text-secondary mb-4">
            Filtra o feed para as notícias mais relevantes para o seu conteúdo.
          </p>

          <div className="grid grid-cols-2 gap-2 mb-6">
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat.id}
                onClick={() => toggle(cat.id)}
                className={cn(
                  "flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs font-medium transition-all",
                  categories.includes(cat.id)
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-border/60 text-text-secondary hover:border-border hover:text-text-primary"
                )}
              >
                <span className="text-sm">{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={handleStart}
            disabled={categories.length === 0}
            className="w-full flex items-center justify-center gap-2 py-3 bg-accent text-white text-sm font-semibold rounded-xl hover:bg-accent/90 active:scale-[0.98] transition-all shadow-lg shadow-accent/25 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            Começar a monitorar
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function FeaturePill({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.04] border border-white/[0.08] rounded-full text-[10px] text-text-secondary">
      <Icon size={10} className="text-accent/70" />
      {label}
    </div>
  );
}
