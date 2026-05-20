# 🐛 NOTICIANDO — Registro de Bugs e Correções

> Cada bug grave deve ser documentado aqui com: causa raiz, impacto, solução aplicada
> e regra para nunca repetir. Leia antes de mexer nas áreas afetadas.

---

## BUG-001 — Timestamps sempre mostrando "agora"

**Data:** 2026-05-18
**Área:** Frontend — `NewsCard.tsx`, `lib/time.ts`
**Severidade:** Média

### Sintoma
Todos os cards do feed exibiam o timestamp como "agora" independente de quando a notícia foi publicada. Notícias de 3h atrás mostravam "agora".

### Causa Raiz
`formatDistanceToNow` calculava o tempo corretamente, mas o componente `NewsCard` **nunca re-renderizava após o mount inicial**. O valor calculado na primeira renderização ficava congelado para sempre.

### Solução Aplicada
Criado hook `useRelativeTimeTick` em `src/renderer/hooks/useRelativeTimeTick.ts`:
```ts
export function useRelativeTimeTick(intervalMs = 60_000): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}
```
Hook chamado em `NewsCard` e `FeaturedCard` — força re-render a cada 60s.

### Regra Para Nunca Repetir
> Qualquer componente que exibe tempo relativo ("5min atrás", "2h") **deve** chamar
> `useRelativeTimeTick()` para manter o valor atualizado.

---

## BUG-002 — Thumbnails ausentes: og:image usando client HTTP fechado

**Data:** 2026-05-18
**Área:** Backend — `backend/crawler/rss_crawler.py`
**Severidade:** Alta

### Sintoma
A fase de enriquecimento de thumbnails via `og:image` não funcionava para nenhum artigo — todos ficavam sem imagem, mesmo para sites que expõem og:image publicamente.

### Causa Raiz
A função `crawl_all_sources` abria um único `httpx.AsyncClient` com `async with`. O bloco `async with` encerrava o client **após o crawl RSS**. A fase 2 de enriquecimento (`_fetch_og_image`) tentava reutilizar o mesmo client — que já estava **fechado** — gerando erros silenciosos em todas as chamadas.

```python
# ❌ ERRADO — client fechado antes do enrich rodar
async with httpx.AsyncClient() as client:
    results = await asyncio.gather(...)   # crawl RSS
    # client ainda aberto aqui...

# client já fechado aqui! ↓
await enrich(item)  # falha silenciosa
```

### Solução Aplicada
Separadas as duas fases com dois clients independentes:
```python
# ✅ CORRETO — Phase 1: RSS crawl
async with httpx.AsyncClient() as rss_client:
    results = await asyncio.gather(...)
# rss_client fechado aqui — OK

# Phase 2: og:image com client NOVO
async with httpx.AsyncClient() as enrich_client:
    await asyncio.gather(*[enrich(item) for item in missing])
```

### Regra Para Nunca Repetir
> Nunca reutilizar um `httpx.AsyncClient` fora do seu bloco `async with`.
> Cada fase de I/O assíncrona que acontece após um `async with` deve abrir seu próprio client.

---

## BUG-003 — Feed sem atualização em tempo real

**Data:** 2026-05-18
**Área:** Frontend + Backend — `useNewsFeed.ts`, `scheduler.py`, `news.py`
**Severidade:** Alta

### Sintoma
O feed não atualizava automaticamente após o crawl do backend. Novas notícias só apareciam após recarregar a página manualmente.

### Causa Raiz (múltipla)
1. **Backend**: O scheduler só emitia evento SSE quando `new_items` não estava vazio. Crawls que não produziam notícias novas não emitiam nenhum evento — o live-dot ficava preso em "crawling".
2. **Frontend**: O polling de fallback usava `crawlInterval * 60 * 1000` (podia ser 5–15 min).
3. **Frontend**: O hook `useNewsFeed` não escutava o evento SSE `"idle"` — não havia forma de saber quando o crawl terminava sem novidades.

### Solução Aplicada
**Backend (`scheduler.py`):** Sempre emitir `{"event": "idle"}` ao final de cada crawl:
```python
# Após commit e notificação de novos itens:
await _notify_sse({"event": "idle"})  # sempre, mesmo sem novos itens
```

**Backend (`news.py`):** Handler SSE agora trata `"crawling"` e `"idle"`:
```python
if event == "crawling":
    yield f"event: crawling\ndata: {{}}\n\n"
elif event == "idle":
    yield f"event: idle\ndata: {{}}\n\n"
```

