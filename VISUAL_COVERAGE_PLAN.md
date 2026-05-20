# Plano: Geração de Imagem para Figuras Públicas + 80% de Cobertura Visual da Narração

> Baseado no estado atual do código (video_scene_agent.py, video.py, ReelsComposition.tsx)
> Objetivo: garantir que o que é falado no roteiro é sempre representado visualmente na tela.

---

## Contexto atual

O SYSTEM_PROMPT já instrui o LLM a preencher `media_keyword` com o nome da pessoa (ex: "Elon Musk", "Jerome Powell"). Mas o `video.py` não sabe o que fazer com esse nome — ele tenta encontrar um asset estático (só existe para nigro/perini) e cai no fallback `cutout_money.png`. Resultado: qualquer figura pública vira uma imagem de dinheiro genérica.

A cobertura visual de 80% falha porque:
1. O `headline` na tela costuma ser abstrato e não espelha a narração
2. Não há legenda/caption animada sincronizada com o áudio
3. Os novos `visual_type` adicionados ao SYSTEM_PROMPT (`map`, `timeline`, `collage`, `split_video`, `newspaper_clip`) não têm renderização no frontend

---

## Parte 1 — `backend/ai/image_generator.py` (NOVO ARQUIVO)

Criar cascade de geração de imagem para figuras públicas e conceitos visuais.

```python
"""
image_generator.py — Geração de imagens editoriais via AI
Cascade: DALL-E 3 → Replicate (Flux Schnell) → Stability AI → skip
"""

DALLE_API_KEY     = os.getenv("OPENAI_API_KEY", "")
REPLICATE_API_KEY = os.getenv("REPLICATE_API_KEY", "")
STABILITY_API_KEY = os.getenv("STABILITY_API_KEY", "")

# Detectar se o keyword é uma figura pública (vs conceito genérico)
GENERIC_KEYWORDS = {"money", "growth", "chart", "crypto", "bitcoin", "briefcase",
                    "newspaper", "bar chart", "line chart", "pie chart"}

def is_public_figure(keyword: str) -> bool:
    """Retorna True se parece ser o nome de uma pessoa ou organização real."""
    kw = keyword.lower().strip()
    return not any(generic in kw for generic in GENERIC_KEYWORDS)

async def generate_cutout_image(keyword: str, context: str = "", category: str = "general") -> Optional[str]:
    """
    Gera imagem editorial para uso como cutout.
    - Se for figura pública: retrato editorial com fundo branco (para rembg depois)
    - Se for conceito: ilustração editorial abstrata
    Retorna URL localhost ou None.
    """
    if is_public_figure(keyword):
        prompt = (
            f"Editorial portrait photograph of {keyword}, "
            f"professional headshot style, clean white background, "
            f"high resolution, journalistic quality, no text, no watermarks"
        )
        negative_prompt = "cartoon, illustration, text, watermark, busy background, logo"
    else:
        prompt = (
            f"Editorial infographic illustration: {keyword}. "
            f"Clean modern style, {context[:80]}, "
            f"white background, no text, minimal flat design"
        )
        negative_prompt = "photorealistic, faces, text, watermark"

    # Cascade de provedores
    # 1. DALL-E 3 (melhor qualidade para retratos)
    # 2. Replicate Flux Schnell (rápido, gratuito com API key)
    # 3. Stability AI SDXL
    # Cada provedor salva em: output/media/generated_{hash}.png
    # Retorna: http://localhost:{port}/output/media/generated_{hash}.png
```

### Remoção de fundo após geração (se `rembg` instalado)

```python
async def remove_background(image_path: Path) -> Path:
    """Remove fundo branco/genérico para criar cutout editorial transparente."""
    try:
        from rembg import remove
        from PIL import Image
        input_img = Image.open(image_path)
        output_img = remove(input_img)
        out_path = image_path.with_suffix(".png")
        output_img.save(out_path, "PNG")
        return out_path
    except ImportError:
        logger.warning("rembg não instalado — imagem usada sem remoção de fundo")
        return image_path
```

### Instalação necessária
```bash
pip install openai replicate stability-sdk rembg pillow --break-system-packages
```

Adicionar ao `backend/.env`:
```
OPENAI_API_KEY=sk-...
REPLICATE_API_KEY=r8_...
STABILITY_API_KEY=sk-...
```

---

## Parte 2 — `backend/api/video.py` — Integração do Image Generator

No bloco de resolução de cutouts, **substituir o fallback `cutout_money.png`** por chamada ao image generator:

