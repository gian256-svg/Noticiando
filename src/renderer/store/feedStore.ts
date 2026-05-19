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
  pendingNews: NewsItem[];   // buffer — not yet shown in timeline
  selectedNews: NewsItem | null;
  filters: FeedFilters;
  crawlerStatus: "idle" | "crawling" | "error";
  isLoading: boolean;
  newsCount: number;
  liveCount: number;
  newItemIds: Set<string>;
  lastRefreshed: Date | null;

  setNews: (news: NewsItem[]) => void;
  appendNews: (news: NewsItem[]) => void;
  flushPendingNews: () => void;
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
    result = result.filter((n) => new Date(n.created_at || n.published_at) >= cutoff);
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
    const timeA = new Date(a.created_at || a.published_at).getTime();
    const timeB = new Date(b.created_at || b.published_at).getTime();
    const tDiff = timeB - timeA;
    if (Math.abs(tDiff) > 60_000) return tDiff;
    return b.viral_score - a.viral_score;
  });
}

export const useFeedStore = create<FeedStore>((set, get) => ({
  allNews: [],
  filteredNews: [],
  pendingNews: [],
  selectedNews: null,
  filters: DEFAULT_FILTERS,
  crawlerStatus: "idle",
  isLoading: false,
  newsCount: 0,
  liveCount: 0,
  newItemIds: new Set<string>(),
  lastRefreshed: null,

  setNews: (news) => {
    // Background sync — absorb pending items into allNews but keep the banner
    // count so the user can still click it and scroll to the new items.
    const { pendingNews, liveCount, newItemIds } = get();
    const hadUnread = pendingNews.length > 0;
    const filtered = applyFilters(news, get().filters);
    set({
      allNews: news,
      filteredNews: filtered,
      newsCount: filtered.length,
      pendingNews: [],
      liveCount: hadUnread ? liveCount : 0,
      newItemIds: hadUnread ? newItemIds : new Set<string>(),
      lastRefreshed: new Date(),
    });
  },

  appendNews: (incoming) => {
    const existing = get().allNews;
    const pending = get().pendingNews;
    const allKnownIds = new Set([...existing.map((n) => n.id), ...pending.map((n) => n.id)]);
    const truly_new = incoming.filter((n) => !allKnownIds.has(n.id));

    // Backfill thumbnails for items already in the visible feed
    const existingIds = new Set(existing.map((n) => n.id));
    const thumbUpdates = new Map(
      incoming
        .filter((n) => existingIds.has(n.id) && n.thumbnail_url)
        .map((n) => [n.id, n.thumbnail_url!])
    );

    if (!truly_new.length && !thumbUpdates.size) return;

    // Apply thumbnail updates to already-visible items
    const updatedAll = thumbUpdates.size
      ? existing.map((n) =>
          thumbUpdates.has(n.id) && !n.thumbnail_url
            ? { ...n, thumbnail_url: thumbUpdates.get(n.id) }
            : n
        )
      : existing;

    const newIds = new Set([...get().newItemIds, ...truly_new.map((n) => n.id)]);
    set({
      allNews: updatedAll,
      filteredNews: thumbUpdates.size ? applyFilters(updatedAll, get().filters) : get().filteredNews,
      // Hold new items in pending buffer — NOT added to feed yet
      pendingNews: [...pending, ...truly_new],
      liveCount: pending.length + truly_new.length,
      newItemIds: newIds,
    });
  },

  // Flush pending buffer into the visible feed and reset counter
  flushPendingNews: () => {
    const pending = get().pendingNews;
    if (!pending.length) {
      set({ liveCount: 0, newItemIds: new Set<string>() });
      return;
    }
    const all = [...pending, ...get().allNews];
    const filtered = applyFilters(all, get().filters);
    set({
      allNews: all,
      filteredNews: filtered,
      newsCount: filtered.length,
      pendingNews: [],
      liveCount: 0,
      newItemIds: new Set<string>(),
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
  clearLiveCount: () => set({ liveCount: 0, pendingNews: [], newItemIds: new Set<string>() }),
}));
