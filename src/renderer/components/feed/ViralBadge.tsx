import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface ViralBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

function getScoreConfig(score: number) {
  if (score >= 75) {
    return {
      color: "text-red-300",
      bg: "bg-red-500/25 backdrop-blur-sm",
      border: "border-red-400/30",
      label: "VIRAL",
      flameColor: "text-red-400",
    };
  }
  if (score >= 50) {
    return {
      color: "text-orange-300",
      bg: "bg-orange-500/25 backdrop-blur-sm",
      border: "border-orange-400/30",
      label: "QUENTE",
      flameColor: "text-orange-400",
    };
  }
  return {
    color: "text-white/70",
    bg: "bg-black/25 backdrop-blur-sm",
    border: "border-white/15",
    label: "",
    flameColor: "text-white/50",
  };
}

export function ViralBadge({ score, size = "md", showLabel = false }: ViralBadgeProps) {
  const config = getScoreConfig(score);

  const sizes = {
    sm: { wrapper: "px-1.5 py-0.5 gap-0.5 rounded-lg", icon: 9, text: "text-[10px]" },
    md: { wrapper: "px-2 py-1 gap-1 rounded-lg", icon: 11, text: "text-[11px]" },
    lg: { wrapper: "px-2.5 py-1 gap-1.5 rounded-xl", icon: 13, text: "text-xs" },
  };

  const s = sizes[size];

  return (
    <div
      className={cn(
        "inline-flex items-center border font-bold tabular-nums",
        config.bg,
        config.border,
        config.color,
        s.wrapper
      )}
    >
      <Flame size={s.icon} className={cn(config.flameColor, score >= 75 && "animate-pulse")} />
      <span className={s.text}>{score}</span>
      {showLabel && config.label && (
        <span className={cn(s.text, "tracking-wide ml-0.5")}>{config.label}</span>
      )}
    </div>
  );
}
