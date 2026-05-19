# 🎨 DESIGN — O Diretor de Arte dos Reels do Noticiando

```
      _____  ______  _____ _____  _____ _   _ 
     |  __ \|  ____|/ ____|_   _|/ ____| \ | |
     | |  | | |__  | (___   | | | |  __|  \| |
     | |  | |  __|  \___ \  | | | | |_ | . ` |
     | |__| | |____ ____) |_| |_| |__| | |\  |
     |_____/|______|_____/|_____|\_____|_| \_|
                                              
```

Este é o manual definitivo do **Diretor de Arte (DESIGN.md)** do **Noticiando**. Ele estabelece as diretrizes estéticas premium, regras estritas de motion design, tipografia, paletas de cores adaptativas, processamento de áudio/locução e distribuição de elementos na tela para gerar vídeos verticais (Reels 9:16) no mesmo padrão visual de veículos premium como *The Economist*.

---

## 💎 1. Direção Estética Geral (Estilo Editorial The Economist)

Para garantir que cada Reels se destaque no feed com uma identidade altamente sofisticada, aplicamos as seguintes regras:

* **Backgrounds Dinâmicos e Ricos (Obrigatório):** Toda a timeline deve possuir fundo texturizado e rico para evitar layouts lisos e simplistas.
  - **Textura de Papel/Grão:** Efeito granulado analógico de alta fidelidade misturado com cores quentes de papel.
  - **Moving Grid (Grade Deslizante):** Um padrão de grid sutil da cor `accent` que desliza diagonalmente ao longo do tempo.
  - **Gradientes Editoriais (HSL):** Gradientes lineares escuros e sutis (ângulos de 170deg) baseados no tema da notícia.
* **Colagem de Estilo "Editorial Impresso Digitalizado":**
  - **Não Repetição de Imagens:** Não repita a mesma imagem nas cenas, exceto se for estritamente necessário (ex: bandeiras de países ou figuras públicas conhecidas). Varie os ativos para manter o dinamismo visual do vídeo.
  - **Recortes Perfeitos (Cutouts):** Silhuetas de pessoas/objetos limpas e nítidas, **sem feather (bordas suavizadas/borradas)**.
  - **Sticker Stroke de 4px:** Todo recorte de colagem (`cutout` ou `illustration`) deve ter uma borda/contorno branco sólido de **cerca de 4px de espessura, nítido e sem blur**.
  - Estrelas, formas geométricas, listras e elementos gráficos minimalistas decorando o layout.
  - Fotos em preto e branco combinadas com cores de fundo vibrantes para contraste extremo.
  - Sombras fortes e profundas abaixo do sticker (`drop-shadow`) para dar sensação física de colagem tridimensional.

---

## 🎨 2. Paletas de Cores por Tema de Notícia

A paleta de cores deve ser coesa e se adaptar instantaneamente conforme o tema da notícia:

| Categoria / Tema | Identidade Visual | Fundo (`bg`) | Gradiente (`grad`) | Destaque (`accent`) | Brilho Dim (`dim`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Investimentos / Finanças** | Deep Blue & Orange | `#060A12` | `#0C172A` | `#F97316` (Laranja) | `#F9731620` |
| **Economia BR (Quente)** | Forest Green & Emerald | `#040D0A` | `#0A1F18` | `#10B981` (Verde Esmeralda) | `#10B98120` |
| **Mercado INT / Política (Frio)** | Indigo & Cyber Blue | `#07070C` | `#0F112D` | `#6366F1` (Indigo Neon) | `#6366F120` |
| **Geopolítica / Tensões** | Crimson & Blood Red | `#0E0505` | `#220909` | `#EF4444` (Vermelho) | `#EF444420` |
| **Cripto / Tecnologia** | Cyberpunk Gold & Amber | `#070B06` | `#0D1A0B` | `#F59E0B` (Amber Gold) | `#F59E0B20` |
| **Geral / Outros** | Beige & Textured Charcoal | `#07070C` | `#10101B` | `#FFFFFF` (Branco Puro) | `#F5F0E840` |

---

## ✍️ 3. Tipografia & Hierarquia do Roteiro

A tipografia deve manter contraste extremo e excelente legibilidade, mesmo em telas menores de celulares:

1. **Título Principal (Gancho / Hook):**
   - Fonte: **Oswald** (Bold ou SemiBold) em caixa alta (uppercase), com kerning (espaçamento de letras) apertado.
   - Tamanho mínimo na tela: **Nunca abaixo de 48px** para leitura rápida no mobile.
