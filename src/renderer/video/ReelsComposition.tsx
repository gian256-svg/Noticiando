import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Series,
} from "remotion";
import React from "react";

export interface ReelsScene {
  id: string;
  headline: string;
  subtext?: string;
  duration_seconds: number;
  visual_type: "hook" | "context" | "data" | "cta";
  accent_word_indices?: number[];
}

export interface ReelsCompositionProps {
  scenes?: ReelsScene[];
  thumbnail_url?: string;
  source_name?: string;
  category?: string;
  news_title?: string;
}

const CATEGORY_PALETTE: Record<string, { bg: string; grad: string; accent: string; dim: string }> = {
  investments:  { bg: "#080E18", grad: "#0D1B33", accent: "#F97316", dim: "#F9731620" },
  economy_br:   { bg: "#051510", grad: "#09231A", accent: "#10B981", dim: "#10B98120" },
  economy_int:  { bg: "#09090F", grad: "#13133A", accent: "#6366F1", dim: "#6366F120" },
  geopolitics:  { bg: "#130808", grad: "#2A0D0D", accent: "#EF4444", dim: "#EF444420" },
  crypto:       { bg: "#090F08", grad: "#0F1F0A", accent: "#F59E0B", dim: "#F59E0B20" },
  general:      { bg: "#0A0A0F", grad: "#14141E", accent: "#F97316", dim: "#F9731620" },
};

function getPalette(category?: string) {
  return CATEGORY_PALETTE[category ?? "general"] ?? CATEGORY_PALETTE.general;
}

