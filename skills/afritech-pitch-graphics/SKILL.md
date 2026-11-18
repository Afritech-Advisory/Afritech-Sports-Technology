---
name: afritech-pitch-graphics
description: Build or update an Afritech 3D pitch graphics match page (pitch-visualizer) and its social video (reel). Use for a new match dataset, a match page, a ?reel=1 capture, or a LinkedIn/website analysis video.
---

# Afritech pitch graphics

1. Read afritech-four-sentences first and write the four for this deliverable's reader.
2. Check the footage against the dataset before building: scoreboard, venue, date, kits and score.
   If they differ, it is a different match and needs its own dataset (`pitch-visualizer/matches/<slug>.json`).
   Never place one match's tags on another match's footage. Prompts can name the wrong match: say so first.
3. Facts come only from the dataset. Times follow `match.timebase` (match clock when the footage shows one,
   clip time when it doesn't). No scorer is named unless the footage shows the last touch.
4. Pages: `npm run build:single -- <slug>`. The Kenya U23 page (`standalone/index.html`, `standalone/clip.mp4`)
   must stay byte-identical; check `git diff` before each commit.
5. Video: follow `pitch-visualizer/scripts/reel/README.md` (plan.py, capture.mjs, compose.py).
6. Caveats on every output: positions hand-tagged by eye, threat and xG illustrative, players by shirt number
   only, footage used with the rights holder's permission.

Build notes and faults: references/build-notes.md.
