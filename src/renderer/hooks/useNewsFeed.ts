import { useRef, useCallback } from "react";
import { useFeedStore } from "@/store/feedStore";
import { getApiBase } from "@/lib/api";

const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes — reliable top-up

export function useNewsFeed() {
  const sseRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { setNews, appendNews, setCrawlerStatus, setLoading } = useFeedStore();

  const fetchNews = useCallback(async () => {
    try {
      const base = await getApiBase();
      // Fetch sorted by published_at; the store's applyFilters re-sorts by date + score tiebreaker
      const res = await fetch(`${base}/news?limit=150&sort=published_at`);
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setNews(data.items ?? []);
    } catch {
      setCrawlerStatus("error");
    }
  }, [setNews, setCrawlerStatus]);

  const startPolling = useCallback(async () => {
    setLoading(true);
    await fetchNews();
    setLoading(false);

    // ── SSE for real-time push ──────────────────────────────────────────────
    const base = await getApiBase();
    const sse = new EventSource(`${base}/news/feed`);
    sseRef.current = sse;

    // New items pushed by the backend after each crawl
    sse.onmessage = (e) => {
      try {
        const items = JSON.parse(e.data);
        appendNews(Array.isArray(items) ? items : [items]);
      } catch {}
    };

    // Crawler state transitions
    sse.addEventListener("crawling", () => setCrawlerStatus("crawling"));
    sse.addEventListener("idle", () => setCrawlerStatus("idle"));
    sse.onerror = () => setCrawlerStatus("error");

    // ── Fallback polling every 2 min ────────────────────────────────────────
    // Ensures new articles surface even if SSE drops or push is missed
    pollRef.current = setInterval(fetchNews, POLL_INTERVAL_MS);
  }, [fetchNews, appendNews, setCrawlerStatus, setLoading]);

  const stopPolling = useCallback(() => {
    sseRef.current?.close();
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  return { startPolling, stopPolling, fetchNews };
}
