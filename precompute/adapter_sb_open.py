"""WC2022 StatsBomb Open Data -> normalized TeamNetwork JSON (PRD §5, §7).

Build-time only; the browser never runs this. Pulls events for every WC2022
match, aggregates per team into the locked schema, runs the overrepresentation
analysis (motifs.py), validates (schema.py), and writes one <team>.json per team
plus _index.json.

Locked decisions applied here:
  * 90-minute floor for player nodes (Q1).
  * Directed passing network; per-90 normalization of weights (Q2, Q4).
  * Pass direction by Δx in StatsBomb coords: forward >+5, backward <-5 (else lateral).

Usage:
  python adapter_sb_open.py                # all 32 teams, 1000 nulls, writes _index.json
  python adapter_sb_open.py --team Spain   # one team (test); does not touch _index.json
  python adapter_sb_open.py --null 200     # fewer null networks (faster, for testing)
"""
from __future__ import annotations

import argparse
import json
import os
import warnings
from collections import defaultdict

import pandas as pd

import motifs
import schema

warnings.filterwarnings("ignore")  # silence statsbombpy "no credentials" notice

from statsbombpy import sb  # noqa: E402

COMPETITION_ID = 43
SEASON_NAME = "2022"
TOURNAMENT_ID = "wc2022"

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_OUT = os.path.join(HERE, "..", "public", "data", TOURNAMENT_ID)

# Off-ball / administrative events excluded from a player's "touch" count.
NON_TOUCH = {
    "Pressure", "Starting XI", "Substitution", "Half Start", "Half End",
    "Tactical Shift", "Injury Stoppage", "Referee Ball-Drop", "Bad Behaviour",
    "Player Off", "Player On", "Dribbled Past", "Foul Committed", "Error",
    "Offside",
}

# StatsBomb position name -> short code (PRD register, e.g. "CDM").
POS_ABBR = {
    "Goalkeeper": "GK",
    "Right Back": "RB", "Right Center Back": "RCB", "Center Back": "CB",
    "Left Center Back": "LCB", "Left Back": "LB",
    "Right Wing Back": "RWB", "Left Wing Back": "LWB",
    "Right Defensive Midfield": "RDM", "Center Defensive Midfield": "CDM",
    "Left Defensive Midfield": "LDM",
    "Right Center Midfield": "RCM", "Center Midfield": "CM", "Left Center Midfield": "LCM",
    "Right Midfield": "RM", "Left Midfield": "LM",
    "Right Attacking Midfield": "RAM", "Center Attacking Midfield": "CAM",
    "Left Attacking Midfield": "LAM",
    "Right Wing": "RW", "Left Wing": "LW",
    "Right Center Forward": "RCF", "Center Forward": "CF", "Left Center Forward": "LCF",
    "Secondary Striker": "SS", "Striker": "ST",
}


def abbr_position(name) -> str:
    if not isinstance(name, str):
        return "—"
    return POS_ABBR.get(name, "".join(w[0] for w in name.split()).upper()[:3])


def classify_direction(start_x: float, end_x: float) -> str:
    dx = end_x - start_x
    if dx > 5:
        return "forward"
    if dx < -5:
        return "backward"
    return "lateral"


# --------------------------------------------------------------------------- #
# Data pull
# --------------------------------------------------------------------------- #
def resolve_season() -> int:
    comps = sb.competitions()
    wc = comps[(comps["competition_id"] == COMPETITION_ID) & (comps["season_name"] == SEASON_NAME)]
    if wc.empty:
        raise RuntimeError(f"WC{SEASON_NAME} (competition {COMPETITION_ID}) not found in open data")
    return int(wc.iloc[0]["season_id"])


def load_matches(season_id: int) -> pd.DataFrame:
    return sb.matches(competition_id=COMPETITION_ID, season_id=season_id)


def build_registry(matches: pd.DataFrame):
    """Return (id->name, id->set(match_ids)) for all teams in the tournament."""
    names, team_matches = {}, defaultdict(set)
    for _, m in matches.iterrows():
        for side in ("home", "away"):
            tid = int(m[f"{side}_team_id"])
            names[tid] = m[f"{side}_team"]
            team_matches[tid].add(int(m["match_id"]))
    return names, team_matches


class EventCache:
    """Fetch each match's events at most once."""

    def __init__(self):
        self._c = {}

    def get(self, match_id: int) -> pd.DataFrame:
        if match_id not in self._c:
            self._c[match_id] = sb.events(match_id=match_id)
        return self._c[match_id]


