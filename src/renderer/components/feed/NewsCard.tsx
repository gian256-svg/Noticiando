import { useState } from "react";
import { Clock } from "lucide-react";
import { ViralBadge } from "./ViralBadge";
import { SourceChips } from "./SourceChips";
import { GenerativeThumbnail } from "./GenerativeThumbnail";
import { useFeedStore } from "@/store/feedStore";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "@/lib/time";
import { useRelativeTimeTick } from "@/hooks/useRelativeTimeTick";

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
  useRelativeTimeTick(); // re-render every 60s so timestamps stay fresh
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
      {/* Thumbnail — real image or generative fallback */}
      <CardThumbnail news={news} height="h-28" isNew={isNew} />

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
  useRelativeTimeTick(); // re-render every 60s so timestamps stay fresh
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
      {/* Background — real image or generative fallback */}
      <CardThumbnail news={news} height="h-full" isNew={isNew} featured />

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

interface CardThumbnailProps {
  news: NewsItem;
  height: string;
  isNew: boolean;
  featured?: boolean;
}

function CardThumbnail({ news, height, isNew, featured = false }: CardThumbnailProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const showGenerative = !news.thumbnail_url || imgFailed;

  return (
    <div className={cn("relative overflow-hidden", height)}>
      {/* Real image — hidden via state if it fails to load */}
      {news.thumbnail_url && !imgFailed && (
        <img
          src={news.thumbnail_url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      )}

      {/* Generative fallback — shown when no URL or img errors */}
      {showGenerative && (
        <GenerativeThumbnail
          title={news.title}
          source={news.sources[0] ?? ""}
          category={news.category}
          viralScore={news.viral_score}
          className="absolute inset-0"
        />
      )}

      {/* Gradient overlay for legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />

      {/* Score badge */}
      <div className={cn("absolute left-2.5", featured ? "top-3.5" : "top-2.5")}>
        <ViralBadge score={news.viral_score} size={featured ? "lg" : "sm"} showLabel={featured} />
      </div>

      {/* NEW pill */}
      {isNew && (
        <div className={cn("absolute right-2.5", featured ? "top-3.5" : "top-2.5")}>
          <span className="text-[9px] font-black text-white bg-live/90 px-1.5 py-0.5 rounded-full tracking-wider">
            NOVO
          </span>
        </div>
      )}

      {/* Category emoji (regular cards only) */}
      {!featured && (
        <div className="absolute bottom-2 right-2.5 text-lg opacity-60 group-hover:opacity-90 transition-opacity">
          {CATEGORY_EMOJI[news.category] ?? "📰"}
        </div>
      )}
    </div>
  );
}

function isWithinMinutes(dateStr: string, minutes: number): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  return now.getTime() - date.getTime() < minutes * 60 * 1000;
}
