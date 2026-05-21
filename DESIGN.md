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
   - Tamanho mínimo na tela: **110px para Hook e 76px para demais títulos** para garantir extremo impacto visual.
   - **Diagramação e Alinhamento:** Todo o layout de texto é centralizado horizontalmente e empilhado verticalmente com o conteúdo visual. Na cena 0 (Hook), o subtext e os contadores de métricas/porcentagens são omitidos para evitar redundâncias na tela.
2. **Subtexto / Narrativa / Legendas:**
   - Fonte: **Inter** ou **Roboto** (Regular ou Light).
   - Tamanho mínimo na tela: **52px** (para legendas principais do Reels, nunca abaixo disso).
3. **Keyword Highlighting (Destaque de Palavras-Chave):**
   - Palavras com score de engajamento alto ou de foco recebem a cor `accent` da paleta do nicho correspondente e um leve efeito de brilho (`text-shadow`).

---

## 🎬 4. Estrutura do Reel & Regras de Dinamismo

* **[0s–2s] → INTRO impactante:** O título entra com animação agressiva, a trilha sonora se inicia e o background texturizado é exibido imediatamente.
* **[2s–Xs] → DESENVOLVIMENTO:** Narração clara sincronizada perfeitamente com elementos visuais de apoio na tela.
* **[Xs–fim] → CONCLUSÃO / PROLONGAMENTO:** Fechamento e conclusão didática/analítica da notícia, prolongando o vídeo sem CTA ou assinaturas de encerramento.
* **Regra de Dinamismo (Sem Tela Estática):**
  - **Máximo de 3.0 segundos** sem mudança visual para cenas estáticas (cutout, illustration, data, etc.) — idealmente cada cena dura entre 2.0s e 3.0s.
  - **Exceção de Pacing:** Cenas do tipo `video` ou `split_video` (vídeos em tela cheia) estão isentas da limitação de 3.0 segundos, durando o tempo completo falado de seu trecho correspondente no roteiro.
  - Cada frase narrada deve ter no máximo 10-12 palavras no roteiro para corresponder a esse ritmo de cortes rápidos.
  - **Texto em Movimento Contínuo:** O contêiner de headline/legendas possui uma animação contínua de escala (escala progressiva de 1.0 a 1.05) para manter dinamismo visual enquanto a cena está ativa.
  - **Remoção de Elementos Fixos:** A marca d'água "NOTICIANDO" e a categoria "BREAKING" foram removidas permanentemente das telas.
  - **Garantia de Unicidade (Bust Caching):** Um `generation_id` gerado no início da request serve de sal para os hashes de imagem (`image_generator.py`) e vídeos (`media_fetcher.py`), forçando o download e a geração de mídias novas. O download de B-roll extrai os top 5 resultados do YouTube e escolhe uma URL aleatória do top 3.
  - Cada frase narrada deve ter pelo menos 1 elemento visual correspondente na tela.
  - **Elementos Obrigatórios por Reel:**
    - Pelo menos **1 vídeo real** ou corte curto do YouTube (uso editorial).
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
- **Fullscreen Obrigatório:** O vídeo DEVE ocupar 100% da tela (sem bordas flutuantes).
- Overlay mínimo **60% de opacidade** sobre o vídeo: `linear-gradient(to top, rgba(0,0,0,0.88) 20%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.70) 100%)`.
- `volume={0}` sempre — áudio vem exclusivamente da narração ElevenLabs e trilha Epidemic.
- **Ken Burns agressivo:** O vídeo deve ter um zoom contínuo de 1.0 para 1.12 para manter dinamismo.
- **Busca e Downloads (yt-dlp):** Extrair os 10 primeiros segundos reais (`0:00-0:10`) via queries específicas.

### PhotoCutout & Illustration Sticker (`visual_type: "cutout" | "illustration"`)
- **Não Repetição:** Não repetir imagens ao longo das cenas (exceto se for uma bandeira ou figura pública proeminente).
- **Sem Feather:** O recorte da imagem deve ser nítido e seco, sem feather/suavização de borda.
- **Empilhamento Vertical e Margin-to-Margin:** O contêiner de texto principal fica posicionado no topo, liberando a metade inferior para o asset visual. Os stickers ocupam **88% da largura da tela** (centralizados com `left: "6%"`) e altura de `46%` (com `bottom: 110-120px`) para maximizar o preenchimento da tela e evitar grandes vazios.
- **Moldura Scrapbook Tracejada (Glow & Depth):** O sticker fica envelopado em um contêiner com um cartão de fundo tracejado deslocado (`border: "2px dashed ...", background: "..."`), criando profundidade tridimensional física.
- **Contorno de Sticker:** Borda branca sólida de **4px de espessura, completamente nítida e sem blur** (filtro `#sticker-outline`).
- Posicionamento alternado: cenas pares → `right: 50px`; ímpares → `left: 50px`.
- Entrada: spring `translateY` (380px → 0), delay 6 frames + float `cos(frame/12)*8px`.
- **Obrigatório**: Filtro drop-shadow editorial de sombra projetada forte.

