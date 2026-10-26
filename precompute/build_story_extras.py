"""public/data/<tid>/*.json -> public/data/triangles.json, players.json, shares.json.

Build-time only. Run after build_site_data.py. These feed the "every triangle" and
"every player" charts: one record per signature triangle and per player
(>= 90 minutes) per tournament — individual items, not team averages.
shares.json feeds the two stacked-area charts: per tournament, the share of signature
triangles and the share of all completed passes in each of the same four types.

Usage: python build_story_extras.py [path/to/public/data]
"""
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "public", "data")


def tri_type(tri):
    """Where a triangle lives: same rule as its label in build_site_data.py."""
    pos = {n["pos"] for n in tri}
    if pos <= {"GK", "DF"}:
        return "back-line"
    if "FW" in pos:
        return "attacking"
    if pos <= {"MF"}:
        return "midfield"
    return "build-up"


def main():
    overview = json.load(open(os.path.join(PUB, "overview.json")))
    triangles, players = [], []
    pass_counts = {}
    for t in overview["tournaments"]:
        tid = t["id"]
        for path in sorted(glob.glob(os.path.join(PUB, tid, "*.json"))):
            if path.endswith("_index.json"):
                continue
            d = json.load(open(path))
            team, slug = d["team"]["name"], d["team"]["slug"]
            by_id = {n["id"]: n for n in d["nodes"]}
            for c in d["clusters"]:
                tri = [by_id[p] for p in c["player_ids"]]
                triangles.append({"t": tid, "team": team, "slug": slug, "rank": c["rank"], "z": c["z_score"],
                                  "type": tri_type(tri), "label": c["label"], "names": c["description"],
                                  "ids": c["player_ids"]})
            # Every completed pass in the network, typed by the two players' units —
            # the same rule as triangles, applied to pairs.
            pc = pass_counts.setdefault(tid, {})
            for e in d["edges"]:
                k = tri_type([by_id[e["from"]], by_id[e["to"]]])
                pc[k] = pc.get(k, 0) + e["count"]
            for n in d["nodes"]:
                players.append({"t": tid, "team": team, "slug": slug, "id": n["id"], "name": n["name"],
                                "pos": n["pos"], "rec90": n["receptions_per90"], "pass90": n["passes_per90"],
                                "minutes": n["minutes"]})
    with open(os.path.join(PUB, "triangles.json"), "w") as f:
        json.dump(triangles, f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(PUB, "players.json"), "w") as f:
        json.dump(players, f, ensure_ascii=False, separators=(",", ":"))
    order = ["back-line", "build-up", "midfield", "attacking"]
    tri_share, pass_share = {}, {}
    for t in overview["tournaments"]:
        tid = t["id"]
        tri = [x for x in triangles if x["t"] == tid]
        tri_share[tid] = {k: round(sum(x["type"] == k for x in tri) / len(tri), 4) for k in order}
        tot = sum(pass_counts[tid].values())
        pass_share[tid] = {k: round(pass_counts[tid].get(k, 0) / tot, 4) for k in order}
    with open(os.path.join(PUB, "shares.json"), "w") as f:
        json.dump({"order": order, "triangles": tri_share, "passes": pass_share}, f, indent=1)
    print(f"{len(triangles)} triangles, {len(players)} players")
    print("triangle shares", tri_share)
    print("pass shares", pass_share)


if __name__ == "__main__":
    main()