**Frontend (`useNewsFeed.ts`):** Polling fixo em 2 minutos + listener `"idle"`:
```ts
sse.addEventListener("idle", () => setCrawlerStatus("idle"));
pollRef.current = setInterval(fetchNews, 2 * 60 * 1000); // 2 min fixo
```

### Regra Para Nunca Repetir
> O backend **sempre** deve emitir um evento de conclusão (ex: `"idle"`) ao final de
> operações longas via SSE, independentemente do resultado.
> O polling de fallback nunca deve depender de configuração do usuário para intervalo.

---

## BUG-004 — Notícias fora do nicho financeiro no feed

**Data:** 2026-05-18
**Área:** Backend — `scoring/viral_scorer.py`, `crawler/sources.py`
**Severidade:** Alta (editorial)

### Sintoma
Feed exibindo artigos completamente fora do nicho do Grupo Primo:
- "O vinho da terra de Cristiano Ronaldo pode desaparecer" (Exame)
- "Com Ludmilla e João Gomes: como será a convocação de Ancelotti" (Exame)
- "GTA 6: atraso no lançamento já completou 18 meses" (Exame)

### Causa Raiz
A fonte **Exame** (exame.com) foi marcada como `economy_br` mas publica conteúdo amplo de entretenimento, esportes, tecnologia e lifestyle — muito além do nicho financeiro. O viral scorer não aplicava penalidade por tema irrelevante.

### Solução Necessária (a implementar)
1. Adicionar lista de **palavras de penalidade** no viral scorer (−50 pts):
```python
PENALTY_KEYWORDS = [
    "futebol", "copa do mundo", "seleção", "convocação",
    "gta", "playstation", "game", "jogo eletrônico",
    "celebridade", "ator", "atriz", "cantor", "show",
    "vinho", "gastronomia", "receita", "culinária",
    "novela", "série", "netflix", "moda", "beleza",
]
```
2. Artigos com score < 10 após penalidade não devem ser salvos no banco.
3. Fontes com alto índice de ruído devem ter filtro de palavras-chave obrigatório.

### Regra Para Nunca Repetir
> Ao adicionar uma nova fonte RSS, sempre verificar: "essa fonte publica apenas conteúdo
> financeiro ou é de propósito geral?" Se for de propósito geral, adicionar filtro de
> penalidade por palavras-chave antes de aceitar o artigo.

---

## BUG-005 — TypeError: Cannot read properties of null em handleGenerateVideo

**Data:** 2026-05-18
**Área:** Frontend — `ScriptPanel.tsx`
**Severidade:** Média

### Sintoma
Clicar em "Gerar Reels" exibia: `TypeError: Cannot read properties of null (r...)`

### Causa Raiz (múltipla)
1. O IPC handler `video:generate-scenes` retorna `{ error: "API Key não configurada" }` quando a chave não está configurada — correto. Porém, se o sidecar Python estava **offline**, o `fetch` lançava exceção e o `catch` capturava, mas em outros edge cases o `result` poderia ser `null`.
2. O código fazia `result.error` e `result.scenes` diretamente sem verificar se `result` era não-nulo.
3. Não havia guard verificando se `window.noticiando?.invoke` existe (necessário fora do contexto Electron).

### Solução Aplicada
```ts
// ✅ Guard de contexto Electron
if (!window.noticiando?.invoke) {
  setVideoError("Função não disponível fora do Electron.");
  return;
}

// ✅ Proteção contra null/undefined
const raw = await window.noticiando.invoke("video:generate-scenes", payload);
const result = (raw ?? {}) as { scenes?: unknown[]; error?: string };

// ✅ Verificar scenes?.length (não apenas scenes)
if (result.error || !result.scenes?.length) {
  setVideoError(result.error ?? "Falha — verifique backend e API Key.");
  return;
}
```

### Regra Para Nunca Repetir
> Todo acesso a `window.noticiando` deve ter optional chaining: `window.noticiando?.invoke`.
> Todo resultado de `invoke` deve ser tratado como potencialmente `null` usando `?? {}`.
> Verificar `array?.length` e não apenas `array` para arrays que podem ser vazios.

---

## BUG-006 — Usuário sem campo para colar roteiro gerado pelo MyHub

**Data:** 2026-05-18
**Área:** Frontend — `ScriptPanel.tsx`
**Severidade:** Média (UX)