2. **Subtexto / Narrativa / Legendas:**
   - Fonte: **Inter** ou **Roboto** (Regular ou Light).
   - Tamanho mínimo na tela: **48px** (para legendas principais do Reels).
3. **Keyword Highlighting (Destaque de Palavras-Chave):**
   - Palavras com score de engajamento alto ou de foco recebem a cor `accent` da paleta do nicho correspondente e um leve efeito de brilho (`text-shadow`).

---

## 🎬 4. Estrutura do Reel & Regras de Dinamismo

* **[0s–2s] → INTRO impactante:** O título entra com animação agressiva, a trilha sonora se inicia e o background texturizado é exibido imediatamente.
* **[2s–Xs] → DESENVOLVIMENTO:** Narração clara sincronizada perfeitamente com elementos visuais de apoio na tela.
* **[Xs–fim] → CALL TO ACTION / Encerramento:** Apresentação da logo e assinatura visual da marca.
* **Regra de Dinamismo (Sem Tela Estática):**
  - **Máximo de 2,5 segundos** sem mudança visual (um novo elemento entrando, corte, transição ou animação).
  - Cada frase narrada deve ter pelo menos 1 elemento visual correspondente na tela.
  - **Elementos Obrigatórios por Reel:**
    - Pelo menos **1 vídeo real** ou corte curto do YouTube (máx 5s por trecho, uso editorial).
    - Pelo menos **2 recortes fotográficos** animados (cutouts).
    - Pelo menos **1 elemento gráfico decorativo** animado (linha, forma, estrela, ou ícone).

---

## ✍️ 5. Animações de Texto (Motion Design Sênior)

Nunca usar texto estático simplesmente "aparecendo" (fade simples sem movimento). Variar entre os seguintes estilos de animação:

### 1. Slide Up com Fade
```javascript
const translateY = interpolate(frame, [0, 15], [60, 0], { extrapolateRight: "clamp" });
const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
```

### 2. Scale In com Bounce
```javascript
const scale = spring({ 
  frame, 
  fps, 
  config: { stiffness: 200, damping: 15 } 
});
```

### 3. Letra por Letra (Stagger)
- Cada caractere entra individualmente com delay progressivo de 2 a 3 frames.

### 4. Wipe Horizontal
- O texto é revelado gradualmente usando uma máscara deslizante da esquerda para a direita.

### 5. Glitch / Distorção
- Um frame breve de ruído visual/glitch antes do texto se assentar na posição final.

### 6. Split Line
- A linha superior sobe enquanto a inferior desce, revelando o texto a partir do centro.

---

## 🎙️ 6. Processamento de Áudio & Trilha Sonora

### Narração (ElevenLabs)
* **Model ID:** `eleven_multilingual_v2`
* **Configurações recomendadas:**
  ```javascript
  {
    stability: 0.45,        // mais expressiva, menos robótica
    similarity_boost: 0.80,
    style: 0.35,            // leve estilo jornalístico
    use_speaker_boost: true
  }
  ```
* **Roteiro:** Adicionar vírgulas estratégicas para pausas naturais e reticências (`...`) para pausas dramáticas. Separar em chunks por cena para sincronização de ±0.3s com os elementos visuais.

### Trilha Sonora (Epidemic Sound)
* **Temas e Estilos de Trilha:**
  - *Política/Tensão:* `["cinematic tension", "news documentary", "investigative"]`
  - *Economia:* `["corporate upbeat", "data driven", "modern news"]`
  - *Ciência/Tecnologia:* `["futuristic ambient", "discovery", "tech minimal"]`
  - *Geral/Viral:* `["energetic news", "breaking news beat", "short form energy"]`
* **Configuração de Mixagem e Ducking:**
  - Volume da Trilha de fundo: `0.15` a `0.25` (não sobrepor narração).
  - Volume da Narração: `1.0`.
  - Fade-in da Trilha: `0.5s` no início.
  - **Duck Automático:** O volume da trilha deve diminuir automaticamente em **40%** sempre que a narração estiver ativa.
  - Fade-out da Trilha: `1.0s` antes do encerramento completo do vídeo.

---

## ✅ 7. Checklist Antes de Renderizar (Filtro do Diretor de Arte)

