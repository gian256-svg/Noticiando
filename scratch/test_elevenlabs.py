import asyncio
import os
import sys
from pathlib import Path

# Add backend directory to path
sys.path.append(str(Path(__file__).resolve().parent.parent / "backend"))

from ai.voice_and_sound import generate_narration, ELEVENLABS_API_KEY
import logging

logging.basicConfig(level=logging.INFO)

async def test():
    print(f"ElevenLabs Key: {ELEVENLABS_API_KEY[:10]}...")
    text = "A maior petrolífera dos EUA está prestes a extrair petróleo no país que a expulsou duas vezes. A Venezuela possui a maior reserva de petróleo do planeta."
    print("Generating narration...")
    result = await generate_narration(text)
    print("Result:", result)

if __name__ == "__main__":
    asyncio.run(test())
