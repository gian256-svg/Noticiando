import { useState, useMemo, useCallback } from "react";
import { getApiBase } from "@/lib/api";
import {
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Zap,
  Video,
  Loader2,
} from "lucide-react";
import { ViralBadge } from "@/components/feed/ViralBadge";
import { SourceChips } from "@/components/feed/SourceChips";
import { FormatSelector } from "./FormatSelector";
import { VideoPreview } from "@/components/video/VideoPreview";
import { useScriptStore } from "@/store/scriptStore";
import { formatDistanceToNow } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { NewsItem } from "@/components/feed/NewsCard";
import type { ReelsCompositionProps } from "@/video/ReelsComposition";

const CATEGORY_LABELS: Record<string, string> = {
  investments: "Investimentos",
  economy_br: "Economia BR",
  economy_int: "Mercado INT",
  geopolitics: "Geopolítica",
  crypto: "Cripto",
  general: "Geral",
};

function buildPrompt(news: NewsItem, duration: number): string {
  return `Notícia para roteiro:

Título: ${news.title}
Fonte(s): ${news.sources.join(", ")}
Publicado: ${news.published_at}
Score viral: ${news.viral_score}/100
Categoria: ${CATEGORY_LABELS[news.category] ?? news.category}

Resumo: ${news.summary || "(sem resumo disponível)"}

Formato: Reels híbrido — combine imagens reais de arquivo, motion graphics e ilustrações para deixar o vídeo dinâmico e com mais possibilidades visuais.
Duração: ${duration} segundos`;
}

const MYHUB_URL = "https://myhub.ia.br/agents";

interface ScriptPanelProps {
  news: NewsItem | null;
}

