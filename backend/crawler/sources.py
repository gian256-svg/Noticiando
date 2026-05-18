"""
Fontes de notícias pré-configuradas para o Grupo Primo.
Foco: investimentos, economia BR/INT, geopolítica.

REGRA DE OURO — ANTI-FAKE-NEWS:
Todas as fontes aqui listadas são veículos jornalísticos de alta credibilidade,
com redação profissional, processo editorial e histórico verificável.
NUNCA adicionar fontes de blogs pessoais, sites de opinião sem curadoria,
portais de entretenimento ou qualquer fonte sem reputação jornalística estabelecida.

A verificação de veracidade é feita pelo sistema de cross-referência:
notícias que aparecem em 2+ fontes independentes recebem boost de score,
enquanto notícias de fonte única recebem score mais conservador.
"""

from dataclasses import dataclass, field


@dataclass
class Source:
    name: str
    url: str
    category: str
    language: str = "pt"
    enabled: bool = True
    # Tier 1 = alta credibilidade editorial (agências, grandes jornais)
    # Tier 2 = boa credibilidade, foco financeiro
    # Tier 3 = credível mas amplo — requer filtro de nicho
    credibility_tier: int = 2
    # Se True, notícias desta fonte só entram se confirmadas por outra fonte
    require_cross_reference: bool = False


DEFAULT_SOURCES: list[Source] = [

    # ════════════════════════════════════════════════════════════════
    # TIER 1 — Agências e Grandes Jornais (máxima credibilidade)
    # Notícias dessas fontes são consideradas verificadas
    # ════════════════════════════════════════════════════════════════

    # ── Agências de notícias ─────────────────────────────────────────
    Source(
        name="Reuters",
        url="https://feeds.reuters.com/reuters/businessNews",
        category="economy_int",
        language="en",
        credibility_tier=1,
    ),
    Source(
        name="Reuters Markets",
        url="https://feeds.reuters.com/reuters/marketsNews",
        category="investments",
        language="en",
        credibility_tier=1,
    ),
    Source(
        name="Associated Press Business",
        url="https://feeds.apnews.com/rss/business",
        category="economy_int",
        language="en",
        credibility_tier=1,
    ),

    # ── Brasil — Grandes jornais ──────────────────────────────────────
    Source(
        name="Valor Econômico",
        url="https://valor.globo.com/rss/valor-economico/",
        category="economy_br",
        credibility_tier=1,
    ),
    Source(
        name="Folha Mercado",
        url="https://feeds.folha.uol.com.br/mercado/rss091.xml",
        category="economy_br",
        credibility_tier=1,
    ),
    Source(
        name="Estadão Economia",
        url="https://economia.estadao.com.br/rss2.xml",
        category="economy_br",
        credibility_tier=1,
    ),
    Source(
        name="G1 Economia",
        url="https://g1.globo.com/rss/g1/economia/",
        category="economy_br",
        credibility_tier=1,
    ),

    # ── Internacional — Grandes jornais ──────────────────────────────
    Source(
        name="Bloomberg",
        url="https://feeds.bloomberg.com/markets/news.rss",
        category="economy_int",
        language="en",
        credibility_tier=1,
    ),
    Source(
        name="Financial Times",
        url="https://www.ft.com/rss/home",
        category="economy_int",
        language="en",
        credibility_tier=1,
    ),
    Source(
        name="Wall Street Journal Markets",
        url="https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
        category="economy_int",
        language="en",
        credibility_tier=1,
    ),
    Source(
        name="BBC Business",
        url="https://feeds.bbci.co.uk/news/business/rss.xml",
        category="economy_int",
        language="en",
        credibility_tier=1,
    ),
    Source(
        name="The Guardian Economy",
        url="https://www.theguardian.com/business/economics/rss",
        category="geopolitics",
        language="en",
        credibility_tier=1,
    ),
    Source(
        name="CNBC",
        url="https://www.cnbc.com/id/10001147/device/rss/rss.html",
        category="economy_int",
        language="en",
        credibility_tier=1,
    ),
    Source(
        name="MarketWatch",
        url="https://feeds.marketwatch.com/marketwatch/topstories/",
        category="investments",
        language="en",
        credibility_tier=1,
    ),

    # ════════════════════════════════════════════════════════════════
    # TIER 2 — Veículos financeiros especializados (alta credibilidade)
    # Foco em finanças, menor risco de conteúdo fora do nicho
    # ════════════════════════════════════════════════════════════════

    Source(
        name="InfoMoney",
        url="https://www.infomoney.com.br/feed/",
        category="investments",
        credibility_tier=2,
    ),
    Source(
        name="InfoMoney Mercados",
        url="https://www.infomoney.com.br/mercados/feed/",
        category="investments",
        credibility_tier=2,
    ),
    Source(
        name="Investing.com Brasil",
        url="https://br.investing.com/rss/news.rss",
        category="investments",
        credibility_tier=2,
    ),
    Source(
        name="Investing.com Brasil — Ações",
        url="https://br.investing.com/rss/stocks.rss",
        category="investments",
        credibility_tier=2,
    ),
    Source(
        name="Suno Research",
        url="https://www.sunoresearch.com.br/feed/",
        category="investments",
        credibility_tier=2,
    ),
    Source(
        name="Empiricus",
        url="https://www.empiricus.com.br/feed/",
        category="investments",
        credibility_tier=2,
    ),
    Source(
        name="Money Times",
        url="https://www.moneytimes.com.br/feed/",
        category="investments",
        credibility_tier=2,
    ),
    Source(
        name="Investing.com — Crypto",
        url="https://br.investing.com/rss/crypto.rss",
        category="crypto",
        credibility_tier=2,
    ),
    Source(
        name="CoinDesk",
        url="https://www.coindesk.com/arc/outboundfeeds/rss/",
        category="crypto",
        language="en",
        credibility_tier=2,
    ),
    Source(
        name="CoinTelegraph",
        url="https://cointelegraph.com/rss",
        category="crypto",
        language="en",
        credibility_tier=2,
    ),

    # ── Internacional — Macro e Geopolítica ───────────────────────────
    Source(
        name="The Economist",
        url="https://www.economist.com/finance-and-economics/rss.xml",
        category="economy_int",
        language="en",
        credibility_tier=2,
    ),
    Source(
        name="Project Syndicate",
        url="https://www.project-syndicate.org/rss",
        category="geopolitics",
        language="en",
        credibility_tier=2,
    ),
    Source(
        name="IMF News",
        url="https://www.imf.org/en/News/rss?language=eng",
        category="economy_int",
        language="en",
        credibility_tier=1,  # Instituição oficial
    ),

    # ════════════════════════════════════════════════════════════════
    # TIER 3 — Veículos amplos com filtro de nicho obrigatório
    # Conteúdo misto: requer score de relevância antes de aceitar
    # ════════════════════════════════════════════════════════════════

    Source(
        name="Exame",
        url="https://exame.com/feed/",
        category="economy_br",
        credibility_tier=3,
        require_cross_reference=False,  # Popular mas amplo — filtrar por nicho
    ),
    Source(
        name="Forbes Brasil",
        url="https://forbes.com.br/feed/",
        category="investments",
        credibility_tier=3,
    ),
    Source(
        name="CNN Brasil Economia",
        url="https://www.cnnbrasil.com.br/economy/feed/",
        category="economy_br",
        credibility_tier=3,
    ),
    Source(
        name="UOL Economia",
        url="https://rss.uol.com.br/feed/economia.xml",
        category="economy_br",
        credibility_tier=3,
    ),
]
