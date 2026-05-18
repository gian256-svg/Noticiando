import { X, Settings2 } from "lucide-react";
import { useConfigStore } from "@/store/configStore";
import { AnthropicKeyInput, MyhubInfo } from "./ApiKeyInput";
import { SourcesConfig } from "./SourcesConfig";


export function SettingsModal() {
  const { settingsOpen, setSettingsOpen } = useConfigStore();

  if (!settingsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => setSettingsOpen(false)}
      />
      <div className="relative bg-surface border border-border rounded-2xl w-[560px] max-h-[82vh] flex flex-col shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
          <Settings2 size={14} className="text-accent" />
          <h2 className="text-sm font-semibold text-text-primary flex-1">Configurações</h2>
          <button
            onClick={() => setSettingsOpen(false)}
            className="p-1 text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-lg transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <AnthropicKeyInput />
          <div className="h-px bg-border/60" />
          <MyhubInfo />
          <div className="h-px bg-border/60" />
          <SourcesConfig />
          <div className="h-px bg-border/60" />
          <CrawlIntervalConfig />
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex justify-end">
          <button
            onClick={() => setSettingsOpen(false)}
            className="px-5 py-2 text-xs bg-accent text-white rounded-lg hover:bg-accent/90 active:scale-[0.98] transition-all font-semibold"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function CrawlIntervalConfig() {
  const { crawlInterval, setCrawlInterval } = useConfigStore();

  return (
    <div>
      <label className="block text-xs font-semibold text-text-primary mb-1">
        Frequência de Atualização
      </label>
      <p className="text-[10px] text-text-secondary mb-3">
        Com que frequência o app busca novas notícias.
      </p>
      <div className="flex items-center gap-2">
        {[5, 10, 15, 30].map((min) => (
          <button
            key={min}
            onClick={() => setCrawlInterval(min)}
            className={`px-3.5 py-1.5 text-xs rounded-lg border font-medium transition-all ${
              crawlInterval === min
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-border/60 text-text-secondary hover:border-border hover:text-text-primary"
            }`}
          >
            {min} min
          </button>
        ))}
      </div>
    </div>
  );
}
