---
name: afritech-pitch-graphics
description: Build an interactive 3D Three.js soccer pitch analysis from a match video clip - tagged sequences replayed as passing lanes over an expected-threat surface, with click-to-inspect, a frame timeline, coaching notes and a single standalone index.html. Use when asked for 3D pitch graphics, a pitch visualizer, an xT or passing-lane view of a clip, or "do what we did for Kenya U23 vs Ivory Coast U23" for another match.
---

# Afritech 3D Pitch Graphics

Turns a match clip into a portable 3D analysis page. The reference build is
`pitch-visualizer/` in the Afritech-Sports-Technology repository
(Kenya U23 vs Ivory Coast U23, AFCON U23 Qualifiers). Start from that code; do not rebuild from zero.

Read `references/prompts.md` for the six prompts that produced the reference build and how each was
interpreted. Read `references/build-notes.md` before touching the code: it lists the faults already
found and fixed.

## 1. Gates before any work (from afritech-match-data)

1. Rights. Who owns the footage? A watermarked third-party broadcast is not cleared: label the output
   "internal demonstration only", never commit or embed the video, and say so in the page and the reply.
2. Consent. Players under 18 need guardian consent held by the club or academy.
3. Grade the footage (A broadcast, B AI camera, C fixed tripod, D handheld) and state what it supports.
   A highlights reel supports key sequences only, not a full event log.

## 2. Review the footage

Work from stills, in the scratchpad, never inside the upload directory.

    ffprobe -v error -show_format -show_streams clip.mp4      # duration, fps, resolution
    # Overview: one frame every 8 s, timestamped, 4 x 4 contact sheets
    ffmpeg -i clip.mp4 -vf "fps=1/8,scale=480:-1,drawtext=text='%{pts\:hms}':x=5:y=5:fontsize=20:fontcolor=yellow:box=1:boxcolor=black,tile=4x4" sheet_%02d.jpg
    # Detail: one frame per second for each wide-angle passage, 3 x 3 sheets at 640 px
    ffmpeg -ss START -t LENGTH -i clip.mp4 -vf "fps=1,scale=640:-1,drawtext=text='%{eif\:t+START\:d}s':x=5:y=28:fontsize=22:fontcolor=yellow:box=1:boxcolor=black,tile=3x3" seq_%02d.jpg

From the overview, list the wide-angle passages (ignore close-ups, replays, crowd shots) and read the
scoreboard clock. If there is no scoreboard (South Africa v Kenya, Nov 2026, was a clean high-camera
feed), do not take the score or minutes from anywhere else: use clip time (see data-format.md), count
the goals the pictures show, and find the change of ends from which goal each keeper defends. Establish which goal each team attacks and which touchline is nearest the camera.

## 3. Tag the sequences

Coordinates are metres on a 105 x 68 pitch: x from the left goal line, y from the near (camera-side)
touchline. Time `t` is match clock in seconds. Record for each sequence the offset to clip time
(`videoOffset` = clip seconds minus clock seconds) so the timeline and video stay in step.

Per event: `t`, `team`, `type`, `from`, optional `to`, `outcome`, optional `player` (shirt number),
optional `note`, optional `pressure { within5, nearest }`. Types and Opta names are in
`references/data-format.md`.

Rules that keep the data honest:
- Place events by eye and say so: about ±5 m from 360p broadcast.
- Shirt numbers only, and only where legible. Never identify a player from their face. If the scorer is
  unclear, leave `player` off and say why in `note`.
- Tag `pressure` only where the frame clearly shows the surrounding players. Leave it off otherwise.
- Take the competition name from the user and say that you did.
- Write three coaching notes per sequence, each traceable to tagged events (distances, seconds between
  events, counts). No claims about things the frame does not show.

## 4. Build

Add `pitch-visualizer/matches/<match>.json` (copy the Kenya U23 file and replace its contents). Title,
team names, codes, colours and attack direction all come from that file; do not edit `src/` or
`index.html` for a new match. Then:

    npm install
    npm run build:single -- <match>   # type-checks, builds, writes standalone/<match>/index.html

The Kenya U23 match keeps the site root (`standalone/index.html`). Every other match gets its own
folder and address, with its clip beside it as `standalone/<match>/clip.mp4`.

What the page contains, in the order it was built:
1. Scene: `SceneManager` (antialiased renderer, perspective camera, ambient and directional light,
   resize handling, damped OrbitControls) and a FIFA-proportioned pitch slab with markings and goals.
