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
  investments:  { bg: "#F5F0E8", grad: "#E8E0D0", accent: "#1A3A6B", text: "#1E293B", dim: "rgba(26,58,107,0.09)" },
  economy_br:   { bg: "#0A1628", grad: "#0D1E35", accent: "#00C896", text: "#FFFFFF", dim: "rgba(0,200,150,0.09)" },
  economy_int:  { bg: "#0B0E17", grad: "#060810", accent: "#E0A96D", text: "#FFFFFF", dim: "rgba(224,169,109,0.12)" },
  geopolitics:  { bg: "#1A0A0A", grad: "#2B1111", accent: "#D32F2F", text: "#FFFFFF", dim: "rgba(211,47,47,0.12)" },
  crypto:       { bg: "#0D0D12", grad: "#06060A", accent: "#F59E0B", text: "#FFFFFF", dim: "rgba(245,158,11,0.12)" },
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

      {/* 🎵 Epidemic Sound Soundtrack Mixed in Background with Ducking and Fades */}
      {music_url && (
        <Audio 
          src={music_url} 
          volume={(f) => {
            const totalFrames = scenes.reduce((acc, s) => acc + Math.max(1, Math.round(s.duration_seconds * fps)), 0);
            
            // Fade in (0.5s = 15 frames)
            let baseVol = interpolate(f, [0, 15], [0, 0.25], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            
            // Fade out (1.0s = 30 frames)
            if (f > totalFrames - 30) {
              baseVol = interpolate(f, [totalFrames - 30, totalFrames], [baseVol, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            }
            
            // Ducking 40% automatically during narration scenes
            let isNarrationActive = false;
            let currentFrameAccumulator = 0;
            for (const s of scenes) {
              const sceneFrames = Math.max(1, Math.round(s.duration_seconds * fps));
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
  if (type === "none" || !type) return null;
  const pulse = Math.sin(frame / 6) * 0.05 + 0.95;

  let resolvedType = type;
  // Se for seta, mas não tiver asset visível, faz fallback para estrela decorativa
  if (type === "arrow" && !hasSideAsset && !isData && !isNewspaper) {
    resolvedType = "star";
  }
  
  if (resolvedType === "star") {
    return null; // A pedido do usuário, a estrela decorativa foi abolida
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
}> = ({ value, color, frame, fps }) => {
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
  
  const springProgress = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 70 }
  });

  const animatedVal = springProgress * rawNum;
  const decimalPlaces = rawNumStr.includes(".") ? rawNumStr.split(".")[1].length : 0;
  const formattedVal = animatedVal.toFixed(decimalPlaces).replace(/\./g, ",");
  const displayString = value.replace(numberMatch[1], formattedVal);

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 8,
      width: "100%",
      transform: `rotate(-3deg) scale(${interpolate(springProgress, [0, 1], [0.75, 1])})`,
      opacity: interpolate(springProgress, [0, 0.3], [0, 1]),
    }}>
      <div style={{
        fontFamily: "'Oswald', 'Montserrat', sans-serif",
        fontSize: 190, // Ampliado para 190px para impacto visual massivo
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
      bottom: 120, // ajustado para evitar sobrepor a headline
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
  const hPan = interpolate(panProgress, [0, 1], [30, -380]);
  const rotate = interpolate(entrance, [0, 1], [6, -0.5]) + interpolate(exitProgress, [0, 1], [0, -3]);
  const scale = interpolate(entrance, [0, 1], [0.85, 1]) * interpolate(exitProgress, [0, 1], [1, 0.85]);
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
        top: "46%",
        left: "5%",
        width: "140%", // Transborda as margens
        maxWidth: 1200,
        backgroundColor: "#f4f1ea", // newsprint warm paper color
        backgroundImage: "radial-gradient(#e5dec9 1px, transparent 1px)", // subtle paper texture
        backgroundSize: "20px 20px",
        padding: "32px",
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
        fontSize: 28,
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

const TimelineBackground: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const drawLine = spring({ frame: Math.max(0, frame - 10), fps, config: { damping: 200 } });
  
  const newsTerms = `
    TAXA SELIC • COPOM • BANCO CENTRAL DO BRASIL • MERCADO FINANCEIRO • IBOVESPA • INDÚSTRIA 4.0 • INFLAÇÃO ACUMULADA • TÍTULOS PÚBLICOS • INVESTIMENTOS ESTRANGEIROS • DEFICIT PÚBLICO • SUPERAVIT COMERCIAL • DÓLAR COMERCIAL • RESERVAS INTERNACIONAIS • BOLSA DE VALORES • FATOR DE RISCO • LIQUIDEZ DIÁRIA
  `;

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
      {[
        { left: "25%", label: "ANTERIOR" },
        { left: "50%", label: "PRESENTE" },
        { left: "75%", label: "PROJEÇÃO" }
      ].map((item, idx) => {
        const threshold = 0.3 + idx * 0.22;
        const scaleVal = drawLine > threshold ? 1 : 0;
        return (
          <div
            key={idx}
            style={{
              position: "absolute",
              top: "calc(72% - 15px)",
              left: item.left,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              transform: `scale(${scaleVal})`,
              transition: "transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            }}
          >
            {/* The vertical marker line */}
            <div style={{ width: 4, height: 30, background: "#D32F2F" }} />
            {/* The year label below the line */}
            <div style={{
              marginTop: 8,
              fontFamily: "'Oswald', 'Montserrat', sans-serif",
              fontSize: 14,
              fontWeight: 900,
              color: "#D32F2F",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
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
}> = ({ src, frame, durationInFrames }) => {
  const scale = interpolate(frame, [0, durationInFrames], [1.0, 1.08], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp"
  });

  return (
    <>
      <OffthreadVideo
        src={src}
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
        background: "linear-gradient(to top, rgba(0,0,0,0.88) 20%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.70) 100%)",
        zIndex: 2,
      }} />
    </>
  );
};

const SplitVideoElement: React.FC<{
  src: string;
  frame: number;
  durationInFrames: number;
}> = ({ src, frame, durationInFrames }) => {
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
        position: "absolute", inset: 0, opacity: 0.25, pointerEvents: "none",
        backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)",
        backgroundSize: "4px 4px", zIndex: 1
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to top, rgba(0,0,0,0.88) 15%, transparent 50%, rgba(0,0,0,0.85) 100%)",
        zIndex: 2,
      }} />
    </>
  );
};

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
  const exitProgress = spring({
    frame: Math.max(0, frame - (durationInFrames - 15)),
    fps,
    config: { damping: 15, stiffness: 85 },
  });

  const exitOpacity = durationInFrames > 20
    ? interpolate(frame, [durationInFrames - 3, durationInFrames], [1, 0], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
      })
    : 1;

  const isHook = scene.visual_type === "hook";
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

  const assetSide = sceneIndex % 2 === 0 ? "right" : "left";

  // Align text to opposite side of asset to prevent overlap
  const textAlignment = hasSideAsset
    ? (assetSide === "right" ? "left" : "right")
    : "center";

  const containerAlignItems = textAlignment === "left"
    ? "flex-start"
    : (textAlignment === "right" ? "flex-end" : "center");

  // Keep colors high-contrast (dark on light gradient, white on full-bleed video)
  const textColor = (isCinematicVideo || isCollage) ? "#FFFFFF" : ((isMap || isTimeline) ? "#1A1A1A" : pal.text);

  const isLightAccent = pal.accent === "#1A3A6B" || pal.accent === "#1A0A0A" || pal.accent === "#0A1628";
  const highlightColor = (isCinematicVideo || isCollage) && isLightAccent ? "#FFC107" : pal.accent; // Destaque em ouro para B-roll em temas escuros

  // Brand Badge Detector (JBS, VALE, etc)
  const brandLayout = useMemo(() => {
    const upper = scene.headline.toUpperCase().trim();
    const brands = ["JBS", "VALE", "PETROBRAS", "PETRO", "APPLE", "NVIDIA", "TESLA", "GOOGLE", "MICROSOFT"];
    for (const brand of brands) {
      if (upper.startsWith(brand + " ") || upper.endsWith(" " + brand)) {
        const rest = upper.replace(brand, "").trim();
        return { brand, rest };
      }
    }
    return null;
  }, [scene.headline]);

  // Slow dynamic camera zoom-in effect (Ken Burns)
  const cameraScale = interpolate(frame, [0, durationInFrames], [1.0, 1.12], {
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
  const titleFontSize = isHook ? 88 : 76;
  const subtextFontSize = 52; // STRICT MINIMUM: never below 48px for mobile legibility

  // Parse potential values (e.g. percentages or numbers) for all scenes
  const dataMetric = useMemo(() => {
    const textToSearch = `${scene.headline} ${scene.subtext ?? ""}`;
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



  return (
    <AbsoluteFill style={{ opacity: exitOpacity, overflow: "hidden" }}>
      {/* 🎙️ Local Scene Narration Audio */}
      {scene.audio_url && <Audio src={scene.audio_url} volume={1.0} />}

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

      {isFullVideo && scene.media_url && (
        <VideoElement src={scene.media_url} sceneIndex={sceneIndex} frame={frame} durationInFrames={durationInFrames} fps={fps} />
      )}
      
      {isSplitVideo && scene.media_url && (
        <SplitVideoElement src={scene.media_url} frame={frame} durationInFrames={durationInFrames} />
      )}

      {isMap && <MapBackground frame={frame} fps={fps} mapImageUrl={scene.map_image_url} />}
      {isTimeline && <TimelineBackground frame={frame} fps={fps} />}
      {isCollage && <CollageBackground frame={frame} fps={fps} cutoutUrl={scene.cutout_url} />}

      {/* ── Editorial Soft Warm Lighting Spotlight (only on standard palettes) ── */}
      {!isCinematicVideo && !isAnalogBg && (
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
      )}

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

        {/* Real YouTube cut or Stock Video Background */}
        {scene.visual_type === "video" && (scene.background_video_url || scene.media_url) && (
          <VideoElement
            src={scene.background_video_url || scene.media_url || ""}
            sceneIndex={sceneIndex}
            frame={frame}
            durationInFrames={durationInFrames}
            fps={fps}
          />
        )}

        {/* Dynamic Graphic Decorator Element (Star, arrow, stripes, circle) */}
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

        {/* Senior Motion Design Cutout Sticker (popping from bottom) or Newspaper Cutout */}
        {(scene.visual_type === "newspaper_clip" || scene.cutout_url === "newspaper") && (
          <NewspaperCutout
            title={scene.headline}
            summary={scene.subtext || ""}
            source={sourceName || "Noticiando"}
            date={new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}
            frame={frame}
            fps={fps}
            sceneIndex={sceneIndex}
            durationInFrames={durationInFrames}
          />
        )}

        {scene.visual_type === "cutout" && scene.cutout_url && scene.cutout_url !== "newspaper" && (
          <div style={{
            position: "absolute",
            bottom: 80,
            right: assetSide === "right" ? 50 : "auto",
            left: assetSide === "left" ? 50 : "auto",
            height: "58%", // Aumentado para 58%
            width: "58%",  // Aumentado para 58%
            zIndex: 4,
            opacity: 1 - exitProgress,
            transform: `translateY(${
              interpolate(
                spring({ frame, fps, config: { damping: 13, stiffness: 85 } }),
                [0, 1],
                [380, 0]
              ) + 
              interpolate(exitProgress, [0, 1], [0, 380]) +
              Math.cos(frame / 12) * 8
            }px) scale(${
              interpolate(
                spring({ frame, fps, config: { damping: 13, stiffness: 85 } }),
                [0, 1],
                [0.6, 1]
              ) * interpolate(exitProgress, [0, 1], [1, 0.7])
            }) rotate(${Math.sin(frame / 15) * 2 + (sceneIndex % 2 === 0 ? 2 : -2) + interpolate(exitProgress, [0, 1], [0, sceneIndex % 2 === 0 ? -12 : 12])}deg)`,
          }}>
            {/* Scrapbook/Collage dotted outline backdrop card */}
            <div style={{
              position: "absolute",
              inset: -14,
              borderRadius: 6,
              border: `2px dashed ${pal.accent}50`,
              background: `${pal.accent}05`,
              transform: "rotate(-3deg) translate(-4px, 4px)",
              zIndex: -1,
            }} />
            
            <Img
              src={scene.cutout_url}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                filter: "url(#sticker-outline) drop-shadow(0 20px 35px rgba(0,0,0,0.65))",
              }}
            />
          </div>
        )}

        {/* Dynamic Stylized Illustration Sticker (floating on side/center) */}
        {(scene.illustration_url || (scene.visual_type === "illustration" && scene.media_url)) && (
          <div style={{
            position: "absolute",
            bottom: 80,
            right: assetSide === "right" ? 50 : "auto",
            left: assetSide === "left" ? 50 : "auto",
            height: "56%", // Aumentado para 56%
            width: "56%",  // Aumentado para 56%
            zIndex: 4,
            opacity: 1 - exitProgress,
            transform: `translateY(${
              Math.sin(frame / 10) * 10 + 
              interpolate(exitProgress, [0, 1], [0, 120])
            }px) scale(${
              interpolate(
                spring({ frame, fps, config: { damping: 14, stiffness: 95 } }),
                [0, 1],
                [0, 1]
              ) * interpolate(exitProgress, [0, 1], [1, 0])
            }) rotate(${Math.cos(frame / 12) * 3 + interpolate(exitProgress, [0, 1], [0, -15])}deg)`,
          }}>
            {/* Dotted backdrop card for illustration */}
            <div style={{
              position: "absolute",
              inset: -12,
              borderRadius: 6,
              border: `2.5px dashed ${pal.accent}50`,
              background: `${pal.accent}05`,
              transform: "rotate(3deg) translate(3px, 3px)",
              zIndex: -1,
            }} />

            <Img
              src={scene.illustration_url || scene.media_url || ""}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                filter: "url(#sticker-outline) drop-shadow(0 20px 30px rgba(0,0,0,0.65))",
              }}
            />
          </div>
        )}

        {/* word-level synchronized captions overlay */}
        {scene.caption_words && scene.caption_words.length > 0 && (
          <CaptionEngine
            words={scene.caption_words}
            frame={frame}
            fps={fps}
            accentColor={highlightColor}
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
          alignItems: containerAlignItems,
          justifyContent: (hasSideAsset || isData || (scene.visual_type === "newspaper_clip" || scene.cutout_url === "newspaper") || isTimeline) ? "flex-start" : "center",
          paddingTop: (hasSideAsset || isData || (scene.visual_type === "newspaper_clip" || scene.cutout_url === "newspaper") || isTimeline) ? (isHook ? 180 : 210) : 0,
          paddingLeft: 80, paddingRight: 80,
          textAlign: textAlignment,
          transform: `translateY(${interpolate(exitProgress, [0, 1], [0, -50])}px) scale(${interpolate(exitProgress, [0, 1], [1, 0.95])})`,
          opacity: 1 - exitProgress,
        }}>

          {/* Kinetic Headline - Overshoot spring & Neon glow */}
          {brandLayout ? (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 18,
              zIndex: 10,
              width: "100%",
              marginBottom: 20,
            }}>
              {/* Brand Logo Badge */}
              <div style={{
                background: "#0F294A", // Corporate navy
                color: "#FFFFFF",
                fontFamily: "'Oswald', sans-serif",
                fontSize: 66,
                fontWeight: 900,
                padding: "10px 28px",
                borderRadius: 6,
                border: "3px solid #FFFFFF",
                boxShadow: "0 14px 30px rgba(15,41,74,0.45), 0 4px 10px rgba(0,0,0,0.25)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                transform: `scale(${interpolate(entrance, [0, 1], [0.8, 1])}) rotate(-2deg)`,
              }}>
                {brandLayout.brand}
              </div>

              {/* Action Text Sublined */}
              <div style={{
                position: "relative",
                fontFamily: "'Oswald', sans-serif",
                fontSize: 76,
                fontWeight: 900,
                color: highlightColor,
                textTransform: "uppercase",
                transform: `scale(${interpolate(entrance, [0, 1], [0.9, 1])})`,
                marginTop: 6,
                paddingBottom: 8,
              }}>
                {brandLayout.rest}
                <WordHighlightLine
                  color={highlightColor}
                  width={brandLayout.rest.length * 40}
                  frame={Math.max(0, frame - 10)}
                />
              </div>
            </div>
          ) : (
            <div style={{
              display: "flex", flexWrap: "wrap",
              justifyContent: textAlignment === "left" ? "flex-start" : (textAlignment === "right" ? "flex-end" : "center"),
              gap: "14px 16px",
              marginBottom: 20,
              zIndex: 10,
              maxWidth: "100%", // Ocupa toda a largura, pois empilhamos verticalmente
              wordBreak: "break-word",
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
                      position: "relative",
                      display: "inline-block",
                      fontFamily: isCinematicVideo ? "'Georgia', 'Times New Roman', serif" : "'Oswald', 'Montserrat', 'Inter', sans-serif",
                      fontSize: isHook ? 80 : 72, // Ligeiramente menor para evitar vazar a tela com palavras gigantes
                      fontWeight: isCinematicVideo ? 600 : 900,
                      textTransform: isCinematicVideo ? "none" : "uppercase",
                      letterSpacing: isCinematicVideo ? "0em" : "-0.015em", // Slightly relaxed kerning to prevent overlap
                      lineHeight: isCinematicVideo ? 1.15 : 1.05, // Slightly increased height to prevent vertical overlap
                      color: isTimeline && !isHighlighted ? "transparent" : (isHighlighted ? (isTimeline ? "#D32F2F" : highlightColor) : textColor),
                      textShadow: isHighlighted 
                        ? (isTimeline ? "none" : (isCinematicVideo ? "0 4px 18px rgba(0,0,0,0.95)" : `0 4px 22px rgba(0,0,0,0.9), 0 0 10px ${highlightColor}60`))
                        : (textColor === "#FFFFFF" ? "0 4px 18px rgba(0,0,0,0.85)" : "none"),
                      transform,
                      transformOrigin: "center center",
                      opacity,
                      filter,
                      paddingBottom: isHighlighted ? 6 : 0,
                      maxWidth: "100%", // Permite que a palavra quebre se for maior que a tela
                      wordWrap: "break-word",
                      WebkitTextStroke: isTimeline && !isHighlighted ? "2px #D32F2F" : "none", // Red outline for timeline numbers
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

          {/* O subtext (narração completa) NÃO é mais renderizado na tela a pedido do usuário,
              apenas a headline com palavras-chave curtas aparece como lettering! */}

          {/* Renderizar subtítulo (subtext completo) APENAS no Hook/Capa do Reels para dar contexto */}
          {isHook && scene.subtext && (
            <div style={{
              fontFamily: "'Inter', 'Montserrat', sans-serif",
              fontSize: 34,
              fontWeight: 500,
              color: textColor === "#FFFFFF" ? "rgba(255, 255, 255, 0.88)" : `${textColor}ee`,
              marginTop: 20,
              textAlign: textAlignment,
              maxWidth: "85%",
              textShadow: textColor === "#FFFFFF" ? "0 4px 16px rgba(0,0,0,0.95)" : "none",
              opacity: interpolate(entrance, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(entrance, [0, 1], [15, 0])}px)`,
              lineHeight: 1.3,
            }}>
              {scene.subtext}
            </div>
          )}

          {/* Big metric/percentage counter animation (for all scenes that contain a value) */}
          {dataMetric && (
            <BigMetricCounter
              value={dataMetric.rawString || `${dataMetric.num}${dataMetric.unit}`}
              color={highlightColor}
              frame={frame}
              fps={fps}
            />
          )}

          {/* High-Fidelity Data Visualization (Editorial Publication-Style Chart) */}
          {isData && (
            <div style={{
              marginTop: 35,
              padding: "20px 24px",
              borderRadius: 4, // rectangular editorial card
              background: "#FBF9F5", // pure book page creme
              border: "2px solid #1E293B",
              boxShadow: "8px 8px 0px rgba(30, 41, 59, 0.95)", // solid flat drop shadow
              width: "100%",
              maxWidth: 640, // Aumentado para 640px
              opacity: interpolate(frame, [12, 22], [0, 1], {
                extrapolateLeft: "clamp", extrapolateRight: "clamp",
              }),
              transform: `scale(${interpolate(entrance, [0, 1], [0.96, 1.0])}) rotate(${sceneIndex % 2 === 0 ? 0.6 : -0.6}deg)`,
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
                paddingBottom: 8,
              }}>
                <span style={{
                  fontFamily: "'Oswald', sans-serif",
                  fontSize: 14,
                  fontWeight: 900,
                  color: "#1E293B",
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

              {/* Chart Types Carousel */}
              {sceneIndex % 3 === 0 && (
                /* TYPE 0: Editorial Bar Chart */
                <div style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  height: 180, // Aumentado para 180px
                  padding: "10px 10px 0 10px",
                  position: "relative",
                }}>
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
                        <span style={{
                          fontFamily: "'Oswald', sans-serif",
                          fontSize: 14,
                          fontWeight: 900,
                          color: item.highlight ? highlightColor : "#475569",
                          marginBottom: 4,
                        }}>
                          {item.highlight ? currentCountText : item.val}{displayUnit}
                        </span>

                        <div style={{
                          width: "100%",
                          height: `${h * 0.8}%`,
                          background: item.highlight ? highlightColor : "#94A3B8",
                          border: "1.5px solid #1E293B",
                          borderRadius: "2px 2px 0 0",
                          boxShadow: item.highlight ? "3px -3px 0px rgba(30, 41, 59, 0.4)" : undefined,
                        }} />

                        <span style={{
                          fontFamily: "'Inter', sans-serif",
                          fontSize: 10,
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
              )}

              {sceneIndex % 3 === 1 && (
                /* TYPE 1: Premium Area/Line Chart */
                <div style={{
                  height: 180, // Aumentado para 180px
                  position: "relative",
                  width: "100%",
                  paddingTop: 10,
                }}>
                  {/* Subtle Grid Lines */}
                  <div style={{ position: "absolute", top: 40, left: 0, right: 0, height: 1, borderTop: "1px dashed #E2E8F0" }} />
                  <div style={{ position: "absolute", top: 90, left: 0, right: 0, height: 1, borderTop: "1px dashed #E2E8F0" }} />
                  <div style={{ position: "absolute", top: 140, left: 0, right: 0, height: 1, borderTop: "1px dashed #E2E8F0" }} />

                  <svg width="100%" height="160" style={{ overflow: "visible" }}>
                    {/* Area fill */}
                    <path
                      d={`M 20 140 L 150 110 L 300 125 L 480 ${140 - 100 * dataEasedProgress} L 480 160 L 20 160 Z`}
                      fill={`${highlightColor}15`}
                    />
                    {/* Line stroke */}
                    <path
                      d={`M 20 140 L 150 110 L 300 125 L 480 ${140 - 100 * dataEasedProgress}`}
                      fill="none"
                      stroke={highlightColor}
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                    {/* End point marker */}
                    <circle
                      cx="480"
                      cy={140 - 100 * dataEasedProgress}
                      r="8"
                      fill={highlightColor}
                      stroke="#1E293B"
                      strokeWidth="2.5"
                    />
                    <circle
                      cx="480"
                      cy={140 - 100 * dataEasedProgress}
                      r={12 + Math.sin(frame / 6) * 4}
                      fill="none"
                      stroke={highlightColor}
                      strokeWidth="2"
                      opacity={0.6 - 0.4 * (Math.sin(frame / 6) * 0.5 + 0.5)}
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
                    color: "#475569",
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
                  height: 180, // Aumentado para 180px
                  padding: "0 10px",
                }}>
                  {/* Left Donut */}
                  <div style={{ position: "relative", width: 160, height: 160 }}>
                    <svg width="160" height="160" style={{ transform: "rotate(-90deg)" }}>
                      <circle cx="80" cy="80" r="62" fill="none" stroke="#E2E8F0" strokeWidth="10" />
                      <circle
                        cx="80"
                        cy="80"
                        r="62"
                        fill="none"
                        stroke={highlightColor}
                        strokeWidth="10"
                        strokeDasharray={390}
                        strokeDashoffset={390 - (Math.min(parsedValue, 100) / 100) * dataEasedProgress * 390}
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
                      fontSize: 26,
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
                          background: item.highlight ? highlightColor : "#94A3B8"
                        }} />
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700, color: "#64748B" }}>
                            {item.label}
                          </span>
                          <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 900, color: item.highlight ? highlightColor : "#1E293B" }}>
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
    </AbsoluteFill>
  );
};


