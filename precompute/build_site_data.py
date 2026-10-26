"""data/normalized/* -> public/data/* for the three-tournament site (schema v2.0).

Build-time only. Reads the normalized tables written by normalize.py and emits,
for every tournament, one JSON per team in the identical v2.0 shape, plus:

  public/data/<tid>/_index.json     team list
  public/data/overview.json         one row per team per tournament (story + beeswarm)
  public/data/people.json           cross-tournament person index (player search)
  data/normalized/people_matches.csv  every 2026 <-> earlier name match, for review

Consistency rules (user decisions, 2026-10-13):
  * Players sit on FORMATION SLOTS in every year (minutes-weighted over matches;
    a substitute takes the slot of the player they replaced).
  * Pass direction only where real (StatsBomb locations: all of 2018, most of 2022).
  * Players are linked across tournaments: 2018<->2022 by StatsBomb id, 2026 by
    name within the same national team (logged for review).

Usage: python build_site_data.py [--null 1000]
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import unicodedata
from collections import defaultdict

import motifs
import site_schema
from normalize import slug, team as canon_team, display_name, RAW

HERE = os.path.dirname(os.path.abspath(__file__))
NORM = os.path.join(HERE, "..", "data", "normalized")
PUB = os.path.join(HERE, "..", "public", "data")

TOURNAMENTS = [
    ("wc2018", "2018 FIFA World Cup", "Russia", "StatsBomb Open Data"),
    ("wc2022", "2022 FIFA World Cup", "Qatar", "FIFA post-match reports + StatsBomb Open Data"),
    ("wc2026", "2026 FIFA World Cup", "Canada · Mexico · United States", "FIFA post-match reports"),
]
_ov = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "people_overrides.json")))
OVERRIDES = {(o["team"], o["fifa_2026_name"]): o["earlier_name"] for o in _ov["confirmed"]}

CHAMPIONS = {"wc2018": "France", "wc2022": "Argentina", "wc2026": "Spain"}

CONFED = {
    "UEFA": ["Austria", "Belgium", "Bosnia and Herzegovina", "Croatia", "Czechia", "Denmark", "England",
             "France", "Germany", "Iceland", "Netherlands", "Norway", "Poland", "Portugal", "Russia",
             "Scotland", "Serbia", "Spain", "Sweden", "Switzerland", "Türkiye", "Wales"],
    "CONMEBOL": ["Argentina", "Brazil", "Colombia", "Ecuador", "Paraguay", "Peru", "Uruguay"],
    "CONCACAF": ["Canada", "Costa Rica", "Curaçao", "Haiti", "Mexico", "Panama", "United States"],
    "CAF": ["Algeria", "Cabo Verde", "Cameroon", "Congo DR", "Côte d'Ivoire", "Egypt", "Ghana",
            "Morocco", "Nigeria", "Senegal", "South Africa", "Tunisia"],
    "AFC": ["Australia", "Iran", "Iraq", "Japan", "Jordan", "Qatar", "Saudi Arabia", "South Korea",
            "Uzbekistan"],
    "OFC": ["New Zealand"],
}
CONFED_OF = {t: c for c, ts in CONFED.items() for t in ts}

STAGE_ORDER = ["Group stage", "Round of 32", "Round of 16", "Quarter-final", "Semi-final",
               "Third-place match", "Final"]


def stage_of(raw: str) -> str:
    s = raw.lower()
    if "group" in s:
        return "Group stage"
    if "32" in s:
        return "Round of 32"
    if "16" in s:
        return "Round of 16"
    if "quarter" in s:
        return "Quarter-final"
    if "semi" in s:
        return "Semi-final"
    if "3rd" in s or "third" in s or "bronze" in s:
        return "Third-place match"
    if "final" in s:
        return "Final"
    return raw


def read(tid, name):
    return list(csv.DictReader(open(os.path.join(NORM, tid, name))))


def num(v, cast=float):
    return cast(v) if v not in ("", None) else None


# --------------------------------------------------------------------------- #
# Names
# --------------------------------------------------------------------------- #
def toks(name: str) -> set:
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    s = s.replace("'", "").replace("’", "")
    return {t for t in re.split(r"[^a-z]+", s) if t}


def fifa_surname(fifa_name: str) -> str | None:
    """'Lamine YAMAL' -> 'Yamal', 'MAC ALLISTER Alexis' -> 'Mac Allister'; None if all caps."""
    words = fifa_name.split()
    upper = [w for w in words if w.isupper() and len(w.strip(".'-")) > 1]
    if not upper or len(upper) == len(words):
        return None
    return " ".join(display_name(w) for w in upper)


def fifa_display(fifa_name: str) -> str:
    """Given names first, surname last: 'GALINDEZ Hernan' -> 'Hernan Galindez'."""
    words = fifa_name.split()
    upper = [w for w in words if w.isupper() and len(w.strip(".'-")) > 1]
    lower = [w for w in words if w not in upper]
    if upper and lower:
        return " ".join(lower + [display_name(w) for w in upper])
    return display_name(fifa_name)


# --------------------------------------------------------------------------- #
# People: cross-tournament identity
# --------------------------------------------------------------------------- #
def fifa_raw_names():
    """(tid, match_id, team, shirt) -> FIFA's printed name, for 2022 and 2026."""
    out = {}
    for year in ("2022", "2026"):
        from datetime import datetime
        for r in json.load(open(os.path.join(RAW, f"fifa{year}.json"))):
            m = r["meta"]
            date = datetime.strptime(m["date"], "%d %B %Y").date().isoformat()
            mid = f"wc{year}-{date}-{slug(canon_team(m['home']))}-{slug(canon_team(m['away']))}"
            for t in r["teams"].values():
                for p in t["players"]:
                    out[(f"wc{year}", mid, canon_team(t["name"]), p["shirt"])] = p["name"]
    return out


