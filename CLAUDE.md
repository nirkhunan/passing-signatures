# Passing Signatures — Project Memory

Interactive passing-network explorer for FIFA World Cup 2022. Full spec lives in
`passing-signatures-prd.md` (the PRD is the source of truth; this file is the
short list of locked constraints that must survive across sessions).

## Stack (locked)
- **Frontend:** React 18, `d3-force`, Tailwind CSS, Vite.
- **Fully client-side. No backend. No database. No localStorage / no browser storage of any kind.**
- **Precompute (build-time only, never runs in browser):** Python with `statsbombpy`,
  `networkx`, `numpy`. Generates static JSON that gets bundled.

## Data contract (locked)
- The normalized schema in **PRD Section 6** is THE contract. The frontend reads ONLY
  that shape — nothing else.
- **Never change the schema without bumping `schema_version`** (currently `"1.0"`).
- One JSON file per team in `public/data/<tournament>/<team>.json`, plus `_index.json`.

## Phase-2 seam (locked)
- No literal `"2022"` hardcoded anywhere in `src/` outside the data path.
- Data paths are **tournament-keyed**: `/data/<tournament>/` from day one.
- Player IDs are the cross-tournament join key — never name-match.
- The Graph component takes a dataset as a prop; it has no hardcoded tournament.

## Theme (locked) — "ink on tactical paper" (light), PRD Section 4
Use these exact tokens:
```
--bg:            #F3F6F3   /* faint-green paper (swap to #F6F7F8 only if tint reads off) */
--surface:       #FFFFFF
--border:        #DDE4DF
--node:          #22312A
--node-dim:      #C9D2CC
--edge-forward:  #0F9E8E
--edge-lateral:  #6B7A82
--edge-backward: #7C3AED
--spotlight:     #E0A000
--cluster-1:     #0072B2  --cluster-2: #009E73  --cluster-3: #D55E00
--cluster-4:     #CC79A7  --cluster-5: #56B4E9
--text:          #22312A  --text-muted: #6B7A82
--isolate-veil:  #E8ECE9
```
Type (all via Google Fonts): display **Archivo** (Expanded 700 for hero),
body **Hanken Grotesk**, data/numbers **JetBrains Mono**.

## Locked data decisions (PRD Section 13)
- **90-minute floor:** players with < 90 minutes are excluded from `nodes`.
  (Kept faithfully even though small-sample blowout cameos can top the per-90
  touch chart — user chose fidelity over forcing Busquets near the top.)
- **Touches = successful ball receptions** (StatsBomb `Ball Receipt*` with no
  incomplete outcome) — the chosen reading of PRD §7 "count touch events."
- **Directed triads** for motif/cluster analysis (passer → recipient flow preserved).
- **Per-90 normalization** of edge weights, so deep-running teams don't just look denser.
- Pass direction by Δx in StatsBomb coords: forward if end_x − start_x > +5,
  backward if < −5, else lateral.
- Exactly **5 clusters** per team, ranked by z-score vs. a degree-preserving null model.

## Status (Stages 0–9 complete)
- App is built and verified through Stage 9. `npm run build` works reliably
  (~0.5s). An early one-time "hang" was just first-run macOS Gatekeeper
  verification of Rollup's native arm64 binary — NOT a code bug; ignore it.
- Dev/build verification on this machine uses a Bash-run dev server on :5173 and
  `curl` checks — the built-in preview tool is pointed at a different project, so
  do NOT rely on preview_start here.
- **Deviations from PRD (user-approved):** Stage 5 gold hover spotlight was
  dropped (user disliked it) — a lightweight hover *name label* is kept instead.
- **Added beyond PRD (user requests):** landing page (+ clickable title → intro),
  line filters (Connections), pass-direction filters, minimum-passes slider,
  player-label toggle, empty-pitch backdrop.
- **Glossary** (pass link / cluster / z-score / motif) was built into the
  Methodology drawer (Stage 8) — done.
- **Next:** deploy to GitHub (PRD Q5). Not a git repo yet; needs user go for any
  push/publish. For GitHub Pages project sites, set Vite `base` to the repo name.

## How we work (this collaborator is not a coder)
- Explain in plain language; check in at each stage; wait for "go" before building.
- Ask permission before running commands, installing, or deleting/overwriting files.
- If the PRD doesn't cover a decision, stop and ask — don't guess.
- Never touch anything outside this project folder.
- Build in the exact stage order from PRD Section 11 (Stage 0 → Stage 9), verifying each.
