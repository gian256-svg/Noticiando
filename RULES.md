# 📋 NOTICIANDO — Regras Editoriais e Diretrizes de Evolução

> Este arquivo é a fonte da verdade do projeto. Todo agente, desenvolvedor ou IA que
> trabalhar no Noticiando **deve ler este arquivo antes de qualquer modificação**.
> Atualize-o sempre que uma regra nova for estabelecida ou uma antiga for revisada.

---

## 1. Propósito e Nicho Editorial

O Noticiando é uma **central de inteligência de conteúdo financeiro** voltada para a
produção de Reels virais pelo **Grupo Primo** (Thiago Nigro, Bruno Perini e equipe).

### ✅ Conteúdo ACEITO (dentro do nicho)
| Categoria | Exemplos de temas válidos |
|---|---|
| `investments` | Ações (B3, NYSE, NASDAQ), FIIs, dividendos, análises de empresas, IPOs, earnings |
| `economy_br` | Selic, IPCA, PIB, câmbio, Banco Central, política fiscal, Fazenda, Copom |
| `economy_int` | Fed, BCE, juros globais, recessão, PMI, inflação internacional, commodities |
| `geopolitics` | Guerras com impacto econômico, sanções, relações comerciais, petróleo geopolítico |
| `crypto` | Bitcoin, Ethereum, stablecoins, regulação cripto, ETFs de cripto |

### ❌ Conteúdo VETADO (fora do nicho)
- Esportes, celebridades, entretenimento, lifestyle (ex: vinho do Cristiano Ronaldo)
- Jogos eletrônicos (ex: GTA 6)
- Fofoca ou notícias de interesse humano sem impacto financeiro
- Copa do Mundo, convocações, futebol em geral (exceto se envolver negócio/ativo financeiro)
- Tecnologia sem relação com mercado financeiro ou cripto

---

## 2. Regras de Fontes RSS

### Fontes aprovadas e categorias corretas
| Fonte | Categoria Correta | Observação |
|---|---|---|
| InfoMoney | `investments` | Alta qualidade, geralmente traz imagens |
| Valor Econômico | `economy_br` | Premium, muitas vezes sem imagem no RSS |
| Exame | `economy_br` | ⚠️ Publica conteúdo fora do nicho — **filtrar por palavras-chave** |
| Forbes Brasil | `investments` | Bom, mas mistura lifestyle |
| CNN Brasil | `economy_br` | Conteúdo amplo — usar filtro de relevância |
| Folha Mercado | `economy_br` | Seção específica de mercado, geralmente OK |
| G1 Economia | `economy_br` | Às vezes inclui tecnologia e comportamento |
| Investing.com BR | `investments` | Ótimo foco, mas bloqueia og:image (usar GenerativeThumbnail) |
| Bloomberg | `economy_int` | Excelente foco mas bloqueia scraping |
| Reuters | `economy_int` | Bom foco, às vezes bloqueia |
| Financial Times | `economy_int` | Paywall — RSS limitado |
| Wall Street Journal | `economy_int` | Paywall — RSS limitado |
| BBC Business | `economy_int` | Bom para notícias internacionais |
| The Guardian Economy | `geopolitics` | Bom para macro e geopolítica |

### Regra de filtro obrigatório por fonte
Fontes que publicam além do nicho (`Exame`, `Forbes Brasil`, `CNN Brasil`, `G1`) devem
ter seus artigos filtrados pelo **scorer de relevância** antes de entrar no banco.
Artigos com `viral_score < 10` após o score de nicho devem ser descartados silenciosamente.

---

## 3. Regras do Viral Scorer

O `viral_score` deve refletir o potencial de engajamento financeiro, não popularidade geral.

