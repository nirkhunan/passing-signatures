# Passing Signatures — PRD

**An interactive passing-network explorer for the FIFA World Cup 2022.**

| | |
|---|---|
| **Project** | Passing Signatures (working title) |
| **Version** | v1 — WC 2022 only; phase-2 architecture built in but not surfaced |
| **Stack** | React 18 · `d3-force` · Tailwind CSS · Vite — fully client-side, no backend, no localStorage |
| **Precompute** | Python · `statsbombpy` · `networkx` · `numpy` (build-time only) |
| **Data source** | StatsBomb Open Data (`statsbomb/open-data`), FIFA World Cup 2022, competition_id 43 |
| **Inspiration** | Northeastern NetSI Sport passing-cluster maps |
| **Delivery** | Standalone repo, run locally / deployable; data shipped as bundled JSON |
| **Status** | Design locked. Ready for Claude Code execution. |

> **How to read the "Design & Presentation Decisions" table:** every choice is tagged **`[Locked]`** (forced by a constraint — not worth debating) or **`[Default]`** (a taste call made on your behalf — change any of these freely before the build starts). Tell me which Defaults to swap and I'll revise this one section without touching the rest.

---

## 1. Problem & End Goal

Football teams have distinct passing identities — Spain recycles laterally in dense webs, England plays vertically and direct — but those identities live in event data that nobody but analysts can read. The end goal is an explorable artifact that makes a team's passing identity **legible at a glance and comparable between teams**: switch from one nation to another and watch the graph reorganize, revealing the structural difference between possession football and direct football.

This is a personal side project, not a commercial product. Success is the **"reveal" landing** — a viewer with no analytics background can feel the England→Spain contrast — and a **clean data layer** that lets WC 2026 drop in later for 2022-vs-2026 comparison.

## 2. Goals

1. **Make style legible.** A non-expert can identify a team's passing character (direct vs. possession, who connects the team) within ~30 seconds of selecting it.
2. **Land the reveal.** Switching teams visibly reorganizes the network and shifts its directional color field, with no jarring snap.
3. **Make "overrepresented" mean something.** The five highlighted clusters per team are statistically overrepresented vs. a null model, not just visually grouped.
4. **Build the 2026 seam now.** The frontend reads a normalized schema, so adding WC 2026 later is "write one new adapter," not a rewrite.
5. **Ship small.** v1 is buildable in 1–2 focused sittings once execution starts.

## 3. Non-Goals (v1)

1. **No WC 2026 data on the surface.** The adapter seam exists; the UI shows only 2022. *(Live 2026 needs a paid feed and reliable post-match data — phase 2.)*
2. **No 48-team support in the UI.** WC 2022 was 32 teams; that's the dropdown. *(48 is a 2026 format.)*
3. **No expected-threat (xT) edge weighting in v1.** Edges weight on frequency + directionality only. *(High-value, but a phase-2 analytical upgrade.)*
4. **No live updating / backend / database.** Data is precomputed to static JSON and bundled. *(Keeps it a client-side side project.)*
5. **No mobile-first design.** Desktop-first dense data viz; mobile degrades gracefully but isn't the target. *(A node-link graph this dense needs screen real estate.)*

---

## 4. Design & Presentation Decisions

These are the decisions you asked me to make. Review the **`[Default]`** rows; the **`[Locked]`** rows follow from constraints already agreed.

