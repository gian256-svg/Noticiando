"""
cerebro.py — O gerenciador e carregador do CEREBRO de Noticiando
Lê RULES.md, BUGS.md, CEREBRO.md e valida a saúde de todo o ecossistema na inicialização.
"""

import os
import logging
from pathlib import Path
from typing import Dict, Any, List
from dotenv import load_dotenv

# Carregar variáveis do arquivo .env
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

logger = logging.getLogger("noticiando.cerebro")

PROJECT_ROOT = Path(__file__).resolve().parents[2]

def read_markdown_file(path: Path) -> str:
    if not path.exists():
        return ""
    try:
        return path.read_text(encoding="utf-8")
    except Exception as e:
        logger.error(f"Erro ao ler {path.name}: {e}")
        return ""

def parse_active_bugs(bugs_content: str) -> List[str]:
    """Parseia de forma simples os tópicos de bugs ativos em BUGS.md"""
    active = []
    in_active_section = False
    for line in bugs_content.splitlines():
        line_strip = line.strip()
        if "## Bugs Ativos" in line or "🔴 Bugs Ativos" in line:
            in_active_section = True
            continue
        if in_active_section and line_strip.startswith("##"):
            # Encontrou outra seção principal
            in_active_section = False
        if in_active_section and line_strip.startswith("- [ ]"):
            active.append(line_strip.replace("- [ ]", "").strip())
    return active[:5] # Limita a 5 itens principais

def parse_active_rules(rules_content: str) -> List[str]:
    """Parseia tópicos pendentes ou importantes em RULES.md"""
    rules = []
    for line in rules_content.splitlines():
        line_strip = line.strip()
        if line_strip.startswith("- [ ]") or (line_strip.startswith("-") and "prioridade" in line_strip.lower()):
            rules.append(line_strip.replace("- [ ]", "").replace("-", "").strip())
    return rules[:5]

class CerebroCommander:
    def __init__(self):
        self.cerebro_path = PROJECT_ROOT / "CEREBRO.md"
        self.rules_path = PROJECT_ROOT / "RULES.md"
        self.design_path = PROJECT_ROOT / "DESIGN.md"
        self.bugs_path = PROJECT_ROOT / "BUGS.md"
        
        self.rules_loaded = False
        self.design_loaded = False
        self.bugs_loaded = False
        self.system_ready = False
        
        self.active_bugs: List[str] = []
        self.active_rules: List[str] = []
        self.api_status: Dict[str, str] = {}

    def run_startup_audit(self):
        """Executa a auditoria completa de arquivos e APIs na inicialização"""
        print("\n" + "="*80)
        print(" [ CEREBRO ] — INICIANDO COMANDANTE DO NOTICIANDO")
        print("="*80)

        # 1. Carregar arquivos importantes
        cerebro_text = read_markdown_file(self.cerebro_path)
        rules_text = read_markdown_file(self.rules_path)
        design_text = read_markdown_file(self.design_path)
        bugs_text = read_markdown_file(self.bugs_path)

        if cerebro_text:
            print(" [ OK ] CEREBRO.md: Encontrado e Carregado com Sucesso.")
        else:
            print(" [ WARN ] CEREBRO.md: Nao encontrado no diretorio raiz.")

        if rules_text:
            self.rules_loaded = True
            self.active_rules = parse_active_rules(rules_text)
            print(f" [ OK ] RULES.md: Carregado. {len(self.active_rules)} diretrizes de alta prioridade mapeadas.")
        else:
            print(" [ FAIL ] RULES.md: ARQUIVO CRITICO DE REGRAS AUSENTE!")

        if design_text:
            self.design_loaded = True
            print(" [ OK ] DESIGN.md: Carregado. Diretor de Arte ativo para montagem de Reels.")
        else:
            print(" [ WARN ] DESIGN.md: Nao encontrado no diretorio raiz.")

        if bugs_text:
            self.bugs_loaded = True
            self.active_bugs = parse_active_bugs(bugs_text)
            print(f" [ OK ] BUGS.md: Carregado. {len(self.active_bugs)} bugs ativos sob observacao.")
        else:
            print(" [ WARN ] BUGS.md: Nao encontrado no diretorio raiz.")

        # 2. Auditar Chaves API no .env
        providers = {
            "Google Gemini": "GEMINI_API_KEY",
            "Groq (Llama)": "GROQ_API_KEY",
            "OpenRouter (Llama/Gemma)": "OPENROUTER_API_KEY",
            "Ollama (Local)": "OLLAMA_BASE_URL",
            "ElevenLabs (Locucao)": "ELEVENLABS_API_KEY",
            "Envato Elements": "ENVATO_API_KEY",
            "Epidemic Sound": "EPIDEMIC_SOUND_TOKEN"
        }

        print("\n [ API ] STATUS DE CONEXAO E INTEGRADORES:")
        for name, env_var in providers.items():
            val = os.getenv(env_var, "")
            if val:
                status = "ATIVO"
                if env_var == "OLLAMA_BASE_URL":
                    status = f"ATIVO ({val})"
                self.api_status[name] = "active"
                print(f"   * {name:<22}: [ {status} ]")
            else:
                self.api_status[name] = "missing"
                print(f"   x {name:<22}: [ INDISPONIVEL / NAO CONFIGURADO ]")

        self.system_ready = self.rules_loaded and self.design_loaded
        
        print("\n" + "="*80)
        if self.system_ready:
            print(" [ OK ] CEREBRO: AUDITORIA CONCLUIDA. SISTEMA 100% OPERACIONAL.")
        else:
            print(" [ FAIL ] CEREBRO: AUDITORIA CONCLUIDA COM FALHAS CRITICAS NO AMBIENTE.")
        print("="*80 + "\n")

    def get_status_dict(self) -> Dict[str, Any]:
        """Retorna o estado consolidado para consumo na API"""
        return {
            "system_ready": self.system_ready,
            "rules_loaded": self.rules_loaded,
            "design_loaded": self.design_loaded,
            "bugs_loaded": self.bugs_loaded,
            "active_bugs": self.active_bugs,
            "active_rules": self.active_rules,
            "api_status": self.api_status
        }

# Instância única global do comandante CEREBRO
cerebro = CerebroCommander()
