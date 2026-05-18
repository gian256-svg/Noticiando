import { Clock } from "lucide-react";
import { ViralBadge } from "./ViralBadge";
import { SourceChips } from "./SourceChips";
import { useFeedStore } from "@/store/feedStore";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "@/lib/time";

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  sources: string[];
  viral_score: number;
  category: string;
  published_at: string;
  thumbnail_url?: string;
  source_count: number;
  url: string;
}

interface NewsCardProps {
  news: NewsItem;
  isSelected: boolean;
  featured?: boolean;
}

const CATEGORY_EMOJI: Record<string, string> = {
  investments: "💰",
  economy_br: "🇧🇷",
  economy_int: "🌍",
  geopolitics: "🗺️",
  crypto: "₿",
  general: "📰",
};

function categoryClass(cat: string) {
  const map: Record<string, string> = {
    investments: "bg-cat-investments",
    economy_br: "bg-cat-economy_br",
    economy_int: "bg-cat-economy_int",
    geopolitics: "bg-cat-geopolitics",
    crypto: "bg-cat-crypto",
    general: "bg-cat-general",
  };
  return map[cat] ?? "bg-cat-general";
}

export function NewsCard({ news, isSelected, featured = false }: NewsCardProps) {
  const { setSelectedNews } = useFeedStore();
  const isNew = isWithinMinutes(news.published_at, 30);

  if (featured) return <FeaturedCard news={news} isSelected={isSelected} />;

  return (
    <div
      onClick={() => setSelectedNews(news)}
      className={cn(
        "rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 group",
        "hover:scale-[1.02] hover:shadow-card-hover",
        "shadow-card",
        isSelected
          ? "ring-2 ring-accent/50 scale-[1.01]"
          : "ring-1 ring-white/[0.05]"
      )}
    >
      {/* Thumbnail — real image or category gradient fallback */}
      <div className={cn("h-28 relative overflow-hidden", !news.thumbnail_url && categoryClass(news.category))}>
        {news.thumbnail_url ? (
          <img
            src={news.thumbnail_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = "none";
              target.parentElement?.classList.add(categoryClass(news.category));
            }}
          />
        ) : (
          <div className="absolute inset-0 opacity-20 mix-blend-overlay" style={{
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }} />
        )}
        {/* Bottom gradient for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

        {/* Score badge - top left */}
        <div className="absolute top-2.5 left-2.5">
          <ViralBadge score={news.viral_score} size="sm" />
        </div>

        {/* NEW badge - top right */}
        {isNew && (
          <div className="absolute top-2.5 right-2.5">
            <span className="text-[9px] font-black text-white bg-live/90 px-1.5 py-0.5 rounded-full tracking-wider">
              NOVO
            </span>
          </div>
        )}

        {/* Category emoji - bottom right */}
        <div className="absolute bottom-2 right-2.5 text-lg opacity-70 group-hover:opacity-90 transition-opacity">
          {CATEGORY_EMOJI[news.category] ?? "📰"}
        </div>
      </div>

      {/* Content */}
      <div className="bg-surface-2 p-3.5">
        <p className={cn(
          "text-xs font-semibold leading-snug line-clamp-2 mb-2.5 text-balance",
          isSelected ? "text-text-primary" : "text-text-primary/90 group-hover:text-text-primary"
        )}>
          {news.title}
        </p>

        <div className="flex items-center justify-between gap-2">
          <SourceChips sources={news.sources} maxVisible={2} />
          <div className="flex items-center gap-1 text-[9px] text-text-muted shrink-0">
            <Clock size={9} />
            {formatDistanceToNow(news.published_at)}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeaturedCard({ news, isSelected }: { news: NewsItem; isSelected: boolean }) {
  const { setSelectedNews } = useFeedStore();
  const isNew = isWithinMinutes(news.published_at, 30);

  return (
    <div
      onClick={() => setSelectedNews(news)}
      className={cn(
        "w-full h-44 rounded-2xl overflow-hidden cursor-pointer relative",
        "transition-all duration-200 hover:scale-[1.01] hover:shadow-card-hover shadow-card",
        isSelected ? "ring-2 ring-accent/60" : "ring-1 ring-white/[0.06]"
      )}
    >
      {/* Background — real image or category gradient fallback */}
      {news.thumbnail_url ? (
        <img
          src={news.thumbnail_url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            const target = e.currentTarget;
            target.style.display = "none";
            target.parentElement?.classList.add(categoryClass(news.category));
          }}
        />
      ) : (
        <>
          <div className={cn("absolute inset-0", categoryClass(news.category))} />
          <div className="absolute inset-0 opacity-10 mix-blend-overlay" style={{
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }} />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(255,255,255,0.15),transparent_60%)]" />
        </>
      )}

      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

      {/* Score badge */}
      <div className="absolute top-3.5 left-3.5">
        <ViralBadge score={news.viral_score} size="lg" showLabel />
      </div>

      {/* NEW + source count */}
      <div className="absolute top-3.5 right-3.5 flex items-center gap-2">
        {isNew && (
          <span className="text-[10px] font-black text-white bg-live/80 px-2 py-0.5 rounded-full tracking-wider">
            NOVO
          </span>
        )}
        {news.source_count > 1 && (
          <span className="text-[10px] font-semibold text-white/80 bg-black/30 px-2 py-0.5 rounded-full">
            {news.source_count} fontes
          </span>
        )}
      </div>

      {/* Content overlay at bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <p className="text-sm font-bold text-white leading-snug line-clamp-2 mb-2">
          {news.title}
        </p>
        <SourceChips sources={news.sources} maxVisible={4} variant="overlay" />
      </div>
    </div>
  );
}

function isWithinMinutes(dateStr: string, minutes: number): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  return now.getTime() - date.getTime() < minutes * 60 * 1000;
}
