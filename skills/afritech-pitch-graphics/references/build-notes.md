# Build notes: faults already found and fixed

Three.js
- Rings and planes are built in XY then rotated -90 degrees about X, so plane +y becomes world -z.
  Ring angles therefore run clockwise seen from above; corner and penalty arcs depend on this.
- `ShaderMaterial` output is not colour-managed. Convert the ramp to linear and end the fragment
  shader with `#include <colorspace_fragment>`.
- A `Float32Array` works as the value of a `vec3[N]` uniform; set `MAX_POINTS` through `defines`.
- `TubeGeometry` indices are ordered by segment, so `setDrawRange(0, segments * radial * 6 * k)`
  reveals a lane progressively, and raycasting respects that range.
- Raycasting does not skip invisible materials. Keep a list of pickable objects and include only
  events playback has reached. Use an invisible sphere around each player mark as the hit target and
  report the player's own position, not the sphere surface.
- Treat a press that moves more than 6 px as an orbit drag, not a click.
- Three control points make a peaked arc. Sample five points along the flight.
- Scale arrows and glows by camera distance each frame, clamped, or they vanish when far and swamp
  the pitch when close.

Standalone build
- `vite build --mode single` with `vite-plugin-singlefile`, `three` marked external, and an import map
  in `index.html` pointing at jsDelivr. Pin an exact Three.js version at least two weeks old.
- Tailwind's play CDN resets headings and buttons. Set `tailwind.config = { corePlugins: { preflight:
  false } }`, guarded with `if (window.tailwind)` so a blocked CDN does not throw.
- A Tailwind `flex` class overrides the `hidden` attribute. Keep `[hidden] { display: none !important }`.
- Give every Tailwind-styled part a plain-CSS fallback; the CDN may be unreachable.
- In a flex column, give children `flex: none` or a horizontally scrolling row collapses on phones.
- For the Artifact, strip `<!doctype>`, `<html>`, `<head>`, `<body>` from the built file
  (`scripts/make-artifact.mjs`) and keep `<title>` first.

Speech
- `speechSynthesis.getVoices()` can be empty at first; listen for `voiceschanged` and re-describe.
- Android reports voice languages as `en_KE`, browsers as `en-KE`; match both.
- To test without audio, replace `window.speechSynthesis` with `Object.defineProperty` in an init
  script (plain assignment does not override it) and record what `speak` receives.

Environment
- Headless Chromium here has no GPU: launch with `--use-gl=swiftshader --enable-unsafe-swiftshader`.
  Frame rates measured this way say nothing about a real device.
- If a CDN is blocked in the sandbox, serve the same package from `node_modules` with `page.route`
  for testing and report that the CDN itself was not exercised.
- Never run a recursive delete with a relative glob after `cd`; write to a fresh directory instead.