2. Threat surface: a `ShaderMaterial` that computes positional xT per pixel and adds a `vec3[32]`
   uniform of intensity points from the sequence on screen. Cyan to magenta to amber.
3. Passing lanes: `buildPassingLanes(json)` - `CatmullRomCurve3` and `TubeGeometry`, glowing waypoint
   sprites, direction arrows that rescale with camera distance. `coordinates.ts` maps metres,
   normalised units or pixels (with a homography) to pitch metres.
4. Interaction: raycast picking opens a floating card (coordinates, zone, threat, 5 m pressure pocket);
   a frame timeline sits at the bottom of the 3D view.
5. Bundle: one `index.html` with CDN Three.js, OrbitControls and Tailwind, the embedded JSON dataset,
   a coaching notes sidebar and a video slot.

Visual direction: dark ink-wash slab, chalk lines, watercolour threat wash, glowing ice-blue arcs,
handwritten dimension notes. Single dark theme by choice.

Coaching notes are read aloud on Play (`src/ui/Narrator.ts`, browser speech, subtitle over the pitch).
Voice accent rule (Andrew, 13 Nov 2026): always an African English voice, Kenyan first. The order is
en-KE, en-TZ, en-UG, en-NG, en-GH, en-ZA, and only then any other English voice. Never pick a Swahili
(sw-) voice for English text. Browser voices depend on the viewer's device: Microsoft Edge on a
computer has Kenyan English voices; iPhones have South African English; many devices have none. The
page states which voice it is using. A Kenyan voice for every viewer needs recorded or pre-generated
audio files (for example a Kenyan neural voice from a cloud speech service, with the user's key).

## 5. Verify before reporting

- `npm run build:single` passes the type check.
- Load `standalone/index.html` in headless Chromium at 1360 x 820 and 400 x 800 with no page errors.
- Click test: a tube and a player mark open the card; an orbit drag does not; empty pitch closes it.
- Timeline: frame step and scrub land on the expected frame; with the clip loaded, the clip's
  scoreboard matches the timeline clock.
- Publish the built `dist-single/<match>/artifact.html` as the Artifact (a new Artifact for a new match)
  and send the standalone `index.html` as a file.
- Clip by URL: serve `standalone/` with a server that answers range requests (Python's http.server
  does not), confirm "Match clip loaded" and that video time equals timeline frame / 30 after play and
  pause. Then remove the clip and confirm the picker fallback message.
- After the Pages deploy: fetch the live page and `clip.mp4` (expect 206 to a Range request), then
  load the live URL in Chromium. If the sandbox blocks jsDelivr, route three.js to `node_modules`.

## 6. Publish (public link that is not a claude.ai link)

Andrew wants a public link with no claude.ai address (13 Nov 2026). Use GitHub Pages:
`.github/workflows/pages.yml` uploads `pitch-visualizer/standalone/` whenever it changes on `main`.
Live address (Kenya U23): https://afritech-advisory.github.io/Afritech-Sports-Technology/
Other matches: the same address followed by `<match>/`. The workflow uploads the whole folder, so a
new match needs no workflow change. Never move or rebuild-and-replace an already published page
unless asked.

- Clip: re-encode at native size (never upscale), H.264 CRF 28, AAC 64k, `+faststart`, save as
  `standalone/clip.mp4`, set `"clip": {"src": "clip.mp4"}` in the dataset. The HTML stays about 65 KB.
  The device picker is the fallback (downloaded copy, claude.ai preview). Details in build-notes.md.
- Keep the claude.ai Artifact updated at the same URL as a private preview. Read it before
  republishing from a new conversation so a new link is not created by mistake.
- Andrew's one-time GitHub steps, the ones he got stuck on, are in references/publishing.md. Give
  them step by step with the exact URL.
- Open a PR only when Andrew asks; he merges it himself.

When someone in the community suggests a fix, try it as stated first and report the measured result
(sizes, what worked). Write replies he will paste with afritech-anti-ai-writing-os, as plain text in
one copy-paste block, first person, no markdown, every number checked.

## 7. Say this every time

- Rights status of the footage (Kenya U23 clip: used with the rights holder's permission) and whether
  the clip is published beside the page or must be loaded from the device.
- Positions are hand-tagged estimates; players are shirt numbers only.
- The threat surface is a generic approximation, not fitted to any competition; xG uses distance and
  angle only. Numbers are illustrative.
- Lanes come from the tagged log, not automated tracking, unless real tracker output was supplied.
- Anything that could not be tested in the build environment (GPU frame rate, blocked CDNs).
