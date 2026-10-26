"""Normalize WC2018 / WC2022 / WC2026 into one "2026-standard" table set.

Build-time only. The 2026 standard is what FIFA's post-match reports provide:
a passer -> receiver completed-pass matrix per team per match, the lineup with
GK/DF/MF/FW, sub/red-card minutes, and each starter's formation slot. Every
tournament is reduced to exactly that shape; anything a source has beyond it
is kept in clearly named extra columns (never required by the core).

Sources
  wc2018  StatsBomb Open Data only (FIFA published no matrix for 2018)
  wc2022  FIFA reports (primary, same template as 2026) + StatsBomb (cross-check, extras,
          and gap-fill where FIFA's matrix leaves out the goalkeeper)
  wc2026  FIFA reports only

Output: data/normalized/<tournament>/{matches,appearances,pass_edges,player_match}.csv
        data/normalized/<tournament>/qa.json

Minutes use the same rule everywhere: a player is on from 0 (starter) or their
sub-on minute, until their sub-off / red-card minute or the nominal match end
(90, or 120 after extra time). Stoppage time is not counted for anyone.
"""
from __future__ import annotations

import csv
import json
import os
import re
import unicodedata
from collections import defaultdict
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
RAW = os.path.join(ROOT, "raw")
OUT = os.path.join(ROOT, "data", "normalized")

TEAM_NAMES = {"IR Iran": "Iran", "Korea Republic": "South Korea", "USA": "United States"}

# StatsBomb position -> FIFA's four-way grouping (FIFA lists wingers as FW).
def pos_group(sb_pos: str | None) -> str | None:
    if not sb_pos:
        return None
    if sb_pos == "Goalkeeper":
        return "GK"
    if "Back" in sb_pos:
        return "DF"
    if "Wing" in sb_pos or "Forward" in sb_pos or "Striker" in sb_pos:
        return "FW"
    return "MF"


def team(name: str) -> str:
    return TEAM_NAMES.get(name, name)


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def display_name(fifa_name: str) -> str:
    """'Raul RANGEL' -> 'Raul Rangel', 'PEDRI' -> 'Pedri', 'MAC ALLISTER Alexis' kept in order."""
    return " ".join(w.capitalize() if w.isupper() and len(w) > 1 else w
                    for w in fifa_name.split())


def minutes_for(starter, on, off, red, length):
    start = 0 if starter else on
    if start is None:
        return None
    end = min(x for x in (off, red, length) if x is not None)
    return max(0, min(end, length) - start)


def write_csv(path, rows, cols):
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(r)


