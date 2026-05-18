# 🎨 DESIGN — O Diretor de Arte dos Reels do Noticiando

```
      _____  ______  _____ _____  _____ _   _ 
     |  __ \|  ____|/ ____|_   _|/ ____| \ | |
     | |  | | |__  | (___   | | | |  __|  \| |
     | |  | |  __|  \___ \  | | | | |_ | . ` |
     | |__| | |____ ____) |_| |_| |__| | |\  |
     |_____/|______|_____/|_____|\_____|_| \_|
                                              
```

Este é o manual do **Diretor de Arte (DESIGN.md)** do **Noticiando**. Ele estabelece as diretrizes estéticas premium, regras de motion design, tipografia, paletas de cores por nicho e sincronização visual para todos os vídeos verticais (Reels 9:16) gerados na pipeline.

---

## 💎 1. Direção Estética Geral (Premium Minimalist)

Para garantir que cada Reels se destaque no feed com uma identidade sofisticada e profissional, aplicamos os seguintes conceitos estéticos:

* **Fundo Dinâmico (Dynamic Backgrounds):** Gradientes lineares escuros e sutis (ângulos de 170deg) que dão profundidade ao vídeo, evitando fundos pretos chapados.
* **Textura de Grão Global (Film Grain Overlay):** Uma camada sutil de ruído/grão analógico por cima da composição, agregando textura cinematográfica.
* **Efeito Glassmorphism:** Cards de texto com fundo translúcido (`rgba(255,255,255,0.03)`), bordas extremamente sutis (`rgba(255,255,255,0.08)`) e desfoque de fundo (`backdrop-filter: blur(16px)`).
* **Varredura de Luz (Ambient Glow Sweeps):** Um círculo desfocado de cor vibrante com animação oscilante lenta em posições randômicas no fundo para simular iluminação de estúdio profissional.

---

## 🎨 2. Paletas de Cores por Nicho de Conteúdo

Cada categoria de notícia possui uma paleta de cores curada, gerando reconhecimento visual instantâneo pelo espectador:

| Categoria | Identidade Visual | Fundo (`bg`) | Gradiente (`grad`) | Destaque (`accent`) | Brilho Dim (`dim`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Investimentos** | Deep Blue & Orange | `#060A12` | `#0C172A` | `#F97316` (Laranja) | `#F9731620` |
| **Economia BR** | Forest Green & Emerald | `#040D0A` | `#0A1F18` | `#10B981` (Verde Esmeralda) | `#10B98120` |
| **Mercado INT** | Indigo & Cyber Blue | `#07070C` | `#0F112D` | `#6366F1` (Indigo Neon) | `#6366F120` |
| **Geopolítica** | Crimson & Blood Red | `#0E0505` | `#220909` | `#EF4444` (Vermelho) | `#EF444420` |
| **Cripto** | Cyberpunk Gold & Amber | `#070B06` | `#0D1A0B` | `#F59E0B` (Amber Gold) | `#F59E0B20` |
| **Geral** | Dark Slate & Bright Coral | `#07070C` | `#10101B` | `#F97316` (Laranja Coral) | `#F9731620` |

---

## ✍️ 3. Tipografia & Hierarquia do Roteiro

A tipografia deve manter contraste extremo e excelente legibilidade, mesmo em telas menores de celulares:

1. **Título da Notícia (News Title):** 
   - Fonte: **Montserrat** (ou sans-serif condensada) em caixa alta (uppercase).
   - Peso: `ExtraBold (800)` ou `Black (900)`.
   - Propósito: Estabelecer impacto instantâneo no gancho (hook) inicial do vídeo.
2. **Subtexto / Narrativa (Subtext):**
   - Fonte: **Inter** ou **Outfit**.
   - Peso: `Medium (500)` ou `SemiBold (600)`.
   - Propósito: Legendar a voz do narrador com suavidade.
3. **Keyword Highlighting (Destaque de Palavras-Chave):**
   - Palavras com score de engajamento alto ou de foco recebem a cor `accent` da paleta do nicho correspondente e um leve efeito de brilho (`text-shadow`).

---

## 🎬 4. Regras de Motion Design & Câmera

A fluidez dos vídeos é ditada por transições e movimentos contínuos (nunca estáticos):

* **Efeito Ken Burns (Slow Camera Zoom):**
   - Cada cena executa um zoom-in ultra lento e contínuo, iniciando em `scale: 1.0` e terminando em `scale: 1.06` ao fim do tempo da cena.
* **Transições por Mola (Spring Transitions):**
   - Entradas de elementos gráficos (cards, logos, fontes de notícias) usam equações de mola física (`spring` da Remotion) com amortecimento (`damping: 16`) e rigidez (`stiffness: 130`) para uma sensação tátil orgânica.
* **Exit Opacity:**
   - Nos últimos `0.25` segundos de cada cena, a opacidade dos elementos gráficos faz um fade-out rápido para `0` para que a próxima cena surja de forma limpa.

---

## 🏁 5. Checklist para Modificações de Roteiro e Cenas
Ao atualizar ou expandir o renderizador dos Reels (`ReelsComposition.tsx` ou scripts de compilação Remotion), o desenvolvedor deve:
- [ ] Validar o contraste das paletas de cores.
- [ ] Garantir que o grão de filme (`film grain`) esteja rodando de forma fluida a 30fps.
- [ ] Verificar a centralização e espaçamento de segurança inferior das legendas (evitando sobreposição com a barra de progresso do Instagram/TikTok).
