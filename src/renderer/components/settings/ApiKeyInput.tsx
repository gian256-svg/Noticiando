import { useState, useEffect } from "react";
import { ExternalLink, Bot, Zap, Clock, Cpu, Loader2 } from "lucide-react";
import { getApiBase } from "@/lib/api";

const MYHUB_URL = "https://myhub.ia.br/agents";

type ProviderStatus = "active" | "fallback" | "local" | "missing" | "loading";

const providers: { name: string; desc: string; defaultStatus: ProviderStatus; backendKey: string }[] = [
  { name: "Google Gemini 2.0 Flash", desc: "Primário — 2 chaves configuradas",      defaultStatus: "active",   backendKey: "Google Gemini" },
  { name: "Groq · Llama 3.3 70B",   desc: "Fallback #1 se Gemini falhar",           defaultStatus: "fallback", backendKey: "Groq (Llama)" },
  { name: "OpenRouter (Llama/Gemma)", desc: "Fallback #2 se Groq falhar",           defaultStatus: "fallback", backendKey: "OpenRouter (Llama/Gemma)" },
  { name: "Ollama · llama3.1",       desc: "Fallback #3 — local, sem API key",       defaultStatus: "local",    backendKey: "Ollama (Local)" },
  { name: "ElevenLabs (locução)",    desc: "Narração brasileira ativa na pipeline",   defaultStatus: "active",   backendKey: "ElevenLabs (Locucao)" },
  { name: "Envato Elements",         desc: "B-roll e stock footage integrados",       defaultStatus: "active",   backendKey: "Envato Elements" },
  { name: "Epidemic Sound",          desc: "Trilhas sonoras licenciadas por nicho",   defaultStatus: "active",   backendKey: "Epidemic Sound" },
];

const STATUS_CONFIG: Record<ProviderStatus, { label: string; dot: string; text: string; bg: string }> = {
  active:   { label: "ATIVO",    dot: "bg-green-400",   text: "text-green-400",   bg: "bg-green-400/10" },
  fallback: { label: "FALLBACK", dot: "bg-blue-400",    text: "text-blue-400",    bg: "bg-blue-400/10" },
  local:    { label: "LOCAL",    dot: "bg-purple-400",  text: "text-purple-400",  bg: "bg-purple-400/10" },
  missing:  { label: "AUSENTE",  dot: "bg-red-500",     text: "text-red-500",     bg: "bg-red-500/10" },
  loading:  { label: "CARREGANDO", dot: "bg-gray-400 animate-pulse", text: "text-text-muted", bg: "bg-white/5" },
};

// ── AI & Media Provider status panel ─────────────────────────────────────────
export function AnthropicKeyInput() {
  const [apiStatus, setApiStatus] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchStatus = async () => {
      try {
        const base = await getApiBase();
        const res = await fetch(`${base}/cerebro/status?t=${Date.now()}`);
        if (!res.ok) throw new Error("HTTP error " + res.status);
        const data = await res.json();
        if (active && data.api_status) {
          setApiStatus(data.api_status);
        }
      } catch (err) {
        console.error("Failed to fetch cerebro status:", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchStatus();
    // Poll every 10 seconds to keep the dashboard real-time
    const interval = setInterval(fetchStatus, 10000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-text-primary mb-2">
        <Zap size={12} className="text-accent" />
        Provedores de IA e Mídia
        {loading && <Loader2 size={10} className="animate-spin text-text-muted ml-auto" />}
      </label>

      <div className="space-y-1.5">
        {providers.map(({ name, desc, defaultStatus, backendKey }) => {
          // Resolve current status
          let currentStatus: ProviderStatus = "loading";
          if (!loading) {
            const statusStr = apiStatus[backendKey];
            if (statusStr === "active") {
              currentStatus = defaultStatus;
            } else if (statusStr === "missing") {
              currentStatus = "missing";
            } else {
              currentStatus = "missing"; // Default fallback
            }
          }

          const cfg = STATUS_CONFIG[currentStatus];
          return (
            <div
              key={name}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/50 bg-background/40"
            >
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-text-primary">{name}</p>
                <p className="text-[9px] text-text-muted">{desc}</p>
              </div>
              <span className={`text-[9px] font-bold ${cfg.text} ${cfg.bg} px-2 py-0.5 rounded-full shrink-0`}>
                {cfg.label}
              </span>
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
    try {
      if (window.noticiando) {
        await window.noticiando.invoke("shell:open-external", MYHUB_URL);
      } else {
        window.open(MYHUB_URL, "_blank");
      }
    } catch (err) {
      console.error("Failed to open MyHub URL in ApiKeyInput:", err);
      try {
        window.open(MYHUB_URL, "_blank");
      } catch (fallbackErr) {
        console.error("Fallback open URL failed in ApiKeyInput:", fallbackErr);
      }
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
