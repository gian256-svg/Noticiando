import { create } from "zustand";
import type { NewsItem } from "@/components/feed/NewsCard";

interface FeedFilters {
  category: string;
  minScore: number;
  period: string;
  search: string;
}

interface FeedStore {
  allNews: NewsItem[];
  filteredNews: NewsItem[];
  selectedNews: NewsItem | null;
  filters: FeedFilters;
  crawlerStatus: "idle" | "crawling" | "error";
  isLoading: boolean;
  newsCount: number;
  liveCount: number;
  newItemIds: Set<string>;

  setNews: (news: NewsItem[]) => void;
  appendNews: (news: NewsItem[]) => void;
  setSelectedNews: (news: NewsItem | null) => void;
  setFilters: (filters: Partial<FeedFilters>) => void;
  setCrawlerStatus: (status: "idle" | "crawling" | "error") => void;
  setLoading: (loading: boolean) => void;
  clearLiveCount: () => void;
}

const DEFAULT_FILTERS: FeedFilters = {
  category: "all",
  minScore: 0,
  period: "6h",
  search: "",
};

function applyFilters(news: NewsItem[], filters: FeedFilters): NewsItem[] {
  let result = [...news];

  if (filters.category !== "all") {
    result = result.filter((n) => n.category === filters.category);
  }

  if (filters.minScore > 0) {
    result = result.filter((n) => n.viral_score >= filters.minScore);
  }

  if (filters.period !== "7d") {
    const hours = { "1h": 1, "6h": 6, "24h": 24, "7d": 168 }[filters.period] ?? 6;
    const cutoff = new Date(Date.now() - hours * 3600 * 1000);
    result = result.filter((n) => new Date(n.published_at) >= cutoff);
  }

  if (filters.search.trim()) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.sources.some((s) => s.toLowerCase().includes(q))
    );
  }

  // Timeline: newest first, viral score as tiebreaker within the same minute
  return result.sort((a, b) => {
    const tDiff = new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
    if (Math.abs(tDiff) > 60_000) return tDiff;
    return b.viral_score - a.viral_score;
  });
}

export const useFeedStore = create<FeedStore>((set, get) => ({
  allNews: [],
  filteredNews: [],
  selectedNews: null,
  filters: DEFAULT_FILTERS,
  crawlerStatus: "idle",
  isLoading: false,
  newsCount: 0,
  liveCount: 0,
  newItemIds: new Set<string>(),

  setNews: (news) => {
    const filtered = applyFilters(news, get().filters);
    set({ allNews: news, filteredNews: filtered, newsCount: filtered.length });
  },

  appendNews: (incoming) => {
    const existing = get().allNews;
    const existingIds = new Set(existing.map((n) => n.id));
    const newItems = incoming.filter((n) => !existingIds.has(n.id));
    // Backfill thumbnails for items that now have og:image but didn't before
    const thumbUpdates = new Map(
      incoming
        .filter((n) => existingIds.has(n.id) && n.thumbnail_url)
        .map((n) => [n.id, n.thumbnail_url!])
    );
    if (!newItems.length && !thumbUpdates.size) return;
    const merged = thumbUpdates.size
      ? existing.map((n) =>
          thumbUpdates.has(n.id) && !n.thumbnail_url
            ? { ...n, thumbnail_url: thumbUpdates.get(n.id) }
            : n
        )
      : existing;
    const all = [...newItems, ...merged];
    const filtered = applyFilters(all, get().filters);
    const newIds = new Set([...get().newItemIds, ...newItems.map((n) => n.id)]);
    set({
      allNews: all,
      filteredNews: filtered,
      newsCount: filtered.length,
      liveCount: get().liveCount + newItems.length,
      newItemIds: newIds,
    });
  },

  setSelectedNews: (news) => set({ selectedNews: news }),

  setFilters: (partial) => {
    const filters = { ...get().filters, ...partial };
    const filtered = applyFilters(get().allNews, filters);
    set({ filters, filteredNews: filtered, newsCount: filtered.length });
  },

  setCrawlerStatus: (crawlerStatus) => set({ crawlerStatus }),
  setLoading: (isLoading) => set({ isLoading }),
  clearLiveCount: () => set({ liveCount: 0, newItemIds: new Set<string>() }),
}));
