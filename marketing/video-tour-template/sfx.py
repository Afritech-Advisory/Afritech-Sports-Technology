import numpy as np, json, wave
tl=json.load(open('timeline.json')); sr=44100; T=tl['total']; n=int(sr*(T+1)); out=np.zeros(n)
sc={x['id']:x for x in tl['scenes']}; rng=np.random.default_rng(3)
cue=lambda i,w:[x['t0'] for x in sc[i]['words'] if x['w']==w][0]
def add(sig,t):
    i=int(t*sr); j=min(n,i+len(sig)); out[i:j]+=sig[:j-i]
def boom(g=1.0):
    d=2.2; x=np.arange(int(d*sr))/sr
    s=np.sin(2*np.pi*(38+50*np.exp(-x*6))*x)*np.exp(-x*1.8)
    s+=rng.standard_normal(len(x))*np.exp(-x*25)*.25
    return s*g
def whoosh(g=.35,d=.9):
    m=int(d*sr); x=np.arange(m)/sr; w=rng.standard_normal(m)
    # moving lowpass via cumulative smoothing with varying alpha
    a=0.02+0.25*np.sin(np.pi*x/d)**2; y=np.zeros(m); acc=0
    for k in range(m): acc+=a[k]*(w[k]-acc); y[k]=acc
    return y*np.sin(np.pi*x/d)**2*g*3
add(boom(1.0),0.25); add(boom(.8),cue('s1','Here')-.05)
for t in [sc[k]['start'] for k in ['s2','s3','s4','s5q','s6','s7','s8','s9']]+[cue('s9','book')]:
    add(whoosh(),t-.45)
out/=np.max(np.abs(out))*1.1
w=wave.open('sfx.wav','wb');w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr);w.writeframes((out*32767).astype(np.int16).tobytes());w.close();print('sfx ok')
