"""
Keywords de alto engajamento para o contexto do Grupo Primo.
Foco: finanças, investimentos, economia, geopolítica.
"""

# Pesos: 1 = base, 2 = alto, 3 = máximo impacto
HIGH_ENGAGEMENT_KEYWORDS: list[tuple[str, int]] = [
    # Urgência
    ("urgente", 3),
    ("exclusivo", 3),
    ("breaking", 3),
    ("agora", 2),
    ("recorde", 3),
    ("histórico", 2),
    ("alerta", 2),
    ("colapso", 3),
    ("crise", 2),
    ("crash", 3),

    # Finanças BR
    ("selic", 3),
    ("copom", 2),
    ("inflação", 2),
    ("ipca", 2),
    ("dólar", 2),
    ("real", 1),
    ("bolsa", 2),
    ("ibovespa", 2),
    ("ações", 1),
    ("dividendos", 2),
    ("recessão", 3),
    ("banco central", 2),
    ("tesouro", 1),
    ("ipo", 3),
    ("petrobras", 2),
    ("vale", 1),
    ("magazineluiza", 1),

    # Finanças INT
    ("fed", 3),
    ("federal reserve", 2),
    ("bce", 2),
    ("juros", 2),
    ("taxa", 1),
    ("recessão", 3),
    ("goldman", 2),
    ("jp morgan", 2),
    ("warren buffett", 3),
    ("wall street", 2),
    ("nasdaq", 2),
    ("s&p", 2),
    ("dow jones", 2),

    # Cripto
    ("bitcoin", 3),
    ("ethereum", 2),
    ("btc", 3),
    ("cripto", 2),
    ("blockchain", 1),
    ("halving", 3),
    ("altcoin", 1),

    # Geopolítica e impacto em mercados
    ("guerra", 3),
    ("conflito", 2),
    ("sanção", 3),
    ("brics", 2),
    ("china", 2),
    ("eua", 1),
    ("trump", 3),
    ("petróleo", 2),
    ("opep", 2),
    ("oil", 1),
    ("ouro", 2),
    ("commodities", 1),

    # Grandes números (detectados por padrão separado)
    # bilhões, trilhões detectados via regex no scorer
]

# Palavras de penalidade — conteúdo fora do nicho financeiro do Grupo Primo
# Artigos que batem nestas palavras recebem −60 pts no viral score
PENALTY_KEYWORDS: list[str] = [
    # Esportes
    "futebol", "copa do mundo", "seleção brasileira", "convocação",
    "gol", "artilheiro", "campeão", "campeonato", "champions league",
    "premier league", "la liga", "série a", "brasileirão",
    "nfl", "nba", "mlb", "formula 1", "f1", "moto gp",
    "ancelotti", "mbappé", "neymar", "vinicius",
    # Entretenimento / celebridades
    "celebridade", "ator", "atriz", "cantor", "cantora",
    "show musical", "álbum", "música nova", "clipe",
    "novela", "série de tv", "stranger things", "the boroughs",
    "squid game", "la casa de papel", "reality show",
    "oscar", "grammy", "emmy", "bbb", "big brother",
    "ludmilla", "anitta", "mc", "funk",
    # Games / tecnologia de entretenimento
    "gta", "gta 6", "gta vi", "playstation", "xbox",
    "nintendo", "jogo eletrônico", "videogame", "esports",
    # Lifestyle / comportamento
    "vinho", "gastronomia", "receita culinária", "restaurante",
    "moda", "beleza", "make up", "skincare", "lifestyle",
    "viagem", "turismo", "destino de viagem", "hotel", "cruzeiro",
    "horóscopo", "signos", "tarot",
    # Esportes radicais / outros
    "surfe", "tênis profissional", "golfe", "vôlei",
]

PENALTY_KEYWORDS_EN: list[str] = [
    # Sports
    "soccer", "football match", "world cup squad", "goal scorer",
    "premier league", "champions league", "nfl", "nba", "mlb",
    # Entertainment
    "celebrity", "actor", "actress", "singer", "album release",
    "tv series", "netflix show", "movie premiere", "award show",
    "oscar", "grammy", "emmy", "reality tv",
    # Gaming
    "gta", "playstation", "xbox", "nintendo", "video game",
    # Lifestyle
    "fashion", "beauty tips", "recipe", "restaurant review",
    "travel guide", "horoscope",
]

# Palavras em inglês equivalentes (para fontes INT)
HIGH_ENGAGEMENT_KEYWORDS_EN: list[tuple[str, int]] = [
    ("breaking", 3),
    ("exclusive", 3),
    ("record", 3),
    ("historic", 2),
    ("crisis", 3),
    ("crash", 3),
    ("recession", 3),
    ("fed", 3),
    ("rate hike", 3),
    ("rate cut", 3),
    ("inflation", 2),
    ("bitcoin", 3),
    ("gold", 2),
    ("oil", 2),
    ("sanctions", 3),
    ("war", 3),
    ("ipo", 3),
    ("bankruptcy", 3),
    ("collapse", 3),
    ("trump", 3),
    ("china", 2),
    ("tariff", 2),
]