| # | Decision | Choice | Tag | Why |
|---|----------|--------|-----|-----|
| D1 | Theme | Light, "ink on tactical paper" | `[Locked]` | Your call — light reads as editorial data-journalism (NYT/Athletic register), which suits showcasing the data |
| D2 | Background hex | `#F3F6F3` (faint-green paper) | `[Default]` | The aesthetic risk in a light register — a barely-there pitch green, deliberately *not* cream/terracotta. Swap to neutral `#F6F7F8` if the tint reads off |
| D3 | Node color (default) | Green-ink `#22312A` | `[Default]` | Dark ink reads cleanly on light; carries the pitch-green DNA so even the dots belong to the subject |
| D4 | Node size | radius ∝ √(touches per 90), 6–26px | `[Locked]` | √ scale so *area* (not radius) encodes the value — honest sizing |
| D5 | Edge color = direction | forward `#0F9E8E` (deep teal) · lateral `#6B7A82` (slate) · backward `#7C3AED` (violet) | `[Default]` | Same teal/slate/violet logic, deepened so they hold contrast on a pale field; still CVD-distinguishable (no red/green trap) |
| D6 | Redundant direction cue | edge curvature + arrowhead | `[Locked]` | Colorblind-safety requires a non-color channel; D5 alone fails ~8% of male viewers |
| D7 | Hover spotlight | Amber-gold `#E0A000` + heavy dim of the rest; cluster rings suppressed while hovering | `[Locked]` | On light, the spotlight pops from *dimming the field*, not the hue alone; suppressing rings removes any gold/cluster collision |
| D8 | Cluster identity | 5 Okabe-Ito hues on node-rings, not edges | `[Default]` | Separate visual layer from edge color; set chosen to read on light and avoid the spotlight gold |
| D9 | Display type | Archivo (Expanded for hero) | `[Default]` | Slightly expanded grotesque nods to scoreboard / jersey typography |
| D10 | Body / UI type | Hanken Grotesk | `[Default]` | Clean, neutral, readable — stays out of the way |
| D11 | Data / number type | JetBrains Mono | `[Default]` | Tabular figures for touch counts, z-scores, % progressive — mono earns its place on numeric data |
| D12 | Layout | Left control rail + dominant canvas + bottom methodology drawer | `[Default]` | Analyst-console framing; canvas gets the space |
| D13 | Signature moment | **The morph** — eased team-switch + force↔pitch reorganization | `[Locked]` | This *is* the reveal; everything else stays quiet around it |
| D14 | Motion | ~750ms eased transitions; respects `prefers-reduced-motion` | `[Locked]` | The reorganization must feel continuous, not snap |

### Design tokens (for implementation)

```
COLOR  (light theme — "ink on tactical paper")
--bg:            #F3F6F3   /* faint-green paper; swap to #F6F7F8 for neutral */
--surface:       #FFFFFF   /* panels, drawer — white cards with a hairline border */
--border:        #DDE4DF   /* hairline rules on light */
--node:          #22312A   /* default player node — green-ink */
--node-dim:      #C9D2CC   /* de-emphasized node during spotlight/isolate */
--edge-forward:  #0F9E8E   /* progressive / goalward passes */
--edge-lateral:  #6B7A82   /* sideways recycling */
--edge-backward: #7C3AED   /* backward / reset passes */
--spotlight:     #E0A000   /* hover: focused player + top-5 partners (RESERVED) */
--cluster-1:     #0072B2   --cluster-2: #009E73   --cluster-3: #D55E00
--cluster-4:     #CC79A7   --cluster-5: #56B4E9   /* Okabe-Ito, CVD-safe, reads on light */
--text:          #22312A   --text-muted: #6B7A82
--isolate-veil:  #E8ECE9   /* dimmed-paper field behind an isolated cluster (see R6) */

TYPE
display: "Archivo" (700/600; Expanded 700 for the hero title)
body:    "Hanken Grotesk" (400/500)
data:    "JetBrains Mono" (400/500) — numbers, z-scores, legends
all via Google Fonts
```

### Layout wireframe

```
┌──────────────────────────────────────────────────────────────────┐
│ PASSING SIGNATURES · FIFA WORLD CUP 2022            data: StatsBomb│  header / eyebrow
├──────────────┬───────────────────────────────────────────────────┤
│ CONTROLS     │                                                     │
│              │                                                     │
│ Team  ▾      │                                                     │
│ [ Spain ]    │              ●───●        FORCE / PITCH             │
│              │             ╱│   │╲         network canvas          │
│ Layout       │            ● │   │ ●                                │
│ ○ Force      │             ╲│   │╱      nodes = players            │
│ ● Pitch      │              ●───●       edges = pass pairs         │
│              │                                                     │
│ Clusters     │                                                     │
│ ▣1 ▣2 ▣3     │                                                     │
│ ▣4 ▣5        │                                                     │
│              │                                                     │
│ Legend ▾     │                                                     │
├──────────────┴───────────────────────────────────────────────────┤
│ ▸ Methodology — what "overrepresented" means, data, limitations   │  collapsible drawer
└──────────────────────────────────────────────────────────────────┘
```

**Signature (D13):** switching teams does not re-render — it **morphs**. Nodes ease from one team's positions to the next; edges recolor as the directional mix changes (England floods with teal forward-lanes; Spain fills with short slate laterals). The Force↔Pitch toggle is the same morph applied to layout: the abstract tangle resolves into a recognizable formation on the grass. Spend the boldness here; keep panels, type, and chrome quiet.

---

## 5. Architecture

