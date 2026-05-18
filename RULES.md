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
2. Clica em **"Gerar Reels"** (autonomo via Claude no sidecar)
3. **OU** clica em "Abrir no myhub" → copia prompt → obtém roteiro → cola na seção "Cole o roteiro do agente"

### Integração Claude
- API Key do Anthropic deve ser configurada pelo usuário em **Configurações**
- Nunca hardcodar API keys no código
- Mensagens de erro devem ser claras: "Configure a API Key em Configurações"

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

## 8. Evolução Planejada (Backlog Prioritário)

### 🔴 Alta prioridade
- [ ] Filtro de nicho no backend: aplicar penalidade −50 em artigos fora do nicho antes de salvar
- [ ] Configurações: tela para inserir API Key do Anthropic
- [ ] Thumbnails: pular fetch de og:image para domínios que sempre bloqueiam

### 🟡 Média prioridade
- [ ] Notificação desktop quando viral_score > 80
- [ ] Exportação MP4 via Remotion headless funcionando end-to-end
- [ ] Histórico de roteiros salvos (lista de scripts)
- [ ] Multi-idioma: tradução automática de notícias EN → PT antes de exibir

### 🟢 Baixa prioridade / Futuro
- [ ] Integração ElevenLabs para locução automática do roteiro
- [ ] Remove.bg para recortes de personagens no estilo colagem
- [ ] Painel de analytics: quais categorias geram mais engajamento
- [ ] Modo dark/light toggle

---

*Última atualização: 2026-05-18*
*Mantenedor: Antigravity AI + Grupo Primo*
