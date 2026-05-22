import re
import sys
from pathlib import Path

# Add backend to path to import sanitize_narration_text
sys.path.append(str(Path(__file__).resolve().parents[1] / "backend"))
from ai.voice_and_sound import sanitize_narration_text
from api.video import parse_custom_script

script_text = """🎬 TÍTULO: A Exxon Voltou para a Venezuela — e Isso Muda Tudo
📌 FORMATO: Reels Híbrido (Imagens reais de arquivo + Motion Graphics + Ilustrações)
⏱️ DURAÇÃO ESTIMADA: 60 segundos
🎯 OBJETIVO: Alertar / Informar

═══════════════════════════════════════════════════════

[00:00 - 00:06] 🎯 HOOK (Cena 1)
• Tipo Visual: hook
• Decorador: stripes
• Texto na Tela: "A EXXON VOLTOU PARA A VENEZUELA"
• Narração (Voz): "A maior petrolífera dos EUA está prestes a extrair petróleo no país que a expulsou duas vezes."
• Áudio/SFX: Boom grave + som de máquinas industriais pesadas arrancando

───────────────────────────────────────────────────────

[00:06 - 00:12] 🌎 CONTEXTO GEOPOLÍTICO (Cena 2)
• Tipo Visual: map
• Decorador: arrow
• Texto na Tela: "O MAIOR CAMPO DE PETRÓLEO DO MUNDO"
• Narração (Voz): "A Venezuela possui a maior reserva de petróleo do planeta — e estava bloqueada para os americanos há quase 20 anos."
• Brand Domain: exxonmobil.com

───────────────────────────────────────────────────────

[00:12 - 00:18] 🎥 B-ROLL HISTÓRICO (Cena 3)
• Tipo Visual: video
• Decorador: stripes
• Youtube Search: "venezuela oil fields aerial view lake maracaibo"
• Texto na Tela: "EXPULSA. HUMILHADA. ESQUECIDA."
• Narração (Voz): "Em 2007, Hugo Chávez nacionalizou os campos e forçou a Exxon a sair de mãos vazias."

───────────────────────────────────────────────────────

[00:18 - 00:28] 📊 DADOS DO CONFRONTO (Cena 4)
• Tipo Visual: data
• Decorador: circle
• Texto na Tela: "US$ 10 BILHÕES EM ATIVOS PERDIDOS"
• Narração (Voz): "O prejuízo foi colossal — o suficiente para construir dez usinas nucleares. E a empresa esperou quase duas décadas por uma reviravanche."

───────────────────────────────────────────────────────

[00:28 - 00:35] 🗞️ GUINADA POLÍTICA (Cena 5)
• Tipo Visual: newspaper_clip
• Decorador: arrow
• Texto na Tela: "TRUMP MUDA O JOGO"
• Narração (Voz): "Mas em janeiro de 2026, tudo virou: os EUA capturaram Maduro, e Trump abriu as portas do petróleo venezuelano."
• Fontes dos Recortes: NYT, BBC, Axios

───────────────────────────────────────────────────────

[00:35 - 00:41] 🎥 B-ROLL TRUMP (Cena 6)
• Tipo Visual: video
• Decorador: stripes
• Youtube Search: "Trump White House oil executives meeting 2026"
• Texto na Tela: "\\"VOCÊS NEGOCIAM COM OS EUA, NÃO COM A VENEZUELA\\""
• Narração (Voz): "Trump reuniu os maiores CEOs do petróleo e anunciou: o governo americano é o novo árbitro do ouro negro venezuelano."

───────────────────────────────────────────────────────

[00:41 - 00:47] ⚡ TENSÃO DRAMÁTICA (Cena 7)
• Tipo Visual: cutout
• Decorador: circle
• Personagem: Darren Woods (CEO Exxon) + Donald Trump
• Texto na Tela: "DE \\"IMPOSSÍVEL\\" A \\"ACORDO FECHADO\\""
• Narração (Voz): "O mesmo CEO que em janeiro disse ser 'impossível investir' — meses depois está a um passo de assinar o maior retorno corporativo da história recente."

───────────────────────────────────────────────────────

[00:47 - 00:53] 📈 ESCALA DO IMPACTO (Cena 8)
• Tipo Visual: timeline
• Decorador: arrow
• Texto na Tela: "UMA LINHA DO TEMPO DE PODER"
• Timeline Points:
  - 2007: "Chávez expulsa a Exxon e nationaliza campos"
  - 2026 Jan: "Trump captura Maduro — EUA assumem controle"
  - 2026 Mai: "Exxon negocia retorno histórico à Venezuela"
• Narração (Voz): "Dezenove anos. Dois líderes. Uma empresa. E um petróleo que nunca parou de valer trilhões."

───────────────────────────────────────────────────────

[00:53 - 00:60] 🔮 PAYOFF EXISTENCIAL (Cena 9)
• Tipo Visual: illustration
• Decorador: stripes
• Texto na Tela: "QUEM CONTROLA O PETRÓLEO, CONTROLA O FUTURO"
• Narração (Voz): "A pergunta não é se a Exxon vai lucrar. A pergunta é: quando o petróleo de um país pertence a outro, quem é realmente soberano?"
• Áudio/SFX: Fade de trilha tensa em acorde suspenso
"""

result = parse_custom_script(script_text, "geopolitics")
scenes = result["scenes"]

full_script_texts = []
for s in scenes:
    text = s.get("subtext") or s.get("headline", "")
    full_script_texts.append(text.strip())

full_script = " ".join(full_script_texts)
sanitized_full = sanitize_narration_text(full_script)
full_words = sanitized_full.split()

print(f"Total words in sanitized full script: {len(full_words)}")

# Now count words in individually sanitized scenes
individually_sanitized_words = []
scene_word_counts = []
for s in scenes:
    text = s.get("subtext") or s.get("headline", "")
    san = sanitize_narration_text(text)
    words = san.split()
    scene_word_counts.append(len(words))
    individually_sanitized_words.extend(words)

print(f"Total words individually sanitized: {len(individually_sanitized_words)}")
print(f"Is exact match: {full_words == individually_sanitized_words}")

if full_words != individually_sanitized_words:
    print("Differences:")
    for idx, (w1, w2) in enumerate(zip(full_words, individually_sanitized_words)):
        if w1 != w2:
            print(f"Index {idx}: Full script has '{w1}', individual has '{w2}'")
            break
else:
    print("Word lists match perfectly! Word counts per scene:")
    for i, count in enumerate(scene_word_counts):
        print(f"  Scene {i+1}: {count} words")