# --------------------------------------------------------------------------- #
# Per-team aggregation
# --------------------------------------------------------------------------- #
def match_minutes(tev: pd.DataFrame, match_end: float) -> dict:
    """Minutes played by each of the team's players in one match.

    Starters (from the Starting XI tactics) enter at 0; subs enter when they come
    on; players leave when subbed off or red-carded, else at match end.
    """
    on, off = {}, {}

    for _, r in tev[tev["type"] == "Starting XI"].iterrows():
        tac = r.get("tactics")
        if isinstance(tac, dict):
            for item in tac.get("lineup", []):
                on[int(item["player"]["id"])] = 0.0

    for _, r in tev[tev["type"] == "Substitution"].iterrows():
        t = float(r["minute"]) + float(r["second"]) / 60.0
        if pd.notna(r["player_id"]):
            off[int(r["player_id"])] = t
        rep = r.get("substitution_replacement_id")
        if pd.notna(rep):
            on[int(rep)] = t

    if "foul_committed_card" in tev.columns:
        reds = tev[tev["foul_committed_card"].isin(["Red Card", "Second Yellow"])]
        for _, r in reds.iterrows():
            if pd.notna(r["player_id"]):
                off[int(r["player_id"])] = float(r["minute"]) + float(r["second"]) / 60.0

    return {pid: max(0.0, off.get(pid, match_end) - start) for pid, start in on.items()}


def process_team(team_id, team_name, match_ids, cache, n_null, seed):
    minutes = defaultdict(float)
    receipts = defaultdict(int)   # touches = successful ball receptions (user decision)
    pos_frames, pass_frames = [], []
    team_minutes = 0.0

    for mid in sorted(match_ids):
        ev = cache.get(mid)
        match_end = float((ev["minute"] + ev["second"] / 60.0).max())
        team_minutes += match_end
        tev = ev[ev["team_id"] == team_id]

        for pid, mins in match_minutes(tev, match_end).items():
            minutes[pid] += mins

        # Touches = successful ball receptions (each time the player gets the ball).
        recs = tev[(tev["type"] == "Ball Receipt*") & (tev["ball_receipt_outcome"].isna())
                   & tev["player_id"].notna()]
        for pid in recs["player_id"].astype(int):
            receipts[pid] += 1

        # Broad on-ball events: used for average pitch position, name, and position
        # (PRD §7: "average event location"), independent of the touch count above.
        played = tev[tev["player_id"].notna()]
        pe = played[played["location"].notna() & ~played["type"].isin(NON_TOUCH)].copy()
        pe["_x"] = pe["location"].apply(lambda v: v[0])
        pe["_y"] = pe["location"].apply(lambda v: v[1])
        pos_frames.append(pe[["player_id", "player", "position", "_x", "_y"]])

        comp = tev[(tev["type"] == "Pass") & (tev["pass_outcome"].isna())
                   & tev["pass_recipient_id"].notna()
                   & tev["location"].notna() & tev["pass_end_location"].notna()].copy()
        comp["sx"] = comp["location"].apply(lambda v: v[0])
        comp["ex"] = comp["pass_end_location"].apply(lambda v: v[0])
        comp["dir"] = comp.apply(lambda r: classify_direction(r["sx"], r["ex"]), axis=1)
        pass_frames.append(comp[["player_id", "pass_recipient_id", "dir"]])

    posev = pd.concat(pos_frames, ignore_index=True)
    passes = pd.concat(pass_frames, ignore_index=True)

    # ---- Nodes (>= 90 minutes; touches = ball receptions) ----
    agg = posev.groupby("player_id")
    xmean, ymean = agg["_x"].mean(), agg["_y"].mean()
    names = agg["player"].first()
    positions = agg["position"].agg(
        lambda s: s.dropna().mode().iloc[0] if not s.dropna().empty else None
    )

    nodes = []
    for pid in xmean.index:
        pid = int(pid)
        mins = minutes.get(pid, 0.0)
        if mins < 90:
            continue
        nodes.append({
            "player_id": pid,
            "name": names.loc[pid],
            "position": abbr_position(positions.loc[pid]),
            "touches_per90": round(receipts.get(pid, 0) * 90.0 / mins, 1),
            "minutes": round(mins, 1),
            "avg_x": round(float(xmean.loc[pid]), 1),
            "avg_y": round(float(ymean.loc[pid]), 1),
        })
    node_ids = {n["player_id"] for n in nodes}

    # ---- Edges (completed passes between two >=90' nodes) ----
    passes["player_id"] = passes["player_id"].astype(int)
    passes["pass_recipient_id"] = passes["pass_recipient_id"].astype(int)
    pair = defaultdict(lambda: {"count": 0, "forward": 0, "lateral": 0, "backward": 0})
    for _, r in passes.iterrows():
        a, b = int(r["player_id"]), int(r["pass_recipient_id"])
        if a in node_ids and b in node_ids:
            d = pair[(a, b)]
            d["count"] += 1
            d[r["dir"]] += 1

    edges = []
    for (a, b), d in pair.items():
        c = d["count"]
        edges.append({
            "from": a, "to": b, "count": c,
            "per90": round(c * 90.0 / team_minutes, 2),
            "pct_forward": round(d["forward"] / c, 3),
            "pct_lateral": round(d["lateral"] / c, 3),
            "pct_backward": round(d["backward"] / c, 3),
            "direction_class": max(("forward", "lateral", "backward"),
                                   key=lambda k: d[k]),
        })

    # ---- Clusters (overrepresented triangles) ----
    clusters = motifs.compute_clusters(nodes, edges, n_null=n_null, seed=seed)

    net = schema.TeamNetwork(
        tournament=schema.Tournament(
            id=TOURNAMENT_ID, name="FIFA World Cup 2022",
            source="StatsBomb Open Data", team_count=32,
        ),
        team=schema.Team(id=int(team_id), name=team_name, matches_played=len(match_ids)),
        nodes=[schema.Node(**n) for n in nodes],
        edges=[schema.Edge(from_=e["from"], to=e["to"], count=e["count"], per90=e["per90"],
                           pct_forward=e["pct_forward"], pct_lateral=e["pct_lateral"],
                           pct_backward=e["pct_backward"], direction_class=e["direction_class"])
               for e in edges],
        clusters=[schema.Cluster(**c) for c in clusters],
    )
    data = net.to_dict()
    schema.validate(data)  # contract guard before write
    return data