### Novo Sistema Ponderado de Relevância (Teto 100)
1. **Mix Ponderado de Fontes (Máx +30 pts):**
   - **Tier 1 (Alta Credibilidade/Foco):** +10 pontos por fonte (ex: *InfoMoney*, *Valor Econômico*).
   - **Tier 2 (Especializadas/Nacionais):** +6 pontos por fonte (ex: *Brazil Journal*, *NeoFeed*, *Poder360*, *JOTA*).
   - **Tier 3 (Amplas/Lifestyle):** +3 pontos por fonte (ex: *Exame*, *Forbes Brasil*, *CNN Brasil*, *G1*, *UOL Economia*).
2. **Palavras-chave Financeiras (Máx +15 pts):** "Selic", "Fed", "Bitcoin", "ações", "juros", "IPCA" etc.
3. **Números e Dados (+10 pts):** Presença de métricas (porcentagens, valores monetários).
4. **Impacto Direto ao Investidor (+10 pts):** Decisões de investimento e rentabilidade.
5. **Nome de Empresa/Ticker (+8 pts):** Menção a marcas ou códigos de negociação (ex: PETR4, VALE3).
6. **Bônus de Cruzamento Inter-Categorias (+10 pts):** Adicionado caso a mesma notícia repercuta em fontes com categorias de foco distintas (ex: uma fonte de Cripto e outra de Economia Internacional), demonstrando impacto sistêmico.
7. **Penalidade Extra-Nicho (-50 pts):** Descarte imediato caso contenha termos vetados (futebol, celebridades, etc.).

### Fatores de Decaimento Temporal por Categoria
O decaimento temporal (`_freshness_score`) é ajustado conforme o dinamismo inerente à categoria:
* **Crypto (2.0x) / Investments (1.5x):** Decaimento acelerado devido à velocidade orgânica desses mercados.
* **Geopolitics (0.5x) / Economy_int (0.5x):** Decaimento muito suave para que conflitos e decisões macroeconômicas globais fiquem em destaque por mais tempo.
* **Demais categorias (1.0x):** Fator padrão de envelhecimento.

### Validação Cruzada Anti-Fake News (Tier 3)
* Fontes com `require_cross_reference=True` (*UOL Economia*, *Exame*, *Forbes*, *CNN*, *G1*) têm suas notícias geradas em estado inativo (`is_active = False`).
* **Regra de Correspondência:** A notícia só é ativada (`is_active = True`) quando o crawler detecta similaridade semântica (limiar de cosseno `Cosine Similarity >= 0.65`) com outro artigo de fonte independente. Isso garante que fake news não vazem para a timeline sem validação cruzada.


---

## 4. Regras de Thumbnails

### Ordem de prioridade para imagens
1. `media:thumbnail` do RSS (mais confiável)
2. `media:content` sem type obrigatório
3. `media:group > media:content`
4. `enclosure` (qualquer tipo)
5. `content:encoded` → primeiro `<img>` (incluindo `data-src`, `data-lazy-src`)
6. Fetch de `og:image` / `twitter:image` da página do artigo (pode falhar por bloqueio)
7. **`GenerativeThumbnail`** — sempre disponível como fallback final

### Regra do GenerativeThumbnail
- Deve usar cores **vibrantes e distintas** por categoria (não escuras similares ao fundo)
- Deve exibir: categoria label, título truncado, fonte, score ring
- Nunca deve ser confundido com um fundo vazio

### Fontes que sempre bloqueiam og:image (ignorar tentativa de fetch)
- `investing.com` / `br.investing.com`
- `bloomberg.com`
- `wsj.com`
- `ft.com`
- `valoreconomico.com`

Para essas fontes, pular direto para `GenerativeThumbnail` sem tentar o fetch (economiza tempo e evita erros).

---

## 5. Regras de Real-Time Feed

### Arquitetura obrigatória
- **SSE (Server-Sent Events)** é o canal primário de push de novas notícias
- **Polling a cada 2 minutos** como fallback confiável (não depender apenas de SSE)
- O backend deve emitir `{"event": "idle"}` ao final de **cada** ciclo de crawl, mesmo sem novos itens