### Sintoma
O fluxo "Abrir no myhub" funcionava (abria o browser e copiava o prompt), mas após o usuário gerar o roteiro no agente Claude do MyHub, **não havia nenhuma forma de trazer esse roteiro de volta para o Noticiando**.

### Causa Raiz
O `ScriptPanel` foi projetado para o fluxo autônomo (Claude direto via API), mas o fluxo manual via MyHub não tinha etapa de retorno.

### Solução Aplicada
Adicionada seção **"Cole o roteiro do agente"** no `ScriptPanel`:
- Área expansível com `<textarea>` para colar o roteiro
- Preview formatado quando colapsado
- Botões Copiar e Limpar
- Label muda para "✓ Roteiro colado" quando há conteúdo

### Regra Para Nunca Repetir
> Qualquer fluxo que envolva o usuário sair do app para executar uma ação **deve ter
> uma etapa de retorno** — um campo, botão ou modal para trazer o resultado de volta.

---

## BUG-007 — Thumbnails gerativos indistinguíveis do fundo escuro

**Data:** 2026-05-18
**Área:** Frontend — `GenerativeThumbnail.tsx`
**Severidade:** Média (UX)

### Sintoma
O `GenerativeThumbnail` estava renderizando mas parecia um fundo escuro vazio. Usuários não conseguiam distinguir entre "thumbnail funcionando" e "card sem imagem".

### Causa Raiz
As cores das paletas das categorias eram todas tons muito escuros:
- `investments`: `#052e16` (quase preto-verde)
- `economy_br`: `#0a1628` (quase preto-azul)
- `crypto`: `#0a0a1a` (quase preto)

Todas eram visualmente idênticas ao fundo dark do app (`#0A0A0F`).

### Solução Aplicada
Paletas reescritas com cores vibrantes e distintas:
```ts
investments:  { a: "#064e3b", b: "#065f46", c: "#10b981" }  // verde esmeralda
economy_br:   { a: "#1e3a8a", b: "#1d4ed8", c: "#3b82f6" }  // azul royal
geopolitics:  { a: "#7c2d12", b: "#c2410c", c: "#f97316" }  // laranja profundo
crypto:       { a: "#713f12", b: "#a16207", c: "#eab308" }  // âmbar/dourado
```

### Regra Para Nunca Repetir
> Cores de fallback/placeholder nunca devem ser similares ao fundo do app.
> Sempre testar visualmente: "se eu esconder a label, consigo perceber que há conteúdo aqui?"

---

---

## BUG-008 — "Gerar Reels" inoperante no modo browser (sem Electron IPC)

**Data:** 2026-05-18
**Área:** Frontend — `ScriptPanel.tsx`
**Severidade:** Crítica

### Sintoma
No modo web (`npm run web`), clicar em "Gerar Reels" exibia "Função não disponível fora do Electron." e abortava sem chamar o backend.

### Causa Raiz
`handleGenerateVideo` verificava `window.noticiando?.invoke` (exclusivo do preload Electron) e retornava erro se ausente, sem fallback via fetch HTTP.

### Solução Aplicada
Adicionada bifurcação: se `window.noticiando?.invoke` existe → IPC Electron; caso contrário → `fetch` direto ao endpoint `POST /generate-video-scenes` do backend.

### Regra Para Nunca Repetir
> Toda feature que consome o backend deve ter dois caminhos: IPC (Electron) e fetch REST (browser). Nunca assumir que `window.noticiando` existe.

---

## BUG-009 — Scheduler emite `crawling` mas nunca `idle` quando crawl retorna 0 items

**Data:** 2026-05-18
**Área:** Backend — `crawler/scheduler.py`
**Severidade:** Alta

### Sintoma
Quando o crawl retornava 0 itens (falha de rede ou feeds vazios), o live-dot ficava preso em estado "crawling" para sempre. O frontend nunca sabia que o ciclo havia terminado.

### Causa Raiz
`run_crawl()` fazia `return` imediato após logar "Crawl returned 0 items", pulando o `_notify_sse({"event": "idle"})` que vem no final da função.

### Solução Aplicada
Adicionado `await _notify_sse({"event": "idle"})` antes do `return` antecipado.

### Regra Para Nunca Repetir
> Toda função que emite um evento de início (`crawling`) **deve garantir** emitir o evento de término (`idle`) em todos os caminhos de saída — inclusive os de erro e retorno antecipado.