# --------------------------------------------------------------------------- #
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--team", default=None, help="case-insensitive name filter (test one team)")
    ap.add_argument("--null", type=int, default=1000, help="number of null networks")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", default=DEFAULT_OUT)
    args = ap.parse_args()

    out_dir = os.path.abspath(args.out)
    os.makedirs(out_dir, exist_ok=True)

    season_id = resolve_season()
    matches = load_matches(season_id)
    names, team_matches = build_registry(matches)
    cache = EventCache()

    targets = sorted(names.items(), key=lambda kv: kv[1])
    if args.team:
        targets = [(tid, nm) for tid, nm in targets if args.team.lower() in nm.lower()]
        if not targets:
            raise SystemExit(f"No team matches filter {args.team!r}")

    index_entries = []
    for tid, nm in targets:
        print(f"[{nm}] processing {len(team_matches[tid])} matches, {args.null} nulls...", flush=True)
        data = process_team(tid, nm, team_matches[tid], cache, args.null, args.seed)
        slug = "".join(ch for ch in nm.lower().replace(" ", "_") if ch.isalnum() or ch == "_")
        path = os.path.join(out_dir, f"{slug}.json")
        with open(path, "w") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        index_entries.append({"id": tid, "name": nm, "file": f"{slug}.json"})
        print(f"  -> {os.path.relpath(path)}  ({len(data['nodes'])} nodes, "
              f"{len(data['edges'])} edges, {len(data['clusters'])} clusters)", flush=True)

    # _index.json only on a full run (never clobber it during a single-team test).
    if not args.team:
        index = {
            "schema_version": schema.SCHEMA_VERSION,
            "tournament": {
                "id": TOURNAMENT_ID, "name": "FIFA World Cup 2022",
                "source": "StatsBomb Open Data", "team_count": len(index_entries),
            },
            "teams": sorted(index_entries, key=lambda e: e["name"]),
        }
        with open(os.path.join(out_dir, "_index.json"), "w") as f:
            json.dump(index, f, ensure_ascii=False, indent=2)
        print(f"\nWrote _index.json with {len(index_entries)} teams.")


if __name__ == "__main__":
    main()
