import sys
import re
from typing import Any

def parse_custom_script(text: str, category: str) -> dict[str, Any]:
    text = text.strip()
    pattern = r'\[(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\]'
    matches = list(re.finditer(pattern, text))
    
    scenes = []
    
    for i, match in enumerate(matches):
        start_min, start_sec, end_min, end_sec = map(int, match.groups())
        start_time = start_min * 60 + start_sec
        end_time = end_min * 60 + end_sec
        duration = float(end_time - start_time)
        if duration <= 0:
            duration = 5.0
            
        start_idx = match.end()
        end_idx = matches[i+1].start() if i + 1 < len(matches) else len(text)
        scene_body = text[start_idx:end_idx].strip()
        
        visual_type = "video"
        decorator_type = "none"
        headline = ""
        subtext = ""
        youtube_search = ""
        media_keyword = ""
        person_name = None
        brand_domain = None
        timeline_points = None
        
        for line in scene_body.split("\n"):
            line = line.strip()
            if not line:
                continue
                
            lower_line = line.lower()
            if "tipo visual:" in lower_line or "visual_type:" in lower_line or "visual type:" in lower_line:
                val = line.split(":", 1)[1].strip().strip('"').strip("'").lower()
                valid_types = ["hook", "video", "cutout", "illustration", "data", "map", "timeline", "collage", "split_video", "newspaper_clip"]
                for vt in valid_types:
                    if vt in val:
                        visual_type = vt
                        break
            elif "decorador:" in lower_line or "decorator_type:" in lower_line or "decorator:" in lower_line:
                val = line.split(":", 1)[1].strip().strip('"').strip("'").lower()
                valid_decorators = ["arrow", "circle", "stripes", "star", "none"]
                for dec in valid_decorators:
                    if dec in val:
                        decorator_type = dec
                        break
            elif "texto na tela:" in lower_line or "headline:" in lower_line or "texto:" in lower_line:
                headline = line.split(":", 1)[1].strip().strip('"').strip("'")
            elif "narração" in lower_line or "narracao" in lower_line or "subtext:" in lower_line or "voz:" in lower_line:
                subtext = line.split(":", 1)[1].strip().strip('"').strip("'")
            elif "youtube search:" in lower_line or "youtube:" in lower_line or "busca:" in lower_line:
                youtube_search = line.split(":", 1)[1].strip().strip('"').strip("'")
            elif "brand domain:" in lower_line or "brand:" in lower_line or "marca:" in lower_line:
                brand_domain = line.split(":", 1)[1].strip().strip('"').strip("'")
            elif "personagem:" in lower_line or "person_name:" in lower_line or "figura:" in lower_line or "character:" in lower_line:
                person_name = line.split(":", 1)[1].strip().strip('"').strip("'")
            elif "keyword:" in lower_line or "media_keyword:" in lower_line:
                val = line.split(":", 1)[1].strip().strip('"').strip("'").lower()
                valid_keywords = ["money", "growth", "crypto", "chart", "bitcoin", "briefcase", "newspaper"]
                for kw in valid_keywords:
                    if kw in val:
                        media_keyword = kw
                        break
                
        if visual_type == "timeline" or "timeline" in scene_body.lower():
            points = []
            for line in scene_body.split("\n"):
                line = line.strip()
                match_pt = re.match(r'^(?:[-•*\s]+)?([^:]+?)\s*:\s*["\']?([^"\']+)["\']?$', line)
                if match_pt:
                    label, val_pt = match_pt.groups()
                    if label.lower() in ["tipo visual", "decorador", "texto na tela", "narração", "narraca", "narraçao", "áudio/sfx", "sfx", "audio/sfx", "brand domain"]:
                        continue
                    points.append({"label": label, "value": val_pt})
            if len(points) == 3:
                timeline_points = points
            elif len(points) > 0:
                while len(points) < 3:
                    points.append({"label": "PROJEÇÃO", "value": "Dados futuros"})
                timeline_points = points[:3]
                
        if not headline and subtext:
            headline = subtext[:30].upper()
        if not subtext and headline:
            subtext = headline
            
        scenes.append({
            "id": f"scene_{i+1}",
            "headline": headline,
            "subtext": subtext,
            "duration_seconds": duration,
            "visual_type": visual_type,
            "decorator_type": decorator_type,
            "youtube_search": youtube_search or None,
            "media_keyword": media_keyword or None,
            "person_name": person_name,
            "brand_domain": brand_domain,
            "timeline_points": timeline_points
        })
        
    return {"scenes": scenes}

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
for i, scene in enumerate(result["scenes"]):
    print(f"Cena {i+1}:")
    print(f"  Visual: {scene['visual_type']}")
    print(f"  Decorator: {scene['decorator_type']}")
    print(f"  Headline: {scene['headline']}")
    print(f"  Subtext: {scene['subtext']}")
    print(f"  Youtube: {scene['youtube_search']}")
    print(f"  Brand: {scene['brand_domain']}")
    print(f"  Person: {scene['person_name']}")
    print(f"  Timeline: {scene['timeline_points']}")
