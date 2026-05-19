import { useRef, useCallback } from "react";
import { useFeedStore } from "@/store/feedStore";
import { useConfigStore } from "@/store/configStore";
import { getApiBase } from "@/lib/api";

const FETCH_DEBOUNCE_MS = 30_000;

export function useNewsFeed() {
  const sseRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFetchRef = useRef<number>(0);
  const { setNews, appendNews, setCrawlerStatus, setLoading } = useFeedStore();

  const fetchNews = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchRef.current < FETCH_DEBOUNCE_MS) return;
    lastFetchRef.current = now;
    try {
      const base = await getApiBase();
      const res = await fetch(`${base}/news?limit=150&sort=published_at&min_score=0&period=24h`);
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setNews(data.items ?? []);
    } catch {
      setCrawlerStatus("error");
    }
  }, [setNews, setCrawlerStatus]);

  const connectSSE = useCallback(async () => {
    if (sseRef.current) return;
    try {
      const base = await getApiBase();
      const sse = new EventSource(`${base}/news/feed`);
      sseRef.current = sse;

      sse.onmessage = (e) => {
        try {
          const items = JSON.parse(e.data);
          appendNews(Array.isArray(items) ? items : [items]);
        } catch {}
      };

      sse.addEventListener("crawling", () => setCrawlerStatus("crawling"));
      sse.addEventListener("idle", () => {
        setCrawlerStatus("idle");
        lastFetchRef.current = 0; // bypass debounce
        fetchNews();
      });

      sse.onerror = () => {
        setCrawlerStatus("error");
        sse.close();
        sseRef.current = null;
        // Schedule retry for SSE connection in 5s
        setTimeout(() => connectSSE(), 5_000);
      };
    } catch {
      setCrawlerStatus("error");
      setTimeout(() => connectSSE(), 5_000);
    }
  }, [fetchNews, appendNews, setCrawlerStatus]);

  const startPolling = useCallback(async () => {
    // Only show loading spinner on initial load if we don't have news items yet
    const currentNews = useFeedStore.getState().allNews;
    const isInitial = currentNews.length === 0;
    if (isInitial) setLoading(true);
    await fetchNews();
    if (isInitial) setLoading(false);

    // Connect to Server-Sent Events
    connectSSE();

    // Start fallback interval polling using the user-defined crawlInterval
    if (pollRef.current) clearInterval(pollRef.current);
    const intervalMinutes = useConfigStore.getState().crawlInterval || 2;
    pollRef.current = setInterval(fetchNews, intervalMinutes * 60 * 1000);
  }, [fetchNews, connectSSE, setLoading]);

  const stopPolling = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  return { startPolling, stopPolling, fetchNews };
}