# --------------------------------------------------------------------------- #
# FIFA reports (2022, 2026)
# --------------------------------------------------------------------------- #
def load_fifa(year):
    reports = json.load(open(os.path.join(RAW, f"fifa{year}.json")))
    matches, apps, edges, pm, qa = [], [], [], [], []
    for r in reports:
        m = r["meta"]
        date = datetime.strptime(m["date"], "%d %B %Y").date().isoformat()
        home, away = team(m["home"]), team(m["away"])
        mid = f"wc{year}-{date}-{slug(home)}-{slug(away)}"
        matches.append({"match_id": mid, "date": date, "stage": m["stage"], "home": home,
                        "away": away, "home_score": m["home_score"], "away_score": m["away_score"],
                        "length": m["length"], "venue": m["venue"], "source": "FIFA post-match report",
                        "source_file": r["source_file"]})
        for side, t in r["teams"].items():
            tname = team(t["name"])
            in_matrix = set(t["matrix_order"])
            keys = {}
            for p in t["players"]:
                appeared = p["starter"] or p["on"] is not None or p["shirt"] in in_matrix
                if not appeared:
                    continue
                # Word order varies between reports ("Azzedine OUNAHI" / "OUNAHI Azzedine").
                key = f"{year}:{slug(tname)}:{'_'.join(sorted(slug(p['name']).split('_')))}"
                keys[p["shirt"]] = key
                mins = minutes_for(p["starter"], p["on"], p["off"], p["red"], m["length"])
                slot = t["slots"].get(str(p["shirt"])) if p["starter"] else None
                apps.append({"match_id": mid, "team": tname, "player_key": key,
                             "name": display_name(p["name"]), "shirt": p["shirt"], "pos": p["pos"],
                             "starter": p["starter"], "on": p["on"], "off": p["off"], "red": p["red"],
                             "minutes": mins, "minutes_known": mins is not None,
                             "formation": t["formation"],
                             "slot_depth": slot[0] if slot else None,
                             "slot_width": slot[1] if slot else None})
                if mins is None:
                    qa.append({"match_id": mid, "team": tname, "issue": "in FIFA matrix but no sub-on minute in FIFA lineup",
                               "player": p["name"]})
            recv = defaultdict(int)
            for a, b, n in t["matrix"]:
                if n and a in keys and b in keys:
                    edges.append({"match_id": mid, "team": tname, "from_key": keys[a],
                                  "to_key": keys[b], "count": n, "source": "fifa"})
                    recv[b] += n
            gk = [p["shirt"] for p in t["players"] if p["starter"] and p["pos"] == "GK"]
            if gk and not set(gk) & in_matrix:
                qa.append({"match_id": mid, "team": tname, "issue": "FIFA matrix omits the starting goalkeeper"})
            for shirt, key in keys.items():
                d = t["distribution"].get(str(shirt), {})
                o = t["offers"].get(str(shirt), {})
                pm.append({"match_id": mid, "team": tname, "player_key": key,
                           "receptions": recv.get(shirt, 0),
                           "passes_attempted": d.get("passes_attempted"),
                           "passes_completed": d.get("passes_completed"),
                           "line_breaks_attempted": d.get("line_breaks_attempted"),
                           "line_breaks_completed": d.get("line_breaks_completed"),
                           "ball_progressions": d.get("ball_progressions"),
                           "switches_of_play": d.get("switches_of_play"),
                           "offers_made": o.get("total_offers"),
                           "offers_received": o.get("offers_received")})
    return matches, apps, edges, pm, qa


# --------------------------------------------------------------------------- #
# StatsBomb Open Data (2018, 2022)
# --------------------------------------------------------------------------- #
def _dir(start, end):
    dx = end[0] - start[0]
    return "forward" if dx > 5 else "backward" if dx < -5 else "lateral"


