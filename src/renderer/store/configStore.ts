import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getApiBase } from "@/lib/api";

export interface NewsSource {
  name: string;
  url: string;
  category: string;
  enabled: boolean;
}

const DEFAULT_SOURCES: NewsSource[] = [
  { name: "InfoMoney", url: "https://www.infomoney.com.br/feed/", category: "investments", enabled: true },
  { name: "Valor Econômico", url: "https://valor.globo.com/rss/valor-economico/", category: "economy_br", enabled: true },
  { name: "G1 Economia", url: "https://g1.globo.com/rss/g1/economia/", category: "economy_br", enabled: true },
  { name: "Exame", url: "https://exame.com/feed/", category: "economy_br", enabled: false },
  { name: "CNN Brasil", url: "https://www.cnnbrasil.com.br/feed/", category: "economy_br", enabled: false },
  { name: "Forbes Brasil", url: "https://forbes.com.br/feed/", category: "investments", enabled: true },
  { name: "Folha Mercado", url: "https://feeds.folha.uol.com.br/mercado/rss091.xml", category: "economy_br", enabled: true },
  { name: "Reuters Markets", url: "https://feeds.reuters.com/reuters/topNews", category: "economy_int", enabled: true },
  { name: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml", category: "economy_int", enabled: true },
  { name: "Financial Times", url: "https://www.ft.com/rss/home", category: "economy_int", enabled: true },
  { name: "The Guardian Economy", url: "https://www.theguardian.com/business/economics/rss", category: "geopolitics", enabled: true },
  { name: "Investing.com Brasil", url: "https://br.investing.com/rss/news.rss", category: "investments", enabled: true },
];

interface ConfigStore {
  sources: NewsSource[];
  crawlInterval: number;
  activeCategories: string[];
  isOnboarded: boolean;
  settingsOpen: boolean;

  addSource: (url: string) => void;
  removeSource: (url: string) => void;
  toggleSource: (url: string) => void;
  setCrawlInterval: (minutes: number) => void;
  setActiveCategories: (cats: string[]) => void;
  setOnboarded: (v: boolean) => void;
  setSettingsOpen: (v: boolean) => void;
}

export const useConfigStore = create<ConfigStore>()(
  persist(
    (set, get) => ({
      sources: DEFAULT_SOURCES,
      crawlInterval: 2,
      activeCategories: ["investments", "economy_br", "economy_int", "geopolitics"],
      isOnboarded: false,
      settingsOpen: false,

      addSource: (url) => {
        const name = new URL(url).hostname.replace("www.", "");
        const existing = get().sources.find((s) => s.url === url);
        if (existing) return;
        set((s) => ({
          sources: [...s.sources, { name, url, category: "general", enabled: true }],
        }));
      },

      removeSource: (url) =>
        set((s) => ({ sources: s.sources.filter((src) => src.url !== url) })),

      toggleSource: (url) =>
        set((s) => ({
          sources: s.sources.map((src) =>
            src.url === url ? { ...src, enabled: !src.enabled } : src
          ),
        })),

      setCrawlInterval: (crawlInterval) => {
        set({ crawlInterval });
        getApiBase().then((base) => {
          fetch(`${base}/config`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ crawl_interval_minutes: crawlInterval }),
          }).catch((err) => console.error("Failed to sync crawl interval to backend:", err));
        });
      },
      setActiveCategories: (activeCategories) => set({ activeCategories }),
      setOnboarded: (isOnboarded) => set({ isOnboarded }),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
    }),
    {
      name: "noticiando-config",
      partialize: (s) => ({
        sources: s.sources,
        crawlInterval: s.crawlInterval,
        activeCategories: s.activeCategories,
        isOnboarded: s.isOnboarded,
      }),
    }
  )
);
