import { Composition } from "remotion";
import { ReelsComposition, ReelsCompositionProps } from "./ReelsComposition";
import React from "react";

const DEMO_PROPS: ReelsCompositionProps = {
  category: "investments",
  source_name: "InfoMoney",
  news_title: "Demo",
  scenes: [
    {
      id: "scene_1",
      headline: "MERCADO EM CHOQUE",
      subtext: "O Banco Central surpreendeu com alta de 0,75 ponto",
      duration_seconds: 2.5,
      visual_type: "hook",
      accent_word_indices: [0, 2],
    },
    {
      id: "scene_2",
      headline: "SELIC SOBE PARA 13,75%",
      subtext: "Maior nível desde 2017 — analistas não esperavam",
      duration_seconds: 3.5,
      visual_type: "data",
      accent_word_indices: [2],
    },
    {
      id: "scene_3",
      headline: "BOLSA DESPENCA 2,4%",
      subtext: "Ibovespa fecha abaixo dos 120 mil pontos",
      duration_seconds: 3.5,
      visual_type: "context",
      accent_word_indices: [1],
    },
    {
      id: "scene_4",
      headline: "SIGA E INVISTA MELHOR",
      subtext: "Atualizações diárias do mercado financeiro",
      duration_seconds: 3.0,
      visual_type: "cta",
      accent_word_indices: [],
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