- [ ] **Nenhum trecho com mais de 2.5s** sem movimento visual ou nova entrada.
- [ ] **Todos os textos** em tela com tamanho **≥ 48px** e perfeitamente legíveis em celulares.
- [ ] Fonte **Oswald** ativa nos títulos principais.
- [ ] **Animações de texto variadas** (usando no mínimo 3 estilos de entrada diferentes).
- [ ] Narração sincronizada com elementos visuais de apoio com tolerância máxima de **±0.3s**.
- [ ] Trilha sonora mixada corretamente (narração cristalina + ducking de 40% na música de fundo).
- [ ] Paleta de cores coesa correspondente ao tema da notícia.
- [ ] Background texturizado contínuo ativo durante todo o vídeo.
- [ ] Pelo menos **1 corte de vídeo real** ou de YouTube incluído no Reel.
- [ ] Pelo menos **2 recortes fotográficos** animados com sombra suave aplicados.
- [ ] Pelo menos **1 elemento gráfico decorativo** animado presente.
- [ ] Transições fluidas aplicadas entre as cenas (evitando corte seco).
- [ ] Nenhuma marca d'água ou logo de terceiros visível.
- [ ] Resolução de exportação final em **1080x1920 @ 30fps**.

---

## 🎬 9. Regras de Mídia Híbrida (Video + Photo + Decorator)

### VideoBackground (`visual_type: "video"`)
- Usar `<OffthreadVideo>` do Remotion — necessário para render CLI; `<Video>` não funciona server-side.
- Overlay mínimo **60% de opacidade** sobre o vídeo: `linear-gradient(170deg, bg#99 0%, grad#cc 100%)` + vinheta superior/inferior.
- `volume={0}` sempre — áudio vem exclusivamente da narração ElevenLabs e trilha Epidemic.
- **Liberdade de Duração:** Vídeos de background podem durar mais tempo nas cenas se fizer sentido para ilustrar a narração.
- **Busca e Downloads:** Há liberdade e obrigação de baixar footages reais relevantes (noticiários, stock videos de pessoas/ações financeiras) e gerar imagens necessárias no nanobanana se necessário.

### PhotoCutout (`visual_type: "cutout"`)
- **Não Repetição:** Não repetir imagens ao longo das cenas (exceto se for uma bandeira ou figura pública proeminente).
- **Sem Feather:** O recorte da imagem deve ser nítido e seco, sem feather/suavização de borda.
- **Contorno de Sticker:** Borda branca sólida de **4px de espessura, completamente nítida e sem blur**.
- Posicionamento alternado: cenas pares → `right: -20px`; ímpares → `left: -20px`.
- Tamanho: largura **52%** da tela, `height: auto`, `objectPosition: bottom center`.
- Entrada: spring `translateX` (220px → 0), delay 6 frames + float `sin(frame/35)*6px`.
- **Obrigatório**: Filtro drop-shadow editorial de sombra projetada forte + o contorno branco nítido de 4px.

### DecoratorElement (todos os `visual_type` exceto CTA)
- 4 tipos: `star` | `arrow` | `circle` | `stripes` — escolher baseado no contexto emocional da cena.
- Tamanho 80×80px, cor `pal.accent`, `drop-shadow` glow.
- Pulse scale `0.92–1.08` (sin/30) + rotation `±6°` (sin/50).
- Alternado por `sceneIndex`: par → `top:100 right:40`; ímpar → `bottom:180 left:40`.
- Opacidade `enterSpring * 0.7` — sutil, não compete com headline.

### ✍️ Tipografia, Dinamismo e Quebra de Parágrafos
- **Dinamismo Textual:** Não colocar blocos de texto muito grandes para não perder o dinamismo do Reels.
- **Gramática Flexível:** Nem sempre as legendas ou títulos precisam seguir regras gramaticais rígidas de parágrafos. Podem entrar palavras isoladas ou frases muito curtas para reforçar dinamicamente o que está sendo dito na narração.

### Pipeline de Áudio
- **Narração ElevenLabs**: `volume={1.0}`, arquivo local `output/narration_*.mp3`.
- **Trilha Epidemic Sound**: `volume={0.18}`, arquivo local `output/media/music_*.mp3`, `loop`.
- **NUNCA** usar URLs externas (SoundHelix, CDNs) no render — somente arquivos `localhost:8765`.
- Ducking de 40% durante narração: implementar via pre-processamento no backend antes do render.