```python
# 2. Resolver cutouts — NOVO FLUXO
if v_type == "cutout":
    kw = (scene.get("media_keyword") or "").lower().strip()

    if kw == "newspaper":
        scene["cutout_url"] = "newspaper"

    else:
        # a) Asset estático (nigro, perini, money, growth, crypto, chart, bitcoin)
        static_asset = _resolve_static_asset(kw)
        if static_asset:
            scene["cutout_url"] = static_asset

        # b) Foto do artigo (og:image)
        elif photo_idx < len(article_photos):
            scene["cutout_url"] = article_photos[photo_idx]
            photo_idx += 1

        # c) NOVO: Gerar imagem via AI (DALL-E / Replicate / Stability)
        else:
            from ai.image_generator import generate_cutout_image
            context = scene.get("subtext", "") or scene.get("headline", "")
            generated = await generate_cutout_image(kw, context, req.category)
            if generated:
                scene["cutout_url"] = generated
                scene["image_generated"] = True  # flag para o frontend
            elif req.thumbnail_url:
                scene["cutout_url"] = req.thumbnail_url
            else:
                scene["cutout_url"] = f"{_get_localhost()}/output/assets/cutout_money.png"

# 3. Resolver ilustrações — NOVO FLUXO (mesmo padrão)
elif v_type == "illustration":
    kw = (scene.get("media_keyword") or "").lower().strip()
    static_asset = _resolve_static_asset(kw)
    if static_asset:
        scene["illustration_url"] = static_asset
    else:
        from ai.image_generator import generate_cutout_image
        context = scene.get("subtext", "") or scene.get("headline", "")
        generated = await generate_cutout_image(kw, context, req.category)
        if generated:
            scene["illustration_url"] = generated
        else:
            scene["illustration_url"] = f"{_get_localhost()}/output/assets/illustration_growth.png"
```

### Paralelizar geração de imagens

Geração de imagem é lenta — fazer em paralelo com `asyncio.gather()` assim como já é feito com a narração ElevenLabs.

```python
# Separar cenas que precisam de geração de imagem
scenes_needing_generation = [
    s for s in scenes
    if s.get("visual_type") in ("cutout", "illustration")
    and not s.get("cutout_url")
    and not s.get("illustration_url")
]

await asyncio.gather(*(resolve_scene_media(s) for s in scenes))
```

---

## Parte 3 — `video_scene_agent.py` — SYSTEM_PROMPT: Campo `person_name`

Adicionar campo explícito `person_name` ao schema para guiar o image generator:

```json
{
  "id": "scene_3",
  "headline": "POWELL DIZ NÃO",
  "subtext": "Jerome Powell, presidente do Fed, descartou cortes de juros em 2025.",
  "visual_type": "cutout",
  "person_name": "Jerome Powell Federal Reserve chairman",   // ← NOVO: nome completo para geração de imagem
  "media_keyword": "Jerome Powell",                          // mantido para compatibilidade
  "decorator_type": "circle"
}
```

Instrução no SYSTEM_PROMPT:
```
PERSON_NAME — obrigatório em cenas "cutout" com figuras públicas:
  * Preencher com o nome completo + cargo da pessoa citada na narração naquele momento.
  * Exemplos: "Jerome Powell Federal Reserve chairman", "Lula presidente do Brasil",
    "Elon Musk Tesla CEO", "Gabriel Galipolo Banco Central presidente"
  * Para cutouts sem figura humana, deixar vazio ou null.
  * Este campo alimenta o gerador de imagem com IA — quanto mais específico, melhor o resultado.
```

---

## Parte 4 — 80% de cobertura visual via Caption Engine

### O problema raiz
O `headline` na tela é curto (3-5 palavras abstratas). O que é narrado (`subtext`) tem 20-40 palavras. O espectador ouve mas não vê o conteúdo rico.

### Solução: ElevenLabs Timestamps + Caption Overlay

**4.1 — Mudar chamada ElevenLabs para endpoint com timestamps**

O endpoint `/v1/text-to-speech/{voice_id}/with-timestamps` retorna além do áudio MP3, um objeto `alignment` com posição de cada palavra no tempo:

