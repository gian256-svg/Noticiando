# 🧠 CEREBRO — O Comandante do Noticiando

```
      _____  ______ _____  ______ ____  _____   ____  
     / ____||  ____|  __ \|  ____|  _ \|  __ \ / __ \ 
    | |     | |__  | |__) | |__  | |_) | |__) | |  | |
    | |     |  __| |  _  /|  __| |  _ <|  _  /| |  | |
    | |____ | |____| | \ \| |____| |_) | | \ \| |__| |
     \_____||______|_|  \_\______|____/|_|  \_\\____/ 
                                                      
```

Bem-vindo ao **CEREBRO**, o comandante central de processos, dados e distribuição de tarefas do **Noticiando**. 
Este arquivo dita o funcionamento da pipeline e a orquestração do sistema. Ele é lido automaticamente na inicialização para inspecionar diretrizes e aplicar as regras de negócio em tempo real.

---

## 🛰️ 1. Torre de Controle & Distribuição de Tarefas

O **CEREBRO** gerencia duas pipelines principais de forma assíncrona e resiliente:

### 📥 Pipeline A: Coleta, Filtro & Scoring (Feed de Notícias)
1. **RSS Crawler:** Disparado a cada ciclo (`CRAWL_INTERVAL_MINUTES`). Varre as fontes de notícias de forma assíncrona (`crawl_all_sources`).
2. **Filtro de Relevância / Nicho:** 
   - Executa `_is_off_topic()` aplicando uma varredura rigorosa com base nas palavras-chave de penalidade de `RULES.md`.
   - Se o artigo contiver termos fora do nicho financeiro (esportes, fofocas, entretenimento), é sumariamente descartado.
3. **Enriquecimento de Miniaturas (og:image):**
   - Varre as páginas em busca de metadados visuais.
   - Pula automaticamente sites sob paywall ou que bloqueiam raspagem (`bloomberg.com`, `wsj.com`, `ft.com`, `investing.com`), delegando ao frontend o fallback para o `GenerativeThumbnail`.
4. **Scoring Viral:**
   - Calcula o score composto (0–100) cruzando multiplicadores de fontes, keywords de engajamento, frescor temporal e penalidades.
   - Se o score for inferior a `10.0`, o artigo não é salvo (ou é desativado se já existir).
5. **Notificação SSE (Live-Update):** Dispara atualizações em tempo real para o frontend Electron através do canal Server-Sent Events (SSE).

### 🎬 Pipeline B: Criação de Conteúdo & Sonorização (Geração de Reels)
1. **Geração de Cenas (LLMs):**
   - Roda em cascata inteligente: **Gemini 2.5 Flash** (Chave 1) → **Gemini 2.5 Flash** (Chave 2) → **Groq (Llama 3.3)** → **OpenRouter (Llama/Gemma)** → **Ollama (Local)**.
   - Transforma a notícia em roteiro híbrido vertical 9:16: cada cena especifica `visual_type` (`hook/video/cutout/illustration/data/cta`), `youtube_search` para b-roll e `decorator_type` para elementos gráficos.
2. **Enriquecimento de Mídia por Cena (`media_fetcher.py`):**
   - **B-Roll YouTube** (`fetch_youtube_broll`): para cenas `visual_type: "video"`, baixa os primeiros 10 segundos do clip via yt-dlp usando `youtube_search` contextual e específico da cena. Cache em `output/media/broll_*.mp4`. Fallbacks categorizados em caso de falha.
   - **Fotos da Matéria** (`fetch_article_photos`): extrai og:image / imagens do artigo para usar em cenas `cutout`. Salvo em `output/media/photo_*.jpg`.
3. **Locução Brasileira (ElevenLabs):**
   - Consolida os subtextos do roteiro de cenas em script corrido.
   - Envia para ElevenLabs **Multilingual v2**, voz **Antoni** (`ErXwobaYiN019PkySvjV`). **SEMPRE chamada** — nunca pular mesmo que o script seja curto.
   - Salvo localmente em `output/narration_*.mp3` e servido via `http://localhost:8765`.
4. **Trilha Sonora por Nicho (Epidemic Sound + fallback yt-dlp):**
   - Tenta buscar e baixar track via **Epidemic Sound API** (Bearer JWT). Endpoints: `/v2/tracks?tags={category_tags}`.
   - Fallback automático: download via yt-dlp de música royalty-free do YouTube Audio Library.
   - **OBRIGATÓRIO: trilha SEMPRE baixada localmente** em `output/media/music_*.mp3` antes do render — nunca usar URL externa no Remotion.
   - Cache por categoria, válido por 7 dias.