def load_statsbomb(season_id, year):
    base = os.path.join(RAW, "statsbomb", str(season_id))
    matches_raw = json.load(open(os.path.join(base, "matches.json")))
    matches, apps, edges, pm = [], [], [], []
    for mr in sorted(matches_raw, key=lambda m: (m["match_date"], m["kick_off"] or "")):
        sbid = mr["match_id"]
        ev = json.load(open(os.path.join(base, "events", f"{sbid}.json")))
        lu = json.load(open(os.path.join(base, "lineups", f"{sbid}.json")))
        home, away = team(mr["home_team"]["home_team_name"]), team(mr["away_team"]["away_team_name"])
        length = 120 if any(e["period"] in (3, 4) for e in ev) else 90
        mid = f"wc{year}-{mr['match_date']}-{slug(home)}-{slug(away)}"
        matches.append({"match_id": mid, "date": mr["match_date"],
                        "stage": mr["competition_stage"]["name"], "home": home, "away": away,
                        "home_score": mr["home_score"], "away_score": mr["away_score"],
                        "length": length, "venue": (mr.get("stadium") or {}).get("name"),
                        "source": "StatsBomb Open Data", "statsbomb_match_id": sbid})

        # Lineup info: names (nickname first — fixes the 2022 surname bug), shirts.
        info = {}
        for tl in lu:
            for p in tl["lineup"]:
                info[p["player_id"]] = {"name": p.get("player_nickname") or p["player_name"],
                                        "shirt": p.get("jersey_number"),
                                        "first_pos": (p.get("positions") or [{}])[0].get("position")}

        for tid, tname_raw in ((mr["home_team"]["home_team_id"], home), (mr["away_team"]["away_team_id"], away)):
            tev = [e for e in ev if e["team"]["id"] == tid]
            xi = next(e for e in tev if e["type"]["name"] == "Starting XI")
            formation = "-".join(str(xi["tactics"]["formation"]))
            starters = {p["player"]["id"]: p["position"]["name"] for p in xi["tactics"]["lineup"]}
            on, off, red = {}, {}, {}
            for e in tev:
                tn = e["type"]["name"]
                if tn == "Substitution":
                    off[e["player"]["id"]] = e["minute"]
                    on[e["substitution"]["replacement"]["id"]] = e["minute"]
                card = (e.get("foul_committed") or {}).get("card", {}).get("name") or \
                       (e.get("bad_behaviour") or {}).get("card", {}).get("name")
                if card in ("Red Card", "Second Yellow") and "player" in e:
                    red[e["player"]["id"]] = e["minute"]

            # Completed passes with a recipient (+ real direction, StatsBomb-only extra).
            pair = defaultdict(lambda: {"count": 0, "forward": 0, "lateral": 0, "backward": 0})
            receipts, locs = defaultdict(int), defaultdict(list)
            for e in tev:
                if "player" in e and "location" in e and e["type"]["name"] not in ("Pressure", "Substitution"):
                    locs[e["player"]["id"]].append(e["location"])
                if e["type"]["name"] == "Ball Receipt*" and "ball_receipt" not in e and "player" in e:
                    receipts[e["player"]["id"]] += 1
                if e["type"]["name"] == "Pass" and "outcome" not in e["pass"] and "recipient" in e["pass"]:
                    d = pair[(e["player"]["id"], e["pass"]["recipient"]["id"])]
                    d["count"] += 1
                    d[_dir(e["location"], e["pass"]["end_location"])] += 1

            players = set(starters) | set(on)
            recv = defaultdict(int)
            for (a, b), d in pair.items():
                if a in players and b in players:
                    edges.append({"match_id": mid, "team": tname_raw, "from_key": f"sb:{a}",
                                  "to_key": f"sb:{b}", "count": d["count"], "source": "statsbomb",
                                  "n_forward": d["forward"], "n_lateral": d["lateral"],
                                  "n_backward": d["backward"]})
                    recv[b] += d["count"]
            for pid in players:
                is_starter = pid in starters
                sb_pos = starters.get(pid) or info.get(pid, {}).get("first_pos")
                mins = minutes_for(is_starter, on.get(pid), off.get(pid), red.get(pid), length)
                xs = locs.get(pid, [])
                apps.append({"match_id": mid, "team": tname_raw, "player_key": f"sb:{pid}",
                             "name": info.get(pid, {}).get("name"), "shirt": info.get(pid, {}).get("shirt"),
                             "pos": pos_group(sb_pos), "statsbomb_position": sb_pos,
                             "starter": is_starter, "on": on.get(pid), "off": off.get(pid),
                             "red": red.get(pid), "minutes": mins, "minutes_known": True,
                             "formation": formation, "slot_depth": None, "slot_width": None,
                             "avg_x": round(sum(p[0] for p in xs) / len(xs), 1) if xs else None,
                             "avg_y": round(sum(p[1] for p in xs) / len(xs), 1) if xs else None})
                pm.append({"match_id": mid, "team": tname_raw, "player_key": f"sb:{pid}",
                           "receptions": recv.get(pid, 0),
                           "ball_receipts_all": receipts.get(pid, 0)})
    return matches, apps, edges, pm


# --------------------------------------------------------------------------- #
# Slots for StatsBomb lineups, learned from 2022 where both sources exist
# --------------------------------------------------------------------------- #
def learn_slot_map(fifa_apps, sb_apps):
    """StatsBomb position name -> mean FIFA formation slot, joined on match+team+shirt."""
    f = {(a["match_id"], a["team"], a["shirt"]): a for a in fifa_apps if a["starter"] and a["slot_depth"] is not None}
    acc = defaultdict(list)
    for a in sb_apps:
        k = (a["match_id"], a["team"], a["shirt"])
        if a["starter"] and k in f:
            acc[a["statsbomb_position"]].append((f[k]["slot_depth"], f[k]["slot_width"]))
    return {pos: (round(sum(d for d, _ in v) / len(v), 3), round(sum(w for _, w in v) / len(v), 3), len(v))
            for pos, v in acc.items()}