### Fetch de notícias (frontend)
- O hook `fetchNews` **deve sempre passar** `min_score=0&period=24h` na query. O endpoint `/news` tem defaults `min_score=10.0` e `period=6h` que filtram a maioria das notícias.
- **A filtragem por score, categoria e período é responsabilidade do `feedStore`**, não do backend.
- O debounce de 30s em `fetchNews` existe para evitar chamadas excessivas durante polling. **No handler do evento SSE `idle`, resetar `lastFetchRef.current = 0` antes de chamar `fetchNews()`** — caso contrário o re-fetch pós-crawl é bloqueado silenciosamente.
- O handler `sse.onerror` deve fechar a conexão, limpar o intervalo e reconectar via `startPolling()` após 5 segundos. Não apenas setar status de erro.
- **Busca de notícias imediata no startup**: Ao inicializar o Noticiando (seja no `startPolling` ou no evento `backend:ready`), o app deve imediatamente disparar um ciclo de crawl chamando `POST /crawl/trigger` para o backend, garantindo notícias atualizadas sem precisar aguardar o tempo de espera configurado.

**Arquivo:** `src/renderer/hooks/useNewsFeed.ts`

### appendNews e thumbnails
- `appendNews` no `feedStore` deve **backfillar `thumbnail_url`** em itens cujo ID já existe no estado mas que agora têm thumbnail: o crawler faz og:image enrichment assíncrono e envia os itens atualizados via SSE — ignorar IDs duplicados sem verificar thumbnail causa thumbs faltando permanentemente.
- Padrão: separar `newItems` (IDs novos) de `thumbUpdates` (IDs existentes com thumbnail novo), aplicar ambos.

**Arquivo:** `src/renderer/store/feedStore.ts`

### Ordenação do feed
1. **Data de publicação** (mais recente primeiro)
2. **Viral score** como critério de desempate dentro do mesmo minuto

### Timestamps
- Todos os timestamps devem ser armazenados e transmitidos em **UTC com sufixo Z**
- O frontend deve re-renderizar os timestamps a cada **60 segundos** via `useRelativeTimeTick`
- Nunca usar `.replace(tzinfo=...)` em Python — sempre usar `.astimezone(timezone.utc)`

---

## 6. Regras de Geração de Vídeo (Reels)

### Fluxo do usuário
1. Seleciona notícia no feed
2. Clica em **"Gerar Reels"** (geração autônoma via cascade de IA)
3. **OU** clica em "Abrir no myhub" → copia prompt → obtém roteiro → cola na seção "Cole o roteiro do agente"

### Cascade de providers (ordem obrigatória)
`Gemini (primary key) → Gemini (secondary key) → Groq → Ollama`

- **Anthropic/Claude não é usado neste projeto.** Não adicionar `ANTHROPIC_API_KEY` nem o pacote `anthropic`.
- Todas as chaves ficam exclusivamente em `backend/.env` — nunca hardcodar.
- Após cada provider call, **validar que o resultado contém o campo `"scenes"`**. Se ausente, tratar como falha de provider e tentar o próximo — nunca retornar HTTP 200 com JSON sem "scenes".

### Diretrizes Gráficas e Tipografia (Diretor de Arte DESIGN.md / The Economist Style)
Abaixo estão as 10 regras globais de ajuste fino de qualidade baseadas no estilo @theeconomist / documentário premium:

