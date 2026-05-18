import { useRef, useCallback } from "react";
import { Loader2, WifiOff, Radio, ArrowUp } from "lucide-react";
import { NewsCard } from "./NewsCard";
import { useFeedStore } from "@/store/feedStore";
import { useConfigStore } from "@/store/configStore";

export function NewsFeed() {
  const { filteredNews, selectedNews, isLoading, newsCount, liveCount, clearLiveCount } =
    useFeedStore();
  const { isOnboarded } = useConfigStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToTopAndClear = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    clearLiveCount();
  }, [clearLiveCount]);

  if (!isOnboarded) return <EmptyState type="onboarding" />;
  if (isLoading && filteredNews.length === 0) return <EmptyState type="loading" />;
  if (filteredNews.length === 0) return <EmptyState type="empty" />;

  const [featured, ...rest] = filteredNews;

  return (
    <div className="flex-1 overflow-hidden flex flex-col relative">
      {/* ── "N novas notícias" banner (appears when SSE pushes items) ── */}
      {liveCount > 0 && (
        <button
          onClick={scrollToTopAndClear}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-1.5 rounded-full bg-live text-white text-[11px] font-bold shadow-lg shadow-live/30 animate-bounce-subtle"
        >
          <ArrowUp size={12} />
          {liveCount} nova{liveCount > 1 ? "s" : ""} notícia{liveCount > 1 ? "s" : ""}
        </button>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="px-5 py-5 space-y-5">
          {/* Section header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-text-primary">Timeline</h2>
              <p className="text-[10px] text-text-muted mt-0.5">
                Mais recentes primeiro
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-live font-semibold">
              <Radio size={11} className="animate-pulse" />
              {newsCount} notícias
            </div>
          </div>

          {/* Featured top story */}
          {featured && (
            <NewsCard
              news={featured}
              isSelected={selectedNews?.id === featured.id}
              featured
            />
          )}

          {/* Cards grid */}
          {rest.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {rest.map((news) => (
                <NewsCard
                  key={news.id}
                  news={news}
                  isSelected={selectedNews?.id === news.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ type }: { type: "loading" | "empty" | "onboarding" | "error" }) {
  const config = {
    loading: {
      icon: <Loader2 size={28} className="text-accent animate-spin" />,
      title: "Buscando notícias...",
      desc: "Conectando às fontes e calculando scores virais",
    },
    empty: {
      icon: (
        <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-border flex items-center justify-center">
          <Radio size={22} className="text-text-muted" />
        </div>
      ),
      title: "Nenhuma notícia encontrada",
      desc: "Ajuste os filtros ou aguarde a próxima atualização",
    },
    onboarding: {
      icon: (
        <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
          <Radio size={22} className="text-accent" />
        </div>
      ),
      title: "Configure o Noticiando",
      desc: "Selecione as categorias de interesse para começar a monitorar",
    },
    error: {
      icon: (
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <WifiOff size={22} className="text-red-400" />
        </div>
      ),
      title: "Erro ao conectar",
      desc: "Verifique sua conexão e reinicie o app",
    },
  };

  const { icon, title, desc } = config[type];

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-10">
      {icon}
      <div>
        <p className="text-sm font-semibold text-text-primary mb-1">{title}</p>
        <p className="text-xs text-text-secondary leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