```python
# Em voice_and_sound.py — generate_narration()

# TROCAR endpoint:
# DE:  /v1/text-to-speech/{voice_id}
# PARA: /v1/text-to-speech/{voice_id}/with-timestamps

url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps"
# Resposta é JSON, não binário:
# {
#   "audio_base64": "...",
#   "alignment": {
#     "characters": ["J","e","r","o",...],
#     "character_start_times_seconds": [0.0, 0.05, 0.09, ...],
#     "character_end_times_seconds": [0.05, 0.09, 0.12, ...]
#   },
#   "normalized_alignment": { ... }
# }

# Decodificar base64 para salvar o MP3
import base64
audio_bytes = base64.b64decode(data["audio_base64"])
filepath.write_bytes(audio_bytes)

# Extrair word-level timestamps a partir de character-level
captions = _build_word_timestamps(data["alignment"])
# Salvar como: output/narration_{timestamp}_captions.json
captions_path = OUTPUT_DIR / f"narration_{ts}_captions.json"
captions_path.write_text(json.dumps(captions))

# Retornar também o URL de captions
return {
    "audio_url": f"{base}/output/{filename}",
    "captions_url": f"{base}/output/narration_{ts}_captions.json"
}
```

**4.2 — Converter character timestamps → word timestamps**

```python
def _build_word_timestamps(alignment: dict) -> list[dict]:
    """Converte character-level alignment do ElevenLabs em word-level."""
    chars = alignment["characters"]
    starts = alignment["character_start_times_seconds"]
    ends = alignment["character_end_times_seconds"]

    words = []
    current_word = []
    word_start = None

    for char, start, end in zip(chars, starts, ends):
        if char == " " or char == "":
            if current_word:
                words.append({
                    "word": "".join(current_word),
                    "start": word_start,
                    "end": ends[starts.index(word_start) + len(current_word) - 1]
                })
                current_word = []
                word_start = None
        else:
            if word_start is None:
                word_start = start
            current_word.append(char)

    if current_word:
        words.append({"word": "".join(current_word), "start": word_start, "end": ends[-1]})

    return words
```

**4.3 — Propagar captions para cada cena**

Em `video.py`, após gerar o áudio global, distribuir os timestamps por cena:

```python
# Cada cena recebe o slice de captions correspondente ao seu trecho de áudio
scene_start_time = 0.0
for s in scenes:
    scene_end_time = scene_start_time + s["duration_seconds"]
    s["caption_words"] = [
        w for w in all_captions
        if w["start"] >= scene_start_time and w["end"] <= scene_end_time + 0.1
    ]
    # Ajustar tempos relativos ao início da cena
    for w in s["caption_words"]:
        w["start"] -= scene_start_time
        w["end"] -= scene_start_time
    scene_start_time = scene_end_time
```

**4.4 — CaptionEngine no ReelsComposition.tsx**

```tsx
// Novo componente: CaptionEngine
const CaptionEngine: React.FC<{
  words: Array<{ word: string; start: number; end: number }>;
  frame: number;
  fps: number;
  accentColor: string;
}> = ({ words, frame, fps, accentColor }) => {
  const currentTimeSec = frame / fps;

  // Pegar as últimas 4-5 palavras que já foram pronunciadas (janela deslizante)
  const WINDOW = 5;
  const pronounced = words.filter(w => w.start <= currentTimeSec);
  const visible = pronounced.slice(-WINDOW);

  if (!visible.length) return null;

  return (
    <div style={{
      position: "absolute",
      bottom: 160,
      left: 40, right: 40,
      display: "flex",
      flexWrap: "wrap",
      gap: "8px 12px",
      justifyContent: "center",
      zIndex: 20,
    }}>
      {visible.map((w, i) => {
        const isActive = w.start <= currentTimeSec && w.end >= currentTimeSec;
        const age = currentTimeSec - w.end; // quanto tempo passou desde que foi dita
        const fadeOut = Math.min(1, Math.max(0, 1 - age * 2)); // some em 0.5s

        return (
          <span key={i} style={{
            fontFamily: "'Oswald', 'Montserrat', sans-serif",
            fontSize: 56,
            fontWeight: 900,
            textTransform: "uppercase",
            color: isActive ? accentColor : "#FFFFFF",
            textShadow: isActive
              ? `0 0 20px ${accentColor}, 0 4px 12px rgba(0,0,0,0.9)`
              : "0 3px 10px rgba(0,0,0,0.85)",
            opacity: fadeOut,
            letterSpacing: "-0.02em",
            lineHeight: 1,
            transition: "color 0.1s ease",
          }}>
            {w.word}
          </span>
        );
      })}
    </div>
  );
};
```

Usar o `CaptionEngine` em todas as cenas de `video` e `hook`:

```tsx
{/* Dentro do NewsScene, após o VideoElement */}
{(isFullVideo || isHook) && scene.caption_words?.length > 0 && (
  <CaptionEngine
    words={scene.caption_words}
    frame={frame}
    fps={fps}
    accentColor={pal.accent}
  />
)}
```

---

## Parte 5 — Novos visual_types no frontend

O SYSTEM_PROMPT já instrui o LLM a gerar `map`, `timeline`, `collage`, `split_video`, `newspaper_clip`. Precisam de renderização no `ReelsComposition.tsx`.

### `newspaper_clip` (já existe `NewspaperCutout`, só falta o tipo novo)
```tsx
// No NewsScene, adicionar:
{scene.visual_type === "newspaper_clip" && (
  <NewspaperCutout
    title={scene.media_keyword || scene.headline}
    summary={scene.subtext || ""}
    source={sourceName || "Noticiando"}
    date={new Date().toLocaleDateString("pt-BR")}
    frame={frame} fps={fps} sceneIndex={sceneIndex}
  />
)}
```

### `data` (já existe) / `timeline`
```tsx
// Timeline: fundo escuro + ano grande centralizado + linha horizontal
{scene.visual_type === "timeline" && (
  <div style={{ /* fundo editorial + número de ano animado */ }}>
    <span style={{ fontSize: 240, fontWeight: 900, color: pal.accent }}>
      {scene.headline}  {/* ex: "1840" ou "$5B" */}
    </span>
  </div>
)}
```

### `split_video` (tela dividida em 2-3 partes)
```tsx
// Requer 2-3 clips diferentes — por ora usar o mesmo clip com filter diferente
{scene.visual_type === "split_video" && scene.background_video_url && (
  <div style={{ display: "flex", height: "100%" }}>
    {[0, 1, 2].map(i => (
      <OffthreadVideo key={i} src={scene.background_video_url}
        startFrom={i * 30}  // offset para parecer clips diferentes
        style={{ flex: 1, objectFit: "cover", filter: i === 1 ? "saturate(0.6)" : undefined }}
        volume={0}
      />
    ))}
  </div>
)}
```

### `map` e `collage`
Por ora, renderizar como `video` (B-roll fullscreen) com headline grande — funcional sem nova UI. Implementação completa de mapa SVG e collage pode ser fase 2.

---

## Resumo de Prioridade

| Prioridade | O que fazer | Arquivo | Impacto |
|---|---|---|---|
| 🔴 P0 | Criar `image_generator.py` com DALL-E 3 / Replicate cascade | `backend/ai/image_generator.py` (NOVO) | Figuras públicas com imagem real |
| 🔴 P0 | Integrar image generator no cutout resolver de `video.py` | `backend/api/video.py` | Fim do fallback `cutout_money.png` |
| 🔴 P0 | Adicionar campo `person_name` no SYSTEM_PROMPT + schema | `video_scene_agent.py` | IA passa nome exato para o generator |
| 🟡 P1 | Mudar ElevenLabs para endpoint `with-timestamps` | `voice_and_sound.py` | Timestamps por palavra para caption |
| 🟡 P1 | Distribuir word timestamps por cena em `video.py` | `video.py` | Alimentar CaptionEngine |
| 🟡 P1 | Criar `CaptionEngine` no frontend | `ReelsComposition.tsx` | 80% cobertura visual da narração |
| 🟡 P1 | Renderizar `newspaper_clip` e `timeline` no frontend | `ReelsComposition.tsx` | Novos tipos de cena ativos |
| 🟢 P2 | `rembg` para remover fundo das imagens geradas | `image_generator.py` | Cutout editorial limpo |
| 🟢 P2 | Paralelizar geração de imagens com `asyncio.gather` | `video.py` | Performance |
| 🟢 P2 | Renderização completa de `map` e `collage` | `ReelsComposition.tsx` | Fidelidade visual total |

---

## Dependências de ambiente

```env
# Adicionar ao backend/.env
OPENAI_API_KEY=sk-...          # DALL-E 3
REPLICATE_API_KEY=r8_...       # Flux Schnell (tem free tier)
STABILITY_API_KEY=sk-...       # SDXL fallback (opcional)
```

```bash
# Instalar Python
pip install openai replicate rembg pillow --break-system-packages
```

---

## Nota sobre qualidade do retrato

Para figuras públicas conhecidas (ex: Powell, Musk, Lula), DALL-E 3 vai gerar um retrato editorial aceitável — não será a foto real mas terá o estilo certo. Para maior fidelidade, uma integração futura com nanobanana (que retorna a foto real recortada) substituiria o generator para figuras com foto disponível no banco deles.