1. **CENTRALIZAÇÃO GLOBAL (CRÍTICA):** Todo conteúdo visual deve estar centralizado na tela verticalmente e horizontalmente. Headline deve estar centralizado horizontalmente entre 15% e 35% do topo. Subtext centralizado logo abaixo. Elementos importantes nunca devem ficar fora dos 10%-90% de altura.
2. **INFORMAÇÃO ÚNICA (SEM REPETIÇÃO):** Nunca exibir a mesma informação duas vezes na mesma cena. O dado grande e animado é o elemento principal, sem duplicar na headline.
3. **GRÁFICOS SEMPRE ANIMADOS:** Todo gráfico deve ter animação. Gráficos de linha usam `strokeDashoffset` crescendo da esquerda para a direita (60% do tempo). Gráficos de barras crescem com `scaleY` em cascata (delay de 4 frames). Counters contam de 0 até o valor final durante 70% da cena. Linhas de timeline horizontal crescem da esquerda para a direita com marcadores aparecendo com `spring()`.
4. **LOGOS DE EMPRESAS/MARCAS:** Sempre exibir o logo se mencionado. Buscar via site oficial/Clearbit, Wikipedia ou Gemini. Exibir sem caixa branca de fundo (usar `mix-blend-mode: "screen"` ou `"luminosity"`), tamanho máximo de 35% da tela, centralizado abaixo do safe zone superior. Entrada com spring fade + scale 0.85 -> 1.0.
5. **B-ROLL E FOOTAGES ÚNICOS:** Anti-repetição obrigatória. Cada cena deve ter footage único, nunca reutilizar clipes de cenas anteriores. B-roll real sempre fullscreen com overlay gradiente.
6. **CONTRASTE E LEGIBILIDADE:** Texto claro em fundo escuro e vice-versa. Textos sobre imagens/vídeos devem possuir sombra forte (`textShadow: "0 2px 20px rgba(0,0,0,0.95), 0 1px 6px rgba(0,0,0,1)"`). Vídeos/B-rolls devem ter overlay gradiente escuro (`linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 45%, transparent 100%)`).
7. **PRINTS DE MANCHETES REAIS:** Adicionar recortes de notícias reais com bordas arredondadas (8px), sombra profunda (`boxShadow: "0 8px 32px rgba(0,0,0,0.8)"`) e leve rotação aleatória (-2° a +2°). Em caso de múltiplas fontes, exibir em cascata (delay de 8 frames). Nunca inventar notícias ou headlines.
8. **TEMPO DE CENA (PACE):** Duração mínima por tipo: B-roll real mínimo 4s além do áudio. Recortes de manchete mínimo 3.5s por recorte. Cenas editoriais com dados mínimos 3s após o contador terminar. Gráficos animados completam animação + 1.5s. Fórmula: `duração_cena = max(duração_áudio + 0.5s, duração_mínima_por_tipo)`.
9. **TELAS DE IMPACTO REAIS:** Apenas usar texto comprovável com fonte real. Usar manchetes de verdade, nunca simular subtítulos de matérias ou headlines fictícios.
10. **ESTILO VISUAL PREMIUM:** Tipografia forte (Headline 3x maior que subtext). Contraste dramático. Badge de editoria ("FINANÇAS", "ECONOMIA") no topo. Linha divisora fina abaixo do headline. Textura de fundo e ticker lento em movimento.

* **Elementos Obrigatórios por Reel:**
  - Pelo menos **2 cortes de vídeo real** fullscreen.
  - Pelo menos **3 recortes fotográficos** grandes.
  - Pelo menos **2 elementos gráficos decorativos** animados.

### Configurações de Locução (ElevenLabs)
* **Voice Model:** `eleven_multilingual_v2`
* **Definições de Voz:** 
  - **Stability (Estabilidade):** Entre 35% e 45% (0.35 - 0.45). Valores menores que 30% causam instabilidade, enquanto acima de 70% deixam a voz monótona e robótica. Entre 35% e 45%, a IA consegue aplicar a emoção correta ao texto.
  - **Similarity (Similaridade):** 75% a 85% (0.75 - 0.85). Equilibra a fidelidade da voz sem causar distorções ou artefatos digitais no áudio.
  - **Style Exaggeration (Exagero de Estilo):** 0% a 15% (0.0 - 0.15). Mantenha próximo de zero. Um valor muito alto pode fazer a IA "forçar" a barra na emoção, gerando um resultado artificial.
  - **Speaker Boost:** Ativado (True). Melhora a clareza e a textura natural da voz, principalmente em gravações clonadas.
