import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Series,
  Audio,
  Img,
  OffthreadVideo,
} from "remotion";
import React, { useMemo } from "react";

export interface ReelsScene {
  id: string;
  headline: string;
  subtext?: string;
  duration_seconds: number;
  visual_type: "hook" | "video" | "cutout" | "illustration" | "data" | "cta";
  accent_word_indices?: number[];
  media_url?: string;
  cutout_url?: string;
  decorator_type?: "star" | "arrow" | "circle" | "stripes" | "none";
}

export interface ReelsCompositionProps {
  scenes?: ReelsScene[];
  thumbnail_url?: string;
  source_name?: string;
  category?: string;
  news_title?: string;
  narration_url?: string;
  music_url?: string;
}

const CATEGORY_PALETTE: Record<string, { bg: string; grad: string; accent: string; dim: string }> = {
  investments:  { bg: "#060A12", grad: "#0C172A", accent: "#F97316", dim: "#F9731620" },
  economy_br:   { bg: "#040D0A", grad: "#0A1F18", accent: "#10B981", dim: "#10B98120" },
  economy_int:  { bg: "#07070C", grad: "#0F112D", accent: "#6366F1", dim: "#6366F120" },
  geopolitics:  { bg: "#0E0505", grad: "#220909", accent: "#EF4444", dim: "#EF444420" },
  crypto:       { bg: "#070B06", grad: "#0D1A0B", accent: "#F59E0B", dim: "#F59E0B20" },
  general:      { bg: "#07070C", grad: "#10101B", accent: "#F97316", dim: "#F9731620" },
};

function getPalette(category?: string) {
  return CATEGORY_PALETTE[category ?? "general"] ?? CATEGORY_PALETTE.general;
}

