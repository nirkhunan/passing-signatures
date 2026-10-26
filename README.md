# Passing Signatures

**Every national team passes with an accent.** Passing networks and "signature
triangles" for every team at the 2018, 2022 and 2026 men's World Cups — 112 teams,
58 nations — told as a short slide-by-slide story, then opened up as an explorer.

## What it does

- **Story** — a guided sequence on one changing stage: Spain's 2026 network, its
  signature triangles, every team at all three World Cups as a dot chart, the champions,
  Morocco and South Korea's change, and 14 players who were in a signature triangle at
  all three tournaments (pick any of them).
- **Explorer** — year tabs (2018 / 2022 / 2026), any team, the same pitch view for every
  year. Find a player and follow him across tournaments; isolate a triangle; filter by
  unit and link strength; turn on real pass direction where it was recorded.
- **All teams** — every team at every World Cup by four style measures (passes per 90,
  back-line share, hub share, signature share), labelled with country codes, with a
  "highlight a country" picker that joins one nation's three dots.

## Consistency rules (so 2026 looks like 2018 and 2022)

- Players sit on their **formation spot** in every year (the only position all three
  sources share). Substitutes take the spot of the player they replaced.
- **Pass direction is shown only where it was recorded** (all of 2018, most of 2022);
  FIFA's 2026 reports don't have pass locations, so direction is off there, not guessed.
- Team pass volumes for 2018 (StatsBomb) are scaled onto FIFA's counting (×0.938,
  measured on the same 2022 player pairs).
- Players are linked across years by StatsBomb ID (2018↔2022) and by exact name within
  the same national team (→2026); near-matches are hand-checked in
  `precompute/people_overrides.json`.

## Run locally

```bash
npm install
npm run dev
```

## Data pipeline (build-time only)

| Year | Source |
|------|--------|
| 2018 | StatsBomb Open Data (events) |
| 2022 | FIFA Training Centre post-match reports, cross-checked against StatsBomb Open Data |
| 2026 | FIFA Training Centre post-match reports |

```bash
cd precompute
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
# 1. download sources into ../raw/ (FIFA PDFs, StatsBomb JSON) — see the scripts' docstrings
./.venv/bin/python parse_all_fifa.py 2022 2026   # FIFA PDFs -> raw/fifa<year>.json
./.venv/bin/python normalize.py                  # -> data/normalized/<year>/*.csv (+ qa.json)
./.venv/bin/python build_site_data.py            # -> public/data/ (schema v2.0)
./.venv/bin/python build_site_data.py --reuse-clusters   # fast re-run: names/labels only
```

`raw/` (≈1.2 GB) is not committed. `data/normalized/` holds the cleaned, source-agnostic
tables; `public/data/` is what the site loads (contract: `precompute/site_schema.py`).

A personal data-visualisation project. Data: StatsBomb Open Data; FIFA Training Centre
post-match summary reports.
