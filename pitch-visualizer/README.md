# Kenya U23 vs Ivory Coast U23 AFCON U23 Qualifiers 3D Soccer Pitch Graphics Analysis

Interactive 3D pitch map built with Vite, TypeScript, Three.js and Lucide icons.
It replays tagged match sequences as ball-path arcs over an expected-threat surface.

    npm install
    npm run dev            # local dev server
    npm run build          # type-check and build to dist/
    npm run build:single   # one standalone file, copied to standalone/index.html

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
- `index.html` page markup, CDN links and the embedded JSON dataset
- `src/data/match.ts` types and helpers for the dataset; `src/data/models.ts` the xT and xG estimates
- `src/main.ts` interface wiring and playback

## Data in this build

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

## Another match

`index.html` holds the reference match and is published at the site root. A further match is one
file, `matches/<slug>.json`, in the same format plus a `teams` list (codes, names, colours) and
`attack` (which goal each team attacks). Team names and colours are read from the dataset; none are
hard-coded in `src/`.

    MATCH=<slug> npm run build:single   # writes standalone/<slug>/index.html

Put its clip at `standalone/<slug>/clip.mp4`. The Pages workflow publishes all of `standalone/`, so
the match appears at `/<slug>/` beside the reference page. The committed `standalone/index.html`
was built before this change and has been left as published.

Coordinates are metres: x from the left goal line, y from the near touchline.

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