The frontend never touches raw StatsBomb files. A build-time adapter normalizes everything to one schema; the app only ever reads that schema. This is the seam that makes phase 2 cheap.

```
RAW SOURCE              ADAPTER (build-time, Python)      NORMALIZED            FRONTEND
──────────────────────────────────────────────────────────────────────────────────────
WC2022 open-data   →    adapter_sb_open.py            ─┐
WC2026 feed (P2)   →    adapter_sb_2026.py  (stub)    ─┴→  /public/data/<tourn>/<team>.json  →  React + d3-force
```

- **Adapter** pulls events, builds per-team passing networks, runs motif analysis, writes one JSON per team conforming to `TeamNetwork`.
- **Frontend** fetches finished JSON. No network analysis, no StatsBomb parsing, and no heavy compute at runtime.
- **Phase 2** adds a second adapter emitting the *same* shape. Because StatsBomb player IDs are stable across datasets, 2022-Spain vs 2026-Spain is a clean ID join, not a fuzzy name match.

### Repo structure

```
passing-signatures/
├── precompute/
│   ├── adapter_sb_open.py        # WC2022 → normalized JSON
│   ├── adapter_sb_2026.py        # PHASE 2 stub (raises NotImplementedError)
│   ├── motifs.py                 # network build + z-score motif analysis
│   ├── schema.py                 # dataclasses / validation for TeamNetwork
│   └── requirements.txt          # statsbombpy, networkx, numpy
├── public/data/wc2022/           # 32 generated <team>.json files (committed)
│   └── _index.json               # tournament metadata + team list
├── src/
│   ├── App.jsx
│   ├── components/  Graph.jsx  Controls.jsx  Legend.jsx  Methodology.jsx
│   ├── lib/  forceLayout.js  pitchLayout.js  colorScales.js  dataLoader.js
│   └── types.js                  # JSDoc typedefs mirroring schema.py
├── index.html
└── package.json                  # react, react-dom, d3-force, tailwind, vite
```

---

## 6. Normalized Data Schema

One file per team. **The frontend depends only on this shape — never change it without a `schema_version` bump.**

```jsonc
{
  "schema_version": "1.0",
  "tournament": {
    "id": "wc2022",
    "name": "FIFA World Cup 2022",
    "source": "StatsBomb Open Data",
    "team_count": 32
  },
  "team": { "id": 772, "name": "Spain", "matches_played": 4 },

  "nodes": [
    {
      "player_id": 5203,
      "name": "Sergio Busquets",
      "position": "CDM",
      "touches_per90": 92.1,
      "minutes": 360,
      "avg_x": 51.3,            // StatsBomb pitch coords, 0–120 (for Pitch layout)
      "avg_y": 40.2             // 0–80
    }
  ],

  "edges": [
    {
      "from": 5203, "to": 5211,
      "count": 41,              // total completed passes over the tournament
      "per90": 10.2,
      "pct_forward": 0.22,      // share of this pair's passes by direction
      "pct_lateral": 0.55,
      "pct_backward": 0.23,
      "direction_class": "lateral"   // dominant class → drives edge color
    }
  ],

  "clusters": [                 // exactly 5, ranked by overrepresentation
    {
      "rank": 1,
      "z_score": 4.8,           // observed vs. degree-preserving null
      "player_ids": [5203, 5211, 5252],
      "label": "Left-side recycle triangle",
      "description": "Busquets–Alba–Pedri short circulation"
    }
  ]
}
```

`_index.json` holds the tournament block plus an array of `{id, name}` for the dropdown, so the app loads team data lazily on selection.

---

## 7. Precompute Pipeline (Python, build-time)

Run once locally; commit the resulting JSON. The browser never runs this.

1. **Pull.** `statsbombpy` reads WC 2022 (competition 43) from open data — no auth needed. Enumerate all 32 teams and their match IDs.
2. **Per team, aggregate events across all their matches:**
   - **Nodes:** for each player, count touch events; compute minutes played; `touches_per90 = touches × 90 / minutes`. Average event `(x, y)` location → `avg_x, avg_y`. Exclude players below a minutes floor (see Open Q1).
   - **Edges:** for each completed pass, key by `(passer, recipient)`; accumulate `count`. Classify each pass by Δx in StatsBomb coords: **forward** if end_x − start_x > +5, **backward** if < −5, else **lateral** (threshold tunable). Aggregate to `pct_*` and pick `direction_class`.
3. **Motif analysis** (`motifs.py`) — see §8.
4. **Validate** against `schema.py`, write `<team>.json`, write `_index.json`.

