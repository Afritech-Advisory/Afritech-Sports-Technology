import json,subprocess
tl=json.load(open('timeline.json'));T=tl['total']
ins=[];flt=[]
for k,s in enumerate(tl['scenes']):
    ins+=['-i',f'vo/{s["id"]}.mp3']; ms=int(s['a0']*1000); flt.append(f'[{k}:a]aresample=44100,adelay={ms}|{ms},apad=whole_dur={T}[v{k}]')
N=len(tl['scenes'])
flt.append(''.join(f'[v{k}]' for k in range(N))+f'amix=inputs={N}:normalize=0:duration=longest,loudnorm=I=-16:TP=-1.5:LRA=11,apad=whole_dur={T},asplit=2[voice][sc]')
flt.append(f'[{N}:a]volume=0.32[mus]')
flt.append('[mus][sc]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[duck]')
flt.append(f'[{N+2}:a]volume=0.55[fx]')
flt.append('[voice][duck][fx]amix=inputs=3:normalize=0:duration=longest,alimiter=limit=0.89[mix]')
subprocess.run(['ffmpeg','-y','-loglevel','error']+ins+['-i','music.wav','-i','video_silent.mp4','-i','sfx.wav','-filter_complex',';'.join(flt),'-map',f'{N+1}:v','-map','[mix]','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-t',str(T),'-movflags','+faststart','final_master.mp4'],check=True)
