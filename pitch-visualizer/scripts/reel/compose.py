# Reel v2, step 3: compose the 1080 x 1350 master from plan.json, the source clip and the captured frames.
#
#   python3 -I scripts/reel/compose.py <work dir> <source clip> <out.mp4>
#
# Builds each part (hook, then per passage: real speed, one-third-speed replay) as an intermediate file,
# then joins them with the end card and encodes once: H.264 High, yuv420p, 30 fps, AAC 128k, +faststart.
# Audio: stadium sound at real speed; under the replay the voice notes over the stadium sound at 16%.
import json, os, subprocess, sys

work, src, out = sys.argv[1:4]
P = json.load(open(os.path.join(work, 'plan.json')))
FPS, W, H, CH, BY, VY = P['fps'], P['W'], P['H'], P['clipH'], P['bandY'], P['viewY']
parts = os.path.join(work, 'parts'); os.makedirs(parts, exist_ok=True)
INTER = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', str(FPS),
         '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2']

def run(args):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-y', *args], capture_output=True, text=True)
    if r.returncode: sys.exit(r.stderr[-2000:])

def part(name, clip_from, clip_len, slow, length, frames, start_number, bands, audio):
    """bands: list of (png, t0, t1) shown in the caption band; audio: filter text producing [aout]."""
    inputs = ['-ss', f'{clip_from:.3f}', '-t', f'{max(clip_len, length) + 0.2:.3f}', '-i', src,
              '-framerate', str(FPS), '-start_number', str(start_number), '-i', frames]
    for png, _, _ in bands: inputs += ['-i', png]
    extra = [f for f in audio['inputs']]
    for f in extra: inputs += ['-i', f]
    v = f"[0:v]setpts=PTS-STARTPTS,fps={FPS},trim=duration={clip_len:.3f},setpts=PTS-STARTPTS"
    if slow: v += f",setpts=3*PTS,fps={FPS}"
    v += f",tpad=stop_mode=clone:stop_duration={length:.3f},trim=duration={length:.3f},scale={W}:{CH}:flags=lanczos,setsar=1[clip];"
    v += f"[1:v]tpad=stop_mode=clone:stop_duration={length:.3f},trim=duration={length:.3f},setsar=1[view];"
    v += f"color=c=0x0d0f14:s={W}x{H}:r={FPS}:d={length:.3f}[bg];[bg][clip]overlay=0:0[a0];[a0][view]overlay=0:{VY}[b0]"
    last = 'b0'
    for i, (_, t0, t1) in enumerate(bands):
        v += f";[{last}][{2 + i}:v]overlay=0:{BY}:enable='between(t,{t0:.3f},{t1:.3f})'[c{i}]"; last = f'c{i}'
    v += f";[{last}]format=yuv420p[vout]"
    a = audio['filter'].format(n=2 + len(bands), L=f'{length:.3f}')
    run([*inputs, '-filter_complex', v + ';' + a, '-map', '[vout]', '-map', '[aout]', '-t', f'{length:.3f}', *INTER,
         os.path.join(parts, name + '.mkv')])
    return os.path.join(parts, name + '.mkv')

files = []
# Hook: last 2 s of the hook passage at real speed
h = P['hook']; hs = next(s for s in P['segments'] if s['id'] == h['id'])
files.append(part('00_hook', hs['clipStart'] + h['from'], h['len'], False, h['len'],
                  os.path.join(work, h['id'], 'a', '%05d.png'), round(h['from'] * FPS), [(h['band'], 0, h['len'])],
                  {'inputs': [], 'filter': "[0:a]asetpts=PTS-STARTPTS,atrim=duration={L},afade=t=in:d=0.08,apad=whole_dur={L}[aout]"}))
for k, s in enumerate(P['segments']):
    files.append(part(f'{k + 1}a_{s["id"]}', s['clipStart'], s['D'], False, s['D'],
                      os.path.join(work, s['id'], 'a', '%05d.png'), 0, [(s['realBand'], 0, s['D'] + 1)],
                      {'inputs': [], 'filter': f"[0:a]asetpts=PTS-STARTPTS,atrim=duration={{L}},afade=t=out:st={max(0, s['D'] - 0.4):.3f}:d=0.4,apad=whole_dur={{L}}[aout]"}))
    bands = [(s['leadBand'], 0, s['notes'][0]['from'])] + [(n['png'], n['from'], n['to']) for n in s['notes']]
    voices = [v for v in s['voice'] if v['file']]
    mix = "[0:a]asetpts=PTS-STARTPTS,atrim=duration={L},volume=0.16,afade=t=in:d=0.3,apad=whole_dur={L}[bed]"
    labels = ['[bed]']
    for i, v in enumerate(voices):
        ms = int(v['at'] * 1000)
        mix += f";[{{n}}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={ms}|{ms},volume=1.6[v{i}]".replace('{n}', '{n_' + str(i) + '}')
        labels.append(f'[v{i}]')
    mix += f";{''.join(labels)}amix=inputs={len(labels)}:normalize=0:duration=first,atrim=duration={{L}}[aout]"
    nb = 2 + len(bands)
    for i in range(len(voices)): mix = mix.replace('{n_' + str(i) + '}', str(nb + i))
    files.append(part(f'{k + 1}b_{s["id"]}', s['clipStart'], s['D'], True, s['L'],
                      os.path.join(work, s['id'], 'b', '%05d.png'), 0, bands,
                      {'inputs': [v['file'] for v in voices], 'filter': mix}))
# End card, 4 s, silent
card = os.path.join(parts, '99_card.mkv')
run(['-loop', '1', '-framerate', str(FPS), '-t', '4', '-i', P['card'], '-f', 'lavfi', '-t', '4', '-i', 'anullsrc=r=48000:cl=stereo',
     '-vf', 'format=yuv420p,fade=t=in:d=0.4', '-shortest', *INTER, card])
files.append(card)

lst = os.path.join(parts, 'list.txt')
open(lst, 'w').write(''.join(f"file '{f}'\n" for f in files))
run(['-f', 'concat', '-safe', '0', '-i', lst, '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '21',
     '-maxrate', '4M', '-bufsize', '8M', '-pix_fmt', 'yuv420p', '-r', str(FPS), '-g', str(FPS * 2),
     '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-movflags', '+faststart', out])
print(out)
