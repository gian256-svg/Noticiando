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
   - Roda em cascata inteligente: **Gemini 2.5 Flash** (Chave 1) → **Gemini 2.5 Flash** (Chave 2) → **Groq (Llama 3.3)** → **Ollama (Local)**.
   - Transforma a notícia em um roteiro de vídeo vertical 9:16 estruturado em JSON com indexação de palavras-chave para destaque visual.
2. **Locução Brasileira (ElevenLabs):**
   - Consolida os subtextos do roteiro de cenas.
   - Envia para a API ElevenLabs usando o modelo **Multilingual v2** com a voz premium **Antoni** (`ErXwobaYiN019PkySvjV`), gerando uma narração em português brasileiro fluida e profissional.
3. **Sonorização por Nicho (Epidemic Sound):**
   - Seleciona automaticamente uma trilha de fundo licenciada do Epidemic Sound correspondente à categoria do vídeo (ex: eletrônico para cripto, dinâmico para investimentos).
4. **Footage / B-Roll Matcher (Envato Elements):**
   - Busca no catálogo do Envato Elements assets de stock footage relacionados ao tópico da notícia para enriquecer o visual do vídeo.
5. **Renderização de MP4 (Remotion CLI):**
   - Agrega as cenas, imagem de destaque, narração ElevenLabs e trilha Epidemic Sound.
   - Executa `remotion render` de forma assíncrona com codec `H.264` e compatibilidade de pixels `yuv420p` para perfeita reprodução em dispositivos móveis e redes sociais.

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
