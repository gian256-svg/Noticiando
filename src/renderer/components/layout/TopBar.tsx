import { useState } from "react";
import { Search, Minus, Square, X } from "lucide-react";
import { useFeedStore } from "@/store/feedStore";

export function TopBar() {
  const { setFilters } = useFeedStore();
  const [query, setQuery] = useState("");

  const handleSearch = (value: string) => {
    setQuery(value);
    setFilters({ search: value });
  };

  const handleMinimize = () => window.noticiando?.window.minimize();
  const handleMaximize = () => window.noticiando?.window.maximize();
  const handleClose = () => window.noticiando?.window.close();

  return (
    <div className="h-12 flex items-center gap-3 px-5 border-b border-border/40 app-drag shrink-0 bg-surface/30">
      {/* Search */}
      <div className="flex-1 app-no-drag">
        <div className="flex items-center gap-2 bg-white/[0.04] border border-border/50 rounded-xl px-3 py-1.5 max-w-xs hover:border-border transition-colors focus-within:border-accent/40 focus-within:bg-white/[0.06]">
          <Search size={13} className="text-text-muted shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar notícias..."
            className="bg-transparent text-xs text-text-primary placeholder-text-muted focus:outline-none w-full"
          />
        </div>
      </div>

      {/* Window controls */}
      <div className="flex items-center gap-1 app-no-drag shrink-0">
        <WinBtn onClick={handleMinimize} className="hover:bg-white/10">
          <Minus size={11} />
        </WinBtn>
        <WinBtn onClick={handleMaximize} className="hover:bg-white/10">
          <Square size={10} />
        </WinBtn>
        <WinBtn onClick={handleClose} className="hover:bg-red-500/80 hover:text-white">
          <X size={11} />
        </WinBtn>
      </div>
    </div>
  );
}

function WinBtn({
  onClick,
  className,
  children,
}: {
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-7 h-7 flex items-center justify-center rounded-lg text-text-secondary transition-all ${className}`}
    >
      {children}
    </button>
  );
}
