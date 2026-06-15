# Passing Signatures

**An interactive passing-network explorer for the FIFA World Cup 2022.**

Every national team passes with an accent — Spain recycles laterally in dense webs,
England plays vertically and direct. Passing Signatures turns StatsBomb's open World
Cup 2022 event data into an explorable map of how each of the 32 teams moved the ball:
who connected with whom, in which direction, and which three-player passing triangles
they leaned on far more than chance. Switch teams and watch the structure reorganize.

## What it does

- **Pick any of the 32 nations** and see its passing network.
- **Pitch** view (players at their average positions) ↔ **Force** view (physics layout),
  with a smooth morph between teams.
- **Filter** by line (defense / midfield / attack), pass direction, and connection strength.
- **Five signature clusters** per team — the passing triangles that are statistically
  overrepresented vs. a degree-preserving null model (z-scored). Double-click to isolate one.
- **Methodology drawer** with per-team z-scores, data source, limitations, and a glossary.
- Colorblind-safe direction encoding (curved arrows + hue).

## Stack

- **Frontend:** React 18 · d3-force · Tailwind CSS · Vite — fully client-side, no backend,
  no database, no browser storage. Data ships as static JSON.
- **Precompute (build-time only):** Python · statsbombpy · networkx · numpy — pulls the
  open data, builds each team's directed passing network, runs the motif/z-score analysis,
  and writes one normalized JSON per team into `public/data/wc2022/`.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
```

## Regenerate the data (optional)

```bash
cd precompute
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
./.venv/bin/python adapter_sb_open.py     # writes 32 team JSON + _index.json
```

## Data

[StatsBomb Open Data](https://github.com/statsbomb/open-data) — FIFA World Cup 2022
(competition 43). A personal data-visualization project.

## Architecture note

The frontend reads only a normalized schema (`precompute/schema.py`, mirrored in
`src/types.js`). Data paths are tournament-keyed (`/data/<tournament>/`) and player IDs
are the join key, so a future tournament is "add one adapter," not a rewrite.
