/**
 * GenerativeThumbnail — v3
 * Vibrant editorial thumbnail — always renders, always looks premium.
 * Bright gradient backgrounds + bold title text + category stripe.
 */
import React, { useMemo } from "react";

interface GenerativeThumbnailProps {
  title: string;
  source: string;
  category: string;
  viralScore: number;
  className?: string;
}

// Bright, magazine-style palettes — clearly NOT a plain background
const PALETTES: Record<string, { a: string; b: string; c: string; text: string; label: string }> = {
  investments:  { a: "#064e3b", b: "#065f46", c: "#10b981", text: "#6ee7b7", label: "💰 INVESTIMENTOS" },
  economy_br:   { a: "#1e3a8a", b: "#1d4ed8", c: "#3b82f6", text: "#93c5fd", label: "🇧🇷 ECONOMIA" },
  economy_int:  { a: "#4c1d95", b: "#6d28d9", c: "#8b5cf6", text: "#c4b5fd", label: "🌍 MERCADO INT" },
  geopolitics:  { a: "#7c2d12", b: "#c2410c", c: "#f97316", text: "#fed7aa", label: "🗺️ GEOPOLÍTICA" },
  crypto:       { a: "#713f12", b: "#a16207", c: "#eab308", text: "#fef08a", label: "₿ CRIPTO" },
  general:      { a: "#1e293b", b: "#334155", c: "#64748b", text: "#cbd5e1", label: "📰 NOTÍCIAS" },
};

function seedRng(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = Math.imul(31, h) + str.charCodeAt(i) | 0; }
  h = Math.abs(h);
  return () => { h ^= h << 13; h ^= h >> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
}

function wrapTitle(title: string, maxW: number): string[] {
  const words = title.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur.length + w.length + 1 > maxW && cur) { lines.push(cur); cur = w; if (lines.length === 2) break; }
    else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur && lines.length < 3) lines.push(cur);
  return lines.slice(0, 3);
}

export function GenerativeThumbnail({ title, source, category, viralScore, className = "" }: GenerativeThumbnailProps) {
  const pal = PALETTES[category] ?? PALETTES.general;
  const seed = useMemo(() => seedRng(title + category), [title, category]);

  // Generate unique decorative elements
  const dots = useMemo(() => Array.from({ length: 8 }, () => ({
    cx: seed() * 400, cy: seed() * 220, r: 4 + seed() * 40, op: 0.06 + seed() * 0.14,
  })), []);

  const lines = useMemo(() => Array.from({ length: 5 }, () => ({
    x1: seed() * 400, y1: seed() * 220,
    x2: seed() * 400, y2: seed() * 220,
    op: 0.06 + seed() * 0.12,
  })), []);

  const titleLines = useMemo(() => wrapTitle(title, 28), [title]);
  const uid = useMemo(() => `gt-${Math.abs(title.charCodeAt(0) * 997 + category.charCodeAt(0) * 31)}`, [title, category]);
  const score = Math.round(viralScore);
  const srcShort = (source || "").slice(0, 16);

  return (
    <div className={`w-full h-full overflow-hidden ${className}`} style={{ background: pal.a }}>
      <svg viewBox="0 0 400 220" xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={`bg-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={pal.a} />
            <stop offset="60%" stopColor={pal.b} />
            <stop offset="100%" stopColor={pal.a} stopOpacity="0.7" />
          </linearGradient>
          <linearGradient id={`fade-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="45%" stopColor="rgba(0,0,0,0.3)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.88)" />
          </linearGradient>
        </defs>

        {/* Base gradient */}
        <rect width="400" height="220" fill={`url(#bg-${uid})`} />

        {/* Decorative blobs */}
        {dots.map((d, i) => (
          <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill={pal.c} opacity={d.op} />
        ))}

        {/* Decorative diagonal lines */}
        {lines.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke={pal.c} strokeWidth="1" opacity={l.op} />
        ))}

        {/* Accent diagonal stripe — top-right corner */}
        <polygon points="310,0 400,0 400,90" fill={pal.c} opacity="0.15" />

        {/* Score ring — top right */}
        <circle cx="370" cy="28" r="18" fill="rgba(0,0,0,0.35)" />
        <circle cx="370" cy="28" r="18" fill="none" stroke={pal.c} strokeWidth="2" opacity="0.4" />
        <text x="370" y="32" textAnchor="middle" fontSize="11" fontWeight="900"
          fill={pal.text}>{score}</text>

        {/* Bottom dark fade */}
        <rect width="400" height="220" fill={`url(#fade-${uid})`} />

        {/* Category label */}
        <text x="12" y="155" fontSize="8" fontWeight="800" letterSpacing="0.06em"
          fill={pal.c} opacity="0.9">{pal.label}</text>

        {/* Thin accent rule */}
        <rect x="12" y="159" width="200" height="1.5" fill={pal.c} opacity="0.5" rx="1" />

        {/* Title lines */}
        {titleLines.map((line, i) => (
          <text key={i} x="12" y={173 + i * 16}
            fontSize={i === 0 ? "13.5" : "12"} fontWeight={i === 0 ? "900" : "700"}
            fill="white" opacity={i === 0 ? 1 : 0.9} letterSpacing="-0.02em">
            {line}
          </text>
        ))}

        {/* Source */}
        <text x="12" y="215" fontSize="8" fontWeight="600" fill={pal.text} opacity="0.65">
          {srcShort}
        </text>

        {/* Bottom accent bar */}
        <rect x="0" y="218" width="400" height="3" fill={pal.c} opacity="0.8" />
      </svg>
    </div>
  );
}