`requirements.txt`: `statsbombpy`, `networkx`, `numpy`. (Claude Code installs these in the precompute step.)

## 8. Analytical Method — "overrepresented" with teeth

This is what separates the project from a pretty graph.

1. Build the team's **directed passing network** (players = nodes, completed passes = weighted directed edges), aggregated over all their matches.
2. Enumerate **3-node connected motifs** (passing triads / triangles) and record observed frequency for each player-triple pattern.
3. Generate **N ≈ 1000 null networks** by degree-preserving edge randomization (configuration-model swaps), preserving each player's in/out degree.
4. For each observed motif, compute **z-score** = (observed − null mean) / null std.
5. Take the **top 5 by z-score** → the five most overrepresented clusters. Attach player IDs, a human label, and the z-score.

The z-scores surface in the Methodology drawer so the "overrepresented" claim is auditable. *(Conceptually mirrors NetSI's approach; we're reproducing their published five-cluster framing on the same WC2022 data they used.)*

---

## 9. User Stories

- As a **curious fan**, I want to pick a team and immediately see its passing shape, so I can grasp its style without reading analytics.
- As a **fan**, I want to switch from England to Spain and watch the graph reorganize, so I can *feel* direct vs. possession football.
- As a **tactics nerd**, I want to hover a player and spotlight their top-5 pass partners in gold, so I can see who they actually combine with.
- As a **tactics nerd**, I want to isolate one of the five clusters so the rest of the network fades back, so I can study one overrepresented pattern without noise.
- As a **skeptic**, I want a methodology drawer explaining "overrepresented" and the data source, so I can trust (or challenge) what I'm seeing.
- As a **colorblind viewer**, I want pass direction encoded by more than hue, so the directional story still reads.
- As a **viewer in any state**, I want an empty/loading state that tells me what's happening, so a slow data fetch isn't a blank screen.

## 10. Requirements

### P0 — Must have (v1 doesn't ship without these)

