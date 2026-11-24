"""Generate the voiceover, one MP3 + word-timing JSON per scene in script.json.
Usage: python3 tts.py [voice]   (default en-KE-AsiliaNeural, female Kenyan English)
Other voices: edge-tts --list-voices  (e.g. en-KE-ChilembaNeural male, sw-KE-ZuriNeural Kiswahili)"""
import asyncio, json, os, ssl, sys, edge_tts
import edge_tts.communicate as ec
CA = "/root/.ccr/ca-bundle.crt"            # cloud-session proxy CA; ignored if absent
if os.path.exists(CA): ec._SSL_CTX = ssl.create_default_context(cafile=CA)
VOICE = sys.argv[1] if len(sys.argv) > 1 else "en-KE-AsiliaNeural"
os.makedirs("vo", exist_ok=True)
async def one(s):
    c = edge_tts.Communicate(s["text"], VOICE, rate="+0%", boundary="WordBoundary")
    words = []
    with open(f'vo/{s["id"]}.mp3', "wb") as f:
        async for ch in c.stream():
            if ch["type"] == "audio": f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append([ch["offset"]/1e7, (ch["offset"]+ch["duration"])/1e7, ch["text"]])
    json.dump(words, open(f'vo/{s["id"]}.json', "w"))
async def main():
    for s in json.load(open("script.json")): await one(s); print("voiced", s["id"])
asyncio.run(main())
