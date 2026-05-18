import { useCallback } from "react";
import { useScriptStore } from "@/store/scriptStore";
import type { NewsItem } from "@/components/feed/NewsCard";

const CATEGORY_LABELS: Record<string, string> = {
  investments: "Investimentos",
  economy_br: "Economia BR",
  economy_int: "Mercado INT",
  geopolitics: "Geopolítica",
  crypto: "Cripto",
  general: "Geral",
};

const MYHUB_URL = "https://myhub.ia.br/agents";

export function useScriptGen() {
  const { duration } = useScriptStore();

  const generate = useCallback(
    async (news: NewsItem) => {
      const prompt = `Notícia para roteiro:

Título: ${news.title}
Fonte(s): ${news.sources.join(", ")}
Publicado: ${news.published_at}
Score viral: ${news.viral_score}/100
Categoria: ${CATEGORY_LABELS[news.category] ?? news.category}

Resumo: ${news.summary || "(sem resumo disponível)"}

Formato: Reels híbrido — combine imagens reais de arquivo, motion graphics e ilustrações para deixar o vídeo dinâmico e com mais possibilidades visuais.
Duração: ${duration} segundos`;

      try {
        await navigator.clipboard.writeText(prompt);
      } catch {}

      if (window.noticiando) {
        await window.noticiando.invoke("shell:open-external", MYHUB_URL);
      } else {
        window.open(MYHUB_URL, "_blank");
      }
    },
    [duration]
  );

  return { generate };
}
