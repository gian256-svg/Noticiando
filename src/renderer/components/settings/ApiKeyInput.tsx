import { ExternalLink, Bot, Zap, Clock, Cpu } from "lucide-react";

const MYHUB_URL = "https://myhub.ia.br/agents";

type ProviderStatus = "active" | "fallback" | "local" | "soon";

const providers: { name: string; desc: string; status: ProviderStatus }[] = [
  { name: "Google Gemini 2.0 Flash", desc: "Primário — 2 chaves configuradas",      status: "active" },
  { name: "Groq · Llama 3.3 70B",   desc: "Fallback #1 se Gemini falhar",           status: "fallback" },
  { name: "Ollama · llama3.1",       desc: "Fallback #2 — local, sem API key",       status: "local" },
  { name: "ElevenLabs (locução)",    desc: "Narração automática de roteiros",        status: "soon" },
  { name: "Envato Elements",         desc: "Stock footage e motion templates",       status: "soon" },
  { name: "Epidemic Sound",          desc: "Trilha sonora licenciada para Reels",    status: "soon" },
];

const STATUS_CONFIG: Record<ProviderStatus, { label: string; dot: string; text: string; bg: string }> = {
  active:   { label: "ATIVO",    dot: "bg-green-400",   text: "text-green-400",   bg: "bg-green-400/10" },
  fallback: { label: "FALLBACK", dot: "bg-blue-400",    text: "text-blue-400",    bg: "bg-blue-400/10" },
  local:    { label: "LOCAL",    dot: "bg-purple-400",  text: "text-purple-400",  bg: "bg-purple-400/10" },
  soon:     { label: "EM BREVE", dot: "bg-text-muted",  text: "text-text-muted",  bg: "bg-white/5" },
};

// ── AI & Media Provider status panel ─────────────────────────────────────────
export function AnthropicKeyInput() {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-text-primary mb-2">
        <Zap size={12} className="text-accent" />
        Provedores de IA e Mídia
      </label>

      <div className="space-y-1.5">
        {providers.map(({ name, desc, status }) => {
          const cfg = STATUS_CONFIG[status];
          return (
            <div
              key={name}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/50 bg-background/40"
              style={{ opacity: status === "soon" ? 0.65 : 1 }}
            >
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-text-primary">{name}</p>
                <p className="text-[9px] text-text-muted">{desc}</p>
              </div>
              {status === "soon"
                ? <Clock size={11} className="text-text-muted shrink-0" />
                : (
                  <span className={`text-[9px] font-bold ${cfg.text} ${cfg.bg} px-2 py-0.5 rounded-full shrink-0`}>
                    {cfg.label}
                  </span>
                )
              }
            </div>
          );
        })}
      </div>

      <p className="text-[9px] text-text-muted mt-2">
        Chaves configuradas em{" "}
        <code className="text-accent/80">backend/.env</code>
      </p>
    </div>
  );
}

// ── MyHub info section ────────────────────────────────────────────────────────
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
        Agente PrimoScript · myhub
      </label>

      <div className="flex items-start gap-3 p-3 bg-background/60 border border-border/60 rounded-lg">
        <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
          <Bot size={15} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-text-primary mb-0.5">PrimoScript · myhub</p>
          <p className="text-[10px] text-text-secondary leading-relaxed">
            Agente especializado em roteiros de Reels financeiros. Ao clicar em
            "Abrir no myhub", o prompt é copiado e o agente abre no navegador.
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

// Legacy exports
export { AnthropicKeyInput as ApiKeyInput };
