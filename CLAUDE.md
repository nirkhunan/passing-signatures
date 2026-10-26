# Passing Signatures — Project Memory

Passing-network story + explorer for the **2018, 2022 and 2026 FIFA World Cups**
(112 team-tournaments, 58 nations). v1 (WC2022 only, StatsBomb) is what `main` / the
live site still shows; the three-tournament redesign lives on branch `pudding-redesign`
(2026-10-13). `passing-signatures-prd.md` is the v1 spec; where it conflicts with the
decisions below, the decisions below win (user-approved 2026-10-13).

## Stack (locked)
- **Frontend:** React 18, `d3-force`, Vite. Plain CSS in `src/index.css` (Tailwind is
  still installed but no longer used by the new UI).
- **Fully client-side. No backend. No database. No localStorage / no browser storage of any kind.**
- **Precompute (build-time only, never in the browser):** Python. `pymupdf` (FIFA PDFs),
  `networkx`, `numpy`. StatsBomb JSON is read directly from the open-data repo files.

## Data pipeline
`raw/` (gitignored, ≈1.2 GB: FIFA PDFs + StatsBomb JSON)
→ `precompute/parse_all_fifa.py` (uses `fifa_pdf.py`) → `raw/fifa<year>.json`
→ `precompute/normalize.py` → `data/normalized/<wc2018|wc2022|wc2026>/` (+ `qa.json`)
→ `precompute/build_site_data.py` → `public/data/` (contract `site_schema.py`, **v2.0**)
→ `precompute/build_story_extras.py` → `public/data/triangles.json`, `players.json`,
  `shares.json` (share of triangles and of all passes per type, for the stacked-area charts).
`build_site_data.py --reuse-clusters` skips the slow null-model step (≈1 h for all teams)
and only refreshes names/labels/metrics.

Sources: 2018 StatsBomb only · 2022 FIFA reports primary + StatsBomb (cross-check r=0.89,
GK gap-fill where FIFA's matrix omits the keeper, direction extras) · 2026 FIFA reports only.
Never use the third-party Alamyy/Worldcup26 CSVs — their matrix cells are wrong.

## Locked data decisions
- **Same look every year (user):** players on **formation slots** (minutes-weighted; subs
  inherit the replaced player's slot) for all three tournaments — not average positions.
- **Pass direction only where real (user):** StatsBomb locations (2018 all, 2022 ~87% of
  links). 2026 has no direction — never estimate it.
- **Cross-tournament players (user approved name matching, 2026-10-13):** 2018↔2022 by
  StatsBomb id; →2026 by exact name within the same national team. Anything looser must be
  hand-confirmed in `precompute/people_overrides.json` (look-alikes listed as rejected).
  Person ids remain the join key in the frontend.
- **Country identity, not 58 colours (user asked; agreed):** dots are coloured by
  confederation (6 hues) and carry FIFA 3-letter codes; a "highlight a country" search
  joins one nation across years.
- 2018 team pass volumes scaled ×0.938 onto FIFA counting (measured on 2022 pairs).
- 90-minute floor; per-90 normalization; directed triads; exactly 5 clusters per team by
  z-score vs. a degree-preserving null model (1,000 nulls); minutes are nominal (90/120, no
  stoppage) for every source.
- Story numbers are computed from the data in `src/story.js` — never type figures in by hand.

## Story/visual decisions (2026-10-13, round 2 — user)
- Dot charts animate: dots drift in from a scatter and settle over ~4 s (live d3-force,
  weak pull + heavy drag in `Beeswarm.jsx`); layout changes travel, never jump.
- Show individuals, not averages (like the Pudding reference): besides teams, there are
  charts of every signature triangle (sorted into piles by type: back-line / build-up /
  midfield / attacking) and every player with 90+ minutes. The 2018→2022 trends were
  re-checked on StatsBomb-only 2022 data (stated in the methods drawer).
- Two stacked-area slides (reference's decade chart, one plateau per World Cup): triangle
  types vs. all passes split the same way — they morph into each other to show that
  passing barely moved while signatures moved back.
- Progress bar: no outlines; state shown by colour + height only.
- No native OS controls: dropdowns and search use `Select` / `SearchBox` (`Select.jsx`)
  in the project's own style; the range slider is restyled too.

## Theme — crimson ramp (user, 2026-10-13; replaces the cream/ink look)
Palette: coolors.co/palette/590d22-800f2f-a4133c-c9184a-ff4d6d-ff758f-ff8fa3-ffb3c1-ffccd5-fff0f3.
Page `#FFF0F3`, ink `#590D22`, muted `#A4133C`, rules `#FFCCD5`/`#FFB3C1`. All tokens live in
`src/lib/theme.js` (`P.c900…c50`) and `src/index.css`. Single-hue palette, so: categorical
sets use well-spaced steps, ordered sets follow the ramp (triangle types: back-line darkest →
attacking brightest), every chart labels its marks, and text on fills uses `textOn()`.
Reference for structure: pudding.cool/2024/11/love-songs. Type: Archivo / Newsreader /
JetBrains Mono. Flat — no shadows.

## Story structure (user, 2026-10-13)
Opening: composite fan-comment card (clearly labelled, links to the real forum threads it
paraphrases) → real news clips + a real FIFA Media post (short quotes, source + link; the
Williams 77-pass record is confirmed in our own data) → title → a full-screen lead-in slide
before every chapter. Visual slides put the text in a left column on desktop (≥1000px).
Never invent quotes or imitate a real person's post.

## Dev / verification
- Dev server: entry `passing-signatures` in `~/Desktop/Coding/.claude/launch.json` (port 5215).
- **iCloud:** ~/Desktop is iCloud-synced and the disk is ~96% full, so macOS offloads
  project files ("dataless") and `vite` stalls reading them. Until that's fixed (free
  space / turn off Optimize Mac Storage / move the project off Desktop — the user's call),
  work in a copy outside iCloud (entries `passing-signatures-scratch`, `-preview`) and
  write finished files back (writes are fast; reads stall).

## How we work (this collaborator is not a coder)
- Explain in plain language; check in at each stage; wait for "go" before building.
- Ask before installing, deleting/overwriting files, committing, or pushing.
- If a decision isn't covered here, stop and ask — don't guess.
- Never touch anything outside this project folder.
