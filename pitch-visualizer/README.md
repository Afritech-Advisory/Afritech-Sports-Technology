# Kenya U23 vs Ivory Coast U23 AFCON U23 Qualifiers 3D Soccer Pitch Graphics Analysis

Interactive 3D pitch map built with Vite, TypeScript, Three.js and Lucide icons.
It replays tagged match sequences as ball-path arcs over an expected-threat surface.

    npm install
    npm run dev            # local dev server
    npm run build          # type-check and build to dist/
    npm run build:single   # one standalone file, copied to standalone/index.html

## Standalone file

`standalone/index.html` is the whole dashboard in one 60 KB file: open it in a browser or send it to someone.
It loads Three.js, OrbitControls and Tailwind CSS from CDN, so it needs an internet connection.
The tracking dataset is embedded as JSON in a `<script id="tracking-data">` block and can be edited in place.
The match clip is not embedded (rights not cleared). The Match clip tab has a video slot: load the file
from your device and it follows the timeline, or set the `<video id="clip">` `src` to a base64 data URI.
Coaching notes typed in the sidebar are saved in the browser only.

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

The source reel is third-party broadcast footage. Rights are not cleared, so this build is
for internal demonstration only and the video is not stored in the repository.
The threat surface is a generic approximation and xG uses distance and angle only.
Pressure (opponents within 5 m, nearest opponent) is an eyeball estimate from the frame and is
tagged on 11 of the 28 events; defenders are not tracked.

The timeline scrubs in source-clip frames (30 fps). Space plays or pauses, arrow keys step one
frame, Shift with an arrow steps ten.

To load another match, replace the JSON in the `tracking-data` block of `index.html`.
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
