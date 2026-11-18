# Reel v2, step 1: timeline, caption band images, end card and .srt for a 1080 x 1350 (4:5) video.
#
#   python3 -I scripts/reel/plan.py <match slug> <work dir> --fonts DIR --logo FILE --hook "TEXT" [--ids g1,g2,g3]
#
# Reads matches/<slug>.json (facts, times, notes) and <work dir>/vo/<seq id>_<n>.mp3 (one voice file per
# coaching note; if missing, notes are timed at 15 characters a second). Writes <work dir>/plan.json,
# <work dir>/band/*.png, <work dir>/card.png and <work dir>/captions.srt.
# Layout: match clip 1080 x 608 at the top, caption band 1080 x 180, 3D pitch 1080 x 562 below.
# LinkedIn covers the bottom 15% (y > 1147): only the 3D pitch sits there, never text.
import argparse, json, math, os, re, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument('slug'); ap.add_argument('work')
ap.add_argument('--fonts', required=True, help='folder with Archivo-SemiBold.ttf, Archivo-Bold.ttf, Archivo-Regular.ttf, IBMPlexMono-Medium.ttf')
ap.add_argument('--logo', required=True); ap.add_argument('--hook', required=True)
ap.add_argument('--hook-seq', default=None, help='sequence whose last 2 s open the video (default: the open sequence)')
ap.add_argument('--ids', default=None); ap.add_argument('--url', required=True)
a = ap.parse_args()

PV = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
data = json.load(open(os.path.join(PV, 'matches', a.slug + '.json')))
M, seqs = data['match'], data['sequences']
if a.ids: seqs = [s for s in seqs if s['id'] in a.ids.split(',')]
FPS, W, H = 30, 1080, 1350
CLIP_H, BAND_Y, BAND_H = 608, 608, 180
VIEW_Y = BAND_Y + BAND_H
SAFE = int(H * 0.85)
INK, RULE, CHALK, MUTED = (13, 15, 20), (42, 46, 56), (236, 232, 221), (139, 144, 160)
teams = {t['code']: t for t in data['teams']}
hexc = lambda h: tuple(int(h.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))
F = lambda name, size: ImageFont.truetype(os.path.join(a.fonts, name), size)
CAP, LAB, HOOK = F('Archivo-SemiBold.ttf', 46), F('IBMPlexMono-Medium.ttf', 26), F('Archivo-Bold.ttf', 62)
os.makedirs(os.path.join(a.work, 'band'), exist_ok=True)

def wrap(text, font, width):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if font.getlength(t) <= width or not cur: cur = t
        else: lines.append(cur); cur = w
    lines.append(cur)
    return lines

def chunks(note, font, width):
    """Split a note into caption cards of at most two lines, breaking at sentence or clause ends."""
    parts = re.split(r'(?<=[.:;,])\s+', note)
    out, cur = [], ''
    for p in parts:
        t = (cur + ' ' + p).strip()
        if len(wrap(t, font, width)) <= 2: cur = t; continue
        if cur: out.append(cur)
        cur = p
        while len(wrap(cur, font, width)) > 2:  # a clause too long on its own: split by words
            ws, head = cur.split(), ''
            for i, w in enumerate(ws):
                if len(wrap((head + ' ' + w).strip(), font, width)) > 2: break
                head = (head + ' ' + w).strip()
            out.append(head); cur = ' '.join(ws[len(head.split()):])
    if cur: out.append(cur)
    return out

def band(name, label, text, font=CAP, color=CHALK, line=56):
    img = Image.new('RGB', (W, BAND_H), INK)
    d = ImageDraw.Draw(img)
    d.line([(0, 0), (W, 0)], fill=RULE, width=2)
    y = 18
    if label:
        d.text((44, y), label.upper(), font=LAB, fill=MUTED); y += 44
    lines = wrap(text, font, W - 88)
    assert len(lines) <= 2, (name, lines)
    if not label: y = (BAND_H - line * len(lines)) // 2 - 4
    for ln in lines:
        d.text((44, y), ln, font=font, fill=color); y += line
    path = os.path.join(a.work, 'band', name + '.png'); img.save(path)
    return path

def dur(path):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]))

segments, captions = [], []
t_out = 0.0
def cap(start, end, text):
    captions.append((start, end, text))

hook_id = a.hook_seq or data.get('open') or seqs[-1]['id']
for k, s in enumerate(seqs):
    start = s['events'][0]['t'] - 0.4
    D = s['end'] - start
    shot = next((e for e in s['events'] if e['type'] == 'shot'), s['events'][-1])
    team = teams[shot['team']]['name']
    voice, gap, lead = [], 0.5, 0.6
    for n, note in enumerate(s['notes']):
        f = os.path.join(a.work, 'vo', f"{s['id']}_{n}.mp3")
        voice.append({'file': f if os.path.exists(f) else None, 'len': dur(f) if os.path.exists(f) else len(note) / 15})
    L = max(3 * D, lead + sum(v['len'] for v in voice) + gap * (len(voice) - 1) + 0.9)
    seg = {'id': s['id'], 'start': start, 'D': D, 'clipStart': start + s['videoOffset'], 'shotAt': shot['from'],
           'goalT': shot['t'], 'L': L, 'voice': [], 'notes': []}
    # Real speed
    real_band = band(f"{s['id']}_real", f"Goal {k + 1} of {len(seqs)} · real speed · clip above, 3D pitch below",
                     f"{s['title']} · {s['label']} on the broadcast clock")
    seg['realBand'] = real_band
    # Slow replay: notes in caption cards, timed by the voice
    at = lead
    for n, (note, v) in enumerate(zip(s['notes'], voice)):
        cards = chunks(note, CAP, W - 88)
        total = sum(len(c) for c in cards)
        c0 = at
        for j, c in enumerate(cards):
            c1 = c0 + v['len'] * len(c) / total
            end = c1 if j < len(cards) - 1 else (at + v['len'] + (gap if n < len(voice) - 1 else L - at - v['len']))
            png = band(f"{s['id']}_n{n}_{j}", f"Replay at one-third speed · coaching note {n + 1} of {len(voice)}", c)
            seg['notes'].append({'note': n, 'from': c0, 'to': end, 'png': png})
            c0 = c1
        seg['voice'].append({'file': v['file'], 'at': at, 'len': v['len'], 'note': n})
        at += v['len'] + gap
    seg['leadBand'] = band(f"{s['id']}_lead", f"Replay at one-third speed", f"{team}: how the goal was made")
    segments.append(seg)

