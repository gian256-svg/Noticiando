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

### Critérios de pontuação (0–100)
| Critério | Peso | Lógica |
|---|---|---|
| **Multi-fonte** | +20 pts | Mesma notícia em 2+ fontes = confirmada e relevante |
| **Palavras-chave financeiras** | +15 pts | "Selic", "Fed", "Bitcoin", "ações", "juros", "IPCA" etc. |
| **Novidade** (< 2h) | +15 pts | Notícias frescas têm vantagem |
| **Números e dados** | +10 pts | "caiu X%", "subiu R$ Y", "recorde de Z" |
| **Impacto direto ao investidor** | +10 pts | Afeta carteira, rentabilidade, tomada de decisão |
| **Nome de empresa/ticker** | +8 pts | Menção a PETR4, VALE3, ITUB4 etc. |
| **Penalidade: fora do nicho** | −50 pts | Esporte, celebridade, entretenimento sem impacto financeiro |

### Palavras de penalidade (nicho errado)
Se o título ou resumo contiver qualquer uma das palavras abaixo, aplicar −50 pts:
```
futebol, copa do mundo, seleção, convocação, gol, artilheiro, campeão
celebridade, ator, atriz, cantor, cantora, show, álbum, música
gta, playstation, xbox, nintendo, game, jogo eletrônico
novela, série, netflix, disney, streaming (exceto negócios)
vinho, gastronomia, receita, culinária
moda, beleza, estilo, lifestyle
```

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
- Após cada provider call, **validar que o resultado contém o campo `"scenes"`**. Se ausente, tratar como falha de provider e tentar o próximo — nunca retornar HTTP 200 com JSON sem `scenes`.
- Mensagens de erro do cascade devem citar `GEMINI_API_KEY` ou `GROQ_API_KEY`.

**Arquivo:** `backend/ai/video_scene_agent.py`

### Diretrizes Gráficas e Tipografia (Diretor de Arte DESIGN.md)
* **Tipografia:** Fonte principal **Oswald** (Bold/SemiBold) para títulos; **Inter** ou **Roboto** para legendas e textos de apoio.
* **Tamanho de Fonte Mínimo:** **Nunca inferior a 48px** na tela para assegurar legibilidade em dispositivos móveis.
* **Regra de Dinamismo:** Máximo de **2,5 segundos** sem mudança visual. Cada frase narrada deve apresentar pelo menos um elemento visual correspondente em tela.
* **Elementos Obrigatórios por Reel:**
  - Pelo menos **1 corte de vídeo real** ou YouTube (máx. 5s por corte, fins informativos/editoriais).
  - Pelo menos **2 recortes fotográficos** animados (estilo colagem/cutout com sombras suaves).
  - Pelo menos **1 elemento gráfico decorativo** animado.
  - Background texturizado contínuo (film grain, papel ou ruído cinematográfico).

### Configurações de Locução (ElevenLabs)
* **Voice Model:** `eleven_multilingual_v2`
* **Definições de Voz:** `stability: 0.45`, `similarity_boost: 0.80`, `style: 0.35`, `use_speaker_boost: true`.
* **Pré-Processamento:** Adicionar vírgulas e reticências estratégicas no roteiro para pausas naturais e sincronização de ±0.3s.

### Configurações de Trilha (Epidemic Sound)
* **Mixagem de Áudio:** Volume da trilha de fundo entre `0.15` e `0.25`, e volume da narração em `1.0`.
* **Duck Automático:** Reduzir o volume da música de fundo em **40%** automaticamente durante os períodos em que a narração do áudio estiver ativa.
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
- [x] **Cortes de YouTube via yt-dlp:** Busca e download de trechos de 5s no YouTube em tempo real na pipeline backend.
- [x] **Recortes (Cutouts) e Ilustrações:** Imagens de sticker transparentes (Nigro, Perini, dinheiro, cripto) servidas e orquestradas pela pipeline do sidecar Python.

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