export function ScriptPanel({ news }: ScriptPanelProps) {
  const { duration } = useScriptStore();
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);
  const [opened, setOpened] = useState(false);

  // Paste-back script state (from MyHub agent)
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [pastedScript, setPastedScript] = useState("");
  const [scriptCopied, setScriptCopied] = useState(false);

  // Video generation state
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoProps, setVideoProps] = useState<ReelsCompositionProps | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);

  const prompt = useMemo(
    () => (news ? buildPrompt(news, duration) : ""),
    [news, duration],
  );

  const handleOpenMyhub = async () => {
    if (!news) return;
    try { await navigator.clipboard.writeText(prompt); } catch {}
    if (window.noticiando) {
      await window.noticiando.invoke("shell:open-external", MYHUB_URL);
    } else {
      window.open(MYHUB_URL, "_blank");
    }
    setOpened(true);
    setTimeout(() => setOpened(false), 3000);
  };

  const handleCopy = async () => {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateVideo = useCallback(async () => {
    if (!news) return;
    setGeneratingVideo(true);
    setVideoError(null);
    setVideoProps(null);

    try {
      let result: { scenes?: unknown[]; error?: string };

      const payload = {
        news_id: news.id,
        title: news.title,
        summary: news.summary ?? "",
        category: news.category,
        duration,
        thumbnail_url: news.thumbnail_url ?? null,
      };

      if (window.noticiando?.invoke) {
        const raw = await window.noticiando.invoke("video:generate-scenes", payload);
        result = (raw ?? {}) as { scenes?: unknown[]; error?: string };
      } else {
        const base = await getApiBase();
        const resp = await fetch(`${base}/generate-video-scenes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          const detail = await resp.text().catch(() => String(resp.status));
          result = { error: `Erro do backend: ${detail}` };
        } else {
          result = await resp.json();
        }
      }

      if (result.error || !result.scenes?.length) {
        setVideoError(
          result.error ??
            "Falha ao gerar cenas — resposta sem campo 'scenes'. Reinicie o backend Python e tente novamente."
        );
        return;
      }

      setVideoProps({
        scenes: result.scenes as ReelsCompositionProps["scenes"],
        thumbnail_url: news.thumbnail_url,
        source_name: news.sources[0],
        category: news.category,
        news_title: news.title,
      });
      setShowPlayer(true);
    } catch (err) {
      setVideoError(`Erro: ${String(err)}`);
    } finally {
      setGeneratingVideo(false);
    }
  }, [news, duration]);

  if (!news) return <EmptyScriptPanel />;

  return (
    <>
      {/* Video preview modal */}
      {showPlayer && videoProps && (
        <VideoPreview
          props={videoProps}
          newsTitle={news.title}
          onClose={() => setShowPlayer(false)}
        />
      )}

      <div className="flex flex-col h-full bg-surface/20">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-1.5 mb-3">
            <Sparkles size={11} className="text-accent" />
            <span className="text-[10px] font-bold text-accent uppercase tracking-widest">
              Roteiro para Reels
            </span>
          </div>

          <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
            <ViralBadge score={news.viral_score} size="md" showLabel />
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-text-secondary border border-white/[0.08]">
              {CATEGORY_LABELS[news.category] ?? news.category}
            </span>
            <span className="text-[10px] text-text-secondary ml-auto">
              {formatDistanceToNow(news.published_at)}
            </span>
          </div>

          <h2 className="text-sm font-semibold text-text-primary leading-snug mb-2.5">
            {news.title}
          </h2>

          <SourceChips sources={news.sources} maxVisible={4} />
        </div>

        {/* Summary */}
        {news.summary && (
          <div className="px-5 py-3 border-b border-border/50 shrink-0">
            <p className="text-[11px] text-text-secondary leading-relaxed line-clamp-4">
              {news.summary}
            </p>
          </div>
        )}

        {/* Duration selector */}
        <div className="px-5 py-3 border-b border-border/50 shrink-0">
          <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-2.5">
            Duração
          </p>
          <FormatSelector />
        </div>

        {/* Prompt preview */}
        <div className="px-5 py-3 border-b border-border/50 shrink-0">
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            className="flex items-center justify-between w-full group"
          >
            <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider group-hover:text-text-primary transition-colors">
              Prompt preparado
            </span>
            <div className={cn("transition-colors", showPrompt ? "text-accent" : "text-text-secondary group-hover:text-text-primary")}>
              {showPrompt ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </div>
          </button>

          {showPrompt && (
            <div className="mt-2 bg-background/60 rounded-lg border border-border/40 p-3 max-h-48 overflow-y-auto">
              <pre className="text-[10px] text-text-secondary/80 whitespace-pre-wrap font-mono leading-relaxed">
                {prompt}
              </pre>
            </div>
          )}
        </div>

        {/* ── Paste-back section: receive MyHub agent output ── */}
        <div className="px-5 py-3 border-b border-border/50 shrink-0">
          <button
            onClick={() => setShowPasteArea(!showPasteArea)}
            className="flex items-center justify-between w-full group"
          >
            <span className={cn(
              "text-[10px] font-semibold uppercase tracking-wider transition-colors",
              pastedScript ? "text-accent" : "text-text-secondary group-hover:text-text-primary"
            )}>
              {pastedScript ? "✓ Roteiro colado" : "Cole o roteiro do agente"}
            </span>
            <div className={cn("transition-colors", showPasteArea ? "text-accent" : "text-text-secondary group-hover:text-text-primary")}>
              {showPasteArea ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </div>
          </button>

          {showPasteArea && (
            <div className="mt-2 space-y-2">
              <textarea
                value={pastedScript}
                onChange={(e) => setPastedScript(e.target.value)}
                placeholder="Cole aqui o roteiro gerado pelo agente PrimoScript no myhub..."
                className="w-full h-40 bg-background/60 rounded-lg border border-border/40 p-3 text-[10px] text-text-secondary font-mono leading-relaxed resize-none focus:outline-none focus:border-accent/50 placeholder:text-text-muted transition-colors"
              />
              {pastedScript && (
                <div className="flex gap-1.5">
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(pastedScript);
                      setScriptCopied(true);
                      setTimeout(() => setScriptCopied(false), 2000);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-medium text-text-secondary border border-border/60 rounded-lg hover:text-text-primary hover:border-border transition-all"
                  >
                    {scriptCopied ? <Check size={10} className="text-live" /> : <Copy size={10} />}
                    {scriptCopied ? "Copiado!" : "Copiar"}
                  </button>
                  <button
                    onClick={() => { setPastedScript(""); setShowPasteArea(false); }}
                    className="flex items-center justify-center gap-1 px-3 py-1.5 text-[10px] font-medium text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-all"
                  >
                    Limpar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Formatted roteiro display when content is pasted */}
          {pastedScript && !showPasteArea && (
            <div className="mt-2 max-h-52 overflow-y-auto bg-background/40 rounded-lg border border-accent/20 p-3">
              <pre className="text-[10px] text-text-secondary whitespace-pre-wrap font-mono leading-relaxed">
                {pastedScript}
              </pre>
            </div>
          )}
        </div>

        {/* CTAs */}
        <div className="px-5 py-4 border-t border-border/50 shrink-0 space-y-2">
          {opened && (
            <div className="flex items-center gap-2 px-3 py-2 bg-live/10 border border-live/20 rounded-lg mb-1">
              <Check size={12} className="text-live" />
              <p className="text-[11px] text-live font-medium">
                myhub aberto! Cole o prompt no agente PrimoScript.
              </p>
            </div>
          )}

          {videoError && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-[11px] text-red-400 font-medium truncate">{videoError}</p>
            </div>
          )}

          {/* Primary: Gerar Reels (autonomous) */}
          <button
            onClick={handleGenerateVideo}
            disabled={generatingVideo}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent text-white text-sm font-semibold rounded-xl hover:bg-accent/90 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-lg shadow-accent/20"
          >
            {generatingVideo ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Gerando cenas…
              </>
            ) : (
              <>
                <Video size={14} />
                Gerar Reels
              </>
            )}
          </button>

          {/* Reopen player if scenes already generated */}
          {videoProps && !showPlayer && (
            <button
              onClick={() => setShowPlayer(true)}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs text-accent border border-accent/30 hover:bg-accent/10 rounded-xl transition-all"
            >
              <Video size={12} />
              Ver preview
            </button>
          )}

          {/* Secondary: myhub */}
          <button
            onClick={handleOpenMyhub}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs text-text-secondary hover:text-text-primary border border-border/60 hover:border-border rounded-xl transition-all"
          >
            <Zap size={12} />
            Abrir no myhub
            <ExternalLink size={11} className="opacity-70" />
          </button>

          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs text-text-secondary hover:text-text-primary border border-border/60 hover:border-border rounded-xl transition-all"
          >
            {copied ? (
              <>
                <Check size={12} className="text-live" />
                <span className="text-live">Prompt copiado!</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                Copiar prompt
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

function EmptyScriptPanel() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 text-center px-8 bg-surface/10">
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
          <FileText size={26} className="text-accent/60" />
        </div>
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
          <Sparkles size={11} className="text-white" />
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-text-primary mb-1.5">
          Selecione uma notícia
        </p>
        <p className="text-xs text-text-secondary leading-relaxed">
          Clique em qualquer card do feed para gerar o Reels no{" "}
          <span className="text-accent font-medium">Noticiando</span>
        </p>
      </div>

      <div className="flex flex-col gap-2 text-[10px] text-text-secondary w-full max-w-[200px]">
        {[
          "Notícia selecionada do feed",
          "Clique em Gerar Reels",
          "Preview + exportar MP4",
        ].map((step, i) => (
          <div key={i} className="flex items-center gap-2.5 text-left">
            <span className="w-4 h-4 rounded-full bg-accent/15 text-accent text-[9px] font-bold flex items-center justify-center shrink-0">
              {i + 1}
            </span>
            <span>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
