# Dataset format

One file per match, `pitch-visualizer/matches/<match>.json`. The build embeds it in the page as
`<script type="application/json" id="tracking-data">`.

    {
      "match": { "title", "competition", "home", "away", "result", "window",
                 "footage": { "grade", "kind", "rights", "method" } },
      "teams": [
        { "code": "KEN", "name": "Kenya", "label": "Kenya U23", "lane": "#9cc2ff", "kit": "#e5343f",
          "trim": "#111318", "accent": "#e5343f", "attacks": "left" },
        { "code": "CIV", "name": "Ivory Coast", "label": "Ivory Coast U23", "lane": "#ffe9c4",
          "kit": "#f6f3ec", "trim": "#ff8a2a", "accent": "#ff8a2a", "attacks": "right" }
      ],
      "open": "g3",
      "clip": { "fps": 30, "frames": 11846, "src": "clip.mp4" },
      "units": "metres",
      "sequences": [
        { "id": "g1", "label": "64'", "title": "Kenya 1–0", "score": "1–0",
          "end": 3870, "videoOffset": -3857,
          "notes": ["...", "...", "..."],
          "events": [
            { "t": 3857, "team": "KEN", "type": "throw_in", "from": [48,68], "to": [41,61], "outcome": "complete" },
            { "t": 3867, "team": "KEN", "type": "shot", "from": [18,32], "to": [0,35.5], "outcome": "goal",
              "pressure": { "within5": 2, "nearest": 3 }, "note": "..." }
          ] }
      ]
    }

- `t`, `end`: match clock in seconds. `videoOffset`: add to the clock to get seconds into the clip.
- `teams`: exactly two, home first. Names, codes and colours are read from here; nothing in `src/` is
  tied to a team. `lane` = ball paths and legend, `kit` and `trim` = player marks, `accent` = header
  underline and timeline ticks, optional `ring` = second colour round the team dot, `label` = full
  header name where it differs from `name`.
- `team` on an event: one of the two codes in `teams`. The page stops with a clear error otherwise.
- `attacks`: the goal a team attacks, `left` (x = 0) or `right` (x = 105). Set the usual direction on
  the team and override it on any sequence from the other half:
  `"attacks": { "RSA": "right", "KEN": "left" }`. Add `"half": 1` to first-half sequences so added
  time reads 45+2, not 47.
- `open`: id of the sequence shown first. Default: the last sequence with a goal.
- The header score counts tagged goals up to the playhead, home first. If the clip does not show
  every goal, say so; do not add events that were not seen.
- `outcome`: `complete`, `incomplete`, `goal`, `won`, `lost`; for shots `goal`, `saved` or `off_target`
  (shown as Goal (16), Attempt saved (15), Miss (13)).
- `xg` on a shot: a fixed value where distance and angle do not apply (0.76 for a penalty).
- No scoreboard or clock in the footage (a clean camera feed): set `"timebase": "clip"` in `match`, use
  seconds into the clip for every `t` and `end` (decimals allowed), and `videoOffset: 0`. The page then
  labels times as clip times. Count only the goals the pictures show and say so in `match.resultNote`,
  which replaces the plain result line. `match.played` adds the date and place.

| type | Shown as | Opta name | Drawn as |
|---|---|---|---|
| throw_in | Throw-in | Pass (1), throw-in | lane |
| pass | Pass | Pass (1) | lane |
| cross | Cross | Pass (1), cross | lane |
| gk_kick | Keeper kick | Pass (1), long ball | lane |
| clearance | Clearance | Clearance (12) | lane |
| shot | Shot | Goal (16) | thicker lane, goal flash |
| carry | Carry | Carry (derived) | dashed ground run |
| take_on | Take-on | Take On (3) | dashed ground run |
| recovery | Recovery | Ball recovery (49) | ring |
| tackle | Tackle | Tackle (7) | ring |
| claim | Keeper claim | Claim (11) | ring |

Threat: xT is credited only for completed passes, crosses, throw-ins and carries (end minus start).
Shots get xG instead. Pressure level: high if two or more opponents within 5 m or the nearest is
within 1.5 m; medium if one; low otherwise.

Tracker output instead of hand tags: pass `{ units, passes: [{ id, team, kind, complete, points }] }`
to `buildPassingLanes`. `units` may be `metres`, `normalised` (with `origin: "far-left"` for top-left
trackers) or `pixels` with a 9-number `homography`; `homographyFromPoints` builds one from four
landmarks on a frame.
