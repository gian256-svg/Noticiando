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
  visual_type: "hook" | "video" | "cutout" | "illustration" | "data" | "map" | "timeline" | "collage" | "split_video" | "newspaper_clip";
  accent_word_indices?: number[];
  media_url?: string;
  cutout_url?: string;
  decorator_type?: "star" | "arrow" | "circle" | "stripes" | "none";
  youtube_search?: string;
  media_keyword?: string;
  background_video_url?: string;
  illustration_url?: string;
  map_image_url?: string;
  audio_url?: string;
  caption_words?: Array<{ word: string; start: number; end: number }>;
  logo_url?: string;
  timeline_points?: Array<{ label: string; value: string | number }>;
  brand_domain?: string;
  person_name?: string;
  tag_badge?: string; // Short floating label near cutout, e.g. "CEO DESDE 2015" or "R$ 4,5 TRI"
  secondary_asset_urls?: string[]; // Decorative satellite images orbiting the main asset
}

export interface ReelsCompositionProps {
  scenes?: ReelsScene[];
  thumbnail_url?: string;
  source_name?: string;
  category?: string;
  news_title?: string;
  narration_url?: string;
  music_url?: string;
  sources?: Array<{ source: string; title: string; url?: string }>;
}

interface Palette { bg: string; grad: string; bgGradient?: string; accent: string; text: string; dim: string }

// ── Paletas Premium Dark — Estilo @theeconomist ───────────────────────────────
const CATEGORY_PALETTE: Record<string, Palette> = {
  // Economia / Finanças — Ciano elétrico
  investments:  { bg: "#0a0f1e", grad: "#0a1628", bgGradient: "linear-gradient(160deg, #0a0f1e 0%, #0d2137 50%, #0a1628 100%)", accent: "#00d4ff", text: "#FFFFFF", dim: "rgba(0,212,255,0.12)" },
  economy_br:   { bg: "#0a0f1e", grad: "#0a1628", bgGradient: "linear-gradient(160deg, #0a0f1e 0%, #0d2137 50%, #0a1628 100%)", accent: "#00d4ff", text: "#FFFFFF", dim: "rgba(0,212,255,0.12)" },
  economy_int:  { bg: "#0a0f1e", grad: "#0a1628", bgGradient: "linear-gradient(160deg, #0a0f1e 0%, #0d2137 50%, #0a1628 100%)", accent: "#00d4ff", text: "#FFFFFF", dim: "rgba(0,212,255,0.12)" },
  // Política — Vermelho forte
  geopolitics:  { bg: "#1a0a0a", grad: "#1a0808", bgGradient: "linear-gradient(160deg, #1a0a0a 0%, #2d0f0f 50%, #1a0808 100%)", accent: "#ff4444", text: "#FFFFFF", dim: "rgba(255,68,68,0.12)" },
  politics:     { bg: "#1a0a0a", grad: "#1a0808", bgGradient: "linear-gradient(160deg, #1a0a0a 0%, #2d0f0f 50%, #1a0808 100%)", accent: "#ff4444", text: "#FFFFFF", dim: "rgba(255,68,68,0.12)" },
  // Tecnologia / Crypto — Roxo tech
  crypto:       { bg: "#050d1a", grad: "#060e1c", bgGradient: "linear-gradient(160deg, #050d1a 0%, #0a1a2e 50%, #060e1c 100%)", accent: "#7b61ff", text: "#FFFFFF", dim: "rgba(123,97,255,0.12)" },
  tech:         { bg: "#050d1a", grad: "#060e1c", bgGradient: "linear-gradient(160deg, #050d1a 0%, #0a1a2e 50%, #060e1c 100%)", accent: "#7b61ff", text: "#FFFFFF", dim: "rgba(123,97,255,0.12)" },
  // Esporte — Verde neon
  sports:       { bg: "#0a1a0a", grad: "#081508", bgGradient: "linear-gradient(160deg, #0a1a0a 0%, #0d2d0d 50%, #081508 100%)", accent: "#00ff88", text: "#FFFFFF", dim: "rgba(0,255,136,0.12)" },
  // Internacional / Geopolítica — Âmbar
  international:{ bg: "#0f0a1a", grad: "#0c0814", bgGradient: "linear-gradient(160deg, #0f0a1a 0%, #1a0f2d 50%, #0c0814 100%)", accent: "#ffaa00", text: "#FFFFFF", dim: "rgba(255,170,0,0.12)" },
  // Padrão
  general:      { bg: "#0a0f1e", grad: "#0a1628", bgGradient: "linear-gradient(160deg, #0a0f1e 0%, #0d2137 50%, #0a1628 100%)", accent: "#00d4ff", text: "#FFFFFF", dim: "rgba(0,212,255,0.12)" },
};

// ── Mapeamento de aliases de categoria ────────────────────────────────────────
const CATEGORY_ALIASES: Record<string, string> = {
  economics: "economy_br", economy: "economy_br",
  "economia": "economy_br", "economia_br": "economy_br",
  "economia_int": "economy_int", "finanças": "economy_br",
  "financas": "economy_br", "mercado": "economy_br",
  "política": "politics", "politica": "politics",
  "geopolitica": "geopolitics", "geopolítica": "geopolitics",
  "tecnologia": "tech", "technology": "tech",
  "criptomoedas": "crypto", "cryptocurrency": "crypto",
  "esportes": "sports", "sport": "sports", "esporte": "sports",
  "internacional": "international", "world": "international", "global": "international",
};

const getEditorialLabel = (cat?: string): string => {
  const key = (cat ?? "general").toLowerCase();
  const labels: Record<string, string> = {
    investments: "FINANÇAS",
    economy_br: "ECONOMIA",
    economy_int: "MUNDO",
    geopolitics: "GEOPOLÍTICA",
    politics: "POLÍTICA",
    crypto: "CRIPTOMOEDAS",
    tech: "TECNOLOGIA",
    sports: "ESPORTES",
    international: "INTERNACIONAL",
    general: "EDITORIAL"
  };
  const resolved = CATEGORY_ALIASES[key] ?? key;
  return labels[resolved] ?? "NOTÍCIA";
};

const EditorialTickerBackground: React.FC<{ frame: number; accentColor: string }> = ({ frame, accentColor }) => {
  const text = "MERCADO • ECONOMIA • TENDÊNCIA • INVESTIMENTOS • GLOBAL • DADOS • ANÁLISE • PROJEÇÃO • RELATÓRIO • ";
  const offset1 = (frame * 0.8) % 1000;
  const offset2 = -(frame * 0.6) % 1000;
  return (
    <div style={{
      position: "absolute",
      inset: 0,
      opacity: 0.03,
      zIndex: 0,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-around",
      padding: "100px 0",
      fontFamily: "'Oswald', sans-serif",
      fontSize: 90,
      fontWeight: 900,
      letterSpacing: "0.1em",
      color: accentColor,
      pointerEvents: "none",
    }}>
      <div style={{ transform: `translateX(-${offset1}px)`, whiteSpace: "nowrap" }}>
        {text.repeat(5)}
      </div>
      <div style={{ transform: `translateX(${offset2}px)`, whiteSpace: "nowrap" }}>
        {text.repeat(5)}
      </div>
    </div>
  );
};

// ── GlitchFlash — Brief chromatic aberration flash at hook scene start ──────────
const GlitchFlash: React.FC<{ frame: number; accentColor: string }> = ({ frame, accentColor }) => {
  // Fire 3 flash frames at frame 2, 4, 7 — then gone forever
  const flashFrames = [2, 4, 7];
  const isFlashFrame = flashFrames.includes(frame);
  const glitchX = frame === 4 ? 6 : frame === 7 ? -4 : 3;

  if (!isFlashFrame) return null;

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 50, pointerEvents: "none", overflow: "hidden" }}>
      {/* Red channel shift */}
      <div style={{
        position: "absolute", inset: 0,
        background: `${accentColor}22`,
        transform: `translateX(${glitchX}px)`,
        mixBlendMode: "screen",
      }} />
      {/* Horizontal glitch bars */}
      {[20, 38, 57, 73].map((top, i) => (
        <div key={i} style={{
          position: "absolute",
          top: `${top}%`,
          left: 0, right: 0,
          height: i % 2 === 0 ? 2 : 4,
          background: i % 2 === 0 ? accentColor : "#ffffff",
          opacity: 0.35,
          transform: `translateX(${i % 2 === 0 ? glitchX * 2 : -glitchX}px)`,
        }} />
      ))}
    </div>
  );
};

// ── CornerBrackets — Cinematic frame brackets for video scenes ───────────────────
const CornerBrackets: React.FC<{
  frame: number;
  fps: number;
  accentColor: string;
  size?: number;
  thickness?: number;
}> = ({ frame, fps, accentColor, size = 48, thickness = 3 }) => {
  const entrance = spring({ frame: Math.max(0, frame - 4), fps, config: { damping: 18, stiffness: 80 } });
  const pulse = 0.55 + Math.sin(frame / 45) * 0.15;
  const corners = [
    { top: 24, left: 24, borderTop: thickness, borderLeft: thickness, borderBottom: 0, borderRight: 0, borderRadius: "4px 0 0 0" },
    { top: 24, right: 24, borderTop: thickness, borderRight: thickness, borderBottom: 0, borderLeft: 0, borderRadius: "0 4px 0 0" },
    { bottom: 24, left: 24, borderBottom: thickness, borderLeft: thickness, borderTop: 0, borderRight: 0, borderRadius: "0 0 0 4px" },
    { bottom: 24, right: 24, borderBottom: thickness, borderRight: thickness, borderTop: 0, borderLeft: 0, borderRadius: "0 0 4px 0" },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 8, pointerEvents: "none", opacity: entrance * pulse }}>
      {corners.map((c, i) => (
        <div key={i} style={{
          position: "absolute",
          ...c,
          width: size,
          height: size,
          borderStyle: "solid",
          borderColor: accentColor,
          borderTopWidth: c.borderTop || 0,
          borderLeftWidth: c.borderLeft || 0,
          borderRightWidth: c.borderRight || 0,
          borderBottomWidth: c.borderBottom || 0,
        }} />
      ))}
    </div>
  );
};

// ── ScanlineOverlay — CRT scanline texture for cinematic video scenes ────────────
const ScanlineOverlay: React.FC<{ frame: number }> = ({ frame }) => {
  const drift = (frame * 0.4) % 4;
  return (
    <div style={{
      position: "absolute",
      inset: 0,
      zIndex: 9,
      pointerEvents: "none",
      backgroundImage: `repeating-linear-gradient(
        0deg,
        transparent,
        transparent 3px,
        rgba(0, 0, 0, 0.06) 3px,
        rgba(0, 0, 0, 0.06) 4px
      )`,
      backgroundPosition: `0 ${drift}px`,
      mixBlendMode: "multiply",
      opacity: 0.55,
    }} />
  );
};

// ── DiagonalStripe — Editorial accent stripe for hook scenes (The Economist aesthetic) ──
const DiagonalStripe: React.FC<{
  frame: number;
  fps: number;
  accentColor: string;
}> = ({ frame, fps, accentColor }) => {
  const entrance = spring({ frame: Math.max(0, frame - 3), fps, config: { damping: 22, stiffness: 60 } });
  const translateX = interpolate(entrance, [0, 1], [800, 0]);
  const pulse = Math.sin(frame / 40) * 0.015 + 1;

  return (
    <>
      {/* Primary diagonal stripe — wide, semi-transparent */}
      <div style={{
        position: "absolute",
        top: -300,
        right: -100,
        width: 560,
        height: 2600,
        background: `linear-gradient(to bottom, ${accentColor}22 0%, ${accentColor}10 50%, transparent 100%)`,
        transform: `translateX(${translateX}px) rotate(-22deg) scale(${pulse})`,
        transformOrigin: "top right",
        zIndex: 2,
        pointerEvents: "none",
      }} />
      {/* Secondary narrower stripe with solid edge */}
      <div style={{
        position: "absolute",
        top: -300,
        right: 60,
        width: 8,
        height: 2600,
        background: `linear-gradient(to bottom, ${accentColor}70 0%, ${accentColor}30 60%, transparent 100%)`,
        transform: `translateX(${translateX * 0.85}px) rotate(-22deg)`,
        transformOrigin: "top right",
        zIndex: 2,
        pointerEvents: "none",
        boxShadow: `0 0 20px ${accentColor}40`,
      }} />
      {/* Third accent sliver */}
      <div style={{
        position: "absolute",
        top: -300,
        right: 160,
        width: 3,
        height: 2600,
        background: `linear-gradient(to bottom, ${accentColor}40 0%, transparent 80%)`,
        transform: `translateX(${translateX * 0.7}px) rotate(-22deg)`,
        transformOrigin: "top right",
        zIndex: 2,
        pointerEvents: "none",
      }} />
    </>
  );
};

