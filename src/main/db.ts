import Store from "electron-store";
import crypto from "crypto";

export interface SavedScript {
  id: string;
  news_id: string;
  title: string;
  content: string;
  format: string;
  created_at: string;
}

interface StoreSchema {
  saved_scripts: SavedScript[];
}

const store = new Store<StoreSchema>({
  name: "noticiando-scripts",
  defaults: { saved_scripts: [] },
});

export function initDb() {
  // electron-store initializes lazily — nothing to do here
}

export function getSavedScripts(): SavedScript[] {
  const scripts = (store as any).get("saved_scripts") as SavedScript[];
  return scripts.slice().sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function saveScript(script: {
  newsId: string;
  title: string;
  content: string;
  format: string;
}): SavedScript {
  const saved: SavedScript = {
    id: crypto.randomUUID(),
    news_id: script.newsId,
    title: script.title,
    content: script.content,
    format: script.format,
    created_at: new Date().toISOString(),
  };

  const scripts = (store as any).get("saved_scripts") as SavedScript[];
  (store as any).set("saved_scripts", [saved, ...scripts].slice(0, 500));
  return saved;
}

export function deleteScript(id: string): void {
  const scripts = (store as any).get("saved_scripts") as SavedScript[];
  (store as any).set(
    "saved_scripts",
    scripts.filter((s) => s.id !== id)
  );
}