# Hook: the last 2 s of the hook sequence at real speed, with a 6-word line from the dataset
hook_seq = next(s for s in segments if s['id'] == hook_id)
hook = {'id': hook_id, 'from': hook_seq['D'] - 2.0, 'len': 2.0,
        'band': band('hook', None, a.hook, font=HOOK, color=hexc(teams[next(e for e in data['sequences'] if e['id'] == hook_id)['events'][-1]['team']]['accent']), line=70)}
assert len(a.hook.split()) <= 6, 'Hook must be six words or fewer'

# End card (4 s): logo, match line, link, one footer line. Text stays above the bottom 15%.
card = Image.new('RGB', (W, H), INK); d = ImageDraw.Draw(card)
logo = Image.open(a.logo).convert('RGBA'); logo.thumbnail((470, 470))
card.paste(logo, ((W - logo.width) // 2, 120), logo)
y = 120 + logo.height + 40
home, away = M['home'], M['away']
date = M['played'].split(',')[0]
def url_lines(u, font, width):
    """Break a long URL after a slash so no line runs off the card."""
    lines, cur = [], ''
    for part in re.split(r'(?<=/)', u):
        if cur and font.getlength(cur + part) > width: lines.append(cur); cur = part
        else: cur += part
    return lines + [cur]
for text, font, color, gap, url in [
    (f"{home} v {away}", F('Archivo-Bold.ttf', 52), CHALK, 6, False),
    (f"{M['competition']} · {date}", F('Archivo-SemiBold.ttf', 38), CHALK, 34, False),
    ('Full 3D analysis:', F('Archivo-Regular.ttf', 34), MUTED, 8, False),
    (a.url, F('IBMPlexMono-Medium.ttf', 34), hexc('#ffd84d'), 30, True),
]:
    for ln in (url_lines(text, font, W - 120) if url else wrap(text, font, W - 120)):
        d.text(((W - font.getlength(ln)) / 2, y), ln, font=font, fill=color); y += int(font.size * 1.3)
    y += gap
foot = F('Archivo-Regular.ttf', 28)
y = max(y + 10, 1000)
d.line([(60, y - 18), (W - 60, y - 18)], fill=RULE, width=2)
for ln in wrap('Positions hand-tagged by eye · threat and xG illustrative · players by shirt number only · footage used with the rights holder\'s permission.', foot, W - 120):
    d.text(((W - foot.getlength(ln)) / 2, y), ln, font=foot, fill=MUTED); y += 38
assert y < SAFE, f'end card footer runs into the bottom 15% (y {y})'
card.save(os.path.join(a.work, 'card.png'))

# Output timeline and captions (.srt)
t = 0.0
cap(t, t + 2.0, a.hook); t += 2.0
for seg in segments:
    s = next(x for x in data['sequences'] if x['id'] == seg['id'])
    seg['outReal'] = t
    cap(t, t + seg['D'], f"{s['title']} · {s['label']} on the broadcast clock (real speed)"); t += seg['D']
    seg['outSlow'] = t
    cap(t, t + seg['notes'][0]['from'], 'Replay at one-third speed')
    for n, note in enumerate(s['notes']):
        cards = [c for c in seg['notes'] if c['note'] == n]
        for c, txt in zip(cards, chunks(note, CAP, W - 88)):
            c['text'] = txt
            cap(t + c['from'], t + c['to'], txt)
    t += seg['L']
total = segments[-1]['outSlow'] + segments[-1]['L'] + 4.0
captions.sort()
def ts(x):
    ms = int(round(x * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s_, ms = divmod(ms, 1000)
    return f'{h:02}:{m:02}:{s_:02},{ms:03}'
with open(os.path.join(a.work, 'captions.srt'), 'w') as f:
    for i, (s0, s1, txt) in enumerate(captions, 1):
        f.write(f'{i}\n{ts(s0)} --> {ts(s1)}\n{txt}\n\n')
json.dump({'fps': FPS, 'W': W, 'H': H, 'clipH': CLIP_H, 'bandY': BAND_Y, 'viewY': VIEW_Y, 'viewH': H - VIEW_Y,
           'clipFps': data['clip']['fps'], 'hook': hook, 'segments': segments, 'card': os.path.join(a.work, 'card.png'),
           'total': total}, open(os.path.join(a.work, 'plan.json'), 'w'), indent=1)
print(f'{len(segments)} passages, {total:.1f} s, {len(captions)} captions')
