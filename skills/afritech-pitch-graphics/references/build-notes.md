# Build notes

## 18 Nov 2026: Kenya v South Africa video v2
- Fault: the v2 brief asked for a video of the 13 Nov Johannesburg match (South Africa 2–2 Kenya) but the
  footage supplied was the 17 Nov Nairobi match (Kenya 1–2 South Africa). Caught by reading the scoreboard
  and venue before building. Fix: a new dataset and page, `kenya-v-south-africa`, tagged from the 17 Nov
  broadcast. Rule: check footage against the dataset before any build (SKILL.md step 2).
- The 17 Nov clip is 640 x 360 with the match clock on screen: `timebase: match`, one `videoOffset` per goal.
- Voice: Kenyan English `en-KE-AsiliaNeural` (the Edge voice the page uses), rendered with edge-tts.
- Reel v2 method, layout and faults: `pitch-visualizer/scripts/reel/README.md`.
