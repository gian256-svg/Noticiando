import { Copy, RefreshCw, Bookmark, FileDown, Check } from "lucide-react";
import { useState } from "react";
import { useScriptGen } from "@/hooks/useScriptGen";
import { cn } from "@/lib/utils";
import type { NewsItem } from "@/components/feed/NewsCard";

interface ScriptActionsProps {
  news: NewsItem;
  script: string;
}

export function ScriptActions({ news, script }: ScriptActionsProps) {
  const { generate } = useScriptGen();
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleCopy = async () => {
    if (!script) return;
    await navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!script) return;
    await window.noticiando.invoke("scripts:save", {
      newsId: news.id,
      title: news.title,
      content: script,
      format: "animated",
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExportPdf = () => {
    // TODO: implement PDF export via WeasyPrint in backend
    window.noticiando.invoke("scripts:export-pdf", { title: news.title, content: script });
  };

  const hasScript = Boolean(script);

  return (
    <div className="flex items-center gap-2">
      <ActionButton
        onClick={handleCopy}
        disabled={!hasScript}
        icon={copied ? Check : Copy}
        label={copied ? "Copiado!" : "Copiar"}
        variant={copied ? "success" : "default"}
      />
      <ActionButton
        onClick={() => generate(news)}
        disabled={!hasScript}
        icon={RefreshCw}
        label="Regenerar"
      />
      <ActionButton
        onClick={handleSave}
        disabled={!hasScript}
        icon={saved ? Check : Bookmark}
        label={saved ? "Salvo!" : "Salvar"}
        variant={saved ? "success" : "default"}
      />
      <ActionButton
        onClick={handleExportPdf}
        disabled={!hasScript}
        icon={FileDown}
        label="PDF"
      />
    </div>
  );
}

function ActionButton({
  onClick,
  disabled,
  icon: Icon,
  label,
  variant = "default",
}: {
  onClick: () => void;
  disabled: boolean;
  icon: React.ElementType;
  label: string;
  variant?: "default" | "success";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-all",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        variant === "success"
          ? "border-live/50 bg-live/10 text-live"
          : "border-border text-text-secondary hover:border-accent/50 hover:text-text-primary hover:bg-white/5"
      )}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}
