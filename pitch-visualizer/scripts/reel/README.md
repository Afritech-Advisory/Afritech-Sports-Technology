# Social video (reel) from a match page

## Version 2 (18 Nov 2026): 4:5 master with voice, captions and a website page

Made `standalone/kenya-v-south-africa/video/reel.mp4` (also in `marketing/linkedin/south-africa-v-kenya/v2/`):
1080 x 1350, 30 fps, H.264 High, AAC 128k, +faststart, about 2 minutes. Kenya 1–2 South Africa, the three goals.
One file for LinkedIn and the website.

Layout: match clip 1080 x 608 on top, caption band 1080 x 180, 3D pitch 1080 x 562 below. LinkedIn's UI covers
the bottom 15% (y > 1147); only the pitch sits there, never text. Opens on a 2 s hook (the last 2 s of the goal
named with `--hook-seq`) with a line of six words or fewer. Each goal: real speed with stadium sound, then a
one-third-speed replay (held on the last moment until the voice ends) with the three coaching notes as captions
(two lines at most, Archivo 46 px) and in the voice, the camera pushing slowly toward the shot, and each note's
ball path lit. End card 4 s with the logo, match line, link and caveats.

1. Build the page: `npm run build:single -- <match>`. `?reel=1` hides the header, sidebar, timeline and buttons and
   exposes `window.reel` (load, set, highlight, camera, frame). The normal page is unchanged.
2. Voice: one file per note at `<work>/vo/<seq id>_<n>.mp3`. v2 used Microsoft's Kenyan English neural voice
   `en-KE-AsiliaNeural`, the voice Edge uses on the analysis page, rendered with `edge-tts` (needs the host
   `speech.platform.bing.com` allowed, and `--proxy "$HTTPS_PROXY"` with `SSL_CERT_FILE` set to the proxy CA).
   Never a Swahili voice reading English. Without voice files, notes are timed at 15 characters a second.
3. Fonts for the captions: TTF copies of Archivo (400/600/700) and IBM Plex Mono 500, made from the
   `@fontsource/archivo` and `@fontsource/ibm-plex-mono` woff2 files with fontTools.
4. Plan: `python3 -I scripts/reel/plan.py <match> <work> --fonts DIR --logo FILE --hook "TEXT" --hook-seq g2 --url URL`
   writes `plan.json`, the caption band images, the end card and `captions.srt` (upload it with the video).
5. Capture: `node scripts/reel/capture.mjs <match> <work>` (all passages in parallel; about 25 frames a minute
   per passage on 4 cores, so about 45 minutes for 2 minutes of video). Run it in the background.
6. Compose: `python3 -I scripts/reel/compose.py <work> SOURCE.mp4 out.mp4`.
7. Poster: a frame from the hook, `ffmpeg -ss 1.0 -i out.mp4 -frames:v 1 -q:v 3 poster.jpg`.

Faults found in v2:
- The v2 brief named the wrong match. Both clips supplied were Kenya v South Africa, 17 Nov 2026, Nairobi
  (Kenya 1–2 South Africa), while the dataset and page were the 13 Nov Johannesburg match (2–2). Check the
  footage (scoreboard, venue, kits) against the dataset before any build; a new match gets its own dataset.
- The 17 Nov clip is 640 x 360: shirt numbers on the ball are not legible, so no player is numbered and no
  scorer is named. The clip carries the match clock, so this dataset uses `timebase: match` with a
  `videoOffset` per passage (the highlights are cut, so the offset changes between goals).
- Three goals at one-third speed with three spoken notes each run to about 2 minutes; the replays of short
  goals are held on the last moment while the voice finishes.

## Version 1

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
