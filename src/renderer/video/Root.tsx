import { Composition } from "remotion";
import { ReelsComposition, ReelsCompositionProps } from "./ReelsComposition";
import React from "react";

const DEMO_PROPS: ReelsCompositionProps = {
  category: "investments",
  source_name: "InfoMoney",
  news_title: "Selic sobe para 13,75%",
  scenes: [
    {
      id: "scene_1",
      headline: "MERCADO EM CHOQUE",
      subtext: "O Banco Central surpreendeu com alta de 0,75 ponto na taxa Selic",
      duration_seconds: 2.5,
      visual_type: "hook",
      accent_word_indices: [0, 2],
      decorator_type: "star",
    },
    {
      id: "scene_2",
      headline: "SELIC SOBE PARA 13,75%",
      subtext: "Maior nível desde 2017. Decisão foi unânime entre os diretores do BC.",
      duration_seconds: 3.5,
      visual_type: "video",
      accent_word_indices: [2],
      youtube_search: "banco central brasil taxa juros selic",
      decorator_type: "arrow",
    },
    {
      id: "scene_3",
      headline: "BOLSA DESPENCA 2,4%",
      subtext: "Ibovespa fecha abaixo dos 120 mil pontos pela primeira vez no mês",
      duration_seconds: 3.5,
      visual_type: "cutout",
      accent_word_indices: [1],
      decorator_type: "circle",
    },
    {
      id: "scene_4",
      headline: "INFLAÇÃO AINDA PRESSIONADA",
      subtext: "IPCA acumulado em 12 meses chega a 6,8%, acima da meta",
      duration_seconds: 3.0,
      visual_type: "data",
      accent_word_indices: [0],
      decorator_type: "stripes",
    },
    {
      id: "scene_5",
      headline: "SIGA E INVISTA MELHOR",
      subtext: "Atualizações diárias do mercado financeiro",
      duration_seconds: 2.5,
      visual_type: "cta",
      accent_word_indices: [],
      decorator_type: "none",
    },
  ],
};

const TOTAL_FRAMES = Math.round(
  (DEMO_PROPS.scenes ?? []).reduce((acc, s) => acc + s.duration_seconds, 0) * 30,
);

export const Root: React.FC = () => (
  <Composition
    id="Reels"
    component={ReelsComposition}
    durationInFrames={TOTAL_FRAMES}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={DEMO_PROPS}
  />
);