5. **Renderização de MP4 (Remotion CLI):**
   - Agrega todas as cenas com `media_url` / `cutout_url` / `decorator_type` preenchidos, narração e trilha locais.
   - Executa `remotion render` com codec `H.264` e `yuv420p` para compatibilidade mobile/social.

### 🚨 Padrão de Qualidade Visual Obrigatório (enforce por cena)
- **Não Repetição de Imagens:** É proibido repetir imagens idênticas ao longo do vídeo.
- **Recortes e Contornos de Stickers:** As imagens em cenas de recorte (`cutout` ou `illustration`) devem ter recortes limpos e nítidos, **sem feather (suavização de borda)**. O contorno/borda de sticker deve ser branco sólido com **cerca de 4px de espessura, sem blur** nas bordas.
- **Empilhamento Vertical (Anti-Overlap):** O texto é empilhado na parte superior da tela e o asset visual/gráfico é renderizado na metade inferior para evitar sobreposição de elementos.
- **Moldura Scrapbook:** Cutouts e illustrations são envolvidos em um contêiner com fundo tracejado (`2px dashed`) deslocado em rotação.
- **Setas Contextuais:** Setas apontam apenas para ativos presentes na tela. Caso não haja ativos, a seta faz fallback para estrela.
- **Variedade de Gráficos:** Alternância entre Bar Chart, Line Area Chart e Donut Chart a cada cena de dados (`sceneIndex % 3`), expandidos a 580px e sem marcas d'água "Noticiando".
- **Rolagem de Números:** Qualquer cena que declare porcentagens ou métricas no texto do roteiro deve renderizar o componente `<BigMetricCounter>` para rolagem dinâmica de números.
- **Footage Real & Downloads:** Há liberdade e obrigação de buscar e baixar footages de vídeo reais (via yt-dlp) para enriquecer o Reel.
- **Mínimo 2 cenas `visual_type: "video"`** em fullscreen com B-roll baixado (10s de footage).
- **Mínimo 3 cenas `visual_type: "cutout"`** com foto da matéria posicionada e animada.
- **Narração ElevenLabs SEMPRE gerada** (nunca retornar reel sem locução).
- **Trilha sonora SEMPRE arquivo local** — nunca usar URLs externas no Remotion.
- **LLM DEVE retornar `youtube_search` e `decorator_type` em 100% das cenas.**
- Se yt-dlp falhar, cena usa `visual_type: "illustration"` como fallback.

---

## 📝 2. Protocolo de Inicialização & Auditoria Contínua

Sempre que o **Noticiando** inicia, o **CEREBRO** executa o protocolo de auditoria de sistema:

1. **Leitura de Regras (`RULES.md`):** Carrega as diretrizes estéticas (paletas de cores HSL, tipografia Montserrat/Inter, cards sticky de maior score viral, botões premium com shimmer sweep) e as palavras-chave do nicho financeiro.
2. **Diretrizes de Direção de Arte (`DESIGN.md`):** Valida os conceitos visuais, as paletas de cores específicas por nicho de notícia, transições físicas de mola e animação lenta de câmera (Ken Burns).
3. **Varredura de Bugs (`BUGS.md`):** Analisa bugs ativos e pendentes de resolução para orientar as prioridades do sistema e evitar regressões de código.
4. **Checagem de Saúde de APIs:** Testa as chaves e tokens em `backend/.env` e expõe o status unificado.

---

## 🚩 3. Diretrizes de Desenvolvimento (Para o Agente de IA)

Ao atuar no codebase do **Noticiando**, você deve SEMPRE agir sob o comando do **CEREBRO**:
- **Consulte `RULES.md`:** Qualquer alteração no frontend React ou no renderizador Remotion deve obedecer fielmente ao design system premium implementado.
- **Consulte `DESIGN.md`:** Respeite rigorosamente a direção de arte e estética dos vídeos verticais (fontes, paletas de nicho, animação Ken Burns e grão analógico).
- **Consulte `BUGS.md`:** Ao encontrar ou criar problemas, documente e resolva-os respeitando o histórico deste arquivo.
- **Mantenha a Pipeline Limpa:** Sem hardcoding de chaves API, sem misturar responsabilidades (Python no backend sidecar, TypeScript no app/renderer).