def build_people(apps_by_tid):
    """Return key -> person_id, person_id -> {name, short}, and the match log."""
    raw = fifa_raw_names()
    variants = defaultdict(set)      # (team, key) -> set of token-sets (all known spellings)
    fifa_names = defaultdict(list)   # key -> FIFA printed names (latest last)
    sb_name = {}                     # key -> StatsBomb display name (nickname-first)
    for tid in ("wc2018", "wc2022", "wc2026"):
        for a in apps_by_tid[tid]:
            k = a["player_key"]
            if a["name"]:
                variants[(a["team"], k)].add(frozenset(toks(a["name"])))
                if k.startswith("sb:"):
                    sb_name.setdefault(k, a["name"])
            fn = raw.get((tid, a["match_id"], a["team"], num(a["shirt"], int)))
            if fn:
                variants[(a["team"], k)].add(frozenset(toks(fn)))
                fifa_names[k].append(fn)

    person = {}
    log = []
    earlier = defaultdict(set)  # team -> earlier-tournament keys
    for tid in ("wc2018", "wc2022"):
        for a in apps_by_tid[tid]:
            person[a["player_key"]] = a["player_key"]
            earlier[a["team"]].add(a["player_key"])

    seen26 = {}
    for a in apps_by_tid["wc2026"]:
        k = a["player_key"]
        if k in seen26:
            continue
        mine = variants[(a["team"], k)]
        fn = fifa_names[k][-1] if fifa_names[k] else a["name"]
        exact, near = set(), set()
        for ek in earlier.get(a["team"], ()):
            theirs = variants[(a["team"], ek)]
            if any(m == t for m in mine for t in theirs):
                exact.add(ek)
            elif any((m <= t or t <= m) and len(m & t) >= 1 for m in mine for t in theirs):
                near.add(ek)
        confirmed = OVERRIDES.get((a["team"], fn))
        if len(exact) == 1:
            ek, method = exact.pop(), "exact name"
        elif confirmed:
            ek = next((e for e in near | exact if sb_name.get(e) == confirmed), None)
            method = "confirmed by hand" if ek else None
        else:
            ek, method = None, None
        if ek:
            person[k] = person[ek]
            log.append({"team": a["team"], "fifa_2026_name": fn, "matched_to": sb_name.get(ek, ek),
                        "earlier_key": ek, "method": method})
        else:
            person[k] = f"p26:{slug(a['team'])}:{'_'.join(sorted(slug(fn).split('_')))}"
            cand = exact | near
            if cand:
                log.append({"team": a["team"], "fifa_2026_name": fn,
                            "matched_to": " | ".join(sorted(sb_name.get(c, c) for c in cand)),
                            "earlier_key": "", "method": "NOT linked (similar name, unconfirmed)"})
        seen26[k] = True

    # Display + short names per person.
    names = {}
    keys_of = defaultdict(list)
    for k, p in person.items():
        keys_of[p].append(k)
    for p, ks in keys_of.items():
        nick = next((sb_name[k] for k in ks if k in sb_name), None)
        fns = [n for k in ks for n in fifa_names.get(k, [])]
        fifa_latest = fns[-1] if fns else None
        display = nick or (fifa_display(fifa_latest) if fifa_latest else ks[0])
        short = None
        if fifa_latest:
            short = fifa_surname(fifa_latest)
            # Prefer the accented spelling from the StatsBomb name when it contains
            # FIFA's surname ("KOVACIC" -> "Kovačić", "MAC ALLISTER" -> "Mac Allister").
            if short and nick:
                words = nick.split()
                want = [t for t in re.split(r"[^a-z]+", unicodedata.normalize("NFKD", short).encode("ascii", "ignore").decode().lower()) if t]
                plain = [unicodedata.normalize("NFKD", w).encode("ascii", "ignore").decode().lower().replace("'", "") for w in words]
                for i in range(len(words) - len(want) + 1):
                    if [re.sub(r"[^a-z]", "", x) for x in plain[i:i + len(want)]] == want:
                        short = " ".join(words[i:i + len(want)])
                        break
        if not short:
            short = display if len(display.split()) <= 1 else display.split()[-1]
        if fifa_latest and not nick and fifa_surname(fifa_latest) is None:
            short = display  # all-caps FIFA names (e.g. "VINICIUS JUNIOR") stay whole
        names[p] = {"name": display, "short": short}
    return person, names, log