export const ReelsComposition: React.FC<ReelsCompositionProps> = ({
  scenes,
  thumbnail_url,
  source_name,
  category,
}) => {
  const { fps } = useVideoConfig();
  const pal = getPalette(category);

  if (!scenes?.length) {
    return (
      <AbsoluteFill style={{ background: pal.bg, alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 28, fontFamily: "sans-serif" }}>
          Sem cenas
        </p>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ background: `linear-gradient(170deg, ${pal.bg} 0%, ${pal.grad} 100%)` }}>
      <Series>
        {scenes.map((scene, idx) => {
          const frames = Math.max(1, Math.round(scene.duration_seconds * fps));
          return (
            <Series.Sequence key={scene.id || idx} durationInFrames={frames}>
              <NewsScene
                scene={scene}
                sceneIndex={idx}
                totalScenes={scenes.length}
                durationInFrames={frames}
                pal={pal}
                sourceName={source_name}
                thumbnailUrl={idx === 0 ? thumbnail_url : undefined}
              />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────
// Single scene
// ─────────────────────────────────────────────

interface Palette { bg: string; grad: string; accent: string; dim: string }

interface SceneProps {
  scene: ReelsScene;
  sceneIndex: number;
  totalScenes: number;
  durationInFrames: number;
  pal: Palette;
  sourceName?: string;
  thumbnailUrl?: string;
}

const NewsScene: React.FC<SceneProps> = ({
  scene,
  sceneIndex,
  totalScenes,
  durationInFrames,
  pal,
  sourceName,
  thumbnailUrl,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({ frame, fps, config: { damping: 16, stiffness: 130 } });
  const exitOpacity = interpolate(
    frame,
    [durationInFrames - fps * 0.25, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const isHook = scene.visual_type === "hook";
  const isCta  = scene.visual_type === "cta";
  const isData = scene.visual_type === "data";

  // Animated grid moves diagonally
  const gridOff = (frame * 0.6) % 80;

  // Progress bar filling (data scenes)
  const barProgress = isData
    ? interpolate(frame, [6, 35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;

  const words = scene.headline.split(" ");
  const accentSet = new Set<number>(scene.accent_word_indices ?? []);

  const fontSize = isHook ? 62 : isCta ? 52 : 54;

  return (
    <AbsoluteFill style={{ opacity: exitOpacity, overflow: "hidden" }}>

      {/* ── Grid texture ── */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: [
          `linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)`,
          `linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)`,
        ].join(","),
        backgroundSize: "80px 80px",
        backgroundPosition: `${gridOff}px ${gridOff}px`,
      }} />

      {/* ── Blurred thumbnail (hook only) ── */}
      {thumbnailUrl && isHook && (
        <>
          <img
            src={thumbnailUrl}
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              objectFit: "cover", opacity: 0.18, filter: "blur(4px) saturate(1.6)",
            }}
          />
          <div style={{
            position: "absolute", inset: 0,
            background: `linear-gradient(to top, ${pal.bg} 40%, transparent 75%, ${pal.bg} 100%)`,
          }} />
        </>
      )}

      {/* ── Top accent line ── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: pal.accent,
        transform: `scaleX(${entrance})`,
        transformOrigin: "left center",
      }} />

      {/* ── Corner index ── */}
      <div style={{
        position: "absolute", top: 32, right: 32,
        color: "rgba(255,255,255,0.2)",
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
        fontSize: 13, fontWeight: 600,
      }}>
        {sceneIndex + 1} / {totalScenes}
      </div>

      {/* ── BREAKING pill (hook) ── */}
      {isHook && (
        <div style={{
          position: "absolute", top: 80, left: 0, right: 0,
          display: "flex", justifyContent: "center",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 20px", borderRadius: 999,
            background: pal.dim,
            border: `1px solid ${pal.accent}50`,
            transform: `scale(${entrance})`,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: pal.accent,
              animation: "pulse 1.5s infinite",
            }} />
            <span style={{
              color: pal.accent, fontSize: 11, fontWeight: 800,
              letterSpacing: "0.18em", textTransform: "uppercase",
              fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
            }}>
              BREAKING
            </span>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "0 72px",
      }}>

        {/* Kinetic headline — word-by-word */}
        <div style={{
          display: "flex", flexWrap: "wrap",
          justifyContent: "center", gap: "12px 14px",
          marginBottom: 28,
        }}>
          {words.map((word, i) => {
            const delay = i * 3;
            const ws = spring({
              frame: Math.max(0, frame - delay),
              fps,
              config: { damping: 11, stiffness: 150 },
            });
            const wy = interpolate(ws, [0, 1], [24, 0]);
            const wo = interpolate(Math.max(0, frame - delay), [0, 5], [0, 1], {
              extrapolateLeft: "clamp", extrapolateRight: "clamp",
            });
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
                  fontSize,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "-0.025em",
                  lineHeight: 1,
                  color: accentSet.has(i) ? pal.accent : "#FFFFFF",
                  textShadow: "0 4px 24px rgba(0,0,0,0.85)",
                  transform: `scale(${ws}) translateY(${wy}px)`,
                  opacity: wo,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>

        {/* Subtext */}
        {scene.subtext && (
          <p style={{
            fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
            fontSize: 22, fontWeight: 400,
            color: "rgba(255,255,255,0.6)",
            textAlign: "center", lineHeight: 1.55,
            maxWidth: 560,
            opacity: interpolate(frame, [10, 18], [0, 1], {
              extrapolateLeft: "clamp", extrapolateRight: "clamp",
            }),
            transform: `translateY(${interpolate(entrance, [0, 1], [12, 0])}px)`,
          }}>
            {scene.subtext}
          </p>
        )}

        {/* Data progress bar */}
        {isData && (
          <div style={{
            marginTop: 36, width: "100%", maxWidth: 500,
            background: "rgba(255,255,255,0.08)",
            borderRadius: 4, height: 5, overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${barProgress * 100}%`,
              background: pal.accent,
              borderRadius: 4,
            }} />
          </div>
        )}

        {/* CTA button */}
        {isCta && (
          <div style={{
            marginTop: 44,
            padding: "16px 40px",
            borderRadius: 14,
            background: pal.accent,
            transform: `scale(${spring({
              frame: Math.max(0, frame - 8),
              fps,
              config: { damping: 10, stiffness: 100 },
            })})`,
          }}>
            <span style={{
              color: "#000",
              fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
              fontWeight: 900, fontSize: 18,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}>
              SIGA PARA MAIS ↗
            </span>
          </div>
        )}
      </div>

      {/* ── Bottom bar ── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 44px 48px",
      }}>
        <span style={{
          fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
          fontSize: 13, fontWeight: 600,
          color: "rgba(255,255,255,0.3)",
          textTransform: "uppercase", letterSpacing: "0.1em",
        }}>
          {sourceName ?? ""}
        </span>
        <span style={{
          fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
          fontSize: 13, fontWeight: 800,
          color: pal.accent,
          textTransform: "uppercase", letterSpacing: "0.12em",
        }}>
          GRUPO PRIMO
        </span>
      </div>

    </AbsoluteFill>
  );
};
