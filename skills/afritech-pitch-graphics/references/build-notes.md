# Build notes

## 18 Nov 2026: Kenya v South Africa video v2
- Fault: the v2 brief asked for a video of the 13 Nov Johannesburg match (South Africa 2–2 Kenya) but the
  footage supplied was the 17 Nov Nairobi match (Kenya 1–2 South Africa). Caught by reading the scoreboard
  and venue before building. Fix: a new dataset and page, `kenya-v-south-africa`, tagged from the 17 Nov
  broadcast. Rule: check footage against the dataset before any build (SKILL.md step 2).
- The 17 Nov clip is 640 x 360 with the match clock on screen: `timebase: match`, one `videoOffset` per goal.
- Voice: Kenyan English `en-KE-AsiliaNeural` (the Edge voice the page uses), rendered with edge-tts.
- Reel v2 method, layout and faults: `pitch-visualizer/scripts/reel/README.md`.

## 18 Nov 2026: /qa, voice sets the pace
- Fault: v2 replayed each goal at a flat one-third speed and froze at the end while the voice continued, so the
  notes were read over the wrong action. Rule: the voiceover is the timing reference; every replay, freeze-frame
  and highlight lands on the action the voice describes (README v2.1, beats.py, beats/<match>.json).
