import hashlib
import re
import unicodedata


def normalize_title(title: str) -> str:
    """Normaliza título para comparação: lowercase, sem acentos, sem pontuação."""
    title = unicodedata.normalize("NFKD", title)
    title = title.encode("ascii", "ignore").decode("ascii")
    title = title.lower()
    title = re.sub(r"[^\w\s]", "", title)
    title = re.sub(r"\s+", " ", title).strip()
    return title


def title_hash(title: str) -> str:
    """Hash SHA-256 do título normalizado (usado como chave de dedup)."""
    normalized = normalize_title(title)
    return hashlib.sha256(normalized.encode()).hexdigest()


def titles_are_similar(title_a: str, title_b: str, threshold: float = 0.75) -> bool:
    """
    Similaridade baseada em Jaccard de bigramas de palavras.
    Mais leve que sentence-transformers para dedup rápido no crawler.
    """
    def bigrams(text: str) -> set[str]:
        words = normalize_title(text).split()
        return {f"{words[i]} {words[i+1]}" for i in range(len(words) - 1)} if len(words) > 1 else set(words)

    bg_a = bigrams(title_a)
    bg_b = bigrams(title_b)

    if not bg_a or not bg_b:
        return False

    intersection = len(bg_a & bg_b)
    union = len(bg_a | bg_b)
    return (intersection / union) >= threshold
