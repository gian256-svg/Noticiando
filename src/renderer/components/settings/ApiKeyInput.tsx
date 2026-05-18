import { ExternalLink, Bot } from "lucide-react";

const MYHUB_URL = "https://myhub.ia.br/agents";

export function MyhubInfo() {
  const handleOpen = async () => {
    if (window.noticiando) {
      await window.noticiando.invoke("shell:open-external", MYHUB_URL);
    } else {
      window.open(MYHUB_URL, "_blank");
    }
  };

  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-text-primary mb-2">
        <Bot size={12} className="text-accent" />
        Geração de Roteiros
      </label>

      <div className="flex items-start gap-3 p-3 bg-background/60 border border-border/60 rounded-lg">
        <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
          <Bot size={15} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-text-primary mb-0.5">PrimoScript · myhub</p>
          <p className="text-[10px] text-text-secondary leading-relaxed">
            Agente especializado em roteiros de Reels financeiros. Ao clicar em "Gerar no myhub",
            o prompt é copiado automaticamente e o agente abre no navegador.
          </p>
        </div>
      </div>

      <button
        onClick={handleOpen}
        className="mt-2 flex items-center gap-1.5 text-[11px] text-accent hover:text-accent/80 transition-colors"
      >
        <ExternalLink size={11} />
        Abrir agente PrimoScript no myhub
      </button>
    </div>
  );
}

// Keep named export for legacy imports
export { MyhubInfo as ApiKeyInput };
