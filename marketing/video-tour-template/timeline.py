import json, re, subprocess
S=json.load(open('script.json'))
rep={"Under-Seventeen":"U-17","forty-eight":"48","nine-nil.":"9-0.","Seventy-three":"73","forty-one":"41,","twenty-seventh":"27th","thirteenth":"13th","ten":"10"}
cur=2.4; out=[]
for s in S:
    dur=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f'vo/{s["id"]}.mp3']))
    W=json.load(open(f'vo/{s["id"]}.json')); toks=s["text"].split()
    assert len(W)==len(toks),(s["id"],len(W),len(toks))
    a0=cur+0.25
    words=[]; skip=False
    for (t0,t1,_),tok in zip(W,toks):
        d=rep.get(tok,tok)
        if tok=="forty-one,": d="41,"
        if skip: words[-1]["t1"]=a0+t1; continue
        if tok=="Advisory": d="Advisory@afritechsports.com"; skip=True
        words.append({"t0":a0+t0,"t1":a0+t1,"w":d})
    # chunk
    chunks=[];c=[]
    for w in words:
        c.append(w)
        if re.search(r'[.!?:]$',w["w"]) or len(c)>=6 or (w["w"].endswith(',') and len(c)>=3) or w["w"].startswith("Advisory@"):
            chunks.append(c);c=[]
    if c: chunks.append(c)
    end=a0+dur+0.35
    out.append({"id":s["id"],"start":cur,"a0":a0,"end":end,"words":words,"chunks":[[words.index(x) for x in ch] for ch in chunks]})
    cur=end
total=cur+4.5
json.dump({"scenes":out,"total":total},open('timeline.json','w'))
print("total",round(total,2))
for sc in out: print(sc["id"],round(sc["start"],2),round(sc["end"],2),[ (w["w"],round(w["t0"],2)) for w in sc["words"] if w["w"] in ("clubs,","Senegal","73","Each","what","Every","And","FIFA's","how","book","Email","Advisory@afritechsports.com","We","10")])
