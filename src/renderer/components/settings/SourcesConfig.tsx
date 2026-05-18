import { useState } from "react";
import { Trash2, Plus, Globe } from "lucide-react";
import { useConfigStore } from "@/store/configStore";

export function SourcesConfig() {
  const { sources, addSource, removeSource } = useConfigStore();
  const [newUrl, setNewUrl] = useState("");

  const handleAdd = () => {
    const url = newUrl.trim();
    if (!url) return;
    addSource(url);
    setNewUrl("");
  };

  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-text-primary mb-3">
        <Globe size={12} className="text-accent" />
        Fontes RSS ({sources.length})
      </label>

      <div className="space-y-1.5 max-h-40 overflow-y-auto mb-3">
        {sources.map((src) => (
          <div key={src.url} className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-background rounded-md border border-border/50 group">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text-primary truncate">{src.name}</p>
              <p className="text-[10px] text-text-secondary truncate">{src.url}</p>
            </div>
            <button
              onClick={() => removeSource(src.url)}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-text-secondary hover:text-red-400 transition-all"
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </div>

      {/* Add new */}
      <div className="flex gap-2">
        <input
          type="url"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="https://example.com/feed.xml"
          className="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-xs text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-accent/50 transition-colors"
        />
        <button
          onClick={handleAdd}
          className="px-3 py-1.5 text-xs bg-accent/10 border border-accent/30 text-accent rounded-md hover:bg-accent/20 transition-colors flex items-center gap-1"
        >
          <Plus size={11} />
          Adicionar
        </button>
      </div>
    </div>
  );
}
