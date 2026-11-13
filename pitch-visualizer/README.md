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
- `src/viz/` threat surface texture and the event layer (arcs, carries, duels, ball)
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
