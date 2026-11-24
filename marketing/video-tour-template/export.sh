#!/usr/bin/env bash
# Final mix + upload-friendly exports. Run after: node render.js full
set -e
python3 music.py          # original music bed (no licensing)
python3 sfx.py            # booms + whooshes on cuts
python3 mix.py            # voice + ducked music + sfx -> final_master.mp4
mkdir -p out
# film grain inflates bitrate: cap it so the file uploads from a phone (~40 MB for 100 s)
ffmpeg -y -loglevel error -i final_master.mp4 -c:v libx264 -preset slow -crf 20 -maxrate 3500k -bufsize 7000k \
  -pix_fmt yuv420p -c:a copy -movflags +faststart out/video.mp4
ffmpeg -y -loglevel error -ss 12.5 -i out/video.mp4 -frames:v 1 -q:v 2 out/cover.jpg
END=$(python3 -c "import json;print(json.load(open('timeline.json'))['total']-2)")
ffmpeg -y -loglevel error -ss "$END" -i out/video.mp4 -frames:v 1 -q:v 2 out/still-end-card.jpg
ffmpeg -y -loglevel error -t 9 -i out/video.mp4 -vf "fps=10,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=5" -loop 0 out/title-loop.gif
ffmpeg -i out/video.mp4 -af ebur128 -f null - 2>&1 | grep -A1 "Integrated" | tail -1
ls -la out
