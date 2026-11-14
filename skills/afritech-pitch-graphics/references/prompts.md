# The prompts, in order

These are the prompts that produced the reference build, with what each was taken to mean.
Prompts 1 to 5 come from the "building 3D soccer pitch graphics in your browser with Three.js" guide;
prompt 0 is the opening request that set the source and the look.

## 0. Opening request

> build an interactive 3D Three.js soccer pitch visualizer from an African match video clip using my
> skills and memory using the video as a source and the image as a template and the image prompt

Attached: the match clip, a template image (dark isometric pitch slab, watercolour heat wash, blue
arcs with value tags, handwritten axes), and prompt 1 as a screenshot.

Interpretation: the video supplies the data (tag it), the image supplies the visual direction, the
Afritech match-data skill supplies the rights gate, footage grade and Opta-style event names.

## 1. Project initialization and scene setup

> Initialize a Vite and TypeScript project with Three.js and Lucide icons. Create a core SceneManager
> class that sets up a WebGLRenderer with antialiasing, a perspective camera, directional and ambient
> lighting, window resize handling, and OrbitControls configured with smooth damping. Render a scaled
> 3D soccer pitch floor with standard pitch markings (touchlines, halfway line, penalty boxes, center
> circle) matching FIFA proportions.

Result: `src/core/SceneManager.ts`, `src/pitch/`. 1 world unit = 1 metre. Camera distance is fitted to
the viewport so the pitch fits on a portrait phone.

## 2. Custom GLSL shader for the expected threat heat grid

> Create a custom Three.js ShaderMaterial using a custom fragment shader that renders a smooth
> Contextual Expected Threat (xT) heat grid across the pitch surface. The shader should accept a
> dynamic float array uniform of spatial coordinate intensity points, blending smoothly from cool cyan
> in the defensive third to vibrant magenta and amber in the attacking penalty box, while maintaining
> 60 FPS performance.

Result: `src/viz/ThreatSurface.ts`. "Contextual" was read as: positional xT plus Gaussian lifts at the
points where the selected team gained threat in the sequence on screen, fading in with playback.
Frame rate cannot be proven without a GPU; report the software-renderer figure and say so.

## 3. Volumetric passing tubes and coordinate mapping

> Build a utility function that takes JSON tracking coordinates extracted from a video clip and
> generates volumetric passing lanes hovering above the grass using Three.js TubeGeometry and
> CatmullRomCurve3. Add glowing vertex points and floating translucent trajectory arrows that scale
> dynamically as the camera orbits.

Result: `src/viz/PassingLanes.ts`, `src/data/coordinates.ts`. With no tracker output, each ball path is
five points sampled along an assumed arc between the tagged start and end. Say this plainly.

## 4. Interactive raycasting and playback controls

> Add raycasting and click-event handlers to the 3D scene so users can click on specific player
> coordinates or passing tubes to inspect defensive pressure pockets and coordinate data in a floating
> HTML overlay card. Include a playback timeline UI component at the bottom of the viewport to scrub
> through match clip frames.

Result: `src/core/Picker.ts`, the card and timeline in `src/main.ts`. Pressure is an eyeball count of
opponents within 5 m and the nearest distance, tagged only where the frame shows it.

## 5. Standalone bundle

> Bundle the entire Three.js soccer pitch visualizer, xT fragment shader, passing tube geometries,
> playback controls, and coaching notes sidebar into a single, standalone index.html file. Include CDN
> links for Three.js, OrbitControls, and Tailwind CSS. Embed a JSON tracking dataset and a
> base64-encoded snippet or video element slot for the match clip so the dashboard is fully portable
> and downloadable.

Plus: "Call it Kenya U23 vs Ivory Coast U23 AFCON U23 Qualifiers 3D Soccer Pitch Graphics Analysis".

Result: `standalone/index.html` (about 60 KB). The clip was first a slot, not an embed, because the
footage rights were not cleared at that point (later confirmed; see follow-ups). CDN links mean the file needs an internet connection.

## Follow-up requests (13 Nov 2026), in order

1. "I would like the public-facing information including the index HTML to be reworded. And yes I
   have been given the video rights." Plus a post for the Claude Code Club explaining the concept,
   tools and benefits for sports video analysis, asking how to embed the video. Result: plain,
   client-safe wording; rights line "Used with the permission of the rights holder."
2. "Make the coach notes audible so when you click the play button you can hear them." Result:
   `Narrator.ts`, browser speech synthesis, subtitle over the pitch, voice toggle.
3. "A Kenyan voice accent instead of a British one. So from now on use an African voice accent."
   Result: the voice rule in SKILL.md section 4. Permanent preference.
4. "Fix the URL so it doesn't show the Claude artifact link." Result: GitHub Pages workflow.
5. A Club member's comment: "Re-encode it with ffmpeg at 720p, H.264, CRF around 28 ... If it's still
   heavy, keep the HTML small and load the clip from its own URL in the same GitHub Pages repo, with
   your local file picker as the fallback." Result: the source was 640x360, so 720p grew it to 57 MB;
   native CRF 28 gave 24 MB; shipped the URL plan. Never upscale.
6. "Give me step by step what I need to do in GitHub." Result: references/publishing.md.
7. "Give me a reply to the comment which I can copy and paste without editing." Result: plain-text
   first-person reply with the measured sizes and the live link, run through the anti-AI writing rules.

## Reusing the sequence for a new match

Send the clip and say: "Use the afritech-pitch-graphics skill on this clip. Call it <title>."
The prompts above do not need to be pasted again; the reference code already implements them.
