"""Passing-network build + overrepresented-triangle analysis (PRD §8).

Method (locked decisions baked in):
  * Directed network: players = nodes, completed passes = directed edges,
    weight = per-90 pass volume (Q4: per-90 normalization; Q2: directed).
  * Candidate clusters = connected 3-player passing triangles in the REAL network.
  * "Strength" of a triangle = combined per-90 volume of all directed passes
    among its three players (the modeling choice the user approved).
  * Null model: ~1000 degree-preserving directed edge-swaps (each player keeps
    their in/out link counts), with the real edge-weights randomly reassigned.
  * z-score = (observed strength − null mean) / null std. Top 5 by z = the
    five most overrepresented clusters.
"""
from __future__ import annotations

import itertools
from typing import Dict, List, Tuple

import networkx as nx
import numpy as np

Triangle = Tuple[int, int, int]

# StatsBomb pitch: x 0–120 (own goal -> opponent goal), y 0–80.
# y convention used here (verified against a known left-back during the Spain
# check): low y = left flank, high y = right flank. Flip these if a known
# left-sided player lands on the right.
_LEFT_MAX_Y = 26.7
_RIGHT_MIN_Y = 53.3


def build_graph(edges: List[dict]) -> nx.DiGraph:
    """Directed weighted passing graph from normalized edge dicts.

    Weight 'w' is per-90 pass volume. Only edges with a positive count create a
    link. Endpoints are assumed already restricted to valid (>=90') nodes.
    """
    g = nx.DiGraph()
    for e in edges:
        if e["count"] > 0:
            g.add_edge(e["from"], e["to"], w=e["per90"], count=e["count"])
    return g


def _triangle_strength(g: nx.DiGraph, tri: Triangle) -> float:
    """Combined per-90 volume of all directed passes among the three players."""
    s = 0.0
    for u, v in itertools.permutations(tri, 2):
        if g.has_edge(u, v):
            s += g[u][v]["w"]
    return s


def _connected_triangles(g: nx.DiGraph) -> List[Triangle]:
    """All 3-node sets that are mutually connected in the undirected projection
    (each of the three pairs has at least one pass in some direction)."""
    und = g.to_undirected()
    tris: List[Triangle] = []
    for tri in itertools.combinations(sorted(und.nodes()), 3):
        a, b, c = tri
        if und.has_edge(a, b) and und.has_edge(b, c) and und.has_edge(a, c):
            tris.append(tri)
    return tris


def _null_strengths(
    g: nx.DiGraph, triangles: List[Triangle], n_null: int, rng: np.random.Generator
) -> np.ndarray:
    """For each candidate triangle, its strength across n_null degree-preserving
    randomizations. Returns an (n_triangles, n_null) array.

    Each null: degree-preserving directed edge swap (preserves every node's in-
    and out-degree), then the real weight multiset is randomly reassigned onto
    the resulting links. A triangle absent from a null contributes strength 0.
    """
    weights = np.array([d["w"] for _, _, d in g.edges(data=True)], dtype=float)
    n_edges = len(weights)
    out = np.zeros((len(triangles), n_null), dtype=float)

    for j in range(n_null):
        h = g.copy()
        if n_edges >= 2:
            # nswap scaled to edge count; tolerate graphs too rigid to fully swap.
            try:
                nx.directed_edge_swap(
                    h,
                    nswap=n_edges,
                    max_tries=max(100, n_edges * 25),
                    seed=int(rng.integers(0, 2**31 - 1)),
                )
            except (nx.NetworkXError, nx.NetworkXAlgorithmError, KeyError):
                pass  # keep whatever (partial) randomization was achieved
        # Randomly reassign the real weights onto the (degree-preserved) links.
        shuffled = weights.copy()
        rng.shuffle(shuffled)
        for (u, v), w in zip(list(h.edges()), shuffled):
            h[u][v]["w"] = w
        for i, tri in enumerate(triangles):
            out[i, j] = _triangle_strength(h, tri)
    return out


def _flank(avg_y: float) -> str:
    if avg_y < _LEFT_MAX_Y:
        return "Left-side"
    if avg_y > _RIGHT_MIN_Y:
        return "Right-side"
    return "Central"


def _third(avg_x: float) -> str:
    if avg_x < 40:
        return "deep"
    if avg_x > 80:
        return "advanced"
    return "midfield"


def _dominant_motion(g: nx.DiGraph, tri: Triangle, edges_meta: Dict[Tuple[int, int], dict]) -> str:
    """Pick the triangle's dominant pass character from its edges' direction mix."""
    agg = {"forward": 0.0, "lateral": 0.0, "backward": 0.0}
    for u, v in itertools.permutations(tri, 2):
        m = edges_meta.get((u, v))
        if m:
            w = m["per90"]
            agg["forward"] += w * m["pct_forward"]
            agg["lateral"] += w * m["pct_lateral"]
            agg["backward"] += w * m["pct_backward"]
    dom = max(agg, key=agg.get)
    return {"forward": "progression", "lateral": "recycle", "backward": "reset"}[dom]


def compute_clusters(
    nodes: List[dict],
    edges: List[dict],
    n_null: int = 1000,
    seed: int = 42,
) -> List[dict]:
    """Return exactly 5 ranked, labeled cluster dicts (PRD §6 shape, no 'rank' field set yet)."""
    rng = np.random.default_rng(seed)
    g = build_graph(edges)

    node_by_id = {n["player_id"]: n for n in nodes}
    edges_meta = {(e["from"], e["to"]): e for e in edges if e["count"] > 0}

    triangles = _connected_triangles(g)
    if len(triangles) < 5:
        raise ValueError(
            f"only {len(triangles)} connected triangles found; cannot pick 5 clusters"
        )

    observed = np.array([_triangle_strength(g, t) for t in triangles])
    nulls = _null_strengths(g, triangles, n_null, rng)

    null_mean = nulls.mean(axis=1)
    null_std = nulls.std(axis=1)
    safe_std = np.where(null_std < 1e-9, 1e-9, null_std)
    z = (observed - null_mean) / safe_std
    # If a triangle never varies in the null and matches observed, z is undefined -> 0.
    z = np.where(null_std < 1e-9, np.where(observed > null_mean, 50.0, 0.0), z)

    order = np.argsort(-z)[:5]

    clusters: List[dict] = []
    for rank, idx in enumerate(order, start=1):
        tri = triangles[idx]
        names = [node_by_id[p].get("name", str(p)) for p in tri]
        cx = float(np.mean([node_by_id[p]["avg_x"] for p in tri]))
        cy = float(np.mean([node_by_id[p]["avg_y"] for p in tri]))
        motion = _dominant_motion(g, tri, edges_meta)
        label = f"{_flank(cy)} {motion} triangle"
        short = [n.split()[-1] for n in names]  # surname-ish for the description
        clusters.append(
            {
                "rank": rank,
                "z_score": round(float(z[idx]), 2),
                "player_ids": [int(p) for p in tri],
                "label": label,
                "description": f"{'–'.join(short)} ({_third(cx)} {motion})",
            }
        )
    return clusters