export const ReelsComposition: React.FC<ReelsCompositionProps> = ({
  scenes,
  thumbnail_url,
  source_name,
  category,
  narration_url,
  music_url,
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
      {/* 🎙️ Premium ElevenLabs Brazilian Voice Narration */}
      {narration_url && <Audio src={narration_url} volume={1.0} />}

      {/* 🎵 Epidemic Sound Soundtrack Mixed in Background */}
      {music_url && <Audio src={music_url} volume={0.15} loop />}

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
const Decorator: React.FC<{ type: string; color: string; frame: number }> = ({ type, color, frame }) => {
  if (type === "none" || !type) return null;
  const pulse = Math.sin(frame / 6) * 0.05 + 0.95;
  
  if (type === "star") {
    return (
      <svg
        viewBox="0 0 100 100"
        style={{
          position: "absolute",
          top: 180,
          right: 80,
          width: 80,
          height: 80,
          fill: color,
          filter: `drop-shadow(0 0 16px ${color})`,
          transform: `scale(${pulse}) rotate(${frame * 0.4}deg)`,
          zIndex: 6,
        }}
      >
        <path d="M50 0 L58 35 L90 20 L65 45 L100 50 L65 55 L90 80 L58 65 L50 100 L42 65 L10 80 L35 55 L0 50 L35 45 L10 20 L42 35 Z" />
      </svg>
    );
  }
  
  if (type === "arrow") {
    return (
      <svg
        viewBox="0 0 100 100"
        style={{
          position: "absolute",
          bottom: 240,
          left: 60,
          width: 90,
          height: 90,
          stroke: color,
          strokeWidth: 8,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          fill: "none",
          filter: `drop-shadow(0 0 12px ${color})`,
          transform: `scale(${pulse}) rotate(${-15 + Math.sin(frame / 8) * 5}deg)`,
          zIndex: 6,
        }}
      >
        <path d="M20 20 C40 30 70 50 60 80 M40 70 L60 80 L70 60" />
      </svg>
    );
  }

  if (type === "circle") {
    return (
      <div style={{
        position: "absolute",
        top: "35%",
        left: "15%",
        width: 160,
        height: 160,
        borderRadius: "50%",
        border: `4px dashed ${color}b3`,
        filter: `drop-shadow(0 0 12px ${color}40)`,
        transform: `scale(${pulse}) rotate(${frame * -0.2}deg)`,
        zIndex: 1,
      }} />
    );
  }

  if (type === "stripes") {
    return (
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: 140,
        height: 140,
        overflow: "hidden",
        zIndex: 2,
        opacity: 0.18,
      }}>
        <div style={{
          width: 250,
          height: 250,
          background: `repeating-linear-gradient(-45deg, ${color}, ${color} 15px, transparent 15px, transparent 30px)`,
          transform: "translate(-60px, -60px)",
        }} />
      </div>
    );
  }

  return null;
};

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

  // Entrance & Exit animations
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

  // Slow dynamic camera zoom-in effect (Ken Burns)
  const cameraScale = interpolate(frame, [0, durationInFrames], [1.0, 1.06], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Diagonal animated grid offset
  const gridOff = (frame * 0.6) % 80;

  // Floating ambient glows (oscillates slowly based on frame)
  const glow1X = Math.sin(frame / 45) * 80 + 340;
  const glow1Y = Math.cos(frame / 60) * 120 + 400;
  const glow2X = Math.cos(frame / 50) * 100 + 740;
  const glow2Y = Math.sin(frame / 70) * 150 + 1300;

  // Headline parsing and text shadow variables
  const words = useMemo(() => scene.headline.split(" "), [scene.headline]);
  const accentSet = useMemo(() => new Set<number>(scene.accent_word_indices ?? []), [scene.accent_word_indices]);
  const titleFontSize = isHook ? 68 : isCta ? 58 : 62;
  const subtextFontSize = 48; // STRICT MINIMUM: never below 48px for mobile legibility

  // Parse potential values (e.g. percentages or numbers) for Data scenes
  const dataMetric = useMemo(() => {
    if (!isData) return null;
    const textToSearch = `${scene.headline} ${scene.subtext ?? ""}`;
    const percentMatch = textToSearch.match(/(-?\d+(?:\.\d+)?)%/);
    if (percentMatch) {
      return { num: parseFloat(percentMatch[1]), unit: "%" };
    }
    const moneyMatch = textToSearch.match(/R\$\s*(-?\d+(?:\.\d+)?)/i);
    if (moneyMatch) {
      return { num: parseFloat(moneyMatch[1]), unit: "R$" };
    }
    const numberMatch = textToSearch.match(/(-?\d+(?:\.\d+)?)/);
    if (numberMatch) {
      return { num: parseFloat(numberMatch[1]), unit: "" };
    }
    return null;
  }, [isData, scene.headline, scene.subtext]);

  // Data animations variables
  const dataEasedProgress = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { damping: 13, stiffness: 85 }
  });

  const parsedValue = dataMetric ? Math.abs(dataMetric.num) : 75;
  const displayUnit = dataMetric ? dataMetric.unit : "%";
  const displayVal = dataMetric ? dataMetric.num : 75;

  const radius = 38;
  const strokeWidth = 6;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(parsedValue, 100) / 100) * dataEasedProgress * circumference;

  const currentCountText = dataMetric
    ? (displayVal * dataEasedProgress).toFixed(displayVal % 1 === 0 ? 0 : 1)
    : (75 * dataEasedProgress).toFixed(0);

  // Call to Action Sweep Shimmer
  const shimmerPercent = interpolate(
    frame % 90,
    [15, 60],
    [-150, 150],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ opacity: exitOpacity, overflow: "hidden" }}>
      {/* ── Global Film Grain Overlay (Cinematic Noise / Paper Texture) ── */}
      <div style={{
        position: "absolute", inset: 0,
        opacity: 0.12,
        mixBlendMode: "overlay",
        pointerEvents: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        backgroundSize: "220px 220px",
        zIndex: 99,
      }} />

      {/* ── Slow Dynamic Ambient Glows ── */}
      <div style={{
        position: "absolute",
        left: glow1X - 350,
        top: glow1Y - 350,
        width: 700,
        height: 700,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${pal.accent} 0%, transparent 70%)`,
        opacity: 0.16,
        filter: "blur(110px)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute",
        left: glow2X - 450,
        top: glow2Y - 450,
        width: 900,
        height: 900,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${pal.accent === '#10B981' ? '#3B82F6' : '#6366F1'} 0%, transparent 70%)`,
        opacity: 0.11,
        filter: "blur(130px)",
        pointerEvents: "none",
      }} />

      {/* ── Diagonal Grid Texture ── */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: [
          `linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px)`,
          `linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)`,
        ].join(","),
        backgroundSize: "80px 80px",
        backgroundPosition: `${gridOff}px ${gridOff}px`,
        pointerEvents: "none",
      }} />

      {/* ── Segmented Top Progress Indicators (Instagram style) ── */}
      <div style={{
        position: "absolute",
        top: 24, left: 24, right: 24,
        display: "flex", gap: 6,
        zIndex: 50,
      }}>
        {Array.from({ length: totalScenes }).map((_, i) => {
          let fillRatio = 0;
          if (i < sceneIndex) {
            fillRatio = 1;
          } else if (i === sceneIndex) {
            fillRatio = interpolate(frame, [0, durationInFrames], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
          }
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: "rgba(255, 255, 255, 0.15)",
                overflow: "hidden",
              }}
            >
              <div style={{
                height: "100%",
                width: `${fillRatio * 100}%`,
                background: pal.accent,
                borderRadius: 2,
                boxShadow: fillRatio > 0 ? `0 0 10px ${pal.accent}` : undefined,
              }} />
            </div>
          );
        })}
      </div>

      {/* ── Content Container with camera zoom (Parallax layout) ── */}
      <AbsoluteFill style={{ transform: `scale(${cameraScale})`, transformOrigin: "center center" }}>
        
        {/* Blurred background image (Hook scene only) */}
        {thumbnailUrl && isHook && (
          <>
            <Img
              src={thumbnailUrl}
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%",
                objectFit: "cover", opacity: 0.28, filter: "blur(5px) saturate(1.8)",
                transform: `scale(${cameraScale * 1.05})`,
                transformOrigin: "center center",
              }}
            />
            <div style={{
              position: "absolute", inset: 0,
              background: `linear-gradient(to top, ${pal.bg} 35%, transparent 70%, ${pal.bg} 100%)`,
            }} />
          </>
        )}

        {/* Real YouTube cut or Stock Video Background */}
        {scene.visual_type === "video" && scene.media_url && (
          <>
            <OffthreadVideo
              src={scene.media_url}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
              volume={0}
            />
            {/* Dark vignette to protect typography legibility */}
            <div style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to top, rgba(0,0,0,0.92) 15%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.92) 85%)",
            }} />
          </>
        )}

        {/* Dynamic Graphic Decorator Element (Star, arrow, stripes, circle) */}
        {scene.decorator_type && scene.decorator_type !== "none" && (
          <Decorator type={scene.decorator_type} color={pal.accent} frame={frame} />
        )}

        {/* Senior Motion Design Cutout Sticker (popping from bottom) */}
        {scene.visual_type === "cutout" && scene.cutout_url && (
          <Img
            src={scene.cutout_url}
            style={{
              position: "absolute",
              bottom: 40,
              right: sceneIndex % 2 === 0 ? 30 : "auto",
              left: sceneIndex % 2 !== 0 ? 30 : "auto",
              height: "44%",
              maxHeight: 520,
              objectFit: "contain",
              transform: `translateY(${
                interpolate(
                  spring({ frame, fps, config: { damping: 13, stiffness: 85 } }),
                  [0, 1],
                  [380, 0]
                ) + Math.cos(frame / 12) * 8
              }px) scale(${
                interpolate(
                  spring({ frame, fps, config: { damping: 13, stiffness: 85 } }),
                  [0, 1],
                  [0.6, 1]
                )
              }) rotate(${Math.sin(frame / 15) * 2 + (sceneIndex % 2 === 0 ? 2 : -2)}deg)`,
              filter: "drop-shadow(0 20px 35px rgba(0,0,0,0.85)) drop-shadow(0 0 8px rgba(255,255,255,0.05))",
              pointerEvents: "none",
              zIndex: 4,
            }}
          />
        )}

        {/* Dynamic Stylized Illustration Sticker (floating on side/center) */}
        {scene.visual_type === "illustration" && scene.media_url && (
          <Img
            src={scene.media_url}
            style={{
              position: "absolute",
              top: "22%",
              right: sceneIndex % 2 === 0 ? 40 : "auto",
              left: sceneIndex % 2 !== 0 ? 40 : "auto",
              height: "32%",
              objectFit: "contain",
              transform: `translateY(${Math.sin(frame / 10) * 10}px) scale(${
                interpolate(
                  spring({ frame, fps, config: { damping: 14, stiffness: 95 } }),
                  [0, 1],
                  [0, 1]
                )
              }) rotate(${interpolate(frame, [0, durationInFrames], [-4, 6])}deg)`,
              filter: "drop-shadow(0 20px 30px rgba(0,0,0,0.8))",
              pointerEvents: "none",
              zIndex: 3,
            }}
          />
        )}

        {/* Top visual category pill/logo (Hook scene) */}
        {isHook && (
          <div style={{
            position: "absolute", top: 80, left: 0, right: 0,
            display: "flex", justifyContent: "center",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 22px", borderRadius: 999,
              background: pal.dim,
              border: `1px solid ${pal.accent}50`,
              boxShadow: `0 8px 24px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.08)`,
              transform: `scale(${entrance}) translateY(${Math.sin(frame / 8) * 3}px)`,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: pal.accent,
                boxShadow: `0 0 10px ${pal.accent}`,
              }} />
              <span style={{
                color: pal.accent, fontSize: 11, fontWeight: 900,
                letterSpacing: "0.22em", textTransform: "uppercase",
                fontFamily: "'Oswald', 'Montserrat', 'Inter', sans-serif",
              }}>
                BREAKING
              </span>
            </div>
          </div>
        )}

        {/* Main Central Card & Typography */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "0 48px",
        }}>

          {/* Kinetic Headline - Overshoot spring & Neon glow */}
          <div style={{
            display: "flex", flexWrap: "wrap",
            justifyContent: "center", gap: "14px 16px",
            marginBottom: 20,
            zIndex: 10,
          }}>
            {words.map((word, i) => {
              const delay = i * 2.5;
              const ws = spring({
                frame: Math.max(0, frame - delay),
                fps,
                config: { damping: 11, stiffness: 160 },
              });
              const wy = interpolate(ws, [0, 1], [30, 0]);
              const rotate = interpolate(ws, [0, 1], [-8, 0]);
              const wo = interpolate(Math.max(0, frame - delay), [0, 5], [0, 1], {
                extrapolateLeft: "clamp", extrapolateRight: "clamp",
              });

              const isHighlighted = accentSet.has(i);

              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    fontFamily: "'Oswald', 'Montserrat', 'Inter', sans-serif",
                    fontSize: titleFontSize,
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "-0.04em", // tight kerning
                    lineHeight: 0.95,
                    color: isHighlighted ? pal.accent : "#FFFFFF",
                    textShadow: isHighlighted 
                      ? `0 0 16px ${pal.accent}b3, 0 4px 28px rgba(0,0,0,0.95)` 
                      : "0 4px 24px rgba(0,0,0,0.85)",
                    transform: `scale(${ws * (isHighlighted ? 1.12 : 1.0)}) translateY(${wy}px) rotate(${rotate + (isHighlighted ? 1.5 : 0)}deg)`,
                    transformOrigin: "center center",
                    opacity: wo,
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>

          {/* Glassmorphic Subtext Card */}
          {scene.subtext && (
            <div style={{
              marginTop: 18,
              padding: "20px 30px",
              borderRadius: 18,
              background: "rgba(10, 11, 22, 0.45)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(14px)",
              boxShadow: "0 20px 45px rgba(0,0,0,0.5), inset 0 1px 0px rgba(255,255,255,0.05)",
              maxWidth: 510,
              opacity: interpolate(frame, [10, 18], [0, 1], {
                extrapolateLeft: "clamp", extrapolateRight: "clamp",
              }),
              transform: `translateY(${interpolate(entrance, [0, 1], [18, 0])}px)`,
              zIndex: 5,
            }}>
              <p style={{
                fontFamily: "'Inter', 'Roboto', sans-serif",
                fontSize: subtextFontSize, // STRICT MINIMUM: >= 48px
                fontWeight: 600,
                color: "rgba(255,255,255,0.95)",
                textAlign: "center", lineHeight: 1.4,
                margin: 0,
                textShadow: "0 2px 8px rgba(0,0,0,0.5)",
              }}>
                {scene.subtext}
              </p>
            </div>
          )}

          {/* High-Fidelity Data Visualization (Circular Gauge + Pulsing Mini-Bars) */}
          {isData && (
            <div style={{
              marginTop: 34,
              display: "flex",
              alignItems: "center",
              gap: 32,
              padding: "20px 28px",
              borderRadius: 20,
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              backdropFilter: "blur(8px)",
              boxShadow: "0 15px 35px rgba(0,0,0,0.3)",
              width: "100%",
              maxWidth: 460,
              opacity: interpolate(frame, [12, 22], [0, 1], {
                extrapolateLeft: "clamp", extrapolateRight: "clamp",
              }),
              transform: `scale(${interpolate(entrance, [0, 1], [0.95, 1.0])})`,
            }}>
              {/* Left Side: Glowing Ring Gauge */}
              <div style={{ position: "relative", width: 90, height: 90, flexShrink: 0 }}>
                <svg width="90" height="90" viewBox="0 0 90 90" style={{ transform: "rotate(-90deg)" }}>
                  {/* Outer circle track */}
                  <circle
                    cx="45" cy="45" r={radius}
                    fill="transparent"
                    stroke="rgba(255, 255, 255, 0.07)"
                    strokeWidth={strokeWidth}
                  />
                  {/* Animated gauge circle fill */}
                  <circle
                    cx="45" cy="45" r={radius}
                    fill="transparent"
                    stroke={pal.accent}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    style={{
                      filter: `drop-shadow(0 0 8px ${pal.accent}cc)`
                    }}
                  />
                </svg>
                {/* Internal percentage text */}
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{
                    color: "#FFFFFF",
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: 16, fontWeight: 800,
                    lineHeight: 1,
                  }}>
                    {currentCountText}
                  </span>
                  <span style={{
                    color: "rgba(255,255,255,0.4)",
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 10, fontWeight: 700,
                    textTransform: "uppercase",
                    marginTop: 2,
                  }}>
                    {displayUnit || "VAL"}
                  </span>
                </div>
              </div>

              {/* Right Side: Mini Bar Dashboard */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, flexGrow: 1 }}>
                <div style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: 10, fontWeight: 800,
                  color: pal.accent,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}>
                  Métrica de Mercado
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 50, paddingBottom: 4 }}>
                  <div style={{
                    flex: 1,
                    height: `${dataEasedProgress * 55}%`,
                    background: `linear-gradient(to top, rgba(255,255,255,0.05), ${pal.accent}aa)`,
                    borderRadius: "4px 4px 2px 2px",
                    border: `1px solid ${pal.accent}40`,
                    boxShadow: `0 0 10px ${pal.accent}33`,
                  }} />
                  <div style={{
                    flex: 1,
                    height: `${dataEasedProgress * 95}%`,
                    background: `linear-gradient(to top, rgba(255,255,255,0.05), ${pal.accent})`,
                    borderRadius: "4px 4px 2px 2px",
                    border: `1px solid ${pal.accent}80`,
                    boxShadow: `0 0 15px ${pal.accent}66`,
                  }} />
                  <div style={{
                    flex: 1,
                    height: `${dataEasedProgress * 70}%`,
                    background: `linear-gradient(to top, rgba(255,255,255,0.05), ${pal.accent}aa)`,
                    borderRadius: "4px 4px 2px 2px",
                    border: `1px solid ${pal.accent}40`,
                    boxShadow: `0 0 10px ${pal.accent}33`,
                  }} />
                </div>
              </div>
            </div>
          )}

          {/* Premium Call to Action Button with metallic shimmer sweep */}
          {isCta && (
            <div style={{
              marginTop: 40,
              padding: "16px 42px",
              borderRadius: 16,
              background: pal.accent,
              boxShadow: `0 15px 35px ${pal.accent}40, 0 0 0 1px ${pal.accent}bb`,
              transform: `scale(${spring({
                frame: Math.max(0, frame - 10),
                fps,
                config: { damping: 10, stiffness: 100 },
              })})`,
              position: "relative",
              overflow: "hidden",
              zIndex: 10,
            }}>
              {/* Metallic shimmer sweep reflection */}
              <div style={{
                position: "absolute",
                top: 0, bottom: 0,
                width: "40%",
                transform: "skewX(-25deg)",
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)",
                left: `${shimmerPercent}%`,
                pointerEvents: "none",
              }} />
              
              <span style={{
                color: "#000",
                fontFamily: "'Oswald', 'Montserrat', sans-serif",
                fontWeight: 900, fontSize: 20,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}>
                SIGA PARA MAIS ↗
              </span>
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

