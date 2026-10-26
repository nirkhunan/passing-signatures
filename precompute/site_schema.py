"""Site data contract, v2.0 (three tournaments, one shape).

Replaces the v1 (WC2022-only, StatsBomb-coordinate) contract in schema.py for
the multi-tournament site. Every tournament — 2018, 2022, 2026 — is emitted in
exactly this shape so the frontend renders all three identically:

  * players sit on their FORMATION SLOT (slot_x 0..1 own goal -> attack,
    slot_y 0..1 left -> right touchline), never on average event positions;
  * edges carry pass direction ONLY where a source recorded real pass
    locations (has_direction); nothing is estimated;
  * player ids are cross-tournament person ids (see people.json).
"""
from __future__ import annotations

SCHEMA_VERSION = "2.0"
N_CLUSTERS = 5
POS = {"GK", "DF", "MF", "FW"}


class SchemaError(ValueError):
    pass


def _req(cond, msg):
    if not cond:
        raise SchemaError(msg)


def validate_team(d: dict) -> None:
    _req(d.get("schema_version") == SCHEMA_VERSION, "bad schema_version")
    for k in ("tournament", "team", "nodes", "edges", "clusters", "metrics"):
        _req(k in d, f"missing {k}")
    ids = set()
    for n in d["nodes"]:
        for k in ("id", "name", "short", "pos", "minutes", "matches", "receptions_per90",
                  "passes_per90", "slot_x", "slot_y"):
            _req(k in n, f"node missing {k}")
        _req(isinstance(n["id"], str), "node id must be a string person id")
        _req(n["pos"] in POS, f"bad pos {n['pos']}")
        _req(n["minutes"] >= 90, f"{n['id']} below 90' floor")
        _req(0 <= n["slot_x"] <= 1 and 0 <= n["slot_y"] <= 1, f"{n['id']} slot out of range")
        ids.add(n["id"])
    for e in d["edges"]:
        _req(e["from"] in ids and e["to"] in ids, "edge endpoint not a node")
        _req(e["count"] > 0 and e["per90"] > 0, "edge must carry passes")
        if e["has_direction"]:
            s = e["pct_forward"] + e["pct_lateral"] + e["pct_backward"]
            _req(abs(s - 1) < 0.02, "direction shares must sum to 1")
    _req(len(d["clusters"]) == N_CLUSTERS, "need exactly 5 clusters")
    _req(sorted(c["rank"] for c in d["clusters"]) == [1, 2, 3, 4, 5], "cluster ranks 1..5")
    for c in d["clusters"]:
        _req(len(c["player_ids"]) == 3 and set(c["player_ids"]) <= ids, "cluster players must be nodes")
