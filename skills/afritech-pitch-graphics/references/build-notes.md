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

## Clip delivery

Never base64 the clip into the HTML. Re-encode at the source's native size (upscaling to 720p only
grows the file: the Kenya clip went 25 MB to 57 MB at 720p, 24 MB at native 360p):

    ffmpeg -i in.mp4 -c:v libx264 -preset slow -crf 28 -pix_fmt yuv420p -c:a aac -b:a 64k -movflags +faststart clip.mp4

Put it beside the page (`standalone/clip.mp4`, with a `!standalone/clip.mp4` gitignore exception),
set `"clip": {..., "src": "clip.mp4"}` in the dataset, and publish the folder on GitHub Pages. The
page loads it over http(s); on failure it falls back to the device picker. Test with a server that
answers range requests (Python's http.server does not, so seeking fails there).

iPhone (Andrew, 14 Nov 2026: "why is it asking for the video to be uploaded"): Safari on an iPhone in
Low Power Mode or on mobile data fetches nothing from a `<video>` until it is asked to play, so
`loadedmetadata` never fired and the pane sat on its upload button. The page now hides the upload
button while the published clip is loading, asks the video to play at once (muted, then pauses) and
asks again on each touch until it loads. Show the upload button only after a real load error.
Not tested on a real iPhone from the sandbox; ask Andrew to confirm on his phone.