---

## BUG-010 — Feed não atualiza após ciclo de crawl sem itens novos

**Data:** 2026-05-18
**Área:** Frontend — `useNewsFeed.ts`
**Severidade:** Alta

### Sintoma
O feed parava de atualizar visualmente após ciclos de crawl que não produziam itens novos. Scores virais re-calculados no backend não apareciam. A página ficava estática até reload manual.

### Causa Raiz
O evento SSE `idle` apenas atualizava o status do live-dot (`setCrawlerStatus("idle")`), mas não disparava `fetchNews()`. Sem re-fetch, scores atualizados e novos artigos de repositório existente nunca chegavam ao frontend.

### Solução Aplicada
```ts
sse.addEventListener("idle", () => { setCrawlerStatus("idle"); fetchNews(); });
```
Agora após cada ciclo de crawl o frontend re-fetcha o feed completo.

### Regra Para Nunca Repetir
> O evento `idle` do SSE sinaliza fim de ciclo — o frontend **sempre** deve re-buscar o feed ao recebê-lo, não apenas atualizar o indicador visual.

---

## BUG-011 — Notícias param de atualizar após abrir Roteiro / gerar Reels devido a bloqueios e dessincronização de intervalo

**Data:** 2026-05-19
**Área:** Backend + Frontend — `useNewsFeed.ts`, `configStore.ts`, `scheduler.py`, `config.py`
**Severidade:** Alta

### Sintoma
Ao abrir o painel de roteiro ou gerar Reels, as notícias no feed paravam de atualizar. Além disso, a frequência de atualização (ex: 5 min) configurada pelo usuário na interface não era aplicada no backend.

### Causa Raiz
1. **Dessincronização de Intervalo**: O frontend armazenava `crawlInterval` localmente, mas nunca enviava essa configuração ao backend via endpoint `PUT /config`. O backend continuava executando com o intervalo padrão (2 min).
2. **Loop de Erro no SSE**: No frontend, quando ocorria um erro no SSE (por exemplo, devido a instabilidade de conexão), a função `startPolling()` era recriada integralmente a cada 5 segundos. Isso causava chamadas excessivas a `setLoading(true)` (travando a UI com spinner) e criava loops de requisições que podiam travar a fila.
3. **Bloqueio de Thread**: O download do B-roll no backend via `yt-dlp` era síncrono e bloqueava o loop principal da API, fazendo com que requisições de status do SSE expirassem no frontend, derrubando o stream. (Embora threads tenham sido introduzidas na sessão anterior, a instabilidade da conexão por conta de reconexões agressivas do frontend ainda persistia).

### Solução Aplicada
1. **Sincronização de Configuração**: Modificada a ação `setCrawlInterval` no Zustand `configStore.ts` e o `useEffect` de inicialização no `App.tsx` para sincronizar o intervalo de crawl via chamada HTTP `PUT /config` ao backend.
2. **Rescheduling no Backend**: Implementada a função `reschedule_crawler(minutes)` no `scheduler.py` do backend, que é acionada pelo endpoint `PUT /config` para atualizar dinamicamente a frequência do APScheduler.
3. **Refatoração Resiliente do Frontend**:
   - Isolada a conexão do SSE (`connectSSE`) para rodar e reconectar de forma silenciosa no background sem disparar `setLoading(true)` repetidamente.
   - O spinner de carregamento global só é ativado se o feed estiver completamente vazio (carregamento inicial).
   - O fallback de polling de notícias agora lê dinamicamente do `crawlInterval` do usuário e limpa o intervalo anterior corretamente antes de agendar o novo, evitando vazamento de timers.

### Regra Para Nunca Repetir
> Toda configuração alterada pelo usuário na interface (Settings) que afete processos do backend (frequência de crawl, caminhos, etc.) deve ser imediatamente propagada para a API e refletida em tempo de execução nos schedulers do servidor.

---

## BUG-012 — Botão "N novas notícias" não mostra as notícias ao clicar

**Data:** 2026-05-19
**Área:** Frontend — `feedStore.ts`, `NewsFeed.tsx`
**Severidade:** Alta (UX)

### Sintoma
O botão "↑ N novas notícias" aparecia corretamente quando o SSE empurrava itens novos, mas clicar nele não produzia nenhuma mudança visível. As notícias exibidas no feed permaneciam as mesmas.

