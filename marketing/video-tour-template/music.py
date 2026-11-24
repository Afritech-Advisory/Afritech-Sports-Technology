import numpy as np, json, wave
sr=44100; T=json.load(open('timeline.json'))['total']+0.5; n=int(sr*T); t=np.arange(n)/sr
bpm=104; beat=60/bpm; out=np.zeros(n)
rng=np.random.default_rng(7)
def add(sig,start):
    i=int(start*sr); j=min(n,i+len(sig))
    if i<n: out[i:j]+=sig[:j-i]
def env(d,a=0.005,r=None):
    m=int(d*sr); x=np.arange(m)/sr; e=np.minimum(1,x/a)*np.exp(-x/(r or d/4)); return e
# chords (A minor-ish, warm): Am F C G
chords=[[57,60,64],[53,57,60],[48,52,55,60],[55,59,62]]
f=lambda m:440*2**((m-69)/12)
bar=4*beat; nb=int(T/bar)+1
pent=[69,72,74,76,79,81]
for b in range(nb):
    ch=chords[b%4]; st=b*bar
    # pad
    d=bar; m=int(d*sr); x=np.arange(m)/sr
    pad=sum(np.sin(2*np.pi*f(k)*x+0.3*np.sin(2*np.pi*0.3*x))+0.3*np.sin(2*np.pi*f(k)*2.003*x) for k in ch)
    pad*=np.minimum(1,x/0.6)*np.minimum(1,(d-x)/0.6)*0.05
    add(pad,st)
    # bass
    for k in [0,1.5,2.5]:
        dd=beat*0.9; m=int(dd*sr); x=np.arange(m)/sr
        add(np.sin(2*np.pi*f(ch[0]-12)*x)*env(dd,0.01,0.25)*0.22,st+k*beat)
    for q in range(4):
        s=st+q*beat
        # kick
        dd=0.35; m=int(dd*sr); x=np.arange(m)/sr
        add(np.sin(2*np.pi*(50+90*np.exp(-x*30))*x)*np.exp(-x*9)*0.45,s)
        # shaker 8ths/16ths
        for e in range(4):
            dd=0.06; m=int(dd*sr); x=np.arange(m)/sr
            add(rng.standard_normal(m)*np.exp(-x*60)*(0.05 if e%2 else 0.03),s+e*beat/4)
        # rim on 2 & 4 offbeat
        if q in (1,3):
            dd=0.08; m=int(dd*sr); x=np.arange(m)/sr
            add((np.sin(2*np.pi*1700*x)+rng.standard_normal(m)*.5)*np.exp(-x*70)*0.08,s+beat/2)
    # marimba motif
    pat=[0,2,3,5,6,8,10,11,13,14]
    for k,p in enumerate(pat):
        note=pent[(b*3+k*2)%len(pent)]-12 if k%3 else ch[-1]+12
        dd=0.45; m=int(dd*sr); x=np.arange(m)/sr
        sig=(np.sin(2*np.pi*f(note)*x)+0.25*np.sin(2*np.pi*f(note)*4*x)*np.exp(-x*30))*np.exp(-x*9)*0.11
        add(sig,st+p*beat/4)
# fade in/out
out*=np.minimum(1,t/2.0)*np.minimum(1,(T-t)/3.0)
out/=np.max(np.abs(out))*1.25
w=wave.open('music.wav','wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((out*32767).astype(np.int16).tobytes()); w.close()
print('ok',T)
