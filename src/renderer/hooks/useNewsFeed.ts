import { useRef, useCallback } from "react";
import { useFeedStore } from "@/store/feedStore";
import { useConfigStore } from "@/store/configStore";
import { getApiBase } from "@/lib/api";

export function useNewsFeed() {
  const sseRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { setNews, appendNews, setCrawlerStatus, setLoading } = useFeedStore();
  const { crawlInterval } = useConfigStore();

  const fetchNews = useCallback(async () => {
    try {
      const base = await getApiBase();
      const res = await fetch(`${base}/news?limit=100&sort=viral_score`);
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setNews(data.items ?? []);
    } catch (e) {
      setCrawlerStatus("error");
    }
  }, []);

  const startPolling = useCallback(async () => {
    setLoading(true);
    await fetchNews();
    setLoading(false);

    // SSE for real-time updates
    const base = await getApiBase();
    const sse = new EventSource(`${base}/news/feed`);
    sseRef.current = sse;

    sse.onmessage = (e) => {
      try {
        const items = JSON.parse(e.data);
        appendNews(Array.isArray(items) ? items : [items]);
        setCrawlerStatus("idle");
      } catch {}
    };

    sse.addEventListener("crawling", () => setCrawlerStatus("crawling"));
    sse.onerror = () => setCrawlerStatus("error");

    // Fallback polling
    pollRef.current = setInterval(fetchNews, crawlInterval * 60 * 1000);
  }, [crawlInterval, fetchNews]);

  const stopPolling = useCallback(() => {
    sseRef.current?.close();
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  return { startPolling, stopPolling, fetchNews };
}