| ID | Requirement | Acceptance criteria |
|----|-------------|---------------------|
| R1 | Force-directed network renders a team | Given a team JSON, when it loads, then nodes (r ∝ √touches/90) and directional-colored edges render via `d3-force` with no overlap-induced unreadability |
| R2 | 32-team dropdown | All WC2022 teams selectable; selecting one lazy-loads its JSON |
| R3 | Morph on team switch | Switching teams eases node positions + recolors edges over ~750ms; no hard snap; respects reduced-motion |
| R4 | Hover spotlight | Hovering a node golds that node + its top-5 partners and dims the rest to `--node-dim`; leaving restores |
| R5 | Five clusters highlighted | Each team shows exactly 5 clusters via node-ring hull colors; toggleable in the rail |
| R6 | Double-click isolate | Double-clicking a cluster fades everything else to a ghost layer, drops the background to `--isolate-veil`, and keeps that cluster vivid + centered; click-out restores *(changed from the scope's "dark background" to stay consistent with the light theme — D1)* |
| R7 | Force↔Pitch layout toggle | Toggling morphs nodes to `avg_x/avg_y` pitch positions (drawn over a faint pitch) and back |
| R8 | Colorblind-safe direction | Edge direction conveyed by curvature + arrowhead in addition to hue |
| R9 | Methodology drawer | Collapsible drawer explains overrepresentation, shows the selected team's 5 z-scores, names data source + limitations |
| R10 | Quality floor | Visible keyboard focus, loading + empty states, no runtime crash on any of the 32 teams |

### P1 — Nice to have (fast follow)

- Cluster legend with labels + z-scores inline on the canvas.
- "Reset view" control after isolate / zoom.
- Subtle node labels on zoom-in (avoid clutter at default zoom).

### P2 — Future / parking lot (design must not preclude)

- WC 2026 adapter + tournament selector (phase 2 headliner).
- **Dual-graph compare** (2022-vs-2026 side by side) — the reason phase 2 exists.
- xT-weighted edges · betweenness-centrality overlay + node-removal · scrollytelling guided mode · possession-phase time scrubber · URL-encoded shareable view state.

---

## 11. Build Sequence (Claude Code execution order)

Each stage ends with its own verification before moving on.

- **Stage 0 — Scaffold.** Vite + React 18 + Tailwind; repo structure per §5; fonts loaded; tokens wired into Tailwind config. ✔ App boots to an empty themed canvas.
- **Stage 1 — Precompute.** Implement `adapter_sb_open.py` + `motifs.py` + `schema.py`; generate all 32 JSON + `_index.json`. ✔ 32 files exist, each schema-valid, each with exactly 5 clusters.
- **Stage 2 — Data loading.** `dataLoader.js` + typedefs; load `_index.json`, lazy-load team JSON. ✔ Console shows a parsed team object on select.
- **Stage 3 — Graph.** Render nodes + directional edges with `d3-force`; sizing + color scales. ✔ Spain renders, readable, correct colors.
- **Stage 4 — Dropdown + morph.** Team selector; eased transition between teams. ✔ England→Spain morphs continuously.
- **Stage 5 — Spotlight.** Hover golds node + top-5, dims rest. ✔ Works on every team; restores cleanly.
- **Stage 6 — Clusters + isolate.** 5-cluster rings; toggles; double-click isolate. ✔ Isolate centers one cluster; restore works.
- **Stage 7 — Pitch toggle.** Force↔Pitch morph over a faint pitch. ✔ Nodes snap to plausible formation positions.
- **Stage 8 — Methodology + legend + CVD encoding.** Drawer with z-scores + source + limits; curvature/arrowhead direction cue. ✔ Direction readable in grayscale.
- **Stage 9 — Polish.** Reduced-motion, keyboard focus, loading/empty states, responsive floor. ✔ Definition-of-done (§14) passes.

---

## 12. Phase 2 — Stubbed (do not build now; do not preclude)

**Trigger:** reliable post-match WC 2026 event data is available (paid Hudl StatsBomb feed or equivalent).

**Scope when triggered:**
1. Implement `adapter_sb_2026.py` emitting identical `TeamNetwork` shape into `/public/data/wc2026/`.
2. Add a **tournament selector** (2022 / 2026) above the team dropdown.
3. Build **dual-graph compare**: two synchronized canvases, same scales, 2022 vs 2026 — the headline feature, because side-by-side is what cross-tournament comparison wants.
4. Cross-tournament **diff view**: join on `player_id`; surface clusters that appeared/disappeared and directional-mix shifts.

**Guardrails baked into v1 so phase 2 stays cheap:**
- Data paths are tournament-keyed (`/data/<tourn>/`) from day one.
- `schema_version` present from day one.
- Player IDs preserved as the join key (never name-match).
- Graph component takes a dataset as a prop — it has no hardcoded "2022" anywhere.

---

## 13. Resolved Decisions

All five open questions are now answered and locked into the spec:

| # | Question | Resolution |
|---|----------|------------|
| Q1 | Minutes floor for a player to appear as a node | **≥ 90 minutes.** Players below the floor are excluded from `nodes`. |
| Q2 | Cluster motif analysis — directed or undirected triads | **Directed.** Triads preserve passing flow (passer → recipient). |
| Q3 | Theme | **Light** — "ink on tactical paper" (D1–D8 reworked accordingly). The dark direction is dropped. |
| Q4 | Cross-team density fairness | **Normalize per-90.** Edge weights use `per90` so the deeper-running teams (Argentina, France ~7 matches) don't just look denser than the early exits (~4–5). |
| Q5 | Deploy target | **GitHub once everything is built, tested, and verified.** Hosting (e.g. enabling GitHub Pages for a live URL) is a decision at that step — no impact on the build now. |

No open questions remain. The build can start at Stage 0.

## 14. Definition of Done (v1)

- [ ] All 32 WC2022 teams load and render without error.
- [ ] Team switch morphs continuously; reduced-motion users get an instant, non-jarring swap.
- [ ] Hover spotlight, 5-cluster highlight, double-click isolate, and Force↔Pitch toggle all work on every team.
- [ ] Pass direction is legible in grayscale (CVD check passes).
- [ ] Methodology drawer shows real z-scores for the selected team and names StatsBomb as the source.
- [ ] Keyboard focus visible; loading and empty states present.
- [ ] No "2022" hardcoded in `src/` outside the data path — phase-2 seam intact.

---

## Appendix — Glossary (non-coder reference)

- **Node / edge** — a node is a player dot; an edge is a line between two players who passed to each other.
- **Force-directed layout** — physics-style layout where connected nodes pull together; reveals structure, not real pitch position.
- **Motif** — a small recurring sub-pattern in a network; here, a passing triangle among three players.
- **z-score** — how unusual something is vs. random chance; high z = a pattern this team does far more than expected.
- **Adapter** — a small program that converts a raw data source into our standard format, so the app doesn't care where data came from.
- **Schema** — the agreed shape of our data files; the contract between the data side and the app side.
