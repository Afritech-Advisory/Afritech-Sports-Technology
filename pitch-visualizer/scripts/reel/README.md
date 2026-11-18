# Social video (reel) from a match page

Version 1 made `marketing/linkedin/south-africa-v-kenya/south-africa-v-kenya-linkedin.mp4`
(14 Nov 2026): 1080 x 1920, 42 s. The 2–1 goal at real speed, then at one-third speed with the
three coaching notes, then an end card. Clip on top, 3D pitch below, frame for frame.

1. Build the match page first: `npm run build:single -- <match>`.
2. Capture the 3D frames (about 4 min for a 9 s passage; headless, swiftshader, no clip needed):

       node scripts/reel/capture.mjs <match> <sequence id> /path/to/scratch/<sequence id>

   `info.json` gives `frames`, `startFrame` and `startSeconds`, the clip trim that matches the page.
3. Edit `end-card.html` (match line, link, footer), screenshot it at 540 x 960, deviceScaleFactor 2.
4. Compose (v1 command; S = startFrame, E = startFrame + frames, A = startSeconds, D = frames / 30,
   T = 4 x D + 6):

       ffmpeg -i SOURCE.mp4 -framerate 30 -i DIR/a/%04d.png -framerate 10 -i DIR/b/%04d.png \
         -loop 1 -framerate 30 -t 6 -i card.png -filter_complex "
       [0:v]trim=start_frame=S:end_frame=E,setpts=PTS-STARTPTS,scale=1080:608,split[v1][v2s];
       [v2s]setpts=3*PTS,fps=30[v2];
       [1:v]split[a1][a2];[a1]crop=1080:210:0:0[h1];[a2]crop=1080:1102:0:210[r1];
       [2:v]fps=30,split[b1][b2];[b1]crop=1080:210:0:0[h2];[b2]crop=1080:1102:0:210[r2];
       [h1][v1][r1]vstack=3,setsar=1,format=yuv420p[s1];
       [h2][v2][r2]vstack=3,setsar=1,format=yuv420p[s2];
       [3:v]scale=1080:1920,setsar=1,format=yuv420p,fps=30[s3];
       [s1][s2][s3]concat=n=3:v=1:a=0[v];
       [0:a]atrim=start=A:duration=D,asetpts=PTS-STARTPTS,afade=t=out:st=D-0.5:d=0.5,apad=whole_dur=T[a]" \
         -map "[v]" -map "[a]" -t T -r 30 -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p \
         -c:a aac -b:a 128k -ar 48000 -movflags +faststart out.mp4

Faults found in v1, already fixed in capture.mjs: a band inserted into the page squeezed the 3D
view (it is now a fixed overlay at y 519); the end-card URL broke mid-word (use `<wbr>`).
Check frames with a contact sheet (`select=eq(n,...)`, `tile`) before sending.

Known weak points of v1 (the brief for v2): small page chrome and sequence strip waste the bottom
third; notes are text only (no voice); no captions burned in for sound-off viewing in the feed;
the camera never moves; only one passage; no website embed or poster frame.
