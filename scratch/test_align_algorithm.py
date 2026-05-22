import re

def clean_word(w: str) -> str:
    return re.sub(r'[^\w]', '', w).lower()

def align_scenes_to_captions(scenes, all_captions):
    caption_cleaned = [clean_word(c["word"]) for c in all_captions]
    scene_captions = []
    cap_idx = 0
    num_captions = len(all_captions)

    for i, s in enumerate(scenes):
        text = s.get("subtext") or s.get("headline", "")
        # Normalization
        sanitized_text = text # or sanitize_narration_text(text)
        scene_words = [clean_word(w) for w in sanitized_text.split() if clean_word(w)]
        
        if i == len(scenes) - 1:
            scene_captions.append(all_captions[cap_idx:])
            continue
            
        best_end_idx = cap_idx
        temp_idx = cap_idx
        matched_positions = []
        
        for sw in scene_words:
            found = False
            for offset in range(6):
                target_pos = temp_idx + offset
                if target_pos < num_captions:
                    if caption_cleaned[target_pos] == sw:
                        temp_idx = target_pos + 1
                        matched_positions.append(target_pos)
                        found = True
                        break
            if not found:
                temp_idx += 1
                
        if matched_positions:
            best_end_idx = max(matched_positions) + 1
        else:
            best_end_idx = min(cap_idx + len(scene_words), num_captions)
            
        if best_end_idx <= cap_idx and cap_idx < num_captions:
            best_end_idx = cap_idx + len(scene_words)
            
        best_end_idx = min(best_end_idx, num_captions)
        
        remaining_scenes = len(scenes) - 1 - i
        max_allowed = num_captions - remaining_scenes
        best_end_idx = min(best_end_idx, max_allowed)
        
        if best_end_idx < cap_idx + 1 and cap_idx < num_captions:
            best_end_idx = cap_idx + 1
            
        scene_captions.append(all_captions[cap_idx:best_end_idx])
        cap_idx = best_end_idx
        
    return scene_captions

# Test cases
scenes = [
    {"subtext": "A Exxon voltou para a Venezuela."},
    {"subtext": "Trump abriu as portas do petróleo venezuelano."},
    {"subtext": "Quem controla o petróleo controla o futuro."}
]

# Scenario 1: Perfect match
all_captions_1 = [
    {"word": "A", "start": 0.0, "end": 0.1},
    {"word": "Exxon", "start": 0.1, "end": 0.5},
    {"word": "voltou", "start": 0.5, "end": 0.8},
    {"word": "para", "start": 0.8, "end": 1.0},
    {"word": "a", "start": 1.0, "end": 1.1},
    {"word": "Venezuela.", "start": 1.1, "end": 1.8},
    {"word": "Trump", "start": 1.8, "end": 2.2},
    {"word": "abriu", "start": 2.2, "end": 2.5},
    {"word": "as", "start": 2.5, "end": 2.6},
    {"word": "portas", "start": 2.6, "end": 3.0},
    {"word": "do", "start": 3.0, "end": 3.1},
    {"word": "petróleo", "start": 3.1, "end": 3.7},
    {"word": "venezuelano.", "start": 3.7, "end": 4.5},
    {"word": "Quem", "start": 4.5, "end": 4.8},
    {"word": "controla", "start": 4.8, "end": 5.2},
    {"word": "o", "start": 5.2, "end": 5.3},
    {"word": "petróleo", "start": 5.3, "end": 5.8},
    {"word": "controla", "start": 5.8, "end": 6.2},
    {"word": "o", "start": 6.2, "end": 6.3},
    {"word": "futuro.", "start": 6.3, "end": 7.0}
]

print("Perfect Match Alignment:")
aligned = align_scenes_to_captions(scenes, all_captions_1)
for idx, words in enumerate(aligned):
    print(f"Scene {idx+1}: {[w['word'] for w in words]}")

# Scenario 2: Extra words / different punctuation / numbers written out
# Scene 2 subtext: "Trump abriu as portas..." but caption has "Trump abriu de fato as portas..."
all_captions_2 = [
    {"word": "A", "start": 0.0, "end": 0.1},
    {"word": "Exxon", "start": 0.1, "end": 0.5},
    {"word": "voltou", "start": 0.5, "end": 0.8},
    {"word": "para", "start": 0.8, "end": 1.0},
    {"word": "a", "start": 1.0, "end": 1.1},
    {"word": "Venezuela.", "start": 1.1, "end": 1.8},
    {"word": "Trump", "start": 1.8, "end": 2.2},
    {"word": "abriu", "start": 2.2, "end": 2.5},
    {"word": "de", "start": 2.5, "end": 2.6},
    {"word": "fato", "start": 2.6, "end": 2.8},
    {"word": "as", "start": 2.8, "end": 2.9},
    {"word": "portas", "start": 2.9, "end": 3.3},
    {"word": "do", "start": 3.3, "end": 3.4},
    {"word": "petróleo", "start": 3.4, "end": 4.0},
    {"word": "venezuelano.", "start": 4.0, "end": 4.8},
    {"word": "Quem", "start": 4.8, "end": 5.1},
    {"word": "controla", "start": 5.1, "end": 5.5},
    {"word": "o", "start": 5.5, "end": 5.6},
    {"word": "petróleo", "start": 5.6, "end": 6.1},
    {"word": "controla", "start": 6.1, "end": 6.5},
    {"word": "o", "start": 6.5, "end": 6.6},
    {"word": "futuro.", "start": 6.6, "end": 7.3}
]

print("\nExtra Words Alignment:")
aligned = align_scenes_to_captions(scenes, all_captions_2)
for idx, words in enumerate(aligned):
    print(f"Scene {idx+1}: {[w['word'] for w in words]}")
