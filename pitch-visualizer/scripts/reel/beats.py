# Reel v2.1, step 1b: voice-led replay timing. The voiceover is the clock.
#
#   python3 -I scripts/reel/beats.py <work dir> <beats.json> --fonts DIR
#
# Needs <work>/plan.json from plan.py and one voice file per caption line at <work>/vo2/<seq id>_c<n>.mp3
# (caption order, as in plan.json). For each line, the replay plays the beat's action span (match time
# 'from' to 'to') slowed so it fits the spoken words (between 1/12 speed and real speed), then holds a
# freeze-frame on 'to' until the next line starts. The ball paths in 'hl' light up for that line only.
# The camera pushes toward the shot while the action moves and holds still on freeze-frames.
# Writes segment['replay'] into plan.json (per-frame match time, camera, highlight; bands, voice, tags)
# and rewrites captions.srt to the new timing.
import argparse, json, os, subprocess
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser(); ap.add_argument('work'); ap.add_argument('beats'); ap.add_argument('--fonts', required=True)
a = ap.parse_args()
P = json.load(open(os.path.join(a.work, 'plan.json')))
B = json.load(open(a.beats))
FPS = P['fps']
LEAD, GAP, TAIL = 0.35, 0.45, 0.5
R_MIN, R_MAX, FILL = 1 / 12, 1.0, 0.85

def run(*args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *args], check=True)

def length(f):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]))

# Tags drawn on the clip panel, bottom left: what the viewer is watching right now
mono = ImageFont.truetype(os.path.join(a.fonts, 'IBMPlexMono-Medium.ttf'), 30)
tags = {}
for name, text in [('slow', 'SLOW MOTION'), ('real', 'REPLAY · REAL SPEED'), ('freeze', 'FREEZE-FRAME')]:
    w = int(mono.getlength(text)) + 40
    img = Image.new('RGBA', (w, 52), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, w - 1, 51], radius=10, fill=(13, 15, 20, 215), outline=(255, 216, 77, 255), width=2)
    d.text((20, 8), text, font=mono, fill=(255, 216, 77, 255))
    tags[name] = os.path.join(a.work, 'band', f'tag_{name}.png'); img.save(tags[name])

captions = []
t_out = 2.0
for seg in P['segments']:
    beats = B[seg['id']]
    cards = seg['notes']
    assert len(beats) == len(cards), f"{seg['id']}: {len(beats)} beats for {len(cards)} caption lines"
    frames, bands, voice, tagspans = [], [], [], []
    t = LEAD
    plays = []
    for i, (b, c) in enumerate(zip(beats, cards)):
        mp3 = os.path.join(a.work, 'vo2', f"{seg['id']}_c{i}.mp3")
        wav = mp3[:-4] + '.wav'
        # trim the voice file's own leading and trailing silence so the words start on the beat
        run('-i', mp3, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse',
            '-ar', '48000', '-ac', '2', wav)
        V = length(wav)
        span = b['to'] - b['from']
        r = min(R_MAX, max(R_MIN, span / (FILL * V)))
        play = span / r
        slot = max(V + GAP, play + 0.3)
        plays.append((t, play, slot, r, b, c, wav, V))
        t += slot
    L = t + TAIL - GAP
    total_play = sum(p[1] for p in plays)
    n = round(L * FPS)
    moved = 0.0
    for j in range(n):
        x = j / FPS
        k = max(i for i, p in enumerate(plays) if x >= p[0] or i == 0)
        s0, play, slot, r, b, c, wav, V = plays[k]
        local = x - s0
        moving = 0 <= local < play
        T = b['from'] + min(max(local, 0), play) * r
        if moving: moved += 1 / FPS
        frames.append({'T': round(T, 4), 'k': round(min(1, moved / total_play), 4), 'hl': b['hl'], 'tag': ('real' if r >= 0.95 else 'slow') if moving else 'freeze'})
    for k, (s0, play, slot, r, b, c, wav, V) in enumerate(plays):
        start = 0 if k == 0 else s0
        end = plays[k + 1][0] if k + 1 < len(plays) else L
        bands.append((c['png'], start, end))
        voice.append({'file': wav, 'at': s0, 'len': V})
        c['from'], c['to'], c['rate'] = s0, end, r
        captions.append((seg['outReal'] + seg['D'] + start, seg['outReal'] + seg['D'] + end, c['text']))
    # merge consecutive frames with the same tag into display spans
    cur = None
    for j, f in enumerate(frames):
        if not cur or cur[0] != f['tag']:
            cur = [f['tag'], j / FPS, (j + 1) / FPS]; tagspans.append(cur)
        else: cur[2] = (j + 1) / FPS
    seg['replay'] = {'L': L, 'frames': frames, 'bands': bands, 'voice': voice,
                     'tags': [(tags[g], s, e) for g, s, e in tagspans],
                     'window': [min(b['from'] for b in beats), max(b['to'] for b in beats)]}
    seg['L'] = L

# Re-time the whole video: hook, then per goal real speed + voice-led replay, then the 4 s end card
t = 2.0
for seg in P['segments']:
    seg['outReal'] = t; t += seg['D']; seg['outSlow'] = t; t += seg['L']
P['total'] = t + 4.0

hook_text = open(os.path.join(a.work, 'captions.srt')).read().split('\n')[2]
lines = [(0.0, 2.0, hook_text)]
real_text = {}
for block in open(os.path.join(a.work, 'captions.srt')).read().strip().split('\n\n'):
    txt = block.split('\n', 2)[2]
    if '(real speed)' in txt:
        real_text[len(real_text)] = txt
for i, seg in enumerate(P['segments']):
    lines.append((seg['outReal'], seg['outSlow'], real_text[i]))
    for c in seg['notes']:
        lines.append((seg['outSlow'] + c['from'], seg['outSlow'] + c['to'], c['text']))
def ts(x):
    ms = int(round(x * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s_, ms = divmod(ms, 1000)
    return f'{h:02}:{m:02}:{s_:02},{ms:03}'
with open(os.path.join(a.work, 'captions.srt'), 'w') as f:
    for i, (s0, s1, txt) in enumerate(lines, 1):
        f.write(f'{i}\n{ts(s0)} --> {ts(s1)}\n{txt}\n\n')
json.dump(P, open(os.path.join(a.work, 'plan.json'), 'w'), indent=1)
for seg in P['segments']:
    print(seg['id'], f"replay {seg['L']:.1f} s", ' '.join(f"1/{1 / c['rate']:.0f}" for c in seg['notes']))
print(f"total {P['total']:.1f} s")