### DecoratorElement & Context-Aware Arrow
- **Seta Direcional Contextual:** O decorator `arrow` (seta desenhada) ajusta dinamicamente sua rotação, margem e direção baseando-se no lado em que o asset visual (cutout/illustration) está posicionado, ou na posição de gráficos/jornais na tela.
- **Fallback de Setas:** Se a cena possuir o decorator `arrow` mas não tiver nenhum asset visual ou dados na tela, ela faz fallback automático para `star` (estrela decorativa), evitando setas apontando para o vazio.
- **Outros Decoradores:** `circle` | `stripes` | `star` continuam disponíveis para ambientação analógica.

### Visualização de Dados Premium (Gráficos Sóbrios de Ponta a Ponta)
- **Variedade Tripla de Gráficos:** Alterna ciclicamente com base no índice da cena (`sceneIndex % 3`):
  1. *Bar Chart:* 4 barras verticais retangulares com bordas sólidas.
  2. *Area Line Chart:* Gráfico de linha e área sombreada contínua via SVG.
  3. *Radial Donut Chart:* Círculo de progresso radial elegante ao lado de legenda de texto.
- **Layout Margin-to-Margin:** O card de dados é expandido de 580px para **maxWidth: 1020px** e o padding lateral da cena é dinamicamente reduzido de 80px para 30px quando há dados na tela (`isData === true`). A altura dos gráficos foi ampliada para **280px** (e **300px** para o donut radial). Isso garante que o gráfico ocupe toda a largura disponível de margem a margem.
- **Sem Marcas D'água:** Proibido o uso de marcas "Noticiando" ou logos redundantes nos cabeçalhos dos gráficos.
- **Animação de Métricas (BigMetricCounter):** Qualquer cena com valores ou porcentagens (mesmo que não seja uma cena do tipo `data`, exceto na cena 0 do Hook) deve renderizar o componente `<BigMetricCounter>` para rolagem dinâmica animada de números em fonte *Oswald* gigante com rotação sutil.

### Recortes de Jornal (NewspaperCutout)
- **Tamanho Margin-to-Margin:** A largura é aumentada de 86% para **88%** (`left: 6%`) para expandir de margem a margem.
- **Legibilidade e Panning Controlado:** A escala é travada em no máximo 1.0-1.05 e o deslocamento horizontal (`hPan`) é zerado. Isso evita que trechos do jornal saiam da tela e garante leitura confortável. Fontes de título maiores (`fontSize: 28px`, `lineHeight: 1.15`) e corpo do texto maior (`fontSize: 15px`).

### Falsos Positivos de Bandeiras e Geração de Logos de Empresas
- **Word-Boundary para Bandeiras:** A identificação de palavras para inserção de bandeiras de países (como a bandeira do Irã) utiliza limites de palavra (`\bira\b` ou Regex exata em português "irã" e não substring "ira"), impedindo que palavras normais como "financeira" ou "carteira" acionem a inserção de bandeiras falsas.
- **Foco em Logos de Empresas:** Quando o roteiro mencionar uma empresa (ex: Hyperliquid, Nvidia), o agente deve requisitar o visual do tipo `cutout` com a palavra-chave `<NomeDaEmpresa> logo`. A geração de imagens com a palavra "logo" no termo causará o desvio do filtro negativo "logo" do gerador e o preenchimento automático do prompt com instruções para criar um ícone vetorial plano em fundo branco nítido, que será recortado centralizado e ampliado na tela, acompanhado do crescimento de métricas.

### TimelineBackground Estilizado
- **Linha Direcional Baixa:** Linha horizontal vermelha deslocada para `72%` de altura para evitar overlap com o texto central.
- **Marcadores de Projeção:** Rótulos estruturados ("ANTERIOR", "PRESENTE", "PROJEÇÃO") com animação de escala independente.
- **Termos de Mercado Financeiro:** Textos de fundo em português de baixo contraste com jargões reais do mercado de capitais (COPOM, SELIC, IBOVESPA).

### ✍️ Tipografia, Dinamismo e Quebra de Parágrafos
- **Dinamismo Textual:** Não colocar blocos de texto muito grandes para não perder o dinamismo do Reels.
- **Gramática Flexível:** Nem sempre as legendas ou títulos precisam seguir regras gramaticais rígidas de parágrafos. Podem entrar palavras isoladas ou frases muito curtas para reforçar dinamicamente o que está sendo dito na narração.

### Pipeline de Áudio
- **Narração ElevenLabs**: `volume={1.0}`, arquivo local `output/narration_*.mp3`.
- **Trilha Epidemic Sound**: `volume={0.18}`, arquivo local `output/media/music_*.mp3`, `loop`.
- **NUNCA** usar URLs externas (SoundHelix, CDNs) no render — somente arquivos `localhost:8765`.
- Ducking de 40% durante narração: implementar via pre-processamento no backend antes do render.