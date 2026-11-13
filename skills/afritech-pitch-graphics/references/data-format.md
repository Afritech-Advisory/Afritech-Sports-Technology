# Dataset format

Embedded in `index.html` as `<script type="application/json" id="tracking-data">`.

    {
      "match": { "title", "competition", "home", "away", "result", "window",
                 "footage": { "grade", "kind", "rights", "method" } },
      "clip": { "fps": 30, "frames": 11846 },
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
- `team`: the two codes used in `TEAM_NAME` and `TEAM_COLOR` (change both for a new match), and the
  attack direction in `goalX()` in `src/data/models.ts`.
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
