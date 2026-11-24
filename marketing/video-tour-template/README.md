# Video tour template: narrated, animated walkthrough of a live Afritech page

Turns any live Afritech page (tournament desk, CV desk, MatchIQ report) into a LinkedIn-ready
video: 1080x1350 portrait, female Kenyan voiceover, burned-in word-by-word captions, page
captures with scrolls, zooms and highlight boxes, chapter cards, light-leak transitions,
film grain, original music and sound effects.

**Worked example:** [`../linkedin/u17-tournament-desk-tour/`](../linkedin/u17-tournament-desk-tour/).
That folder holds the FIFA U-17 World Cup Qatar 2026 desk tour (103 s), its LinkedIn post,
first comment, Claude Code Club post, captions and voiceover script. Every file in this
folder is the exact pipeline that produced it.

## Before you start: the Four Sentences

Read the afritech-four-sentences skill first. The video must say, on its first screen, who
it is for and end on one action. In the example that is "For clubs, agents and federations
scouting Africa's young players" and "Book a briefing". Stranger test: someone outside
football can say who it's for and what to do next.

## Requirements

Node with Playwright and Chromium, Python 3 with Pillow and numpy, `pip install edge-tts`,
ffmpeg. Fonts load from Google Fonts at render time.

## Steps

| # | Command | What it does |
|---|---|---|
| 1 | `node capture.js <url> results players nations matches approach contact` | Phone-layout captures (960 px wide) of the page top and each section id into `cap/`. It prints the section ids it finds on the page. |
| 2 | `python3 assets.py` | Film-grain tile and the logo crop. Add photos by hand (see Photos). |
| 3 | Edit `script.json` | One entry per scene: `{"id", "text"}`. Write numbers as words ("forty-eight", "nine-nil") so the voice reads them well; `timeline.py` turns them back into digits for the captions. Spell the email for the ear ("afri-tech sports dot com"). |
| 4 | `python3 tts.py` | Voice per scene into `vo/` with word timings. The default is `en-KE-AsiliaNeural` (female Kenyan English). `edge-tts --list-voices` lists others, including Kiswahili `sw-KE-ZuriNeural`. |
| 5 | `python3 timeline.py` | Scene start and end times, caption chunks and caption number formatting into `timeline.json`. `cur=2.4` leaves a 2.4 s cold open before the voice. Edit `rep` for new number words. |
| 6 | Edit `stage.html` | Fit the visuals to the new script (see below). |
| 7 | `node render.js test 1 12 30 45 82 100` | Test frames into `test/`. **Always check these before the full render.** |
| 8 | `node render.js full` | Renders every frame (30 fps) into `video_silent.mp4`. About 3 minutes for 100 s. |
| 9 | `./export.sh` | Music, sound effects, mix (-16 LUFS, music ducks under the voice), then `out/video.mp4` (~40 MB), `cover.jpg`, `still-end-card.jpg` and `title-loop.gif`. |

## How `stage.html` is organised

Everything is computed from time `t` in `render(t)`, so every frame comes out the same on every run.

- **Cues:** `init()` names the moments visuals hit, by spoken word, for example
  `sen: cue('s4','Senegal')`. Change the scene ids and words to match the new script.
- **Scroll keyframes:** `y.results = kf(t, [[time, scrollPx], ...])` scrolls each capture.
  Pixels are capture pixels: the window is 960x950.
- **Highlight boxes:** `hl(t, on, off, x, y-scroll, w, h)` in capture pixels. Find
  positions from a thumbnail of the capture (scale up by 960 / thumbnail width).
- **Chips:** the `chips` list holds the lime pill captions, each `[start, end, text]`.
- **Chapters:** the `CH` list holds the numbered chapter cards.
- **Quote card:** the `#quote` div shows during scene `s5q`. Use only a real quote, with no name unless the person agrees.
- **Cold open:** `#poster` with a push-in, letterbox and blur on the title reveal.
- **Palette:** `--maroon` (FIFA tournament maroon), `--gold` (now the tournament lime
  #D4F53C) and `--wine`. For a non-FIFA page, swap these for Afritech navy #1A365D, teal
  #0D9488 and gold #E9C46A.

## Photos

`cap/poster.jpg` is the cold open, `cap/moz.jpg` is a full-bleed scene photo with a tilt
down, and `cap/hl_card.jpg` is the official-video card. Use 1080x1440 portrait where you
can. Crop out phone status bars and app buttons. Never inpaint over faces. Photos are not
committed here: they belong to their owners. When you use an event's own images, keep the
"Images: <owner>" credit on screen and the "Not affiliated with or endorsed by <owner>"
line on the end card. The rights holder can still ask LinkedIn to take the post down.

## Lessons from the first build

- Read the live page and use only facts on it. Leave out sections that aren't ready (the
  radar charts were still empty), and don't fake them.
- Capture the phone layout. Desktop text is too small once it's scaled into a 1080-wide frame.
- Aim for under two minutes. The first script ran 114 s and was cut to 85 s before the cold
  open and quote were added.
- Burn in the captions: most LinkedIn video plays on mute.
- Check test frames first. They caught a highlight box that never switched off (now reset every frame).
- Film grain inflates the bitrate (137 MB at CRF 17). `export.sh` caps it at 3.5 Mb/s.
- In cloud sessions edge-tts needs the proxy CA; `tts.py` handles this.

## Reusable prompt

> You are a Senior Creative Sports Director. Make an animated audio-visual video, in a
> female Kenyan voice, giving a guided tour of <URL> for my LinkedIn personal page. Use
> the video-tour template in marketing/video-tour-template, only facts from the live page,
> the Four Sentences, and show me test frames before the full render. Photos: <attach>.
