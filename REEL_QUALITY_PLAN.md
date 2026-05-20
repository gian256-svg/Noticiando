# Plano de Melhoria de Qualidade dos Reels — Noticiando
> Baseado na leitura completa do código do projeto  
> Referência visual: [@theeconomist](https://www.instagram.com/theeconomist/reels/)  
> Estilo: documentário jornalístico — dinâmico, narrativo, editorial, viral

---

## Como o Reel é gerado hoje (pipeline real)

```
Usuário clica "Gerar Reels"
  → video:generate-scenes (IPC Electron)
  → video_scene_agent.py  (Gemini → Groq → OpenRouter → Ollama)  [gera JSON de cenas]
  → video.py              [orquestra tudo]
      ├── fetch_youtube_broll()   → yt-dlp, segundos 15–20 de qualquer vídeo
      ├── fetch_article_photos()  → og:image do artigo / thumbnail
      ├── generate_narration()    → ElevenLabs por cena (+0.4s de respiro)
      └── get_epidemic_soundtrack() → Epidemic Sound ou yt-dlp fallback
  → ReelsCompositionProps → @remotion/player (preview)
  → npx remotion render   → MP4 final
```

---

## Problemas Identificados no Código (raiz dos problemas visuais)

### 1. B-roll irrelevante (`media_fetcher.py` + `video_scene_agent.py`)
**Causa:** `download_ranges` fixo em `{start_time: 15, end_time: 20}` — pega sempre os mesmos 5 segundos de qualquer vídeo, sem considerar relevância do momento. Fallback é `big_buck_bunny.mp4` (animação infantil completamente fora do contexto).

**Causa adicional:** `youtube_search` gerado em inglês e com queries muito genéricas. O SYSTEM_PROMPT pede "4-6 palavras", mas modelos menores (Groq/Ollama no cascade) produzem queries vagas como "business finance" que retornam qualquer coisa.

### 2. Narração cortada (`video.py`)
**Causa:** Existe `+0.4s de respiro` em `process_scene_audio()`, mas `_adjust_scene_durations()` chamado ANTES da narração reescala todas as cenas para bater o `target_duration`. Quando o ElevenLabs processa depois, as durações reais dos áudios podem não caber no slot ajustado. Além disso, `exitOpacity` no `ReelsComposition.tsx` faz fade out de 0.25s ao fim de cada cena — se a narração estiver próxima do fim, é cortada visualmente.

### 3. Vídeo em moldura flutuante, não fullscreen (`ReelsComposition.tsx`)
**Causa:** `VideoElement` usa `isFloatingFrame = sceneIndex % 2 !== 0` — cenas de índice ímpar colocam o vídeo numa moldura de 55% largura × 38% altura com borda branca e rotação, em vez de fullscreen. Nos prints, isso aparece como vídeo pequeno com muito espaço vazio.

### 4. Elementos de cutout pequenos demais (`ReelsComposition.tsx`)
**Causa:** `cutout_url` renderiza a imagem com `height: "44%"` e `maxHeight: 520`. Para uma tela de 1920px de altura, 44% = ~845px, mas o `maxHeight: 520` corta isso — a imagem fica pequena. Soma-se o fato de fotos de artigo (`og:image`) geralmente serem imagens paisagem (16:9) que não funcionam bem como recorte vertical.

### 5. Paleta de cores sem impacto visual
**Causa:** As paletas existem e estão corretas conceitualmente (`CATEGORY_PALETTE` em `ReelsComposition.tsx`), mas o background é sempre um gradiente suave entre `bg` e `grad` — cores muito próximas. Para `investments` é `#F5F0E8 → #EFEBE1` (dois cremes quase iguais), resultando em fundo monótono. O `gridOff` animado tem `opacity: 0.04` — invisível. Os `glow` radiais calculados existem no código mas **não são renderizados** (variáveis declaradas mas nunca usadas no JSX).

### 6. Ken Burns fraco
**Causa:** `cameraScale` vai de `1.0 → 1.06` ao longo de toda a cena — muito sutil para criar sensação de movimento. The Economist usa zoom mais agressivo (1.0 → 1.12 em 3–4s).

### 7. Tipos de mídia limitados para cutout/illustration
**Causa:** `_resolve_static_asset()` em `video.py` mapeia apenas: `nigro, primo, perini, money, briefcase, growth, chart, crypto, bitcoin`. Qualquer notícia que não seja sobre essas personas/keywords cai no fallback `cutout_money.png` — totalmente irrelevante para, ex., uma notícia sobre Banco Central ou geopolítica.

### 8. Fotos do artigo sem remoção de fundo
**Causa:** `fetch_article_photos()` baixa a `og:image` do artigo — são fotos editoriais com fundo (paisagens, pessoas em contexto). O componente `cutout` tenta usá-las como "recortes" com `filter: url(#sticker-outline)`, mas sem remover o fundo ficam quadradas/retangulares, não como recortes editoriais.

---

## Melhorias por Arquivo (o que mudar e onde)

---

### `backend/ai/video_scene_agent.py` — SYSTEM_PROMPT

**Problema:** queries youtube_search vagas, limite de 3.5s por cena (muito curto para narração), falta de instruções de design editorial.

**Melhorias no SYSTEM_PROMPT:**

```
MUDANÇAS:
1. youtube_search: queries mais específicas e contextuais (pessoa + evento + ano quando possível)
   Exemplos ruins:  "business finance news", "economy brazil"
   Exemplos bons:   "Gabriel Galipolo Banco Central audiencia senado 2025",
                    "oil pump jack field aerial", "Dubai skyline night aerial 4k"

2. Remover limite "Máximo 3.5 segundos por cena" — o ElevenLabs define a duração real.
   Deixar o modelo gerar duration_seconds como estimativa; o video.py vai sobrescrever
   com a duração real do áudio + 0.5s de respiro.

3. Adicionar instrução: para cenas "video", a youtube_search DEVE descrever
   exatamente o que aparece na narração naquele momento — não um tema geral.

4. Adicionar instrução: variar visual_type com mais equilíbrio —
   não concentrar todos os "video" no início ou no fim.

5. Adicionar instrução: cenas "cutout" com personagem real da notícia devem ter
   media_keyword = nome do personagem quando for nigro/perini,
   ou media_keyword = "newspaper" quando for contexto editorial.
```

---

### `backend/ai/media_fetcher.py` — `fetch_youtube_broll()`

**Problema:** sempre pega segundos 15–20, fallback é Big Buck Bunny.

**Mudanças:**

```python
# 1. Remover o download_ranges fixo de 15-20s
# Usar --download-sections "*0:00-0:08" para pegar o início do vídeo
# (mais provável de ser relevante e ter contexto visual imediato)

# 2. Substituir fallback por vídeos de fundo adequados por categoria
CATEGORY_FALLBACK_VIDEOS = {
    "investments": "output/assets/fallback_investments.mp4",   # bolsa de valores genérica
    "economy_br":  "output/assets/fallback_economy_br.mp4",    # imagem de São Paulo/Brasília
    "economy_int": "output/assets/fallback_economy_int.mp4",   # skyline urbano internacional
    "geopolitics": "output/assets/fallback_geopolitics.mp4",   # mapa/globo
    "crypto":      "output/assets/fallback_crypto.mp4",        # tela de trading/blockchain
    "general":     "output/assets/fallback_general.mp4",       # newsroom/jornal
}
# Baixar esses fallbacks uma vez (queries fixas de alta qualidade) e cachear permanentemente.

# 3. Aumentar duração do clip: 0:00-0:10 (10 segundos) em vez de 5s

# 4. Manter tentativas com fallback por categoria antes do "último recurso"
```

---

### `backend/api/video.py` — `generate_scenes_endpoint()`

**Problema:** `_adjust_scene_durations()` escala durações ANTES do ElevenLabs, depois o ElevenLabs sobrescreve com duração real + 0.4s, quebrando o total. O respiro é de 0.4s — aumentar para 0.5s.

**Mudanças:**

```python
# 1. Mudar respiro de +0.4s para +0.5s em process_scene_audio()
s["duration_seconds"] = round(actual_duration + 0.5, 2)  # era +0.4

# 2. NÃO chamar _adjust_scene_durations() nas cenas quando ElevenLabs estiver ativo.
# Quando o ElevenLabs roda, a duração REAL deve ser o áudio + 0.5s — ponto final.
# _adjust_scene_durations() só deve ser chamado no fallback sem ElevenLabs.

# 3. Para cenas "video" (isFloatingFrame em índices ímpares), o B-roll deve ser 
# obrigatoriamente fullscreen. Adicionar campo force_fullscreen_video=True nas
# cenas de visual_type="video" que têm background_video_url definido.
```

---

### `src/renderer/video/ReelsComposition.tsx` — NewsScene + VideoElement

**Problemas:** vídeo em moldura, Ken Burns fraco, glows não renderizados, cutout pequeno, exitOpacity cortando narração, paleta monótona.

#### 6.1 VideoElement — sempre fullscreen quando tem B-roll

```tsx
// REMOVER a lógica isFloatingFrame
// Quando há background_video_url, SEMPRE renderizar como fullscreen:
const VideoElement = ({ src, frame, durationInFrames, fps }) => {
  // Ken Burns no vídeo também
  const scale = interpolate(frame, [0, durationInFrames], [1.0, 1.08], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp"
  });
  return (
    <>
      <OffthreadVideo
        src={src}
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover",
          transform: `scale(${scale})`,  // Ken Burns no vídeo
        }}
        volume={0}
      />
      {/* Gradient overlay editorial */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to top, rgba(0,0,0,0.88) 20%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.70) 100%)",
      }} />
    </>
  );
};
```

#### 6.2 Ken Burns mais agressivo

```tsx
// Era: [1.0, 1.06] — muito sutil
// Novo: [1.0, 1.12] — perceptível e dinâmico
const cameraScale = interpolate(frame, [0, durationInFrames], [1.0, 1.12], {
  extrapolateLeft: "clamp", extrapolateRight: "clamp",
});
```

#### 6.3 exitOpacity — fade out mais curto para não cortar narração

```tsx
// Era: durationInFrames - fps * 0.25 (0.25s = 7.5 frames)
// Novo: apenas 3 frames de fade, e só se a cena for longa o suficiente
const exitOpacity = durationInFrames > 20
  ? interpolate(frame, [durationInFrames - 3, durationInFrames], [1, 0], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    })
  : 1;
```

#### 6.4 Cutout — maior e sem maxHeight limitante

```tsx
// Era: height: "44%", maxHeight: 520
// Novo: height: "58%", sem maxHeight
<Img
  src={scene.cutout_url}
  style={{
    position: "absolute",
    bottom: 100,
    right: assetSide === "right" ? 20 : "auto",
    left: assetSide === "left" ? 20 : "auto",
    height: "58%",          // era 44%
    // maxHeight: 520       // REMOVER este limite
    objectFit: "contain",
    // ... resto igual
  }}
/>
```

#### 6.5 Paletas — mais contraste e vibrantes

```tsx
// Adicionar tema "dark_editorial" para categorias que precisam de mais impacto
const CATEGORY_PALETTE: Record<string, Palette> = {
  investments:  { bg: "#F5F0E8", grad: "#E8E0D0", accent: "#1A3A6B", text: "#1E293B", dim: "rgba(26,58,107,0.09)" },
  economy_br:   { bg: "#0A1628", grad: "#0D1E35", accent: "#00C896", text: "#FFFFFF", dim: "rgba(0,200,150,0.09)" },  // dark + verde
  economy_int:  { bg: "#0B0E17", grad: "#060810", accent: "#E0A96D", text: "#FFFFFF", dim: "rgba(224,169,109,0.12)" },
  geopolitics:  { bg: "#1A0A0A", grad: "#2B1111", accent: "#D32F2F", text: "#FFFFFF", dim: "rgba(211,47,47,0.12)" },  // dark red
  crypto:       { bg: "#0D0D12", grad: "#06060A", accent: "#F59E0B", text: "#FFFFFF", dim: "rgba(245,158,11,0.12)" },
  general:      { bg: "#F5F0E8", grad: "#EFEBE1", accent: "#1A3A6B", text: "#1E293B", dim: "rgba(26,58,107,0.09)" },
};
```

#### 6.6 Tamanho das fontes — aumentar headline

```tsx
// Era: isHook ? 68 : 62
// Novo: isHook ? 88 : 76  (mais impacto, mais espaço ocupado)
const titleFontSize = isHook ? 88 : 76;
const subtextFontSize = 52;  // era 48
```

#### 6.7 Renderizar os glows (estavam declarados mas nunca usados no JSX)

```tsx
// Adicionar dentro do conteúdo principal, ANTES do grid:
<div style={{
  position: "absolute",
  left: glow1X, top: glow1Y,
  width: 400, height: 400,
  borderRadius: "50%",
  background: `radial-gradient(circle, ${pal.accent}18 0%, transparent 70%)`,
  transform: "translate(-50%, -50%)",
  pointerEvents: "none", zIndex: 1,
}} />
<div style={{
  position: "absolute",
  left: glow2X, top: glow2Y,
  width: 500, height: 500,
  borderRadius: "50%",
  background: `radial-gradient(circle, ${pal.accent}10 0%, transparent 70%)`,
  transform: "translate(-50%, -50%)",
  pointerEvents: "none", zIndex: 1,
}} />
```

---

### `backend/ai/video_scene_agent.py` — Lógica de duração

**Mudar limite de 3.5s:**

```python
# No SYSTEM_PROMPT, remover:
# "Máximo 3.5 segundos por cena para garantir dinamismo."
#
# Substituir por:
# "Estime duration_seconds com base no texto da narração (subtext):
#  ~0.45s por palavra + 0.5s de margem. Mínimo 2.0s, sem máximo fixo.
#  O sistema vai ajustar para a duração real do áudio ElevenLabs."
```

---

## Prioridade de Implementação

| Prioridade | Arquivo | Mudança | Impacto |
|---|---|---|---|
| 🔴 P0 | `ReelsComposition.tsx` | VideoElement sempre fullscreen | Visual imediato |
| 🔴 P0 | `ReelsComposition.tsx` | exitOpacity: 3 frames (era 7.5) | Narração não cortada |
| 🔴 P0 | `video.py` | Respiro +0.5s (era +0.4s) + não reescalar quando ElevenLabs ativo | Narração completa |
| 🔴 P0 | `media_fetcher.py` | download_ranges 0:00-0:10 (era 15-20s fixo) | B-roll relevante |
| 🔴 P0 | `ReelsComposition.tsx` | Paletas escuras para economy_br e geopolitics | Visual editorial |
| 🟡 P1 | `ReelsComposition.tsx` | Ken Burns 1.0→1.12 (era 1.06) | Dinamismo |
| 🟡 P1 | `ReelsComposition.tsx` | Cutout height 58% sem maxHeight (era 44% + max 520) | Elementos maiores |
| 🟡 P1 | `ReelsComposition.tsx` | Renderizar glows (declarados mas não usados) | Profundidade visual |
| 🟡 P1 | `video_scene_agent.py` | SYSTEM_PROMPT: youtube_search mais específico + remover limite 3.5s | Qualidade das cenas |
| 🟡 P1 | `ReelsComposition.tsx` | titleFontSize 76–88px (era 62–68px) | Legibilidade |
| 🟢 P2 | `media_fetcher.py` | Fallbacks por categoria (era Big Buck Bunny) | Contexto visual |
| 🟢 P2 | `video_scene_agent.py` | Queries youtube_search em PT-BR ou bilíngue | Relevância |
| 🟢 P2 | `video.py` | Não chamar _adjust_scene_durations() quando ElevenLabs ativo | Timing preciso |

---

## O que NÃO existe no projeto hoje (mas foi mencionado nas instruções)

- **nanobanana para fotos recortadas**: não há integração — fotos vêm do og:image do artigo. Para implementar: adicionar endpoint nanobanana em `media_fetcher.py` e criar nova keyword nos cutouts.
- **Remoção de fundo automática das fotos**: não há — `fetch_article_photos()` baixa a imagem bruta. Para implementar: usar `rembg` (Python) em `media_fetcher.py` antes de salvar.
- **DESIGN.md**: não existe no projeto Noticiando. Se existir em outro local, referenciar aqui.
- **Palavras grifadas em tempo real sincronizadas com narração**: o `CaptionEngine` existe mas não está sendo usado na `ReelsComposition` — está como componente separado. Para implementar: integrar o `CaptionEngine` nas cenas `video` e `b_roll`.
