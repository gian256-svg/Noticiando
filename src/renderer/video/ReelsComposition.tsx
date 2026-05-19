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
  youtube_search?: string;
  media_keyword?: string;
  background_video_url?: string;
  illustration_url?: string;
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

interface Palette { bg: string; grad: string; accent: string; text: string; dim: string }

const CATEGORY_PALETTE: Record<string, Palette> = {
  investments:  { bg: "#F5F0E8", grad: "#EFEBE1", accent: "#1A3A6B", text: "#1E293B", dim: "rgba(26,58,107,0.09)" },  // Creme & Deep Blue (The Economist)
  economy_br:   { bg: "#EAF2EC", grad: "#DFEAE2", accent: "#0F5132", text: "#112E21", dim: "rgba(15,81,50,0.09)" },   // Sage Green
  economy_int:  { bg: "#121824", grad: "#0B0E17", accent: "#E0A96D", text: "#FFFFFF", dim: "rgba(224,169,109,0.12)" }, // Deep Blue (Dark)
  geopolitics:  { bg: "#F4EBEB", grad: "#EAE0E0", accent: "#D32F2F", text: "#2B1111", dim: "rgba(211,47,47,0.09)" },   // Crimson Red
  crypto:       { bg: "#1A1A1E", grad: "#121215", accent: "#F59E0B", text: "#FFFFFF", dim: "rgba(245,158,11,0.12)" },  // Slate & Gold
  general:      { bg: "#F5F0E8", grad: "#EFEBE1", accent: "#1A3A6B", text: "#1E293B", dim: "rgba(26,58,107,0.09)" },
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
      {/* ── Global Film Grain & Paper Texture Overlay ── */}
      <div style={{
        position: "absolute", inset: 0,
        opacity: 0.16,
        mixBlendMode: "multiply",
        pointerEvents: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        backgroundSize: "240px 240px",
        zIndex: 99,
      }} />

      {/* ── Vintage Soft Vignette & Editorial Border ── */}
      <div style={{
        position: "absolute", inset: 0,
        boxShadow: "inset 0 0 120px rgba(0, 0, 0, 0.25)",
        border: "10px solid rgba(0, 0, 0, 0.05)",
        pointerEvents: "none",
        zIndex: 98,
      }} />

      {/* ── Editorial Soft Warm Lighting Spotlight ── */}
      <div style={{
        position: "absolute",
        left: "50%",
        top: "40%",
        width: 800,
        height: 800,
        transform: "translate(-50%, -50%)",
        borderRadius: "50%",
        background: `radial-gradient(circle, rgba(255, 253, 245, 0.25) 0%, transparent 80%)`,
        pointerEvents: "none",
        zIndex: 1,
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
        {(scene.background_video_url || (scene.media_url && scene.visual_type !== "illustration")) && (
          <>
            <OffthreadVideo
              src={scene.background_video_url || scene.media_url || ""}
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
              background: "linear-gradient(to top, rgba(0,0,0,0.85) 15%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.85) 85%)",
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
        {(scene.illustration_url || (scene.visual_type === "illustration" && scene.media_url)) && (
          <Img
            src={scene.illustration_url || scene.media_url || ""}
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
              const isHighlighted = accentSet.has(i);
              const delay = i * 2.5;
              const wordFrame = Math.max(0, frame - delay);

              let transform = "";
              let opacity = 0;
              let filter = "";

              const animStyle = sceneIndex % 3;

              if (animStyle === 0) {
                // Style 0: Slide Up + Rotate Stagger
                const s = spring({
                  frame: wordFrame,
                  fps,
                  config: { damping: 12, stiffness: 140 },
                });
                const y = interpolate(s, [0, 1], [40, 0]);
                const rot = interpolate(s, [0, 1], [-6, 0]);
                const o = interpolate(wordFrame, [0, 5], [0, 1], { extrapolateRight: "clamp" });
                
                transform = `scale(${s * (isHighlighted ? 1.12 : 1.0)}) translateY(${y}px) rotate(${rot + (isHighlighted ? 1.5 : 0)}deg)`;
                opacity = o;
              } else if (animStyle === 1) {
                // Style 1: Punchy Pop (Scale In with Bounce)
                const s = spring({
                  frame: wordFrame,
                  fps,
                  config: { damping: 10, stiffness: 180 },
                });
                const rot = interpolate(s, [0, 1], [8, 0]);
                const o = interpolate(wordFrame, [0, 4], [0, 1], { extrapolateRight: "clamp" });

                transform = `scale(${s * (isHighlighted ? 1.15 : 1.0)}) rotate(${rot}deg)`;
                opacity = o;
              } else {
                // Style 2: Smooth Slide-in + Blur Reveal
                const s = spring({
                  frame: wordFrame,
                  fps,
                  config: { damping: 14, stiffness: 120 },
                });
                const x = interpolate(s, [0, 1], [-25, 0]);
                const blurVal = interpolate(s, [0, 1], [8, 0]);
                const o = interpolate(wordFrame, [0, 6], [0, 1], { extrapolateRight: "clamp" });

                transform = `scale(${s * (isHighlighted ? 1.12 : 1.0)}) translateX(${x}px)`;
                opacity = o;
                filter = `blur(${blurVal}px)`;
              }

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
                      ? `0 4px 22px rgba(0,0,0,0.9), 0 0 10px ${pal.accent}60` 
                      : "0 4px 18px rgba(0,0,0,0.85)",
                    transform,
                    transformOrigin: "center center",
                    opacity,
                    filter,
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

          {/* High-Fidelity Data Visualization (Editorial Publication-Style Chart) */}
          {isData && (
            <div style={{
              marginTop: 30,
              padding: "20px 24px",
              borderRadius: 4, // rectangular editorial card
              background: "#FBF9F5", // pure book page creme
              border: "1.5px solid #1E293B",
              boxShadow: "6px 6px 0px rgba(30, 41, 59, 0.9)", // solid flat drop shadow
              width: "100%",
              maxWidth: 440,
              opacity: interpolate(frame, [12, 22], [0, 1], {
                extrapolateLeft: "clamp", extrapolateRight: "clamp",
              }),
              transform: `scale(${interpolate(entrance, [0, 1], [0.96, 1.0])}) rotate(${sceneIndex % 2 === 0 ? 0.8 : -0.8}deg)`,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}>
              {/* Header */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1.5px solid #1E293B",
                paddingBottom: 6,
              }}>
                <span style={{
                  fontFamily: "'Oswald', sans-serif",
                  fontSize: 14,
                  fontWeight: 900,
                  color: "#1E293B",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}>
                  INDICADOR ECONOMIA / NOTICIANDO
                </span>
                <span style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 10,
                  fontWeight: 700,
                  color: pal.accent,
                }}>
                  ● ATUALIZADO
                </span>
              </div>

              {/* Grid / Bars */}
              <div style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                height: 120,
                padding: "10px 10px 0 10px",
                position: "relative",
              }}>
                {/* 4 elegant bars */}
                {[
                  { label: "Q1", val: Math.round(parsedValue * 0.45) },
                  { label: "Q2", val: Math.round(parsedValue * 0.7) },
                  { label: "Q3", val: Math.round(parsedValue * 0.9) },
                  { label: "HOJE", val: Math.round(parsedValue), highlight: true },
                ].map((item, idx) => {
                  const h = dataEasedProgress * item.val;
                  return (
                    <div key={idx} style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      width: "18%",
                      height: "100%",
                      justifyContent: "flex-end",
                    }}>
                      {/* Value text above bar */}
                      <span style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontSize: 13,
                        fontWeight: 900,
                        color: item.highlight ? pal.accent : "#475569",
                        marginBottom: 4,
                      }}>
                        {item.highlight ? currentCountText : item.val}{displayUnit}
                      </span>

                      {/* Bar itself */}
                      <div style={{
                        width: "100%",
                        height: `${h * 0.8}%`,
                        background: item.highlight ? pal.accent : "#94A3B8",
                        border: "1.5px solid #1E293B",
                        borderRadius: "2px 2px 0 0",
                        boxShadow: item.highlight ? "2px -2px 0px rgba(30, 41, 59, 0.4)" : undefined,
                      }} />

                      {/* X label */}
                      <span style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 9,
                        fontWeight: 800,
                        color: "#475569",
                        marginTop: 6,
                        textTransform: "uppercase",
                      }}>
                        {item.label}
                      </span>
                    </div>
                  );
                })}
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