// ── CutoutHalo — SVG ring that draws itself around person cutouts ──────────────
const CutoutHalo: React.FC<{
  frame: number;
  fps: number;
  accentColor: string;
  assetSide: "left" | "right";
  entranceDelay: number;
}> = ({ frame, fps, accentColor, assetSide, entranceDelay }) => {
  const entrance = spring({
    frame: Math.max(0, frame - entranceDelay - 8),
    fps,
    config: { damping: 18, stiffness: 90 },
  });
  const drawProgress = interpolate(entrance, [0, 1], [0, 1]);
  const pulse = Math.sin(frame / 22) * 0.025 + 0.975;
  const opacity = interpolate(entrance, [0, 0.4], [0, 1]);

  const r1 = 240;
  const r2 = 210;
  const cx = 270;
  const cy = 270;
  const c1 = 2 * Math.PI * r1;
  const c2 = 2 * Math.PI * r2;

  // Glow dot position (end of inner arc)
  const arcAngle = drawProgress * 0.4 * 2 * Math.PI - Math.PI / 2;
  const dotX = cx + r2 * Math.cos(arcAngle);
  const dotY = cy + r2 * Math.sin(arcAngle);

  return (
    <div style={{
      position: "absolute",
      bottom: "5%",
      [assetSide]: "2%",
      width: 540,
      height: 540,
      opacity: opacity * pulse,
      zIndex: 3,
      pointerEvents: "none",
    }}>
      <svg width="540" height="540" style={{ overflow: "visible" }}>
        <defs>
          <filter id="halo-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Outer dashed orbit ring */}
        <circle
          cx={cx} cy={cy} r={r1}
          fill="none"
          stroke={accentColor}
          strokeWidth="1.5"
          strokeDasharray={`${c1 * drawProgress * 0.65} ${c1}`}
          strokeLinecap="round"
          opacity={0.35}
        />
        {/* Inner bold arc */}
        <circle
          cx={cx} cy={cy} r={r2}
          fill="none"
          stroke={accentColor}
          strokeWidth="4"
          strokeDasharray={`${c2 * drawProgress * 0.40} ${c2}`}
          strokeDashoffset={-c2 * 0.05}
          strokeLinecap="round"
          opacity={0.75}
          filter="url(#halo-glow)"
        />
        {/* Glowing dot at the arc tip */}
        {drawProgress > 0.15 && (
          <>
            <circle cx={dotX} cy={dotY} r={10} fill={accentColor} opacity={0.3} />
            <circle cx={dotX} cy={dotY} r={5} fill={accentColor} opacity={0.9} />
          </>
        )}
        {/* Small tick marks at cardinal angles */}
        {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, i) => {
          const tx = cx + (r1 + 12) * Math.cos(angle);
          const ty = cy + (r1 + 12) * Math.sin(angle);
          const tick = drawProgress > i * 0.2 ? 1 : 0;
          return (
            <circle key={i} cx={tx} cy={ty} r={3 * tick} fill={accentColor} opacity={0.5 * tick} />
          );
        })}
      </svg>
    </div>
  );
};

// ── FloatingTagBadge — hand-tag label near cutout (Pelé "83 ANO" aesthetic) ────
const FloatingTagBadge: React.FC<{
  text: string;
  frame: number;
  fps: number;
  accentColor: string;
  assetSide: "left" | "right";
  entranceDelay: number;
  verticalOffset?: string;
}> = ({ text, frame, fps, accentColor, assetSide, entranceDelay, verticalOffset = "42%" }) => {
  const entrance = spring({
    frame: Math.max(0, frame - entranceDelay),
    fps,
    config: { damping: 10, stiffness: 140, mass: 0.7 },
  });
  const bounce = Math.sin(frame / 28) * 7;
  const sway = Math.cos(frame / 45) * 2.5;
  const opacity = interpolate(entrance, [0, 1], [0, 1]);
  const scale = interpolate(entrance, [0, 1], [0.5, 1]);
  const translateY = interpolate(entrance, [0, 1], [-60, 0]);

  // Badge appears on opposite side to cutout
  const opposite = assetSide === "left" ? "right" : "left";

  return (
    <div style={{
      position: "absolute",
      bottom: verticalOffset,
      [opposite]: "6%",
      zIndex: 22,
      opacity,
      transform: `translateY(${translateY + bounce}px) scale(${scale}) rotate(${sway - 5}deg)`,
      pointerEvents: "none",
    }}>
      {/* Tag string (thin line from top) */}
      <div style={{
        width: 2,
        height: 28,
        background: `${accentColor}80`,
        margin: "0 auto 0",
        position: "absolute",
        top: -28,
        left: "50%",
        transform: "translateX(-50%)",
      }} />
      {/* Tag hole */}
      <div style={{
        width: 14,
        height: 14,
        borderRadius: "50%",
        border: `2px solid ${accentColor}`,
        background: "rgba(0,0,0,0.3)",
        position: "absolute",
        top: 10,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 2,
      }} />
      {/* Tag body */}
      <div style={{
        background: "#FFFDE7",
        border: `2.5px solid ${accentColor}`,
        borderRadius: "8px",
        padding: "20px 28px 14px",
        boxShadow: `5px 5px 0px ${accentColor}50, 0 25px 50px rgba(0,0,0,0.65)`,
        minWidth: 160,
        textAlign: "center",
      }}>
        <span style={{
          fontFamily: "'Oswald', 'Montserrat', sans-serif",
          fontSize: 30,
          fontWeight: 900,
          color: "#1a1a1a",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          display: "block",
          textShadow: "none",
        }}>
          {text}
        </span>
      </div>
    </div>
  );
};

