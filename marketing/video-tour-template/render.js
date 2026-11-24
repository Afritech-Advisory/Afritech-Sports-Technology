const { chromium } = require('playwright');
const fs=require('fs'); const {spawn}=require('child_process');
(async () => {
  const mode=process.argv[2]; // 'test' or 'full'
  const tl=JSON.parse(fs.readFileSync('timeline.json'));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  await p.goto('file://'+process.cwd()+'/stage.html', { waitUntil: 'networkidle' });
  await p.evaluate(async tl=>{await document.fonts.ready; init(tl); await Promise.all([...document.images].map(i=>i.decode()))}, tl);
  console.log('fonts', await p.evaluate(()=>[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family).join(',')));
  if(mode==='test'){ fs.mkdirSync('test',{recursive:true});
    const ts=process.argv.slice(3).map(Number);
    for(const t of ts){ await p.evaluate(t=>render(t),t); await p.screenshot({path:`test/f_${t}.png`}); }
  } else {
    const fps=30, N=Math.ceil(tl.total*fps);
    const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate',String(fps),'-c:v','mjpeg','-i','-','-c:v','libx264','-preset','slow','-crf','17','-pix_fmt','yuv420p','video_silent.mp4']);
    for(let i=0;i<N;i++){ await p.evaluate(t=>render(t), i/fps); const buf=await p.screenshot({type:'jpeg',quality:95}); if(!ff.stdin.write(buf)) await new Promise(r=>ff.stdin.once('drain',r)); if(i%300===0) console.log(i,'/',N); }
    ff.stdin.end(); await new Promise(r=>ff.on('close',r));
  }
  await b.close();
})();
