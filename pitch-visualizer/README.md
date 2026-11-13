# Pitch visualizer

Interactive 3D pitch map built with Vite, TypeScript, Three.js and Lucide icons.
It replays tagged match sequences as ball-path arcs over an expected-threat surface.

    npm install
    npm run dev            # local dev server
    npm run build          # type-check and build to dist/
    npm run build:single   # one self-contained HTML file in dist-single/

## Structure

- `src/core/SceneManager.ts` renderer (antialiased), perspective camera, ambient and directional light, resize handling, damped OrbitControls, render loop
- `src/pitch/` FIFA dimensions (105 x 68 m, 1 unit = 1 m) and the pitch slab with markings, goals and the 12 x 8 zone grid
- `src/viz/ThreatSurface.ts` custom `ShaderMaterial`: positional xT plus a dynamic `vec3[32]` uniform of intensity points (x m, y m, weight), blended cyan to magenta to amber in the fragment shader
- `src/viz/PassingLanes.ts` `buildPassingLanes(json, options)`: tracking JSON in, volumetric lanes out (`CatmullRomCurve3` and `TubeGeometry`, glowing waypoint sprites, translucent direction arrows that rescale with camera distance)
- `src/data/coordinates.ts` maps tracker coordinates (metres, normalised, or image pixels with a homography) to pitch metres
- `src/viz/EventLayer.ts` carries, duels, the ball and playback
- `src/data/match.ts` the tagged event log; `src/data/models.ts` the xT and xG estimates
- `src/main.ts` interface wiring and playback

## Data in this build

Kenya U23 v Ivory Coast U23, second half, 64' to 90+6': five sequences and 28 events,
hand-tagged from a broadcast highlights reel. Positions are accurate to roughly 5 m and
players are recorded by shirt number only. Event names follow Opta conventions.

The source reel is third-party broadcast footage. Rights are not cleared, so this build is
for internal demonstration only and the video is not stored in the repository.
The threat surface is a generic approximation and xG uses distance and angle only.

To load another match, replace `SEQUENCES` in `src/data/match.ts`.
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
