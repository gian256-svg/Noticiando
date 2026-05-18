"""
Fontes de notícias pré-configuradas para o Grupo Primo.
Foco: investimentos, economia BR/INT, geopolítica.
"""

from dataclasses import dataclass


@dataclass
class Source:
    name: str
    url: str
    category: str
    language: str = "pt"
    enabled: bool = True


# Baseado nas fontes validadas pelo time do Grupo Primo
DEFAULT_SOURCES: list[Source] = [
    # ── Brasil — Investimentos e Finanças ────────────────────────────────
    Source(
        name="InfoMoney",
        url="https://www.infomoney.com.br/feed/",
        category="investments",
    ),
    Source(
        name="Valor Econômico",
        url="https://valor.globo.com/rss/valor-economico/",
        category="economy_br",
    ),
    Source(
        name="Exame",
        url="https://exame.com/feed/",
        category="economy_br",
    ),
    Source(
        name="Forbes Brasil",
        url="https://forbes.com.br/feed/",
        category="investments",
    ),
    Source(
        name="CNN Brasil",
        url="https://www.cnnbrasil.com.br/feed/",
        category="economy_br",
    ),
    Source(
        name="Folha Mercado",
        url="https://feeds.folha.uol.com.br/mercado/rss091.xml",
        category="economy_br",
    ),
    Source(
        name="G1 Economia",
        url="https://g1.globo.com/rss/g1/economia/",
        category="economy_br",
    ),
    Source(
        name="Investing.com Brasil",
        url="https://br.investing.com/rss/news.rss",
        category="investments",
    ),
    # ── Internacional — Mercados e Geopolítica ───────────────────────────
    Source(
        name="Bloomberg",
        url="https://feeds.bloomberg.com/markets/news.rss",
        category="economy_int",
        language="en",
    ),
    Source(
        name="Reuters",
        url="https://feeds.reuters.com/reuters/topNews",
        category="economy_int",
        language="en",
    ),
    Source(
        name="Financial Times",
        url="https://www.ft.com/rss/home",
        category="economy_int",
        language="en",
    ),
    Source(
        name="Wall Street Journal",
        url="https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
        category="economy_int",
        language="en",
    ),
    Source(
        name="BBC Business",
        url="https://feeds.bbci.co.uk/news/business/rss.xml",
        category="economy_int",
        language="en",
    ),
    Source(
        name="The Guardian Economy",
        url="https://www.theguardian.com/business/economics/rss",
        category="geopolitics",
        language="en",
    ),
]