* **Pré-Processamento e Dicas de Ouro para a formatação do texto:** 
  - A IA lê o que está escrito. Se quiser pausas mais longas, utilize sinais de pontuação adequados (como reticências) ou insira `<break time="2s" />` caso esteja usando a interface de edição avançada.
  - Evite emojis e símbolos matemáticos misturados com as palavras, pois isso costuma confundir a pronúncia do modelo.
  - Use abreviações (ex: "R$" em vez de "reais") de forma consistente para guiar o ritmo correto da locução.

### Configurações de Trilha (Epidemic Sound)
* **Mixagem de Áudio:** Volume da trilha de fundo em `0.70` base (reduzido automaticamente para `0.38` sob locução), e volume da narração em `1.0`.
* **Duck Automático:** Reduzir o volume da música de fundo em **45%** automaticamente durante os períodos em que a narração do áudio estiver ativa.
* **Fades:** Fade-in de `0.5s` no início da música e fade-out de `1.0s` antes do encerramento completo do vídeo.

### Composição Remotion
- Resolução obrigatória: **1080×1920** (vertical 9:16)
- FPS: **30**
- Exportar sempre como MP4 na pasta Downloads do usuário
- Módulos `@remotion/cli`, `@remotion/bundler`, `@remotion/renderer` devem ficar no `vite.config` como `external` (são Node.js-only)

---

## 7. Regras de Arquitetura

### IPC Electron ↔ Python Sidecar
- Toda comunicação usa `window.noticiando.invoke(channel, ...args)`
- Nunca acessar `window.noticiando` sem verificar `if (!window.noticiando?.invoke)`
- Handlers IPC sempre retornam `{ error: string }` em caso de falha, nunca lançam exceção
- O renderer nunca chama `child_process` diretamente

### Banco de dados
- SQLite via SQLAlchemy no sidecar Python
- Electron usa `better-sqlite3` apenas para scripts salvos localmente
- `electron-store` para configurações persistentes (API keys, preferências)

### Estado global (Zustand)
- `feedStore` — notícias, filtros, status do crawler
- `configStore` — configurações do usuário
- `scriptStore` — script atual, formato, duração

---

## 8. Evolução Planejada (Backlog Concluído e Futuro)

### 🟢 Funcionalidades Ativadas e Concluídas
- [x] **Integração ElevenLabs e Epidemic Sound:** Locução profissional brasileira e sonorização de fundo com ducking de 40% na pipeline de Reels.
- [x] **Cortes de YouTube via yt-dlp:** Busca e download de trechos iniciais de 10s no YouTube em tempo real na pipeline backend com fallbacks categorizados.
- [x] **Recortes (Cutouts) e Ilustrações:** Imagens de sticker transparentes grandes e jornalísticas servidas e orquestradas pela pipeline do sidecar Python.
- [x] **Remotion Fullscreen UI & Sincronia:** Duração +0.5s perfeitamente ajustada e componentes Ken Burns cravados para o padrão documentário The Economist.

### 🔴 Alta prioridade
- [ ] Filtro de nicho no backend: aplicar penalidade −50 em artigos fora do nicho antes de salvar
- [ ] Thumbnails: pular fetch de og:image para domínios que sempre bloqueiam (bloomberg, wsj, ft, investing)

### 🟡 Média prioridade
- [ ] Notificação desktop quando viral_score > 80
- [ ] Exportação MP4 via Remotion headless funcionando end-to-end
- [ ] Histórico de roteiros salvos (lista de scripts)
- [ ] Multi-idioma: tradução automática de notícias EN → PT antes de exibir

### 🟢 Baixa prioridade / Futuro
- [ ] Remove.bg para recortes automatizados adicionais de personagens no estilo colagem
- [ ] Painel de analytics: quais categorias geram mais engajamento
- [ ] Modo dark/light toggle

---

---

## 9. Dependências Python e Sistema

- `yt-dlp` é obrigatório para corte automático de vídeos do YouTube.
- `feedparser>=6.0.0` é obrigatório — usado pelo crawler RSS.
