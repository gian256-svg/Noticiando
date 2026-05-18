import { useRef, useCallback } from "react";
import { useFeedStore } from "@/store/feedStore";
import { getApiBase } from "@/lib/api";

const POLL_INTERVAL_MS = 2 * 60 * 1000;
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
    sse.addEventListener("idle", () => { setCrawlerStatus("idle"); fetchNews(); });
    sse.onerror = () => setCrawlerStatus("error");

    pollRef.current = setInterval(fetchNews, POLL_INTERVAL_MS);
  }, [fetchNews, appendNews, setCrawlerStatus, setLoading]);

  const stopPolling = useCallback(() => {
    sseRef.current?.close();
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  return { startPolling, stopPolling, fetchNews };
}
