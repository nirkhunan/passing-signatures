"""TeamNetwork schema + validation (PRD §6).

This module is the build-time guardian of the data contract. Every generated
<team>.json is validated against this shape before it is written. The frontend
depends ONLY on this shape; never change it without bumping SCHEMA_VERSION.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import List

SCHEMA_VERSION = "1.0"

# Allowed dominant-direction labels for an edge.
DIRECTION_CLASSES = {"forward", "lateral", "backward"}

# Exactly this many clusters per team (PRD §6, §8).
N_CLUSTERS = 5


@dataclass
class Tournament:
    id: str
    name: str
    source: str
    team_count: int


@dataclass
class Team:
    id: int
    name: str
    matches_played: int


@dataclass
class Node:
    player_id: int
    name: str
    position: str
    touches_per90: float
    minutes: float
    avg_x: float  # StatsBomb pitch coords, 0–120
    avg_y: float  # 0–80


@dataclass
class Edge:
    from_: int  # serialized as "from" (reserved word workaround)
    to: int
    count: int
    per90: float
    pct_forward: float
    pct_lateral: float
    pct_backward: float
    direction_class: str


@dataclass
class Cluster:
    rank: int
    z_score: float
    player_ids: List[int]
    label: str
    description: str


@dataclass
class TeamNetwork:
    tournament: Tournament
    team: Team
    nodes: List[Node]
    edges: List[Edge]
    clusters: List[Cluster]
    schema_version: str = SCHEMA_VERSION

    def to_dict(self) -> dict:
        """Serialize to the exact JSON shape in PRD §6 (note: 'from', not 'from_')."""
        return {
            "schema_version": self.schema_version,
            "tournament": asdict(self.tournament),
            "team": asdict(self.team),
            "nodes": [asdict(n) for n in self.nodes],
            "edges": [
                {
                    "from": e.from_,
                    "to": e.to,
                    "count": e.count,
                    "per90": e.per90,
                    "pct_forward": e.pct_forward,
                    "pct_lateral": e.pct_lateral,
                    "pct_backward": e.pct_backward,
                    "direction_class": e.direction_class,
                }
                for e in self.edges
            ],
            "clusters": [asdict(c) for c in self.clusters],
        }


class SchemaError(ValueError):
    """Raised when a generated file does not conform to the contract."""


def _require(cond: bool, msg: str) -> None:
    if not cond:
        raise SchemaError(msg)


def validate(data: dict) -> None:
    """Validate a serialized TeamNetwork dict. Raises SchemaError on any problem.

    Checks the structure the frontend relies on: required keys, types, the
    exactly-5-clusters rule, valid direction classes, percentage sums, and that
    every edge endpoint refers to a real node.
    """
    _require(data.get("schema_version") == SCHEMA_VERSION,
             f"schema_version must be '{SCHEMA_VERSION}', got {data.get('schema_version')!r}")

    # tournament
    t = data.get("tournament")
    _require(isinstance(t, dict), "tournament must be an object")
    for k in ("id", "name", "source", "team_count"):
        _require(k in t, f"tournament missing '{k}'")
    _require(isinstance(t["id"], str), "tournament.id must be a string")

    # team
    tm = data.get("team")
    _require(isinstance(tm, dict), "team must be an object")
    for k in ("id", "name", "matches_played"):
        _require(k in tm, f"team missing '{k}'")
    _require(isinstance(tm["id"], int), "team.id must be an int")

    # nodes
    nodes = data.get("nodes")
    _require(isinstance(nodes, list) and len(nodes) > 0, "nodes must be a non-empty list")
    node_ids = set()
    for n in nodes:
        for k in ("player_id", "name", "position", "touches_per90", "minutes", "avg_x", "avg_y"):
            _require(k in n, f"node missing '{k}'")
        _require(isinstance(n["player_id"], int), "node.player_id must be an int")
        _require(n["minutes"] >= 90, f"node {n['player_id']} below 90' floor: {n['minutes']}")
        _require(0 <= n["avg_x"] <= 120, f"node {n['player_id']} avg_x out of range: {n['avg_x']}")
        _require(0 <= n["avg_y"] <= 80, f"node {n['player_id']} avg_y out of range: {n['avg_y']}")
        node_ids.add(n["player_id"])

    # edges
    edges = data.get("edges")
    _require(isinstance(edges, list), "edges must be a list")
    for e in edges:
        for k in ("from", "to", "count", "per90", "pct_forward", "pct_lateral",
                  "pct_backward", "direction_class"):
            _require(k in e, f"edge missing '{k}'")
        _require(e["from"] in node_ids, f"edge.from {e['from']} is not a node")
        _require(e["to"] in node_ids, f"edge.to {e['to']} is not a node")
        _require(e["direction_class"] in DIRECTION_CLASSES,
                 f"edge direction_class invalid: {e['direction_class']!r}")
        pct_sum = e["pct_forward"] + e["pct_lateral"] + e["pct_backward"]
        _require(abs(pct_sum - 1.0) < 0.02 or e["count"] == 0,
                 f"edge {e['from']}->{e['to']} pct_* must sum to ~1.0, got {pct_sum:.3f}")

    # clusters — exactly 5, ranked 1..5
    clusters = data.get("clusters")
    _require(isinstance(clusters, list), "clusters must be a list")
    _require(len(clusters) == N_CLUSTERS, f"must have exactly {N_CLUSTERS} clusters, got {len(clusters)}")
    ranks = sorted(c["rank"] for c in clusters)
    _require(ranks == list(range(1, N_CLUSTERS + 1)), f"cluster ranks must be 1..{N_CLUSTERS}, got {ranks}")
    for c in clusters:
        for k in ("rank", "z_score", "player_ids", "label", "description"):
            _require(k in c, f"cluster missing '{k}'")
        _require(len(c["player_ids"]) == 3, f"cluster {c['rank']} must have 3 players (directed triad)")
        for pid in c["player_ids"]:
            _require(pid in node_ids, f"cluster {c['rank']} references non-node player {pid}")