### Causa Raiz
`appendNews` adicionava os novos itens diretamente em `filteredNews` **imediatamente** ao receber o SSE — antes do usuário clicar. O botão servia apenas como atalho de scroll (`scrollToTop`). Se o usuário já estava no topo da timeline, `scrollTo({ top: 0 })` era um no-op silencioso, e a ação de `clearLiveCount` apenas apagava o contador sem nenhuma mudança perceptível no feed.

O padrão esperado (Twitter/X-style) era: novos itens ficam **em espera** e só entram na timeline após o clique.

### Solução Aplicada
Implementado buffer `pendingNews` no store:
- `appendNews` agora guarda itens genuinamente novos em `pendingNews` em vez de adicioná-los a `filteredNews`
- `liveCount` reflete `pendingNews.length`
- Nova ação `flushPendingNews()`: move `pendingNews` para `allNews`/`filteredNews` + zera contador
- `setNews` (full-refresh periódico) limpa `pendingNews` e `liveCount`, pois o backend já retorna todos os itens na resposta completa
- `NewsFeed.tsx`: `onClick` do botão chama `flushPendingNews()` e usa `requestAnimationFrame` para garantir que o scroll só acontece após o React inserir os novos cards no DOM

### Regra Para Nunca Repetir
> Nunca usar `appendNews` para adicionar itens diretamente ao feed e depois mostrar
> um botão de "novos itens". Novos itens chegados por push (SSE/WebSocket) devem
> sempre ir para um **buffer pendente** e ser promovidos ao feed somente por ação
> explícita do usuário (clique) ou por full-refresh. O botão deve ser uma ação
> de "flush", não um atalho de scroll.

---

## BUG-013 — Reels de baixa qualidade: cenas longas/estáticas, mídias repetidas e ausência de logo

**Data:** 2026-05-20
**Área:** Backend + Frontend — `video_scene_agent.py`, `image_generator.py`, `media_fetcher.py`, `video.py`, `ReelsComposition.tsx`
**Severidade:** Alta

### Sintoma
Os Reels gerados ficavam monótonos, com cenas que passavam de 3 segundos paradas na tela com o mesmo B-roll ou cutout estático, elementos visuais se repetindo ao longo do vídeo, ausência de logo corporativo e textos sem movimento.

### Causa Raiz
1. **Pacing Lento**: O roteiro gerado pelo LLM tinha subtexts excessivamente longos por cena. Além disso, a duração da cena dependia inteiramente do tamanho da locução sem qualquer teto limitante.
2. **Mídias Repetidas**: Os downloads e as gerações de imagens por IA usavam hashing simples baseados estritamente na query ou palavra-chave. Em múltiplos requests ou na mesma sequência, o cache era reutilizado indefinidamente resultando em repetição de mídias.
3. **UI Estática**: Não havia marca d'água corporativa nas cenas e os contêineres de texto ficavam completamente estáticos na tela durante a exibição.

### Solução Aplicada
1. **Roteiro Curto & Pacing Limitado**: Atualizado o prompt do `video_scene_agent.py` para obrigar narrações de no máximo 10-12 palavras e cenas de no máximo 3.0s. No backend (`video.py`), a duração calculada de cada cena foi limitada em `min(3.0, round(scene_duration + 0.2, 2))`.
2. **Sal no Cache (Bust Cache) & Aleatoriedade**: O backend gera um `generation_id` por run que serve de `salt` para os hashes de imagem (`image_generator.py`) e vídeos (`media_fetcher.py`), forçando o download e a geração de mídias novas. Além disso, o download de B-roll busca do top 5 do YouTube e escolhe uma URL aleatória do top 3.
3. **Watermark & Texto Animado**: Adicionado o watermark permanente "NOTICIANDO" no canto superior direito de cada cena do Reels e aplicada animação de escala progressiva contínua (pulso 1.0 a 1.05) no contêiner de texto para mantê-lo sempre em movimento.

### Regra Para Nunca Repetir
> Para vídeos curtos estilo Reels, nenhuma cena pode passar de 3.0s de duração. O subtext do roteiro deve ser curto e o backend deve garantir mídias únicas injetando um `generation_id`/`salt` único em cada requisição de geração para desviar do cache. Legendas e títulos devem possuir animações contínuas de escala para eliminar imagens de texto estáticas.

---

*Última atualização: 2026-05-20*
*Mantenedor: Antigravity AI + Grupo Primo*
