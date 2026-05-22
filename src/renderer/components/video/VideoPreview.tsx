import { Player } from "@remotion/player";
import { X, Download, Loader2, Clapperboard, AlertCircle } from "lucide-react";
import React, { useCallback, useState } from "react";
import { ReelsComposition, ReelsCompositionProps } from "@/video/ReelsComposition";
import { cn } from "@/lib/utils";

interface VideoPreviewProps {
  props: ReelsCompositionProps;
  newsTitle: string;
  onClose: () => void;
}

export function VideoPreview({ props, newsTitle, onClose }: VideoPreviewProps) {
  const [rendering, setRendering] = useState(false);
  const [renderResult, setRenderResult] = useState<{ ok: boolean; path?: string; error?: string } | null>(null);

  const totalFrames = Math.max(
    1,
    Math.round((props.scenes ?? []).reduce((acc, s) => acc + s.duration_seconds, 0) * 30),
  );

  const handleRender = useCallback(async () => {
    setRendering(true);
    setRenderResult(null);
    try {
      // 1. Ask user where to save before rendering
      const saveResult = (await window.noticiando.invoke("video:save-dialog", {
        newsTitle,
      })) as { canceled: boolean; filePath?: string };

      if (saveResult.canceled || !saveResult.filePath) {
        setRendering(false);
        return;
      }

      // 2. Render to chosen path
      const result = (await window.noticiando.invoke("video:render", {
        compositionProps: props,
        newsTitle,
        totalFrames,
        outputPath: saveResult.filePath,
      })) as { ok: boolean; outputPath?: string; error?: string };

      if (result.ok) {
        setRenderResult({ ok: true, path: result.outputPath });
        // Open the file's folder automatically
        await window.noticiando.invoke("shell:show-item", result.outputPath);
      } else {
        setRenderResult({ ok: false, error: result.error ?? "Erro desconhecido" });
      }
    } catch (err) {
      setRenderResult({ ok: false, error: String(err) });
    } finally {
      setRendering(false);
    }
  }, [props, newsTitle, totalFrames]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative flex flex-col items-center gap-5" style={{ maxHeight: "95vh" }}>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <X size={14} className="text-white" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-2">
          <Clapperboard size={14} className="text-accent" />
          <span className="text-[11px] font-bold text-accent uppercase tracking-widest">
            Preview Reels
          </span>
        </div>

        {/* Player — 9:16 at ~270px wide */}
        <div
          className="rounded-2xl overflow-hidden border border-white/10"
          style={{ width: 270, height: 480, flexShrink: 0 }}
        >
          <Player
            component={ReelsComposition}
            inputProps={props}
            durationInFrames={totalFrames}
            fps={30}
            compositionWidth={1080}
            compositionHeight={1920}
            style={{ width: "100%", height: "100%" }}
            controls
            loop
          />
        </div>

        {/* Scene list */}
        {(props.scenes ?? []).length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5" style={{ maxWidth: 320 }}>
            {(props.scenes ?? []).map((s, i) => (
              <span
                key={s.id}
                className="text-[9px] font-semibold px-2 py-0.5 rounded-full border border-white/10 text-white/40"
              >
                {i + 1}. {s.visual_type}
              </span>
            ))}
          </div>
        )}

        {/* Render result */}
        {renderResult && (
          <div
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-medium",
              renderResult.ok
                ? "bg-live/10 border-live/30 text-live"
                : "bg-red-500/10 border-red-500/30 text-red-400",
            )}
          >
            {renderResult.ok ? (
              <>
                <Download size={12} />
                Vídeo salvo! {renderResult.path?.split(/[\\/]/).pop()}
              </>
            ) : (
              <>
                <AlertCircle size={12} />
                {renderResult.error}
              </>
            )}
          </div>
        )}

        {/* Render button */}
        <button
          onClick={handleRender}
          disabled={rendering}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-accent/25"
        >
          {rendering ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Renderizando…
            </>
          ) : (
            <>
              <Download size={14} />
              Exportar MP4
            </>
          )}
        </button>

      </div>
    </div>
  );
}