# --------------------------------------------------------------------------- #
# Slots
# --------------------------------------------------------------------------- #
def assign_slots(apps):
    """Give every appearance a slot: starters keep theirs, subs inherit the replaced player's."""
    by_mt = defaultdict(list)
    for a in apps:
        by_mt[(a["match_id"], a["team"])].append(a)
    for rows in by_mt.values():
        starters = [a for a in rows if a["starter"] == "True" and a["slot_depth"]]
        team_pos = defaultdict(list)
        for a in starters:
            a["_slot"] = (float(a["slot_depth"]), float(a["slot_width"]))
            team_pos[a["pos"]].append(a["_slot"])
        # Chain substitutions in time order so a sub of a sub inherits correctly.
        subs = sorted([a for a in rows if a["starter"] != "True"], key=lambda a: num(a["on"], int) or 999)
        for s in subs:
            on = num(s["on"], int)
            gone = [a for a in rows if "_slot" in a and num(a["off"], int) == on and not a.get("_replaced")]
            pick = next((a for a in gone if a["pos"] == s["pos"]), gone[0] if gone else None)
            if pick:
                pick["_replaced"] = True
                s["_slot"] = pick["_slot"]
            elif team_pos.get(s["pos"]):
                pts = team_pos[s["pos"]]
                s["_slot"] = (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
        for a in rows:
            if "_slot" not in a:
                a["_slot"] = {"GK": (0.0, 0.5), "DF": (0.22, 0.5), "MF": (0.5, 0.5), "FW": (0.8, 0.5)}.get(a["pos"], (0.5, 0.5))


def fill_missing_2018_slots(apps, slot_map):
    """Positions never seen in 2022 (so not in the learned map): mirror left/right or fall back."""
    for a in apps:
        if a["starter"] == "True" and not a["slot_depth"]:
            pos = a["statsbomb_position"]
            mirror = pos.replace("Left", "@").replace("Right", "Left").replace("@", "Right")
            if mirror in slot_map:
                a["slot_depth"] = slot_map[mirror]["depth"]
                a["slot_width"] = 1 - slot_map[mirror]["width"]
            else:
                base = re.sub(r"^(Left|Right) ", "", pos)
                if base in slot_map:
                    side = 0.25 if pos.startswith("Left") else 0.75 if pos.startswith("Right") else 0.5
                    a["slot_depth"], a["slot_width"] = slot_map[base]["depth"], side


# --------------------------------------------------------------------------- #
# Clusters, with labels that mean the same thing in every year
# --------------------------------------------------------------------------- #
def cluster_label(tri_nodes):
    w = sum(n["slot_y"] for n in tri_nodes) / 3
    flank = "Left-side" if w < 0.36 else "Right-side" if w > 0.64 else "Central"
    pos = {n["pos"] for n in tri_nodes}
    if pos <= {"GK", "DF"}:
        unit = "back-line"
    elif "FW" in pos:
        unit = "attacking"
    elif pos <= {"MF"}:
        unit = "midfield"
    else:
        unit = "build-up"
    return f"{flank} {unit} triangle"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--null", type=int, default=1000)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--reuse-clusters", action="store_true",
                    help="keep the triangles already in public/data (skip the slow null-model step); "
                         "only names, labels and metrics are refreshed")
    args = ap.parse_args()

    slot_map = json.load(open(os.path.join(NORM, "slot_map_statsbomb_to_fifa.json")))
    qa22 = json.load(open(os.path.join(NORM, "wc2022", "qa.json")))
    # StatsBomb counts ~6% more completed passes than FIFA on the same 2022 pairs;
    # scale 2018 volumes (team passes per 90 only) onto FIFA's scale for comparison.
    x = qa22["crosscheck_fifa_vs_statsbomb"]
    sb_to_fifa = x["fifa_total"] / x["statsbomb_total_same_pairs"]

    data = {}
    for tid, *_ in TOURNAMENTS:
        data[tid] = {f: read(tid, f + ".csv") for f in ("matches", "appearances", "pass_edges", "player_match")}
    fill_missing_2018_slots(data["wc2018"]["appearances"], slot_map)
    person, names, log = build_people({t: d["appearances"] for t, d in data.items()})

    os.makedirs(PUB, exist_ok=True)
    overview, people = [], defaultdict(lambda: {"tournaments": []})

    for tid, tname, host, source in TOURNAMENTS:
        D = data[tid]
        assign_slots(D["appearances"])
        matches = {m["match_id"]: m for m in D["matches"]}
        teams = sorted({a["team"] for a in D["appearances"]})
        out_dir = os.path.join(PUB, tid)
        os.makedirs(out_dir, exist_ok=True)
        index = []
        recv = {(p["match_id"], p["player_key"]): int(p["receptions"]) for p in D["player_match"]}

        for tm in teams:
            apps = [a for a in D["appearances"] if a["team"] == tm]
            mids = sorted({a["match_id"] for a in apps})
            team_minutes = sum(int(matches[m]["length"]) for m in mids)
            stage = max((stage_of(matches[m]["stage"]) for m in mids), key=STAGE_ORDER.index)
            if CHAMPIONS[tid] == tm:
                stage = "Champion"
            # Per person aggregation.
            P = defaultdict(lambda: {"minutes": 0.0, "matches": 0, "recv": 0, "sx": 0.0, "sy": 0.0,
                                     "w": 0.0, "pos": defaultdict(float)})
            for a in apps:
                pid = person[a["player_key"]]
                mins = num(a["minutes"]) or 0.0
                p = P[pid]
                p["minutes"] += mins
                p["matches"] += 1
                p["recv"] += recv.get((a["match_id"], a["player_key"]), 0)
                w = max(mins, 1.0)
                p["sx"] += a["_slot"][0] * w
                p["sy"] += a["_slot"][1] * w
                p["w"] += w
                p["pos"][a["pos"] or "MF"] += w
            edges_raw = [e for e in D["pass_edges"] if e["team"] == tm]
            agg = defaultdict(lambda: {"count": 0, "f": 0, "l": 0, "b": 0, "dir_known": 0})
            for e in edges_raw:
                k = (person[e["from_key"]], person[e["to_key"]])
                g = agg[k]
                g["count"] += int(e["count"])
                if e["n_forward"] not in ("", None):
                    g["f"] += int(e["n_forward"]); g["l"] += int(e["n_lateral"]); g["b"] += int(e["n_backward"])
                    g["dir_known"] += int(e["count"])
            out_pass = defaultdict(int)
            for (a, b), g in agg.items():
                out_pass[a] += g["count"]

            nodes = []
            for pid, p in P.items():
                if p["minutes"] < 90:
                    continue
                nodes.append({
                    "id": pid, "name": names[pid]["name"], "short": names[pid]["short"],
                    "pos": max(p["pos"], key=p["pos"].get),
                    "minutes": round(p["minutes"]), "matches": p["matches"],
                    "receptions_per90": round(p["recv"] * 90 / p["minutes"], 1),
                    "passes_per90": round(out_pass[pid] * 90 / p["minutes"], 1),
                    "slot_x": round(p["sx"] / p["w"], 3), "slot_y": round(p["sy"] / p["w"], 3),
                })
            # Two players sharing a short label (e.g. several Kims) get their full names.
            shorts = defaultdict(int)
            for n in nodes:
                shorts[n["short"]] += 1
            for n in nodes:
                if shorts[n["short"]] > 1:
                    n["short"] = n["name"]
            ids = {n["id"] for n in nodes}
            edges = []
            for (a, b), g in agg.items():
                if a in ids and b in ids and a != b and g["count"] > 0:
                    # Direction only when (nearly) all of the link's passes have real locations.
                    has_dir = g["dir_known"] >= 0.9 * g["count"] and (g["f"] + g["l"] + g["b"]) > 0
                    tot = g["f"] + g["l"] + g["b"]
                    edges.append({"from": a, "to": b, "count": g["count"],
                                  "per90": round(g["count"] * 90 / team_minutes, 2),
                                  "has_direction": has_dir,
                                  "pct_forward": round(g["f"] / tot, 3) if has_dir else 0,
                                  "pct_lateral": round(g["l"] / tot, 3) if has_dir else 0,
                                  "pct_backward": round(1 - round(g["f"] / tot, 3) - round(g["l"] / tot, 3), 3) if has_dir else 0})

            # Clusters (existing PRD §8 method; coordinates only feed its unused default label).
            mnodes = [{"player_id": i, "name": n["name"], "avg_x": n["slot_x"] * 120, "avg_y": n["slot_y"] * 80}
                      for i, n in enumerate(nodes)]
            idx = {n["id"]: i for i, n in enumerate(nodes)}
            medges = [{"from": idx[e["from"]], "to": idx[e["to"]], "count": e["count"], "per90": e["per90"],
                       "pct_forward": 0, "pct_lateral": 1, "pct_backward": 0} for e in edges]
            prev_path = os.path.join(out_dir, f"{slug(tm)}.json")
            if args.reuse_clusters and os.path.exists(prev_path):
                prev = json.load(open(prev_path))["clusters"]
                raw_cl = [{"rank": c["rank"], "z_score": c["z_score"], "player_ids": [idx[p] for p in c["player_ids"]]}
                          for c in prev]
            else:
                raw_cl = motifs.compute_clusters(mnodes, medges, n_null=args.null, seed=args.seed)
            clusters = []
            for c in raw_cl:
                tri = [nodes[i] for i in c["player_ids"]]
                clusters.append({"rank": c["rank"], "z_score": c["z_score"],
                                 "player_ids": [n["id"] for n in tri],
                                 "label": cluster_label(tri),
                                 "description": " · ".join(n["short"] for n in tri)})

            # Team "accent" metrics — all scale-free or calibrated, so years compare.
            all_pass = sum(g["count"] for g in agg.values())
            scale = sb_to_fifa if tid == "wc2018" else 1.0
            pos_of = {pid: max(p["pos"], key=p["pos"].get) for pid, p in P.items()}
            back = sum(g["count"] for (a, b), g in agg.items() if pos_of.get(a) in ("GK", "DF") and pos_of.get(b) in ("GK", "DF"))
            involve = defaultdict(int)
            for (a, b), g in agg.items():
                involve[a] += g["count"]; involve[b] += g["count"]
            hub_pid = max(involve, key=involve.get)
            tri_pairs = {(a, b) for c in clusters for a in c["player_ids"] for b in c["player_ids"] if a != b}
            sig = sum(g["count"] for k, g in agg.items() if k in tri_pairs)
            metrics = {
                "passes_per90": round(all_pass * 90 / team_minutes * scale, 1),
                "backline_share": round(back / all_pass, 3),
                "hub_share": round(involve[hub_pid] / all_pass, 3),
                "hub_id": hub_pid, "hub_name": names[hub_pid]["name"],
                "signature_share": round(sig / all_pass, 3),
            }
            team_obj = {"name": tm, "slug": slug(tm), "confederation": CONFED_OF[tm],
                        "matches_played": len(mids), "stage": stage}
            doc = {"schema_version": site_schema.SCHEMA_VERSION,
                   "tournament": {"id": tid, "name": tname, "host": host, "source": source},
                   "team": team_obj, "nodes": nodes, "edges": edges, "clusters": clusters, "metrics": metrics}
            site_schema.validate_team(doc)
            with open(os.path.join(out_dir, f"{slug(tm)}.json"), "w") as f:
                json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
            index.append({"name": tm, "slug": slug(tm), "file": f"{slug(tm)}.json"})
            overview.append({"tournament": tid, **team_obj, **metrics,
                             "top_cluster": clusters[0]["description"], "top_cluster_label": clusters[0]["label"],
                             "nodes": len(nodes)})
            sig_ids = defaultdict(list)
            for c in clusters:
                for pid in c["player_ids"]:
                    sig_ids[pid].append(c["rank"])
            for n in nodes:
                pe = people[n["id"]]
                pe.update(names[n["id"]])
                pe["tournaments"].append({"t": tid, "team": tm, "slug": slug(tm), "minutes": n["minutes"],
                                          "clusters": sig_ids.get(n["id"], [])})
            print(f"[{tid}] {tm:24s} nodes {len(nodes):2d} edges {len(edges):3d}  #1 {clusters[0]['description']}", flush=True)

        with open(os.path.join(out_dir, "_index.json"), "w") as f:
            json.dump({"schema_version": site_schema.SCHEMA_VERSION,
                       "tournament": {"id": tid, "name": tname, "host": host, "source": source,
                                      "team_count": len(index)},
                       "teams": index}, f, ensure_ascii=False, indent=1)
        # Remove team files from an older build that no longer exist (e.g. v1 files).
        keep = {e["file"] for e in index} | {"_index.json"}
        for fn in os.listdir(out_dir):
            if fn.endswith(".json") and fn not in keep:
                os.remove(os.path.join(out_dir, fn))

    with open(os.path.join(PUB, "overview.json"), "w") as f:
        json.dump({"schema_version": site_schema.SCHEMA_VERSION,
                   "tournaments": [{"id": t, "name": n, "host": h, "source": s, "champion": CHAMPIONS[t]}
                                   for t, n, h, s in TOURNAMENTS],
                   "calibration": {"statsbomb_to_fifa_pass_scale": round(sb_to_fifa, 4)},
                   "teams": overview}, f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(PUB, "people.json"), "w") as f:
        json.dump({pid: p for pid, p in people.items()}, f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(NORM, "people_matches.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["team", "fifa_2026_name", "matched_to", "earlier_key", "method"])
        w.writeheader()
        w.writerows(log)
    multi = sum(1 for p in people.values() if len(p["tournaments"]) > 1)
    print(f"\npeople: {len(people)} with ≥90' somewhere; {multi} appear in 2+ tournaments; "
          f"2026 links: {sum(1 for l in log if l['earlier_key'])}, ambiguous: {sum(1 for l in log if not l['earlier_key'])}")


if __name__ == "__main__":
    main()