// ── AmbientParticles — floating dots that add depth to dark backgrounds ─────────
const AmbientParticles: React.FC<{
  frame: number;
  accentColor: string;
  count?: number;
}> = ({ frame, accentColor, count = 16 }) => {
  const particles = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      x: (i * 97 + 43) % 100,
      baseY: (i * 73 + 21) % 100,
      size: (i % 3) * 1.5 + 1.5,
      speed: 0.12 + (i % 5) * 0.07,
      delay: (i * 17) % 80,
      opacity: 0.03 + (i % 4) * 0.015,
    })),
  [count]);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none" }}>
      {particles.map((p, i) => {
        const yFrac = ((frame * p.speed + p.delay * 25) % 2400) / 2400;
        const y = ((p.baseY - yFrac * 130 + 130) % 115) - 15;
        const xWobble = Math.sin(frame / 60 + i) * 1.2;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${p.x + xWobble}%`,
              top: `${y}%`,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              background: accentColor,
              opacity: p.opacity,
            }}
          />
        );
      })}
    </div>
  );
};

// ── SecondaryAssetOrbit — satellite images orbiting the main cutout/illustration ──
const SecondaryAssetOrbit: React.FC<{
  urls: string[];
  frame: number;
  fps: number;
  accentColor: string;
  assetSide: "left" | "right";
  entranceDelay: number;
}> = ({ urls, frame, fps, accentColor, assetSide, entranceDelay }) => {
  if (!urls || urls.length === 0) return null;

  // Positions: top-opposite-side, upper-corner, lower-corner
  const positions: Array<{ top: string; left?: string; right?: string; delay: number; rotate: number }> = [
    { top: "12%", ...(assetSide === "right" ? { left: "4%" } : { right: "4%" }), delay: 0,  rotate: -8 },
    { top: "38%", ...(assetSide === "right" ? { left: "2%" } : { right: "2%" }), delay: 8,  rotate:  5 },
    { top: "62%", ...(assetSide === "right" ? { left: "5%" } : { right: "5%" }), delay: 16, rotate: -4 },
  ];

  return (
    <>
      {urls.slice(0, 3).map((url, i) => {
        const pos = positions[i] || positions[0];
        const localDelay = entranceDelay + pos.delay;
        const entryProgress = spring({
          frame: Math.max(0, frame - localDelay),
          fps,
          config: { damping: 14, stiffness: 90 },
        });
        const floatY = Math.sin(frame / 40 + i * 1.3) * 6;
        const floatRotate = Math.cos(frame / 55 + i * 0.9) * 2;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: pos.top,
              left: pos.left,
              right: pos.right,
              width: 110,
              height: 110,
              zIndex: 6,
              opacity: entryProgress * 0.92,
              transform: `
                translateY(${interpolate(entryProgress, [0, 1], [-80, 0]) + floatY}px)
                scale(${entryProgress})
                rotate(${pos.rotate + floatRotate}deg)
              `,
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: `0 8px 32px rgba(0,0,0,0.55), 0 0 0 2px ${accentColor}40`,
            }}
          >
            <Img
              src={url}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            {/* Accent corner bracket */}
            <div style={{
              position: "absolute",
              top: 4, left: 4,
              width: 18, height: 18,
              borderTop: `2px solid ${accentColor}`,
              borderLeft: `2px solid ${accentColor}`,
              borderRadius: "3px 0 0 0",
            }} />
            <div style={{
              position: "absolute",
              bottom: 4, right: 4,
              width: 18, height: 18,
              borderBottom: `2px solid ${accentColor}`,
              borderRight: `2px solid ${accentColor}`,
              borderRadius: "0 0 3px 0",
            }} />
          </div>
        );
      })}
    </>
  );
};

// ── NotebookLinesBg — lined paper texture for illustration/cutout scenes ────────
const NotebookLinesBg: React.FC<{ accentColor: string }> = ({ accentColor }) => (
  <AbsoluteFill style={{
    background: "#F5F1E8",
    backgroundImage: `
      repeating-linear-gradient(
        transparent, transparent 59px,
        rgba(100, 149, 237, 0.22) 59px, rgba(100, 149, 237, 0.22) 61px
      )
    `,
    backgroundPosition: "0 20px",
    zIndex: 0,
  }}>
    {/* Red margin line */}
    <div style={{
      position: "absolute",
      top: 0, bottom: 0,
      left: "13%",
      width: 2,
      background: "rgba(210, 40, 40, 0.28)",
    }} />
    {/* Subtle paper grain overlay */}
    <div style={{
      position: "absolute", inset: 0,
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
      backgroundSize: "200px 200px",
      opacity: 0.6,
      mixBlendMode: "multiply",
    }} />
    {/* Top vignette to keep text readable */}
    <div style={{
      position: "absolute",
      top: 0, left: 0, right: 0,
      height: "35%",
      background: "linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 100%)",
    }} />
    {/* Bottom vignette */}
    <div style={{
      position: "absolute",
      bottom: 0, left: 0, right: 0,
      height: "30%",
      background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)",
    }} />
  </AbsoluteFill>
);

const BrandLogo: React.FC<{ logoUrl: string; frame: number; fps: number }> = ({ logoUrl, frame, fps }) => {
  const entrance = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 100 }
  });
  
  const scale = interpolate(entrance, [0, 1], [0.85, 1.0]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);
  
  return (
    <div style={{
      position: "absolute",
      top: 220,
      left: 0,
      right: 0,
      display: "flex",
      justifyContent: "center",
      zIndex: 45,
      opacity,
      transform: `scale(${scale})`,
    }}>
      <img
        src={logoUrl}
        style={{
          maxWidth: "35%",
          maxHeight: 120,
          objectFit: "contain",
          mixBlendMode: "screen",
        }}
      />
    </div>
  );
};

const NewspaperCollage: React.FC<{
  sources?: Array<{ source: string; title: string; url?: string }>;
  frame: number;
  fps: number;
  fallbackHeadline?: string;
  fallbackSourceName?: string;
}> = ({ sources, frame, fps, fallbackHeadline, fallbackSourceName }) => {
  const fallbackOutlets = ["Bloomberg", "Reuters", "The Wall Street Journal", "Financial Times", "New York Times", "BBC News"];
  const list = [...(sources || [])];
  while (list.length < 3) {
    const fallbackOutlet = fallbackOutlets[list.length % fallbackOutlets.length];
    list.push({
      source: fallbackOutlet,
      title: fallbackHeadline || "Fato confirmado pelas fontes de mercado",
    });
  }

  const visibleSources = list.slice(0, 3);

  const layouts = [
    { left: "6%", top: "42%", rotation: -1.5, delay: 0 },
    { left: "6%", top: "60%", rotation: 1.2, delay: 8 },
    { left: "6%", top: "78%", rotation: -0.8, delay: 16 },
  ];

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      zIndex: 15,
      pointerEvents: "none",
    }}>
      {visibleSources.map((src, idx) => {
        const layout = layouts[idx % layouts.length];
        const entrance = spring({
          frame: Math.max(0, frame - layout.delay),
          fps,
          config: { damping: 15, stiffness: 80 }
        });

        const scale = interpolate(entrance, [0, 1], [0.85, 1]);
        const opacity = interpolate(entrance, [0, 1], [0, 1]);
        const translateY = interpolate(entrance, [0, 1], [150, 0]);

        const titleText = src.title || fallbackHeadline || "Fato confirmado pelas fontes de mercado";
        const sourceName = src.source || "Bloomberg";

        return (
          <div
            key={idx}
            style={{
              position: "absolute",
              top: layout.top,
              left: layout.left,
              width: "88%",
              backgroundColor: "#f4f1ea",
              backgroundImage: "radial-gradient(#e5dec9 1px, transparent 1px)",
              backgroundSize: "16px 16px",
              padding: "20px",
              borderRadius: "8px",
              border: "1.5px solid #d4c8ac",
              boxShadow: "0 12px 36px rgba(0,0,0,0.85)",
              transform: `translateY(${translateY}px) scale(${scale}) rotate(${layout.rotation}deg)`,
              opacity,
              fontFamily: "'Georgia', serif",
              color: "#1a1a1a",
            }}
          >
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              borderBottom: "1.5px double #1a1a1a",
              paddingBottom: 6,
              marginBottom: 10,
              fontSize: 11,
              fontWeight: "bold",
              textTransform: "uppercase",
              color: "#c62828",
              letterSpacing: "0.1em",
            }}>
              <span>{sourceName}</span>
              <span>FONTE CONFIRMADA</span>
            </div>

            <h4 style={{
              margin: 0,
              fontSize: 30,
              lineHeight: 1.2,
              fontWeight: "bold",
              color: "#000000",
              textAlign: "left",
            }}>
              {titleText}
            </h4>
          </div>
        );
      })}
    </div>
  );
};


function getPalette(category?: string) {
  const key = (category ?? "general").toLowerCase();
  const resolved = CATEGORY_ALIASES[key] ?? key;
  return CATEGORY_PALETTE[resolved] ?? CATEGORY_PALETTE.general;
}

export const ReelsComposition: React.FC<ReelsCompositionProps> = ({
  scenes,
  thumbnail_url,
  source_name,
  category,
  news_title,
  narration_url,
  music_url,
  sources,
}) => {
  const { fps } = useVideoConfig();
  const pal = getPalette(category);

  const scenesWithOffsets = useMemo(() => {
    if (!scenes) return [];
    const firstAppearance: Record<string, number> = {};
    let currentAbsoluteFrame = 0;
    return scenes.map((scene) => {
      // Guard: duration_seconds can be undefined/NaN if backend fails — default to 5s
      const safeDuration = (typeof scene.duration_seconds === "number" && isFinite(scene.duration_seconds) && scene.duration_seconds > 0)
        ? scene.duration_seconds
        : 5;
      const durationFrames = Math.max(1, Math.round(safeDuration * fps));
      const startFrame = currentAbsoluteFrame;
      let videoOffset = 0;
      if (scene.media_url) {
        if (firstAppearance[scene.media_url] === undefined) {
          firstAppearance[scene.media_url] = startFrame;
        }
        // Cap videoOffset to avoid seeking past end of B-roll video
        videoOffset = Math.max(0, startFrame - firstAppearance[scene.media_url]);
      }
      currentAbsoluteFrame += durationFrames;
      return {
        ...scene,
        startFrame,
        videoOffset,
        durationFrames,
      };
    });
  }, [scenes, fps]);

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
    <AbsoluteFill style={{ background: pal.bgGradient ?? `linear-gradient(170deg, ${pal.bg} 0%, ${pal.grad} 100%)` }}>
      {/* 🎙️ Premium ElevenLabs Brazilian Voice Narration */}
      {narration_url && <Audio src={narration_url} volume={1.0} />}

      {/* 🎵 Epidemic Sound Soundtrack Mixed in Background with Ducking and Fades */}
      {music_url && (
        <Audio 
          src={music_url} 
          volume={(f) => {
            const totalFrames = scenesWithOffsets.reduce((acc, s) => acc + s.durationFrames, 0);
            
            // Fade in (0.5s = 15 frames)
            let baseVol = interpolate(f, [0, 15], [0, 0.25], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            
            // Fade out (1.0s = 30 frames)
            if (f > totalFrames - 30) {
              baseVol = interpolate(f, [totalFrames - 30, totalFrames], [baseVol, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            }
            
            // Ducking 40% automatically during narration scenes
            let isNarrationActive = false;
            let currentFrameAccumulator = 0;
            for (const s of scenesWithOffsets) {
              const sceneFrames = s.durationFrames;
              if (f >= currentFrameAccumulator && f < currentFrameAccumulator + sceneFrames) {
                // Audio plays until the padding at the end of the scene (usually ~0.4s)
                const narrationEndFrame = currentFrameAccumulator + sceneFrames - Math.round(0.4 * fps);
                if ((s.audio_url || narration_url) && f < narrationEndFrame) {
                  isNarrationActive = true;
                }
                break;
              }
              currentFrameAccumulator += sceneFrames;
            }
            
            return isNarrationActive ? baseVol * 0.60 : baseVol;
          }} 
          loop 
        />
      )}

      {/* SVG filter for sharp white 4px sticker outline */}
      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <defs>
          <filter id="sticker-outline">
            <feMorphology in="SourceAlpha" result="dilated" operator="dilate" radius="3" />
            <feGaussianBlur in="dilated" stdDeviation="0.8" result="blurred" />
            <feComponentTransfer in="blurred" result="sharpOutline">
              <feFuncA type="linear" slope="30" />
            </feComponentTransfer>
            <feFlood floodColor="white" result="flood" />
            <feComposite in="flood" in2="sharpOutline" operator="in" result="coloredOutline" />
            <feMerge>
              <feMergeNode in="coloredOutline" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      <Series>
        {scenesWithOffsets.map((scene, idx) => {
          const frames = scene.durationFrames;
          return (
            <Series.Sequence key={scene.id || idx} durationInFrames={frames}>
              <NewsScene
                scene={scene}
                sceneIndex={idx}
                totalScenes={scenesWithOffsets.length}
                durationInFrames={frames}
                pal={pal}
                sourceName={source_name}
                thumbnailUrl={idx === 0 ? thumbnail_url : undefined}
                sources={sources}
                category={category}
                newsTitle={news_title}
                hasGlobalNarration={!!narration_url}
                videoOffset={scene.videoOffset}
              />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────
interface DecoratorProps {
  type: string;
  color: string;
  frame: number;
  assetSide?: "left" | "right";
  isData?: boolean;
  isNewspaper?: boolean;
  hasSideAsset?: boolean;
}

const Decorator: React.FC<DecoratorProps> = ({
  type,
  color,
  frame,
  assetSide = "right",
  isData = false,
  isNewspaper = false,
  hasSideAsset = false,
}) => {
  const pulse = Math.sin(frame / 6) * 0.05 + 0.95;

  let resolvedType = type;
  // Desabilitar setas do fundo e estrelas, garantindo no mínimo 3 elementos ativos com círculo ou listras
  if (resolvedType === "none" || resolvedType === "arrow" || resolvedType === "star" || !resolvedType) {
    resolvedType = (frame + 1) % 2 === 0 ? "circle" : "stripes";
  }
  
  if (resolvedType === "arrow") {
    let arrowStyle: React.CSSProperties = {
      position: "absolute",
      width: 100,
      height: 100,
      stroke: color,
      strokeWidth: 8,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      fill: "none",
      filter: `drop-shadow(0 0 12px ${color})`,
      zIndex: 6,
    };
    
    let rotation = -15 + Math.sin(frame / 8) * 5;

    if (hasSideAsset) {
      if (assetSide === "right") {
        arrowStyle.bottom = 320;
        arrowStyle.left = 70;
        arrowStyle.transform = `scale(${pulse}) rotate(${rotation + 25}deg)`;
      } else {
        arrowStyle.bottom = 320;
        arrowStyle.right = 70;
        arrowStyle.transform = `scale(${pulse}) scaleX(-1) rotate(${rotation + 25}deg)`;
      }
    } else if (isData) {
      arrowStyle.bottom = 580;
      arrowStyle.left = "18%";
      arrowStyle.transform = `scale(${pulse}) rotate(${rotation + 55}deg)`;
    } else if (isNewspaper) {
      arrowStyle.bottom = 620;
      arrowStyle.left = "14%";
      arrowStyle.transform = `scale(${pulse}) rotate(${rotation + 45}deg)`;
    }

    return (
      <svg viewBox="0 0 100 100" style={arrowStyle}>
        <path d="M20 20 C40 30 70 50 60 80 M40 70 L60 80 L70 60" />
      </svg>
    );
  }

  if (resolvedType === "circle") {
    return (
      <div style={{
        position: "absolute",
        top: "35%",
        left: "15%",
        width: 160,
        height: 160,
        borderRadius: "50%",
        border: `4px solid ${color}cc`,
        filter: `drop-shadow(0 0 12px ${color}40)`,
        transform: `scale(${pulse}) rotate(${frame * -0.2}deg)`,
        zIndex: 1,
      }} />
    );
  }

  if (resolvedType === "stripes") {
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

// ─────────────────────────────────────────────
const BigMetricCounter: React.FC<{
  value: string;
  color: string;
  frame: number;
  fps: number;
  durationInFrames: number;
}> = ({ value, color, frame, fps, durationInFrames }) => {
  const numberMatch = value.match(/([\d.,]+)/);
  if (!numberMatch) {
    return (
      <div style={{
        fontFamily: "'Oswald', 'Montserrat', sans-serif",
        fontSize: 110,
        fontWeight: 900,
        color,
        textAlign: "center",
        textShadow: `0 8px 30px rgba(0,0,0,0.55), 0 0 15px ${color}40`,
        transform: `rotate(-3deg)`,
        margin: "15px 0",
      }}>
        {value}
      </div>
    );
  }

  const rawNumStr = numberMatch[1].replace(/,/g, ".");
  const rawNum = parseFloat(rawNumStr);

  const countEnd = Math.round(durationInFrames * 0.7);

  // Only animate the roll for numbers ≥ 100 — rolling "2" or "4" looks absurd
  const animatedVal = rawNum < 100
    ? rawNum
    : interpolate(frame, [0, countEnd], [0, rawNum], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  
  const decimalPlaces = rawNumStr.includes(".") ? rawNumStr.split(".")[1].length : 0;
  const formattedVal = animatedVal.toFixed(decimalPlaces).replace(/\./g, ",");
  const displayString = value.replace(numberMatch[1], formattedVal);

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 70 }
  });

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 8,
      width: "100%",
      transform: `rotate(-3deg) scale(${interpolate(entrance, [0, 1], [0.75, 1])})`,
      opacity: interpolate(entrance, [0, 0.3], [0, 1]),
    }}>
      <div style={{
        fontFamily: "'Oswald', 'Montserrat', sans-serif",
        fontSize: 190, // Ampliado para impacto visual massivo
        fontWeight: 900,
        color,
        lineHeight: 1,
        textAlign: "center",
        textShadow: `0 8px 32px rgba(0,0,0,0.7), 0 0 20px ${color}50`,
        letterSpacing: "-0.03em",
        WebkitTextStroke: "2px rgba(0, 0, 0, 0.8)",
      }}>
        {displayString}
      </div>
    </div>
  );
};


interface PaletteWithText {
  bg: string;
  grad: string;
  accent: string;
  text: string;
  dim: string;
}

interface SceneProps {
  scene: ReelsScene;
  sceneIndex: number;
  totalScenes: number;
  durationInFrames: number;
  pal: PaletteWithText;
  sourceName?: string;
  thumbnailUrl?: string;
  sources?: Array<{ source: string; title: string; url?: string }>;
  category?: string;
  newsTitle?: string;
  hasGlobalNarration?: boolean;
  videoOffset?: number;
}

const CaptionEngine: React.FC<{
  words: Array<{ word: string; start: number; end: number }>;
  frame: number;
  fps: number;
  accentColor: string;
}> = ({ words, frame, fps, accentColor }) => {
  const currentTimeSec = frame / fps;

  const activeIndex = words.findIndex(w => currentTimeSec >= w.start && currentTimeSec <= w.end);
  let focusIndex = activeIndex;
  if (focusIndex === -1) {
    focusIndex = words.reduce((acc, w, idx) => {
      if (w.start <= currentTimeSec) return idx;
      return acc;
    }, -1);
  }

  if (focusIndex === -1) return null;

  const startIdx = Math.max(0, focusIndex - 1);
  const endIdx = Math.min(words.length, focusIndex + 3);
  const visibleWords = words.slice(startIdx, endIdx);

  return (
    <div style={{
      position: "absolute",
      bottom: 300, // 82% do height ≈ 345px do fundo, acima do safe zone inferior
      left: 0,
      right: 0,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 30,
      pointerEvents: "none",
    }}>
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "10px 16px",
        padding: "12px 28px",
        borderRadius: "12px",
        background: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(6px)",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        boxShadow: "0 15px 30px rgba(0,0,0,0.6)",
        maxWidth: "85%",
      }}>
        {visibleWords.map((w, idx) => {
          const globalIdx = startIdx + idx;
          const isActive = globalIdx === focusIndex;
          
          return (
            <span
              key={globalIdx}
              style={{
                fontFamily: "'Oswald', 'Montserrat', 'Inter', sans-serif",
                fontSize: isActive ? 60 : 50,
                fontWeight: 900,
                textTransform: "uppercase",
                color: isActive ? accentColor : "#FFFFFF",
                transform: isActive ? "scale(1.08) translateY(-3px)" : "scale(1.0)",
                textShadow: isActive 
                  ? `0 0 15px ${accentColor}BF, 0 3px 8px rgba(0,0,0,0.8)` 
                  : "0 2px 6px rgba(0,0,0,0.6)",
                transition: "all 0.08s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                letterSpacing: "-0.01em",
                display: "inline-block",
                opacity: isActive ? 1.0 : 0.55,
              }}
            >
              {w.word}
            </span>
          );
        })}
      </div>
    </div>
  );
};


const WordHighlightLine: React.FC<{ color: string; width: number; frame: number }> = ({ color, width, frame }) => {
  // Animate the line drawing from left to right with a spring overshoot
  const progress = spring({
    frame: Math.max(0, frame - 12),
    fps: 30,
    config: { damping: 14, stiffness: 110 },
  });
  const dashoffset = width * (1 - progress);
  return (
    <svg
      width={width}
      height={12}
      viewBox={`0 0 ${width} 12`}
      style={{
        position: "absolute",
        bottom: -6,
        left: 0,
        overflow: "visible",
        pointerEvents: "none",
        zIndex: -1,
      }}
    >
      <path
        d={`M 2 6 Q ${width / 2} 10 ${width - 2} 5`}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={width}
        strokeDashoffset={dashoffset}
      />
    </svg>
  );
};

const NewspaperCutout: React.FC<{
  title: string;
  summary: string;
  source: string;
  date: string;
  frame: number;
  fps: number;
  sceneIndex: number;
  durationInFrames: number;
}> = ({ title, summary, source, date, frame, fps, sceneIndex, durationInFrames }) => {
  const entrance = spring({ frame, fps, config: { damping: 15, stiffness: 85 } });
  const exitProgress = spring({
    frame: Math.max(0, frame - (durationInFrames - 15)),
    fps,
    config: { damping: 15, stiffness: 85 },
  });

  const panProgress = frame / durationInFrames;
  const hPan = 0; // Removed horizontal panning to keep text inside margins
  const rotate = interpolate(entrance, [0, 1], [6, -0.5]) + interpolate(exitProgress, [0, 1], [0, -3]);
  const scale = interpolate(entrance, [0, 1], [0.95, 1.03]) * interpolate(exitProgress, [0, 1], [1, 0.85]); // Scaled down to keep within margins
  const translateY = interpolate(entrance, [0, 1], [380, 0]) + interpolate(exitProgress, [0, 1], [0, 480]);

  // Progressive yellow highlighter (starts after entrance animation completes, from frame 15 to 45)
  const highlightProgress = interpolate(
    frame,
    [15, Math.min(durationInFrames - 5, 45)],
    [0, 100],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <div
      style={{
        position: "absolute",
        top: "42%",
        left: "6%",
        width: "88%", // Centralizado e expandido via scale
        maxWidth: 1200,
        backgroundColor: "#f4f1ea", // newsprint warm paper color
        backgroundImage: "radial-gradient(#e5dec9 1px, transparent 1px)", // subtle paper texture
        backgroundSize: "20px 20px",
        padding: "24px",
        border: "2px solid #d4c8ac",
        boxShadow: "0 28px 50px rgba(0, 0, 0, 0.5), inset 0 0 100px rgba(0,0,0,0.05)",
        transform: `translateY(${translateY}px) translateX(${hPan}px) scale(${scale}) rotate(${rotate}deg)`,
        transformOrigin: "center center",
        fontFamily: "'Georgia', 'Times New Roman', serif",
        color: "#1a1a1a",
        zIndex: 4,
        opacity: interpolate(entrance, [0, 1], [0, 1]) * (1 - exitProgress),
      }}
    >
      {/* Newspaper Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "2.5px double #1a1a1a",
        paddingBottom: 8,
        marginBottom: 14,
        textTransform: "uppercase",
        fontSize: 12,
        fontWeight: "bold",
        letterSpacing: "0.12em",
        color: "#444",
      }}>
        <span>{source || "Noticiando"}</span>
        <span>{date || "Edição Especial"}</span>
      </div>

      {/* Main Headline */}
      <h3 style={{
        margin: "0 0 14px 0",
        fontFamily: "'Georgia', serif",
        fontWeight: "bold",
        fontSize: 38,
        lineHeight: 1.15,
        color: "#000000",
        textAlign: "left",
      }}>
        {title}
      </h3>

      {/* Snippet in multiple columns for realistic newspaper look */}
      <div style={{
        display: "flex",
        gap: 16,
        fontSize: 15,
        lineHeight: 1.45,
        color: "#2b2b2b",
        textAlign: "justify",
      }}>
        <div style={{ flex: 1, position: "relative" }}>
          <span style={{ position: "relative", zIndex: 1 }}>
            {summary || "Informações exclusivas obtidas pela nossa mesa de análise indicam forte movimentação no mercado financeiro nacional."}
            <div
              style={{
                position: "absolute",
                left: -2,
                top: 0,
                bottom: 0,
                backgroundColor: "rgba(255, 235, 59, 0.45)", // yellow highlighter mark
                zIndex: -1,
                width: `${highlightProgress}%`,
                transformOrigin: "left center",
                borderRadius: "2px",
              }}
            />
          </span>
        </div>
      </div>
      
      {/* Editorial Stamp */}
      <div style={{
        position: "absolute",
        bottom: 12,
        right: 18,
        border: "2px solid #D32F2F",
        color: "#D32F2F",
        fontSize: 10,
        fontWeight: 900,
        padding: "2px 6px",
        transform: "rotate(-12deg)",
        opacity: 0.85,
        borderRadius: 2,
      }}>
        FONTE REAL
      </div>
    </div>
  );
};

const MapBackground: React.FC<{ frame: number; fps: number; mapImageUrl?: string }> = ({ frame, fps, mapImageUrl }) => {
  const drawLine = spring({ frame: Math.max(0, frame - 15), fps, config: { damping: 200 } });
  
  return (
    <AbsoluteFill style={{ background: "#F4F1EA", zIndex: 0 }}>
      {mapImageUrl ? (
        <Img
          src={mapImageUrl}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.85,
            filter: "grayscale(25%) sepia(20%) brightness(92%)",
            transform: `scale(${interpolate(frame, [0, 300], [1.0, 1.08])})`,
          }}
        />
      ) : (
        <>
          {/* Grid pattern */}
          <div style={{
            position: "absolute", inset: 0, opacity: 0.4,
            backgroundImage: "linear-gradient(#d1ccc0 1px, transparent 1px), linear-gradient(90deg, #d1ccc0 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            transform: `translate(${frame * 0.5}px, ${frame * 0.2}px)`
          }} />
          {/* SVG Map Abstract Coasts */}
          <svg width="100%" height="100%" style={{ position: "absolute", opacity: 0.15, transform: "scale(1.5)" }}>
            <path d="M 100,200 Q 300,400 400,100 T 800,500 T 1000,200" fill="none" stroke="#000" strokeWidth="10" />
            <path d="M -200,600 Q 400,800 600,600 T 1080,900" fill="none" stroke="#000" strokeWidth="15" />
          </svg>
        </>
      )}
      
      {/* Animated Red Route Line */}
      <svg width="100%" height="100%" style={{ position: "absolute", zIndex: 2 }}>
        <path 
          d="M 300,500 L 700,400" 
          fill="none" stroke="#D32F2F" strokeWidth="12" strokeLinecap="round"
          strokeDasharray="500" strokeDashoffset={500 * (1 - drawLine)}
        />
        {/* Animated radar/marker rings */}
        <circle cx="700" cy="400" r={20 + (frame % 40)} fill="none" stroke="#D32F2F" strokeWidth="4" opacity={1 - ((frame % 40)/40)} />
      </svg>

      {/* Ships */}
      <div style={{
        position: "absolute", top: 460, left: 450,
        width: 30, height: 12, background: "#1a1a1a",
        transform: `rotate(-15deg) translate(${frame * 0.8}px, ${Math.sin(frame/10)*5}px)`
      }} />
      <div style={{
        position: "absolute", top: 490, left: 420,
        width: 30, height: 12, background: "#1a1a1a",
        transform: `rotate(-15deg) translate(${frame * 0.9}px, ${Math.sin(frame/12)*5}px)`
      }} />
    </AbsoluteFill>
  );
};

const TimelineBackground: React.FC<{
  frame: number;
  fps: number;
  durationInFrames: number;
  timelinePoints?: Array<{ label: string; value: string | number }>;
}> = ({ frame, fps, durationInFrames, timelinePoints }) => {
  const lineAnimEnd = Math.round(durationInFrames * 0.7);
  const drawLine = interpolate(frame, [0, lineAnimEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  
  const newsTerms = `
    TAXA SELIC • COPOM • BANCO CENTRAL DO BRASIL • MERCADO FINANCEIRO • IBOVESPA • INDÚSTRIA 4.0 • INFLAÇÃO ACUMULADA • TÍTULOS PÚBLICOS • INVESTIMENTOS ESTRANGEIROS • DEFICIT PÚBLICO • SUPERAVIT COMERCIAL • DÓLAR COMERCIAL • RESERVAS INTERNACIONAIS • BOLSA DE VALORES • FATOR DE RISCO • LIQUIDEZ DIÁRIA
  `;

  const points = timelinePoints && timelinePoints.length === 3 ? timelinePoints : [
    { label: "ANTERIOR", value: "10%" },
    { label: "PRESENTE", value: "15%" },
    { label: "PROJEÇÃO", value: "25%" }
  ];

  const positions = ["25%", "50%", "75%"];

  return (
    <AbsoluteFill style={{ background: "#F9F6F0", zIndex: 0 }}>
      {/* Script font text block acting as a historic document in PT-BR */}
      <div style={{
        position: "absolute", inset: "40px 30px",
        fontFamily: "'Georgia', serif", fontSize: 22, color: "#1a1a1a", opacity: 0.12,
        lineHeight: 1.7, transform: "rotate(-1deg)",
        maskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
        wordWrap: "break-word",
        letterSpacing: "0.05em",
        textTransform: "uppercase",
      }}>
        {Array(8).fill(newsTerms).join("\n\n")}
      </div>

      {/* Horizontal Red Line - Moved to bottom (72%) to avoid text overlap */}
      <div style={{
        position: "absolute", top: "72%", left: 0,
        height: 6, background: "#D32F2F",
        width: `${drawLine * 100}%`,
        transform: "translateY(-50%)",
        boxShadow: "0 4px 12px rgba(211,47,47,0.4)"
      }} />
      
      {/* Timeline markers and year text labels */}
      {points.map((item, idx) => {
        const threshold = 0.25 + idx * 0.25; // 0.25, 0.50, 0.75
        const triggerFrame = Math.round(lineAnimEnd * threshold);
        
        const markerSpring = spring({
          frame: Math.max(0, frame - triggerFrame),
          fps,
          config: { damping: 12, stiffness: 100 }
        });

        const scaleVal = markerSpring;

        return (
          <div
            key={idx}
            style={{
              position: "absolute",
              top: "calc(72% - 80px)", // Adjusted to give space for values above
              left: positions[idx],
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              transform: `scale(${scaleVal})`,
              transformOrigin: "center bottom",
              width: 160,
              marginLeft: -80,
            }}
          >
            {/* Value above the marker */}
            <div style={{
              fontFamily: "'Oswald', 'Montserrat', sans-serif",
              fontSize: 28,
              fontWeight: 900,
              color: "#D32F2F",
              marginBottom: 8,
              textAlign: "center",
              textShadow: "0 1px 2px rgba(0,0,0,0.15)",
            }}>
              {item.value}
            </div>

            {/* The vertical marker line */}
            <div style={{ width: 4, height: 30, background: "#D32F2F" }} />
            
            {/* The label below the line */}
            <div style={{
              marginTop: 8,
              fontFamily: "'Oswald', 'Montserrat', sans-serif",
              fontSize: 14,
              fontWeight: 900,
              color: "#1a1a1a",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              textAlign: "center",
            }}>
              {item.label}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const CollageBackground: React.FC<{ frame: number; fps: number; cutoutUrl?: string }> = ({ frame, fps, cutoutUrl }) => {
  if (!cutoutUrl) return <AbsoluteFill style={{ background: "#2B54C4" }} />;
  
  const instances = [
    { top: "15%", left: "15%", scale: 0.6, rot: -8, delay: 0 },
    { top: "25%", left: "65%", scale: 0.7, rot: 12, delay: 5 },
    { top: "60%", left: "15%", scale: 0.8, rot: -5, delay: 10 },
    { top: "70%", left: "65%", scale: 0.65, rot: 15, delay: 15 },
    { top: "45%", left: "40%", scale: 1.1, rot: 0, delay: 20, isMain: true },
  ];

  return (
    <AbsoluteFill style={{ background: "#1B306B", zIndex: 0 }}>
      {/* Background Stripes */}
      <div style={{ position: "absolute", top: "30%", left: -50, width: "120%", height: 60, background: "#D32F2F", transform: "rotate(-5deg)", opacity: 0.9 }} />
      <div style={{ position: "absolute", top: "60%", left: -50, width: "120%", height: 60, background: "#D32F2F", transform: "rotate(3deg)", opacity: 0.9 }} />
      
      {instances.map((inst, i) => {
        const spr = spring({ frame: Math.max(0, frame - inst.delay), fps, config: { damping: 14 } });
        return (
          <div key={i} style={{
            position: "absolute", top: inst.top, left: inst.left,
            width: 320, height: 320,
            transform: `translate(-50%, -50%) scale(${spr * inst.scale}) rotate(${inst.rot}deg)`,
            border: inst.isMain ? "12px solid #F5F0E8" : "12px solid #000",
            backgroundColor: "#fff",
            boxShadow: "0 30px 60px rgba(0,0,0,0.6)",
            overflow: "hidden",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            {/* Grayscale High-Contrast Filter */}
            <Img 
              src={cutoutUrl} 
              style={{
                width: "150%", height: "150%", objectFit: "cover",
                filter: "grayscale(100%) contrast(160%) brightness(0.9)",
              }} 
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const VideoElement: React.FC<{
  src: string;
  sceneIndex: number;
  frame: number;
  durationInFrames: number;
  fps: number;
  videoOffset?: number;
}> = ({ src, frame, durationInFrames, videoOffset = 0 }) => {
  const scale = interpolate(frame, [0, durationInFrames], [1.0, 1.08], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp"
  });

  return (
    <>
      <OffthreadVideo
        src={src}
        startFrom={videoOffset}
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover",
          transform: `scale(${scale})`,
          filter: "saturate(0.3) contrast(1.15) brightness(0.85) sepia(0.1)", // Cinematic grade
        }}
        volume={0}
      />
      {/* Halftone Print Overlay */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.15, pointerEvents: "none",
        backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)",
        backgroundSize: "4px 4px", zIndex: 1
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 45%, transparent 100%)",
        zIndex: 2,
      }} />
    </>
  );
};

const SplitVideoElement: React.FC<{
  src: string;
  frame: number;
  durationInFrames: number;
  videoOffset?: number;
}> = ({ src, frame, durationInFrames, videoOffset = 0 }) => {
  const scale = interpolate(frame, [0, durationInFrames], [1.0, 1.05], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp"
  });

  // Dividimos o vídeo em 3 faixas, dando um zoom massivo e pan diferente em cada um para parecerem 3 câmeras separadas
  const bands = [
    { top: 0, height: "33.33%", origin: "center top", scaleMod: 1.5 },
    { top: "33.33%", height: "33.33%", origin: "center center", scaleMod: 1.8 },
    { top: "66.66%", height: "33.34%", origin: "center bottom", scaleMod: 1.4 },
  ];

  return (
    <>
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", background: "#000" }}>
        {bands.map((band, i) => (
          <div key={i} style={{
            position: "relative", width: "100%", height: band.height, overflow: "hidden",
            borderBottom: i < 2 ? "4px solid #1a1a1a" : "none"
          }}>
            <OffthreadVideo
              src={src}
              startFrom={videoOffset}
              style={{
                position: "absolute", width: "100%", height: "300%", top: `-${i * 100}%`,
                objectFit: "cover",
                transformOrigin: band.origin,
                transform: `scale(${scale * band.scaleMod})`,
                filter: "saturate(0.2) contrast(1.2) brightness(0.9)", // Cinematic grade
              }}
              volume={0}
            />
          </div>
        ))}
      </AbsoluteFill>
      {/* Halftone Print Overlay */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.15, pointerEvents: "none",
        backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)",
        backgroundSize: "4px 4px", zIndex: 1
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 45%, transparent 100%)",
        zIndex: 2,
      }} />
    </>
  );
};

// ── LowerThird — Bottom anchor that fills the dead zone ──────────────────────
const LowerThird: React.FC<{
  sourceName?: string;
  category?: string;
  frame: number;
  fps: number;
  accentColor: string;
  sceneIndex: number;
  totalScenes: number;
  durationInFrames: number;
  personName?: string;
  isHook: boolean;
}> = ({ sourceName, category, frame, fps, accentColor, sceneIndex, totalScenes, durationInFrames, personName, isHook }) => {
  const entrance = spring({ frame: Math.max(0, frame - 8), fps, config: { damping: 20, stiffness: 130 } });
  const exit = spring({ frame: Math.max(0, frame - (durationInFrames - 10)), fps, config: { damping: 15, stiffness: 100 } });
  const translateY = interpolate(entrance, [0, 1], [120, 0]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]) * (1 - exit);

  // Animated accent bar width
  const barWidth = interpolate(frame, [8, Math.round(durationInFrames * 0.5)], [0, 100], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  const label = getEditorialLabel(category);

  return (
    <div style={{
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 48,
      padding: "0 48px 54px",
      transform: `translateY(${translateY}px)`,
      opacity,
      pointerEvents: "none",
    }}>
      {/* Gradient fade from transparent to dark at the very bottom */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 280,
        background: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.75) 100%)",
        zIndex: -1,
      }} />

      {/* Animated horizontal accent bar */}
      <div style={{
        height: 3,
        background: `linear-gradient(to right, ${accentColor}, ${accentColor}60, transparent)`,
        width: `${barWidth}%`,
        marginBottom: 20,
        boxShadow: `0 0 12px ${accentColor}80`,
        borderRadius: 2,
      }} />

      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
      }}>
        {/* Left: source name + category */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {personName && (
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              backgroundColor: accentColor,
              padding: "5px 16px",
              borderRadius: 4,
              marginBottom: 4,
              width: "fit-content",
            }}>
              <span style={{
                fontFamily: "'Oswald', sans-serif",
                fontSize: 18,
                fontWeight: 900,
                color: "#000000",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}>
                ◉ {personName}
              </span>
            </div>
          )}
          <div style={{
            fontFamily: "'Oswald', sans-serif",
            fontSize: 26,
            fontWeight: 900,
            color: "rgba(255,255,255,0.75)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}>
            {sourceName || "NOTICIANDO"}
          </div>
          <div style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 18,
            fontWeight: 700,
            color: accentColor,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            opacity: 0.8,
          }}>
            {label}
          </div>
        </div>

        {/* Right: scene counter — simple "2 / 5" style, not stories dots */}
        <div style={{
          fontFamily: "'Oswald', sans-serif",
          fontSize: 16,
          fontWeight: 700,
          color: "rgba(255,255,255,0.35)",
          letterSpacing: "0.08em",
          paddingBottom: 4,
        }}>
          {sceneIndex + 1}<span style={{ color: accentColor, margin: "0 2px" }}>/</span>{totalScenes}
        </div>
      </div>
    </div>
  );
};

// ── HookBottomFeature — Large bottom graphic element for hook scenes ───────────
const HookBottomFeature: React.FC<{
  frame: number;
  fps: number;
  accentColor: string;
  newsTitle?: string;
  durationInFrames: number;
}> = ({ frame, fps, accentColor, newsTitle, durationInFrames }) => {
  const entrance = spring({ frame: Math.max(0, frame - 15), fps, config: { damping: 14, stiffness: 90 } });
  const opacity = interpolate(entrance, [0, 1], [0, 1]);
  const translateY = interpolate(entrance, [0, 1], [80, 0]);

  const pulse = Math.sin(frame / 15) * 0.03 + 0.97;

  return (
    <div style={{
      position: "absolute",
      bottom: "16%",
      left: "8%",
      right: "8%",
      zIndex: 20,
      opacity,
      transform: `translateY(${translateY}px)`,
      pointerEvents: "none",
    }}>
      {/* Accent border top */}
      <div style={{
        height: 4,
        background: `linear-gradient(to right, transparent, ${accentColor}, transparent)`,
        marginBottom: 20,
        transform: `scaleX(${pulse})`,
      }} />

      {/* "URGENTE" badge */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        marginBottom: 16,
      }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 12,
          border: `2px solid ${accentColor}`,
          padding: "8px 24px",
          borderRadius: 4,
          boxShadow: `0 0 20px ${accentColor}40, inset 0 0 20px ${accentColor}08`,
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            background: accentColor,
            boxShadow: `0 0 12px ${accentColor}`,
            animation: "none",
            opacity: Math.sin(frame / 8) * 0.4 + 0.6,
          }} />
          <span style={{
            fontFamily: "'Oswald', sans-serif",
            fontSize: 22,
            fontWeight: 900,
            color: accentColor,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}>
            ANÁLISE EXCLUSIVA
          </span>
        </div>
      </div>

      {/* News title teaser */}
      {newsTitle && (
        <p style={{
          fontFamily: "'Inter', 'Montserrat', sans-serif",
          fontSize: 28,
          fontWeight: 600,
          color: "rgba(255,255,255,0.65)",
          textAlign: "center",
          lineHeight: 1.35,
          margin: 0,
          textShadow: "0 2px 12px rgba(0,0,0,0.9)",
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}>
          {newsTitle}
        </p>
      )}

      {/* Bottom accent line */}
      <div style={{
        height: 2,
        background: `linear-gradient(to right, transparent, ${accentColor}50, transparent)`,
        marginTop: 20,
      }} />
    </div>
  );
};

const getEntranceDelayInFrames = (
  captionWords: ReelsScene["caption_words"],
  keywords: (string | undefined)[],
  fps: number,
  fallbackFrames: number = 15
): number => {
  if (!captionWords || captionWords.length === 0) return fallbackFrames;
  
  const cleanKeywords = keywords
    .filter((k): k is string => !!k)
    .map(k => k.toLowerCase().replace(/[,.;:!?()"[\]]/g, "").trim())
    .flatMap(k => k.split(/\s+/))
    .filter(k => k.length > 2);

  if (cleanKeywords.length === 0) return fallbackFrames;

  for (const w of captionWords) {
    const wClean = w.word.toLowerCase().replace(/[,.;:!?()"[\]]/g, "").trim();
    if (cleanKeywords.some(kw => wClean.includes(kw) || kw.includes(wClean))) {
      return Math.round(w.start * fps);
    }
  }

  return fallbackFrames;
};

const NewsScene: React.FC<SceneProps> = ({
  scene,
  sceneIndex,
  totalScenes,
  durationInFrames,
  pal,
  sourceName,
  thumbnailUrl,
  sources,
  category,
  newsTitle,
  hasGlobalNarration,
  videoOffset = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entranceDelay = useMemo(() => {
    return getEntranceDelayInFrames(
      scene.caption_words,
      [scene.person_name, scene.media_keyword],
      fps,
      15
    );
  }, [scene.caption_words, scene.person_name, scene.media_keyword, fps]);

  // Entrance & Exit animations
  const entrance = spring({ frame, fps, config: { damping: 16, stiffness: 130 } });
  const exitProgress = spring({
    frame: Math.max(0, frame - (durationInFrames - 15)),
    fps,
    config: { damping: 15, stiffness: 85 },
  });

  // Fade-in: first 12 frames — smooth entry
  const fadeInOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  // Fade-out: last 18 frames — smooth exit into next scene
  const exitOpacity = durationInFrames > 30
    ? interpolate(frame, [durationInFrames - 18, durationInFrames], [1, 0], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
      })
    : 1;
  // Combined opacity: fades in then fades out
  const sceneOpacity = Math.min(fadeInOpacity, exitOpacity);

  const assetSide = sceneIndex % 2 === 0 ? "right" : "left";

  // ── Cutout slide lateral ──
  const cutoutFrame = Math.max(0, frame - entranceDelay);
  const _cutoutSpring       = spring({ frame: cutoutFrame, fps, config: { damping: 22, stiffness: 200, mass: 0.9 } });
  const _cutoutSlideFrom    = assetSide === "right" ? 340 : -340;
  const _cutoutTranslateX   = interpolate(_cutoutSpring, [0, 1], [_cutoutSlideFrom, 0]);
  const _cutoutEntryOpacity = interpolate(cutoutFrame, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const _cutoutExitX        = interpolate(exitProgress, [0, 1], [0, -_cutoutSlideFrom * 0.45]);

  const isHook = sceneIndex === 0 || scene.visual_type === "hook";
  const isData = scene.visual_type === "data";
  const isMap = scene.visual_type === "map";
  const isTimeline = scene.visual_type === "timeline";
  const isCollage = scene.visual_type === "collage";
  const isSplitVideo = scene.visual_type === "split_video";

  // Dynamic layout flags
  const isFullVideo = scene.visual_type === "video";
  const isCinematicVideo = isFullVideo || isSplitVideo;
  const isAnalogBg = isMap || isTimeline || isCollage;

  const hasSideAsset = (scene.visual_type === "cutout" && scene.cutout_url) ||
                       (scene.visual_type === "illustration" && (scene.illustration_url || scene.media_url));

  // High-contrast text colors
  const textColor = (isMap || isTimeline) ? "#1A1A1A" : "#FFFFFF";

  // Premium accent color (Cyan or Gold depending on category)
  const highlightColor = (category === "investments" || category === "finanças" || category === "financas") ? "#FFD700" : pal.accent;

  // ── Ken Burns Direcional ──
  const _tensionKeywords = ["queda", "crise", "guerra", "conflito", "colapso", "perde", "cai", "caiu", "caem", "risco", "crash", "falência", "alerta", "alertas", "pânico", "sanções", "bombas", "ataque", "déficit", "caindo", "corte", "inflação"];
  const _revealKeywords  = ["alta", "sobe", "cresceu", "crescimento", "positivo", "recorde", "novo", "abre", "lança", "aprovado", "ganhou", "ganhos", "vence", "expande", "supera", "acordo", "recupera", "aumenta", "atingiu"];
  const _headlineLower   = (scene.headline || "").toLowerCase();
  const _hasTension  = _tensionKeywords.some(k => _headlineLower.includes(k));
  const _hasReveal   = !_hasTension && _revealKeywords.some(k => _headlineLower.includes(k));
  const _usePan      = !isFullVideo && !isSplitVideo && !_hasTension && !_hasReveal && !hasSideAsset;
  const _panDir      = sceneIndex % 2 === 0 ? 1 : -1;
  const _zoomIn      = _hasTension || (!_hasReveal && sceneIndex % 2 === 0);
  const _kbStart     = _zoomIn ? 1.0 : 1.12;
  const _kbEnd       = _zoomIn ? 1.12 : 1.0;

  const cameraPanX = _usePan
    ? interpolate(frame, [0, durationInFrames], [0, _panDir * 2], { extrapolateRight: "clamp" })
    : 0;

  const cameraScale = _usePan
    ? 1.0
    : interpolate(frame, [0, durationInFrames], [_kbStart, _kbEnd], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  // Diagonal animated grid offset
  const gridOff = (frame * 0.6) % 80;

  // Floating ambient glows
  const glow1X = Math.sin(frame / 45) * 80 + 340;
  const glow1Y = Math.cos(frame / 60) * 120 + 400;
  const glow2X = Math.cos(frame / 50) * 100 + 740;
  const glow2Y = Math.sin(frame / 70) * 150 + 1300;

  // Headline parsing — guard against null/undefined headline
  const words = useMemo(() => (scene.headline || "").split(" ").filter(Boolean), [scene.headline]);
  const accentSet = useMemo(() => new Set<number>(scene.accent_word_indices ?? []), [scene.accent_word_indices]);
  
  // Parse potential values (e.g. percentages or numbers) for all scenes
  const dataMetric = useMemo(() => {
    const textToSearch = `${scene.headline ?? ""} ${scene.subtext ?? ""}`;
    const percentMatch = textToSearch.match(/(-?\d+(?:[.,]\d+)?)\s*%/);
    if (percentMatch) {
      const num = parseFloat(percentMatch[1].replace(",", "."));
      return { num, unit: "%", rawString: `${percentMatch[1]}%` };
    }
    const moneyMatch = textToSearch.match(/(R\$\s*-?\d+(?:[.,]\d+)?(?:\s*[BMK]ilh(?:ão|ões)?)?|\$\s*-?\d+(?:[.,]\d+)?(?:\s*[BMK]ilh(?:ão|ões)?)?)/i);
    if (moneyMatch) {
      const matchNum = moneyMatch[1].match(/(-?\d+(?:[.,]\d+)?)/);
      const num = matchNum ? parseFloat(matchNum[1].replace(",", ".")) : 10;
      const unit = moneyMatch[1].toLowerCase().includes("r$") ? "R$" : "$";
      return { num, unit, rawString: moneyMatch[1] };
    }
    const numberMatch = textToSearch.match(/(-?\d+(?:[.,]\d+)?\s*(?:Bilh(?:ão|ões)|Milh(?:ão|ões)|Mil)?)/i);
    if (numberMatch) {
      const matchNum = numberMatch[1].match(/(-?\d+(?:[.,]\d+)?)/);
      const num = matchNum ? parseFloat(matchNum[1].replace(",", ".")) : 50;
      return { num, unit: "", rawString: numberMatch[1] };
    }
    return null;
  }, [scene.headline, scene.subtext]);

  const matchedCountries = useMemo(() => {
    const cleanText = ` ${scene.headline ?? ""} ${scene.subtext ?? ""} `
      .toLowerCase()
      .replace(/[,.;:!?()"[\]]/g, " ")
      .replace(/\s+/g, " ");
    
    const matched: string[] = [];
    const COUNTRY_MAP: Record<string, string> = {
      china: "cn",
      "coreia do sul": "kr",
      "coreia": "kr",
      "estados unidos": "us",
      eua: "us",
      brasil: "br",
      "arábia saudita": "sa",
      saudi: "sa",
      aramco: "sa",
      irã: "ir",
      israel: "il",
      rússia: "ru",
      russia: "ru",
      ucrânia: "ua",
      ucrania: "ua",
    };
    for (const [key, code] of Object.entries(COUNTRY_MAP)) {
      const paddedKey = ` ${key} `;
      if (cleanText.includes(paddedKey) && !matched.includes(code)) {
        matched.push(code);
      }
    }
    return matched;
  }, [scene.headline, scene.subtext]);

  // ── Rule 2: Filter metric words, brand name parts, and country names to avoid duplicates ──
  const filteredWordsWithIndices = useMemo(() => {
    let result = words.map((word, index) => ({ word, index }));

    // 1. Filter out metrics
    if (dataMetric) {
      const metricClean = dataMetric.rawString.toLowerCase();
      result = result.filter(({ word }) => {
        const wClean = word.toLowerCase().replace(/[,.;:!?()"[\]]/g, "");
        if (!wClean) return true;
        if (metricClean.includes(wClean)) return false;
        if ((wClean === "bilhão" || wClean === "bilhões" || wClean === "milhão" || wClean === "milhões" || wClean === "mil") && 
            (metricClean.includes("bilh") || metricClean.includes("milh") || metricClean.includes("mil"))) {
          return false;
        }
        return true;
      });
    }

    // 2. Filter out brand name words if brand_domain is present
    if (scene.brand_domain) {
      const domainParts = scene.brand_domain.toLowerCase().split(".")[0].split(/[-_]/).filter((p: string) => p.length > 2);
      result = result.filter(({ word }) => {
        const wClean = word.toLowerCase().replace(/[,.;:!?()"[\]]/g, "");
        return !domainParts.some((part: string) => wClean.includes(part) || part.includes(wClean));
      });
    }

    // 3. Filter out country names if flags are displayed
    if (matchedCountries.length > 0) {
      const COUNTRY_NAMES_PT = ["china", "coreia", "estados unidos", "eua", "brasil", "arábia saudita", "saudi", "irã", "israel", "rússia", "russia", "ucrânia", "ucrania"];
      result = result.filter(({ word }) => {
        const wClean = word.toLowerCase().replace(/[,.;:!?()"[\]]/g, "");
        return !COUNTRY_NAMES_PT.some((country: string) => wClean.includes(country) || country.includes(wClean));
      });
    }

    return result;
  }, [words, dataMetric, scene.brand_domain, matchedCountries]);

  const longestWordLength = useMemo(() => {
    return Math.max(...filteredWordsWithIndices.map(w => w.word.length), 0);
  }, [filteredWordsWithIndices]);

  const baseTitleFontSize = isHook ? 112 : 76;
  const titleFontSize = useMemo(() => {
    if (longestWordLength > 12) {
      return Math.max(48, baseTitleFontSize - (longestWordLength - 12) * 4);
    }
    return baseTitleFontSize;
  }, [longestWordLength, baseTitleFontSize]);

  const textPulse = interpolate(frame, [0, durationInFrames], [1.0, 1.05], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Data animations variables
  const dataEasedProgress = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { damping: 13, stiffness: 85 }
  });

  const parsedValue = dataMetric ? Math.abs(dataMetric.num) : 75;
  const displayUnit = dataMetric ? dataMetric.unit : "%";

  // ── Rule 3: Chart animations ──
  const lineAnimFrames = Math.round(durationInFrames * 0.6);
  const strokeDashoffsetLine = interpolate(frame, [0, lineAnimFrames], [550, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const endPointSpring = spring({
    frame: Math.max(0, frame - lineAnimFrames),
    fps,
    config: { damping: 12, stiffness: 100 }
  });

  const donutAnimFrames = Math.round(durationInFrames * 0.7);
  const strokeDashoffsetDonut = 640 - (Math.min(parsedValue, 100) / 100) * interpolate(frame, [0, donutAnimFrames], [0, 1], { extrapolateRight: "clamp" }) * 640;

  const currentCountText = dataMetric
    ? (Math.abs(dataMetric.num) <= 9
        ? dataMetric.num.toFixed(dataMetric.num % 1 === 0 ? 0 : 1)
        : interpolate(frame, [0, Math.round(durationInFrames * 0.7)], [0, dataMetric.num], { extrapolateRight: "clamp" }).toFixed(dataMetric.num % 1 === 0 ? 0 : 1))
    : interpolate(frame, [0, Math.round(durationInFrames * 0.7)], [0, 75], { extrapolateRight: "clamp" }).toFixed(0);

  return (
    <AbsoluteFill style={{ opacity: sceneOpacity, overflow: "hidden" }}>
      {/* 🎙️ Local Scene Narration Audio */}
      {scene.audio_url && !hasGlobalNarration && <Audio src={scene.audio_url} volume={1.0} />}

      {/* ── Global Film Grain ── */}
      <div style={{
        position: "absolute", inset: 0,
        opacity: 0.16,
        mixBlendMode: "multiply",
        pointerEvents: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        backgroundSize: "240px 240px",
        zIndex: 99,
      }} />

      {/* ── Vintage Vignette & Border ── */}
      <div style={{
        position: "absolute", inset: 0,
        boxShadow: "inset 0 0 120px rgba(0, 0, 0, 0.25)",
        border: "10px solid rgba(0, 0, 0, 0.05)",
        pointerEvents: "none",
        zIndex: 98,
      }} />

      {isFullVideo && scene.media_url && (
        <VideoElement src={scene.media_url} sceneIndex={sceneIndex} frame={frame} durationInFrames={durationInFrames} fps={fps} videoOffset={videoOffset} />
      )}
      
      {isSplitVideo && scene.media_url && (
        <SplitVideoElement src={scene.media_url} frame={frame} durationInFrames={durationInFrames} videoOffset={videoOffset} />
      )}

      {isMap && <MapBackground frame={frame} fps={fps} mapImageUrl={scene.map_image_url} />}
      {isTimeline && <TimelineBackground frame={frame} fps={fps} durationInFrames={durationInFrames} timelinePoints={scene.timeline_points} />}
      {isCollage && <CollageBackground frame={frame} fps={fps} cutoutUrl={scene.cutout_url} />}

      {/* ── Notebook paper background for illustration scenes (paper/research aesthetic) ── */}
      {scene.visual_type === "illustration" && !isCinematicVideo && (
        <NotebookLinesBg accentColor={pal.accent} />
      )}

      {/* ── Editorial diagonal accent stripe — hook scenes only ── */}
      {isHook && (
        <DiagonalStripe frame={frame} fps={fps} accentColor={pal.accent} />
      )}

      {/* ── Glitch flash — hook scene opening impact ── */}
      {isHook && (
        <GlitchFlash frame={frame} accentColor={pal.accent} />
      )}

      {/* ── CRT Scanline texture — video/cinematic scenes ── */}
      {isCinematicVideo && (
        <ScanlineOverlay frame={frame} />
      )}

      {/* ── Cinematic corner brackets — video scenes ── */}
      {isCinematicVideo && (
        <CornerBrackets frame={frame} fps={fps} accentColor={pal.accent} />
      )}

      {/* ── Ambient particles — dark scene backgrounds for depth ── */}
      {!isAnalogBg && !isCinematicVideo && (
        <AmbientParticles frame={frame} accentColor={pal.accent} count={14} />
      )}

      {/* Ticker scrolling text in text/editorial scenes */}
      {!isCinematicVideo && !isAnalogBg && (
        <EditorialTickerBackground frame={frame} accentColor={pal.accent} />
      )}

      {/* ── Rule 4: Brand Logo Resolver ── */}
      {scene.logo_url && (
        <BrandLogo logoUrl={scene.logo_url} frame={frame} fps={fps} />
      )}

      {/* ── Single Continuous Progress Bar ── */}
      {(() => {
        // Simple approximate: (sceneIndex + frame/durationInFrames) / totalScenes
        const overallProgress = totalScenes > 0
          ? (sceneIndex + (durationInFrames > 0 ? frame / durationInFrames : 0)) / totalScenes
          : 0;
        const barWidth = Math.min(100, overallProgress * 100);
        return (
          <div style={{
            position: "absolute",
            top: 0, left: 0, right: 0,
            height: 3,
            background: "rgba(255,255,255,0.1)",
            zIndex: 50,
          }}>
            <div style={{
              height: "100%",
              width: `${barWidth}%`,
              background: `linear-gradient(to right, ${pal.accent}cc, ${pal.accent})`,
              boxShadow: `0 0 8px ${pal.accent}80`,
            }} />
          </div>
        );
      })()}

      {/* ── Content Container with camera zoom (Parallax layout) ── */}
      <AbsoluteFill style={{ transform: `scale(${cameraScale}) translateX(${cameraPanX}%)`, transformOrigin: "center center" }}>
        
        {/* ── Animated Sliding Grid Background ── */}
        <div style={{
          position: "absolute", inset: 0,
          opacity: 0.04,
          backgroundImage: `linear-gradient(to right, ${pal.accent} 1.5px, transparent 1.5px), linear-gradient(to bottom, ${pal.accent} 1.5px, transparent 1.5px)`,
          backgroundSize: "60px 60px",
          backgroundPosition: `${gridOff}px ${gridOff}px`,
          pointerEvents: "none",
          zIndex: 1,
        }} />

        <div style={{
          position: "absolute",
          left: glow1X, top: glow1Y,
          width: 400, height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${pal.accent}18 0%, transparent 70%)`,
          transform: "translate(-50%, -50%)",
          pointerEvents: "none", zIndex: 1,
        }} />
        <div style={{
          position: "absolute",
          left: glow2X, top: glow2Y,
          width: 500, height: 500,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${pal.accent}10 0%, transparent 70%)`,
          transform: "translate(-50%, -50%)",
          pointerEvents: "none", zIndex: 1,
        }} />

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

        {/* Dynamic Graphic Decorator Element */}
        {scene.decorator_type && scene.decorator_type !== "none" && (
          <Decorator
            type={scene.decorator_type}
            color={pal.accent}
            frame={frame}
            assetSide={assetSide}
            isData={isData}
            isNewspaper={scene.visual_type === "newspaper_clip" || scene.cutout_url === "newspaper"}
            hasSideAsset={!!hasSideAsset}
          />
        )}

        {/* ── Cutout sliding from bottom ── */}
        {scene.visual_type === "cutout" && scene.cutout_url && scene.cutout_url !== "newspaper" && (
          <>
            {/* Halo ring — draws itself in behind the person */}
            <CutoutHalo
              frame={frame}
              fps={fps}
              accentColor={pal.accent}
              assetSide={assetSide}
              entranceDelay={entranceDelay}
            />

            {/* Secondary satellite images orbiting the cutout */}
            {scene.secondary_asset_urls && scene.secondary_asset_urls.length > 0 && (
              <SecondaryAssetOrbit
                urls={scene.secondary_asset_urls}
                frame={frame}
                fps={fps}
                accentColor={pal.accent}
                assetSide={assetSide}
                entranceDelay={entranceDelay + 12}
              />
            )}

            {/* The actual cutout photo */}
            <div style={{
              position: "absolute",
              bottom: "8%",
              left: "5%",
              right: "5%",
              height: "72%",
              zIndex: 4,
              opacity: (1 - exitProgress) * _cutoutEntryOpacity,
              transform: `translateX(${_cutoutTranslateX + _cutoutExitX}px)`,
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-end",
            }}>
              <Img
                src={scene.cutout_url}
                style={{
                  maxHeight: "100%",
                  maxWidth: "100%",
                  objectFit: "contain",
                  filter: "url(#sticker-outline) drop-shadow(-8px 8px 24px rgba(0,0,0,0.7))",
                }}
              />
            </div>

            {/* Floating tag badge — appears after cutout enters */}
            {scene.tag_badge && (
              <FloatingTagBadge
                text={scene.tag_badge}
                frame={frame}
                fps={fps}
                accentColor={pal.accent}
                assetSide={assetSide}
                entranceDelay={entranceDelay + 18}
                verticalOffset="40%"
              />
            )}
          </>
        )}

        {/* Dynamic Stylized Illustration Sticker */}
        {(scene.illustration_url || (scene.visual_type === "illustration" && scene.media_url)) && (
          <>
            {/* Halo ring for illustrations too */}
            <CutoutHalo
              frame={frame}
              fps={fps}
              accentColor={pal.accent}
              assetSide={assetSide}
              entranceDelay={entranceDelay}
            />

            {/* Secondary satellite images for illustrations */}
            {scene.secondary_asset_urls && scene.secondary_asset_urls.length > 0 && (
              <SecondaryAssetOrbit
                urls={scene.secondary_asset_urls}
                frame={frame}
                fps={fps}
                accentColor={pal.accent}
                assetSide={assetSide}
                entranceDelay={entranceDelay + 12}
              />
            )}

            <div style={{
              position: "absolute",
              bottom: "8%",
              left: "5%",
              right: "5%",
              height: "68%",
              zIndex: 4,
              opacity: 1 - exitProgress,
              transform: `translateY(${
                Math.sin(frame / 10) * 10 +
                interpolate(exitProgress, [0, 1], [0, 120])
              }px) scale(${
                interpolate(
                  spring({ frame: Math.max(0, frame - entranceDelay), fps, config: { damping: 14, stiffness: 95 } }),
                  [0, 1],
                  [0, 1]
                ) * interpolate(exitProgress, [0, 1], [1, 0])
              }) rotate(${Math.cos(frame / 12) * 3 + interpolate(exitProgress, [0, 1], [0, -15])}deg)`,
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-end",
            }}>
              <Img
                src={scene.illustration_url || scene.media_url || ""}
                style={{
                  maxHeight: "100%",
                  maxWidth: "100%",
                  objectFit: "contain",
                  filter: "url(#sticker-outline) drop-shadow(0 20px 30px rgba(0,0,0,0.65))",
                }}
              />
            </div>

            {/* Tag badge for illustrations */}
            {scene.tag_badge && (
              <FloatingTagBadge
                text={scene.tag_badge}
                frame={frame}
                fps={fps}
                accentColor={pal.accent}
                assetSide={assetSide}
                entranceDelay={entranceDelay + 20}
                verticalOffset="38%"
              />
            )}
          </>
        )}

        {/* Country Flags Overlay */}
        {matchedCountries.map((code, idx) => {
          const delay = 12 + idx * 8;
          const flagEntrance = spring({
            frame: Math.max(0, frame - delay),
            fps,
            config: { damping: 13, stiffness: 95 },
          });
          
          const y = interpolate(flagEntrance, [0, 1], [300, 0]);
          const rot = interpolate(flagEntrance, [0, 1], [-20, 5 * (idx % 2 === 0 ? 1 : -1)]);
          const scale = flagEntrance * (1 - exitProgress);
          
          const oppositeSide = assetSide === "right" ? "left" : "right";
          const side = hasSideAsset ? oppositeSide : (idx % 2 === 0 ? "left" : "right");
          const sideOffset = 40;

          return (
            <div
              key={code}
              style={{
                position: "absolute",
                bottom: 120 + idx * 330,
                [side]: sideOffset,
                width: 360,
                height: 360,
                borderRadius: "50%",
                border: "8px solid #FFFFFF",
                boxShadow: "0 25px 50px rgba(0,0,0,0.8)",
                overflow: "hidden",
                zIndex: 5,
                transform: `translateY(${y}px) rotate(${rot}deg) scale(${scale})`,
                transformOrigin: "center center",
                opacity: 1 - exitProgress,
              }}
            >
              <img
                src={`https://flagcdn.com/w320/${code}.png`}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          );
        })}

        {/* Captions Overlay
        {scene.caption_words && scene.caption_words.length > 0 && !isHook && (
          <CaptionEngine
            words={scene.caption_words}
            frame={frame}
            fps={fps}
            accentColor={highlightColor}
          />
        )}
        */}

        {/* ── Rule 1: Centralized Headline Container ── */}
        <div style={{
          position: "absolute",
          top: "8%",
          left: "8%",
          right: "8%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          zIndex: 40,
          transform: `translateY(${interpolate(exitProgress, [0, 1], [0, -30])}px)`,
          opacity: 1 - exitProgress,
        }}>
          {/* Selo/badge de editoria */}
          {category && (
            <div style={{
              display: "inline-block",
              fontFamily: "'Oswald', sans-serif",
              fontSize: 20,
              fontWeight: 900,
              color: "#FFFFFF",
              backgroundColor: pal.accent,
              padding: "4px 12px",
              borderRadius: "4px",
              letterSpacing: "0.1em",
              marginBottom: 16,
              boxShadow: `0 4px 12px ${pal.accent}40`,
              opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" }),
              transform: `scale(${interpolate(frame, [0, 10], [0.8, 1], { extrapolateRight: "clamp" })})`,
            }}>
              {getEditorialLabel(category)}
            </div>
          )}

          {/* Headline Text */}
          {filteredWordsWithIndices.length > 0 && (
            <div style={{
              display: "block",
              textAlign: "center",
              width: "100%",
              wordBreak: "break-word",
              opacity: interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              transform: `translateY(${interpolate(frame, [0, 12], [24, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
            }}>
              {filteredWordsWithIndices.map(({ word, index }, i) => {
                const isHighlighted = accentSet.has(index);
                // Hook: each word slams in from a different direction with very tight delay
                // Other: staggered by 2.5 frames
                const delay = isHook ? i * 1.8 : i * 2.5;
                const wordFrame = Math.max(0, frame - delay);

                let transform = "";
                let opacity = 0;
                let filter = "";
                let textShadowExtra = "";

                if (isHook) {
                  // ── KINETIC SLAM — aggressive spring, overshoots then locks ──
                  const slamDir = i % 3; // 0=from top, 1=from right, 2=from left
                  const sSlam = spring({ frame: wordFrame, fps, config: { damping: 8, stiffness: 260, mass: 0.7 } });
                  const oSlam = interpolate(wordFrame, [0, 3], [0, 1], { extrapolateRight: "clamp" });
                  let slamTransform = `scale(${interpolate(sSlam, [0, 1], [1.6, isHighlighted ? 1.08 : 1.0])})`;
                  if (slamDir === 0) {
                    slamTransform += ` translateY(${interpolate(sSlam, [0, 1], [-90, 0])}px)`;
                  } else if (slamDir === 1) {
                    slamTransform += ` translateX(${interpolate(sSlam, [0, 1], [80, 0])}px)`;
                  } else {
                    slamTransform += ` translateX(${interpolate(sSlam, [0, 1], [-80, 0])}px)`;
                  }
                  // After impact: subtle shake at frame 3-6
                  const shakeAmt = interpolate(wordFrame, [3, 4, 5, 6, 7], [0, 3, -2, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                  slamTransform += ` rotate(${shakeAmt}deg)`;
                  transform = slamTransform;
                  opacity = oSlam;
                  textShadowExtra = isHighlighted
                    ? `0 0 40px ${pal.accent}CC, 0 0 80px ${pal.accent}55`
                    : "0 0 30px rgba(0,0,0,0.9)";
                } else {
                  const animStyle = sceneIndex % 3;

                  if (animStyle === 0) {
                    const s = spring({ frame: wordFrame, fps, config: { damping: 14, stiffness: 150 } });
                    const y = interpolate(s, [0, 1], [24, 0]);
                    const rot = interpolate(s, [0, 1], [-4, 0]);
                    const o = interpolate(wordFrame, [0, 5], [0, 1], { extrapolateRight: "clamp" });
                    transform = `scale(${s * (isHighlighted ? 1.12 : 1.0)}) translateY(${y}px) rotate(${rot + (isHighlighted ? 1.5 : 0)}deg)`;
                    opacity = o;
                  } else if (animStyle === 1) {
                    const s = spring({ frame: wordFrame, fps, config: { damping: 10, stiffness: 180 } });
                    const rot = interpolate(s, [0, 1], [8, 0]);
                    const o = interpolate(wordFrame, [0, 4], [0, 1], { extrapolateRight: "clamp" });
                    transform = `scale(${s * (isHighlighted ? 1.15 : 1.0)}) rotate(${rot}deg)`;
                    opacity = o;
                  } else {
                    const s = spring({ frame: wordFrame, fps, config: { damping: 14, stiffness: 120 } });
                    const x = interpolate(s, [0, 1], [-25, 0]);
                    const blurVal = interpolate(s, [0, 1], [8, 0]);
                    const o = interpolate(wordFrame, [0, 6], [0, 1], { extrapolateRight: "clamp" });
                    transform = `scale(${s * (isHighlighted ? 1.12 : 1.0)}) translateX(${x}px)`;
                    opacity = o;
                    filter = `blur(${blurVal}px)`;
                  }
                }

                return (
                  <span
                    key={i}
                    style={{
                      position: "relative",
                      display: "inline-block",
                      marginRight: 16,
                      marginBottom: 14,
                      fontFamily: isCinematicVideo ? "'Georgia', 'Times New Roman', serif" : "'Oswald', 'Montserrat', 'Inter', sans-serif",
                      fontSize: titleFontSize,
                      fontWeight: isCinematicVideo ? 600 : 900,
                      textTransform: isCinematicVideo ? "none" : "uppercase",
                      letterSpacing: isCinematicVideo ? "0em" : "-0.015em",
                      lineHeight: isCinematicVideo ? 1.15 : 1.05,
                      color: isHighlighted ? highlightColor : textColor,
                      textShadow: textShadowExtra
                        ? `0 2px 20px rgba(0,0,0,0.95), 0 1px 6px rgba(0,0,0,1), ${textShadowExtra}`
                        : "0 2px 20px rgba(0,0,0,0.95), 0 1px 6px rgba(0,0,0,1)",
                      transform,
                      transformOrigin: "center center",
                      opacity,
                      filter,
                      paddingBottom: isHighlighted ? 6 : 0,
                      maxWidth: "100%",
                      wordWrap: "break-word",
                    }}
                  >
                    {word}
                    {isHighlighted && !isTimeline && !isCinematicVideo && (
                      <WordHighlightLine
                        color={highlightColor}
                        width={word.length * (titleFontSize * 0.55)}
                        frame={wordFrame}
                      />
                    )}
                  </span>
                );
              })}
            </div>
          )}

          {/* Divisor line below headline */}
          {filteredWordsWithIndices.length > 0 && (
            <div style={{
              width: "80px",
              height: "3px",
              backgroundColor: pal.accent,
              margin: "16px auto",
              opacity: interpolate(frame, [5, 15], [0, 1], { extrapolateRight: "clamp" }),
              transform: `scaleX(${interpolate(frame, [5, 15], [0, 1], { extrapolateRight: "clamp" })})`,
            }} />
          )}

          {/* Subtext (Rule 1 & 10) */}
          {scene.subtext && (
            <p style={{
              fontFamily: isCinematicVideo ? "'Georgia', 'Times New Roman', serif" : "'Inter', 'Montserrat', 'Roboto', sans-serif",
              fontSize: Math.max(18, Math.round(titleFontSize / 3)),
              fontWeight: 500,
              color: textColor,
              opacity: interpolate(frame, [10, 20], [0, 0.85], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              transform: `translateY(${interpolate(frame, [10, 20], [10, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
              maxWidth: "85%",
              margin: "0 auto",
              lineHeight: 1.45,
              textShadow: "0 2px 16px rgba(0,0,0,0.95), 0 1px 4px rgba(0,0,0,1)",
              textAlign: "center",
            }}>
              {scene.subtext}
            </p>
          )}
        </div>

        {/* ── Rule 1: Visual Asset Container (Centered below headline) ── */}
        <div style={{
          position: "absolute",
          top: "38%",
          bottom: "10%",
          left: "5%",
          right: "5%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
          opacity: 1 - exitProgress,
        }}>
          {/* Big metric/percentage counter animation — only for % / monetary / large numbers ≥ 100 */}
          {dataMetric && !isHook && (dataMetric.unit !== "" || dataMetric.num >= 100) && (
            <BigMetricCounter
              value={dataMetric.rawString || `${dataMetric.num}${dataMetric.unit}`}
              color={highlightColor}
              frame={frame}
              fps={fps}
              durationInFrames={durationInFrames}
            />
          )}

          {/* Newspaper clippings collage (Rule 7) */}
          {(scene.visual_type === "newspaper_clip" || scene.visual_type === "collage") && (
            <NewspaperCollage
              sources={sources}
              frame={frame}
              fps={fps}
              fallbackHeadline={newsTitle || scene.headline}
              fallbackSourceName={sourceName}
            />
          )}

          {/* High-Fidelity Data Visualization Charts (Rule 3) */}
          {isData && (
            <div style={{
              padding: "24px",
              borderRadius: 16,
              background: "rgba(0, 0, 0, 0.35)",
              backdropFilter: "blur(12px)",
              border: "1.5px solid rgba(255, 255, 255, 0.15)",
              boxShadow: "0 25px 50px rgba(0, 0, 0, 0.45)",
              width: "100%",
              maxWidth: 1020,
              opacity: interpolate(frame, [12, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              transform: `scale(${interpolate(entrance, [0, 1], [0.96, 1.0])}) rotate(${sceneIndex % 2 === 0 ? 0.6 : -0.6}deg)`,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}>
              {/* Chart Header */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1.5px solid rgba(255, 255, 255, 0.15)",
                paddingBottom: 8,
              }}>
                <span style={{
                  fontFamily: "'Oswald', sans-serif",
                  fontSize: 14,
                  fontWeight: 900,
                  color: "#FFFFFF",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}>
                  {sceneIndex % 3 === 0 ? "DESEMPENHO HISTÓRICO" : (sceneIndex % 3 === 1 ? "FLUXO DE TENDÊNCIA" : "PROPORÇÃO DO MERCADO")}
                </span>
                <span style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 10,
                  fontWeight: 700,
                  color: highlightColor,
                  letterSpacing: "0.05em",
                }}>
                  ● ATUALIZADO
                </span>
              </div>

              {/* Chart Types */}
              {sceneIndex % 3 === 0 && (
                /* TYPE 0: Staggered Bar Chart */
                <div style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  height: 280,
                  padding: "10px 10px 0 10px",
                  position: "relative",
                }}>
                  {[
                    { label: "Q1", val: Math.round(parsedValue * 0.45) },
                    { label: "Q2", val: Math.round(parsedValue * 0.7) },
                    { label: "Q3", val: Math.round(parsedValue * 0.9) },
                    { label: "HOJE", val: Math.round(parsedValue), highlight: true },
                  ].map((item, idx) => {
                    const barDelay = idx * 4;
                    const barSpring = spring({
                      frame: Math.max(0, frame - barDelay),
                      fps,
                      config: { damping: 14, stiffness: 100 }
                    });
                    const barHeight = item.val * 0.8;
                    return (
                      <div key={idx} style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        width: "18%",
                        height: "100%",
                        justifyContent: "flex-end",
                      }}>
                        <span style={{
                          fontFamily: "'Oswald', sans-serif",
                          fontSize: 14,
                          fontWeight: 900,
                          color: item.highlight ? highlightColor : "rgba(255, 255, 255, 0.6)",
                          marginBottom: 4,
                          opacity: barSpring,
                          transform: `scale(${barSpring})`,
                        }}>
                          {item.highlight ? currentCountText : item.val}{displayUnit}
                        </span>

                        <div style={{
                          width: "100%",
                          height: `${barHeight}%`,
                          background: item.highlight ? highlightColor : "rgba(255, 255, 255, 0.25)",
                          border: "1.5px solid rgba(255, 255, 255, 0.15)",
                          borderRadius: "2px 2px 0 0",
                          boxShadow: item.highlight ? `0 0 15px ${highlightColor}` : undefined,
                          transform: `scaleY(${barSpring})`,
                          transformOrigin: "bottom",
                        }} />

                        <span style={{
                          fontFamily: "'Inter', sans-serif",
                          fontSize: 10,
                          fontWeight: 800,
                          color: "rgba(255, 255, 255, 0.5)",
                          marginTop: 6,
                          textTransform: "uppercase",
                          opacity: barSpring,
                        }}>
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {sceneIndex % 3 === 1 && (
                /* TYPE 1: Premium Area/Line Chart */
                <div style={{
                  height: 280,
                  position: "relative",
                  width: "100%",
                  paddingTop: 10,
                }}>
                  {/* Subtle Grid Lines */}
                  <div style={{ position: "absolute", top: 60, left: 0, right: 0, height: 1, borderTop: "1px dashed rgba(255, 255, 255, 0.15)" }} />
                  <div style={{ position: "absolute", top: 140, left: 0, right: 0, height: 1, borderTop: "1px dashed rgba(255, 255, 255, 0.15)" }} />
                  <div style={{ position: "absolute", top: 220, left: 0, right: 0, height: 1, borderTop: "1px dashed rgba(255, 255, 255, 0.15)" }} />

                  <svg width="100%" height="260" style={{ overflow: "visible" }}>
                    {/* Area fill */}
                    <path
                      d={`M 20 240 L 150 180 L 300 210 L 480 ${240 - 180 * (parsedValue / 100)} L 480 260 L 20 260 Z`}
                      fill={`${highlightColor}15`}
                      style={{
                        opacity: interpolate(endPointSpring, [0, 1], [0, 1]),
                      }}
                    />
                    {/* Line stroke */}
                    <path
                      d={`M 20 240 L 150 180 L 300 210 L 480 ${240 - 180 * (parsedValue / 100)}`}
                      fill="none"
                      stroke={highlightColor}
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray="550"
                      strokeDashoffset={strokeDashoffsetLine}
                    />
                    {/* End point marker */}
                    <circle
                      cx="480"
                      cy={240 - 180 * (parsedValue / 100)}
                      r={8 * endPointSpring}
                      fill={highlightColor}
                      stroke="#050811"
                      strokeWidth="2.5"
                    />
                    <circle
                      cx="480"
                      cy={240 - 180 * (parsedValue / 100)}
                      r={12 * endPointSpring + Math.sin(frame / 6) * 4 * endPointSpring}
                      fill="none"
                      stroke={highlightColor}
                      strokeWidth="2"
                      opacity={endPointSpring * (0.6 - 0.4 * (Math.sin(frame / 6) * 0.5 + 0.5))}
                    />
                  </svg>

                  {/* Horizontal Labels */}
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 4,
                    padding: "0 10px",
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 10,
                    fontWeight: 800,
                    color: "rgba(255, 255, 255, 0.5)",
                  }}>
                    <span>INICIAL</span>
                    <span>Q2</span>
                    <span>Q3</span>
                    <span style={{ color: highlightColor }}>{currentCountText}{displayUnit}</span>
                  </div>
                </div>
              )}

              {sceneIndex % 3 === 2 && (
                /* TYPE 2: Radial Donut Chart */
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-around",
                  height: 300,
                  padding: "0 10px",
                }}>
                  {/* Left Donut */}
                  <div style={{ position: "relative", width: 260, height: 260 }}>
                    <svg width="260" height="260" style={{ transform: "rotate(-90deg)" }}>
                      <circle cx="130" cy="130" r="102" fill="none" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="16" />
                      <circle
                        cx="130"
                        cy="130"
                        r="102"
                        fill="none"
                        stroke={highlightColor}
                        strokeWidth="16"
                        strokeDasharray={640}
                        strokeDashoffset={strokeDashoffsetDonut}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "'Oswald', sans-serif",
                      fontSize: 42,
                      fontWeight: 900,
                      color: highlightColor,
                    }}>
                      {currentCountText}{displayUnit}
                    </div>
                  </div>

                  {/* Right Description Metrics */}
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: 12,
                  }}>
                    {[
                      { label: "Média Esperada", val: "70%" },
                      { label: "Cenário Atual", val: `${currentCountText}${displayUnit}`, highlight: true },
                    ].map((item, idx) => (
                      <div key={idx} style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                      }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: "50%",
                          background: item.highlight ? highlightColor : "rgba(255, 255, 255, 0.3)"
                        }} />
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700, color: "rgba(255, 255, 255, 0.5)" }}>
                            {item.label}
                          </span>
                          <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 900, color: item.highlight ? highlightColor : "rgba(255, 255, 255, 0.9)" }}>
                            {item.val}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </AbsoluteFill>

      {/* ── Hook scene bottom feature ── */}
      {isHook && (
        <HookBottomFeature
          frame={frame}
          fps={fps}
          accentColor={pal.accent}
          newsTitle={newsTitle}
          durationInFrames={durationInFrames}
        />
      )}

      {/* ── LowerThird anchor for every scene ── */}
      <LowerThird
        sourceName={sourceName}
        category={category}
        frame={frame}
        fps={fps}
        accentColor={pal.accent}
        sceneIndex={sceneIndex}
        totalScenes={totalScenes}
        durationInFrames={durationInFrames}
        personName={scene.person_name || undefined}
        isHook={isHook}
      />
    </AbsoluteFill>
  );
};


