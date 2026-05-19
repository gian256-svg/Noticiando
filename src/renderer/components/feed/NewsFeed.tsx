import { useRef, useCallback } from "react";
import { Loader2, WifiOff, Radio, ArrowUp, ArrowDown, Flame } from "lucide-react";
import { NewsCard } from "./NewsCard";
import { useFeedStore } from "@/store/feedStore";
import { useConfigStore } from "@/store/configStore";

export function NewsFeed() {
  const { filteredNews, selectedNews, isLoading, newsCount, liveCount, flushPendingNews } =
    useFeedStore();
  const { isOnboarded } = useConfigStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToTop = useCallback(() => {
    // Flush pending items into the feed first, then scroll to top so user sees them
    flushPendingNews();
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, [flushPendingNews]);

  const scrollToBottom = useCallback(() => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, []);

  const scrollToNextHot = useCallback(() => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    
    // Find all rendered cards
    const cards = Array.from(container.querySelectorAll("[data-news-card]")) as HTMLElement[];
    const containerTop = container.scrollTop;
    
    // Find next hot card (viral_score >= 50) below current scroll position
    const nextHotCard = cards.find((card) => {
      const score = parseFloat(card.getAttribute("data-score") || "0");
      if (score < 50) return false;
      return card.offsetTop > containerTop + 140; // small offset to not loop on current one
    });
    
    if (nextHotCard) {
      // Subtract the sticky container's height so it is fully visible below it
      const stickyHeight = container.querySelector(".sticky")?.clientHeight || 150;
      const targetScroll = nextHotCard.offsetTop - stickyHeight - 16;
      container.scrollTo({ top: Math.max(0, targetScroll), behavior: "smooth" });
    } else {
      // Loop back to top
      container.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  if (!isOnboarded) return <EmptyState type="onboarding" />;
  if (isLoading && filteredNews.length === 0) return <EmptyState type="loading" />;
  if (filteredNews.length === 0) return <EmptyState type="empty" />;

  // Find the news item with the highest viral_score to feature at the top as the featured story
  const featured = filteredNews.reduce((max, current) =>
    current.viral_score > max.viral_score ? current : max
  , filteredNews[0]);

  const rest = filteredNews.filter((n) => n.id !== featured.id);

  return (
    <div className="flex-1 overflow-hidden flex flex-col relative group/feed">
      {/* ── "N novas notícias" banner (appears when SSE pushes items) ── */}
      {liveCount > 0 && (
        <button
          onClick={scrollToTop}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-1.5 rounded-full bg-live text-white text-[11px] font-bold shadow-lg shadow-live/30 animate-bounce-subtle"
        >
          <ArrowUp size={12} />
          {liveCount} nova{liveCount > 1 ? "s" : ""} notícia{liveCount > 1 ? "s" : ""}
        </button>
      )}

      {/* Smart Scroll Assistant */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-3 p-2 rounded-full bg-surface/85 border border-white/[0.05] shadow-2xl backdrop-blur-md transition-all duration-300 opacity-60 hover:opacity-100 hover:scale-105 group/scroll">
        {/* Top button */}
        <button
          onClick={scrollToTop}
          title="Ir para o topo (Destaque)"
          className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/[0.06] transition-all"
        >
          <ArrowUp size={16} />
        </button>

        {/* Hot / Viral shortcut */}
        <button
          onClick={scrollToNextHot}
          title="Próxima notícia Quente (Score >= 50)"
          className="w-9 h-9 rounded-full flex items-center justify-center bg-accent/15 border border-accent/25 text-accent hover:bg-accent hover:text-white hover:shadow-[0_0_12px_rgba(249,115,22,0.5)] transition-all"
        >
          <Flame size={18} className="fill-current animate-pulse" />
        </button>

        {/* Bottom button */}
        <button
          onClick={scrollToBottom}
          title="Ir para o fim"
          className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/[0.06] transition-all"
        >
          <ArrowDown size={16} />
        </button>
      </div>

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

          {/* Featured top story (Sticky at the top of the timeline) */}
          {featured && (
            <div className="sticky -top-5 z-10 bg-[#0D0E1A] pt-5 pb-3.5 -mx-5 px-5 border-b border-border/40 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.5)]">
              <NewsCard
                news={featured}
                isSelected={selectedNews?.id === featured.id}
                featured
              />
            </div>
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
