# 3D Soccer Pitch Graphics Analysis

Matches in this build (one dataset each in `matches/`):

- `kenya-u23-v-ivory-coast-u23`: Kenya U23 vs Ivory Coast U23, AFCON U23 Qualifiers. Published at the site root.

Interactive 3D pitch map built with Vite, TypeScript, Three.js and Lucide icons.
It replays tagged match sequences as ball-path arcs over an expected-threat surface.

    npm install
    npm run dev            # local dev server
    npm run build          # type-check and build to dist/
    npm run build:single   # one standalone file per match in matches/
    npm run build:single -- <match>   # only that match
    MATCH=<match> npm run dev         # dev server on another match

The first match (Kenya U23) builds to `standalone/index.html`; every other match builds to
`standalone/<match>/index.html`, so each has its own address on GitHub Pages and the first one
never moves.

## Standalone file

`standalone/index.html` is the whole dashboard in one 60 KB file: open it in a browser or send it to someone.

Public link: https://afritech-advisory.github.io/Afritech-Sports-Technology/ . The `Publish pitch visualizer` workflow puts `standalone/index.html` there each time it changes on `main` (GitHub Pages must be set to deploy from GitHub Actions).
It loads Three.js, OrbitControls and Tailwind CSS from CDN, so it needs an internet connection.
The tracking dataset is embedded as JSON in a `<script id="tracking-data">` block and can be edited in place.
The match clip is not embedded in the HTML. It sits beside the page as `standalone/clip.mp4`
(re-encoded at its native 640×360, H.264 CRF 28, AAC 64k, faststart: 24 MB). The dataset's
`clip.src` points to it, so on GitHub Pages the Match clip tab loads it by URL and seeks with range
requests. Where the file is missing (a downloaded copy, the claude.ai preview) the tab says so and
the device file picker is the fallback.
Coaching notes typed in the sidebar are saved in the browser only.
The coaching notes for each sequence are read aloud when you press Play, using the speech voice built
into the viewer's browser (`src/ui/Narrator.ts`), with a subtitle over the pitch. The speaker button in
the timeline turns the voice off. The voice varies by device.

## Structure

- `src/core/SceneManager.ts` renderer (antialiased), perspective camera, ambient and directional light, resize handling, damped OrbitControls, render loop
- `src/core/Picker.ts` raycast picking on click or tap (drags are ignored); opens the inspect card with coordinates, zone, threat and the 5 m pressure pocket
- `src/pitch/` FIFA dimensions (105 x 68 m, 1 unit = 1 m) and the pitch slab with markings, goals and the 12 x 8 zone grid
- `src/viz/ThreatSurface.ts` custom `ShaderMaterial`: positional xT plus a dynamic `vec3[32]` uniform of intensity points (x m, y m, weight), blended cyan to magenta to amber in the fragment shader
- `src/viz/PassingLanes.ts` `buildPassingLanes(json, options)`: tracking JSON in, volumetric lanes out (`CatmullRomCurve3` and `TubeGeometry`, glowing waypoint sprites, translucent direction arrows that rescale with camera distance)
- `src/data/coordinates.ts` maps tracker coordinates (metres, normalised, or image pixels with a homography) to pitch metres
- `src/viz/EventLayer.ts` carries, duels, the ball and playback
- `index.html` page markup and CDN links; nothing in it is specific to one match
- `matches/<match>.json` the dataset for each match: teams, colours, attack direction, sequences. The build puts it in the page's `tracking-data` block
- `scripts/build-single.mjs` builds each match and writes the published copy and the preview copy
- `src/data/match.ts` types and helpers for the dataset, including the two teams; `src/data/models.ts` the xT and xG estimates
- `src/main.ts` interface wiring and playback

## Data in the Kenya U23 build

Kenya U23 v Ivory Coast U23, second half, 64' to 90+6': five sequences and 28 events,
hand-tagged from a broadcast highlights reel. Positions are accurate to roughly 5 m and
players are recorded by shirt number only. Event names follow Opta conventions.

The footage is used with the permission of the rights holder. The re-encoded clip is stored at
`standalone/clip.mp4` and published with the page; it is not inside the HTML.
The threat surface is a generic approximation and xG uses distance and angle only.
Pressure (opponents within 5 m, nearest opponent) is an eyeball estimate from the frame and is
tagged on 11 of the 28 events; defenders are not tracked.

The timeline scrubs in source-clip frames (30 fps). Space plays or pauses, arrow keys step one
frame, Shift with an arrow steps ten.

To add another match, add `matches/<match>.json` and build. Nothing in `src/` names a team.
Coordinates are metres: x from the left goal line, y from the near touchline.

Team names, codes and colours come from the dataset's `teams` list (home team first):

    "teams": [
      { "code": "KEN", "name": "Kenya", "label": "Kenya U23", "lane": "#9cc2ff", "kit": "#e5343f",
        "trim": "#111318", "accent": "#e5343f", "attacks": "left" },
      { "code": "CIV", "name": "Ivory Coast", "label": "Ivory Coast U23", "lane": "#ffe9c4", "kit": "#f6f3ec",
        "trim": "#ff8a2a", "accent": "#ff8a2a", "attacks": "right" }
    ]

`lane` colours the ball paths and legend, `kit` and `trim` the player marks, `accent` the header
underline and timeline ticks, optional `ring` a second colour round the team dot. `attacks` is the goal
the team attacks (`left` is x = 0). Teams change ends at half-time, so a sequence can carry its own
`"attacks": { "KEN": "right", "CIV": "left" }` and `"half": 1` (so first-half added time reads 45+2).
The header score counts the tagged goals; the threat toggle, legend, goal labels and cards all read
from `teams`. `"open": "<sequence id>"` picks the sequence shown first.

## Tracking JSON

    {
      "units": "metres",
      "passes": [
        { "id": "p1", "team": "KEN", "kind": "pass", "complete": true,
          "points": [[40, 30, 0.6], [33.5, 19.5, 5.8], [27, 9, 0.6]] }
      ]
    }

`units` may also be `"normalised"` (0 to 1, with `"origin": "far-left"` for top-left trackers)
or `"pixels"` with a 9-number `homography`. `homographyFromPoints` builds that matrix from
four landmarks picked on a video frame. Points are `[x, y]` or `[x, y, height]`.
The lanes in this build are generated from the hand-tagged event log, not from an automated tracker.
