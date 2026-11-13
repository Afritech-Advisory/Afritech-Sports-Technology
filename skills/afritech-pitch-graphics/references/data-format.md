# Dataset format

Embedded in `index.html` as `<script type="application/json" id="tracking-data">`.

    {
      "match": { "title", "competition", "home", "away", "result", "window",
                 "footage": { "grade", "kind", "rights", "method" } },
      "teams": [
        { "code": "RSA", "name": "South Africa", "kit": "#ffcb05", "trim": "#007a4d", "lane": "#ffe14d", "accent": "#00a35c" },
        { "code": "KEN", "name": "Kenya", "kit": "#e5343f", "trim": "#111318", "lane": "#ff8f97" }
      ],
      "attack": { "RSA": "right", "KEN": "left" },
      "open": "g1",
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
- `teams`: home team first. `code` is what events use in `team`; `name` appears in the threat toggle,
  legend, cards and goal labels (the header uses `match.home` and `match.away`). `kit` is the player
  mark and dot, `trim` the rim of the mark, `lane` the ball paths and value tags, `accent` (optional,
  defaults to `kit`) the header underline, timeline ticks and the ring round the dot. Nothing about
  the teams is hard-coded in `src/`. A dataset with no `teams` list gets the Kenya U23 v Ivory Coast
  U23 colours, which is how the reference page still builds unchanged.
- `attack`: the goal each team attacks, `left` (x = 0) or `right` (x = 105). Take it from the footage.
  Teams change ends at half time, so a sequence from the other half carries its own `"attack"`.
  Without it the home team attacks left.
- `open`: id of the sequence shown first. Defaults to the last sequence with a goal.
- `match.startScore`: `[home, away]` goals scored before the first tagged sequence, if any. The
  header score counts tagged goals on top of it, so tag every goal the clip shows.
- The page throws on load if an event uses a team code that is not in `teams`.
- `outcome`: `complete`, `incomplete`, `goal`, `won`, `lost`.

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