def main():
    os.makedirs(OUT, exist_ok=True)
    A_COLS = ["match_id", "team", "player_key", "name", "shirt", "pos", "starter", "on", "off", "red",
              "minutes", "minutes_known", "formation", "slot_depth", "slot_width", "slot_source",
              "statsbomb_position", "avg_x", "avg_y"]
    E_COLS = ["match_id", "team", "from_key", "to_key", "count", "source", "n_forward", "n_lateral", "n_backward"]
    M_COLS = ["match_id", "date", "stage", "home", "away", "home_score", "away_score", "length", "venue",
              "source", "source_file", "statsbomb_match_id"]
    P_COLS = ["match_id", "team", "player_key", "receptions", "passes_attempted", "passes_completed",
              "line_breaks_attempted", "line_breaks_completed", "ball_progressions", "switches_of_play",
              "offers_made", "offers_received", "ball_receipts_all"]

    f22 = load_fifa("2022")
    f26 = load_fifa("2026")
    s18 = load_statsbomb(3, "2018")
    s22 = load_statsbomb(106, "2022")

    # Match IDs: FIFA and StatsBomb 2022 must agree (same date + teams).
    fids, sids = {m["match_id"] for m in f22[0]}, {m["match_id"] for m in s22[0]}
    unmatched = sorted(fids ^ sids)

    slot_map = learn_slot_map(f22[1], s22[1])

    # ---- wc2022: FIFA core, joined to StatsBomb ids on match + team + shirt ----
    sb_by_shirt = {(a["match_id"], a["team"], a["shirt"]): a for a in s22[1]}
    fifa_to_sb = {}
    for a in f22[1]:
        s = sb_by_shirt.get((a["match_id"], a["team"], a["shirt"]))
        if s:
            fifa_to_sb[a["player_key"]] = s["player_key"]
            a.update(player_key=s["player_key"], name=s["name"], statsbomb_position=s["statsbomb_position"],
                     avg_x=s["avg_x"], avg_y=s["avg_y"], formation=a["formation"] or s["formation"])
        a["slot_source"] = "FIFA lineup diagram" if a["slot_depth"] is not None else None
    for e in f22[2]:
        e["from_key"] = fifa_to_sb.get(e["from_key"], e["from_key"])
        e["to_key"] = fifa_to_sb.get(e["to_key"], e["to_key"])
    for p in f22[3]:
        p["player_key"] = fifa_to_sb.get(p["player_key"], p["player_key"])

    # Gap-fill: where FIFA's matrix omits the GK, take that GK's edges from StatsBomb.
    gk_gaps = {(q["match_id"], q["team"]) for q in f22[4] if "goalkeeper" in q["issue"]}
    filled = 0
    gk_keys = {(a["match_id"], a["team"], a["player_key"]) for a in f22[1] if a["pos"] == "GK" and a["starter"]}
    for e in s22[2]:
        if (e["match_id"], e["team"]) in gk_gaps and (
                (e["match_id"], e["team"], e["from_key"]) in gk_keys or (e["match_id"], e["team"], e["to_key"]) in gk_keys):
            f22[2].append({**e, "source": "statsbomb (GK gap-fill)"})
            filled += 1
    # Direction extras onto FIFA edges, from StatsBomb's located passes.
    sdir = {(e["match_id"], e["from_key"], e["to_key"]): e for e in s22[2]}
    for e in f22[2]:
        s = sdir.get((e["match_id"], e["from_key"], e["to_key"]))
        if s and e["source"] == "fifa":
            e.update(n_forward=s["n_forward"], n_lateral=s["n_lateral"], n_backward=s["n_backward"])
    # Receptions recomputed after gap-fill.
    recv = defaultdict(int)
    for e in f22[2]:
        recv[(e["match_id"], e["to_key"])] += e["count"]
    sb_receipts = {(p["match_id"], p["player_key"]): p["ball_receipts_all"] for p in s22[3]}
    for p in f22[3]:
        p["receptions"] = recv.get((p["match_id"], p["player_key"]), 0)
        p["ball_receipts_all"] = sb_receipts.get((p["match_id"], p["player_key"]))
    for q in f22[4]:
        if "goalkeeper" in q["issue"]:
            q["resolution"] = "GK edges filled from StatsBomb"

    # ---- wc2018: StatsBomb only; slots from the learned position map ----
    for a in s18[1]:
        if a["starter"] and a["statsbomb_position"] in slot_map:
            a["slot_depth"], a["slot_width"], _ = slot_map[a["statsbomb_position"]]
            a["slot_source"] = "StatsBomb position -> FIFA slot map (learned on 2022)"
    for a in f26[1]:
        a["slot_source"] = "FIFA lineup diagram" if a["slot_depth"] is not None else None

    # ---- 2022 cross-check: FIFA matrix vs StatsBomb matrix, pair by pair ----
    fpairs = {(e["match_id"], e["from_key"], e["to_key"]): e["count"] for e in f22[2] if e["source"] == "fifa"}
    spairs = {(e["match_id"], e["from_key"], e["to_key"]): e["count"] for e in s22[2]}
    common = set(fpairs) | {k for k in spairs if (k[0], k[1]) in {(a, b) for a, b, _ in fpairs}}
    tot_f = sum(fpairs.values())
    tot_s = sum(spairs.get(k, 0) for k in fpairs)
    exact = sum(1 for k in fpairs if spairs.get(k, 0) == fpairs[k])
    within2 = sum(1 for k in fpairs if abs(spairs.get(k, 0) - fpairs[k]) <= 2)
    import statistics
    def corr(xs, ys):
        mx, my = statistics.mean(xs), statistics.mean(ys)
        num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
        return num / (sum((x - mx) ** 2 for x in xs) ** .5 * sum((y - my) ** 2 for y in ys) ** .5)
    ks = list(fpairs)
    xcheck = {"pairs_compared": len(ks), "fifa_total": tot_f, "statsbomb_total_same_pairs": tot_s,
              "exact_match_share": round(exact / len(ks), 3), "within_2_share": round(within2 / len(ks), 3),
              "pearson_r": round(corr([fpairs[k] for k in ks], [spairs.get(k, 0) for k in ks]), 3),
              "unmatched_fifa_players": sum(1 for a in f22[1] if not a["player_key"].startswith("sb:"))}

    for tid, (ms, aps, es, ps, qa), extra in (
            ("wc2018", (*s18, []), {}),
            ("wc2022", f22, {"crosscheck_fifa_vs_statsbomb": xcheck, "gk_gap_fill_edges": filled,
                             "match_id_mismatches": unmatched}),
            ("wc2026", f26, {})):
        d = os.path.join(OUT, tid)
        os.makedirs(d, exist_ok=True)
        write_csv(os.path.join(d, "matches.csv"), ms, M_COLS)
        write_csv(os.path.join(d, "appearances.csv"), aps, A_COLS)
        write_csv(os.path.join(d, "pass_edges.csv"), es, E_COLS)
        write_csv(os.path.join(d, "player_match.csv"), ps, P_COLS)
        if tid == "wc2022":  # keep the independent StatsBomb version for comparison
            write_csv(os.path.join(d, "pass_edges_statsbomb.csv"), s22[2], E_COLS)
        json.dump({"issues": qa, **extra}, open(os.path.join(d, "qa.json"), "w"), indent=1, ensure_ascii=False)
    json.dump({k: {"depth": v[0], "width": v[1], "n": v[2]} for k, v in sorted(slot_map.items())},
              open(os.path.join(OUT, "slot_map_statsbomb_to_fifa.json"), "w"), indent=1)
    print(json.dumps({"crosscheck_2022": xcheck, "gk_gap_fill_edges": filled,
                      "match_id_mismatches": unmatched}, indent=1))


if __name__ == "__main__":
    main()
