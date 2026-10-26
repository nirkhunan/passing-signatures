"""FIFA Training Centre post-match summary report (PDF) -> structured match dict.

Build-time only. Works on the 2022 and 2026 report layout (identical 52-page
template). Reads the PDF's text layer by coordinates — never OCR — so every
number is exactly what FIFA printed.

Extracted per match:
  * meta: teams, score, stage, date, venue, match length (90 / 120)
  * per team: formation string, lineup (shirt, name, GK/DF/MF/FW, starter,
    on/off minute, red-card minute) and each starter's formation slot (x, y)
  * per team: full passer -> receiver completed-pass matrix
  * per player: in-possession distributions (passes, line breaks, ...) and
    offers & receptions
"""
from __future__ import annotations

import re
from collections import defaultdict

import pymupdf

SUB_OFF = 0xDC2626   # red minute text  = substituted off
SUB_ON = 0x059669    # green minute text = substituted on
NUM = re.compile(r"^\d{1,3}%?$")
MINUTE = re.compile(r"(\d{1,3})(?:'(?:\+(\d+))?|\+(\d*)'?)")  # 67' / 90'+2 / 90+ (spaces removed first)
POS = {"GK", "DF", "MF", "FW"}


def _spans(page):
    out = []
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                t = s["text"].strip()
                if t:
                    x0, y0, x1, y1 = s["bbox"]
                    out.append({"t": t, "x": (x0 + x1) / 2, "x0": x0, "x1": x1,
                                "y": (y0 + y1) / 2, "c": s["color"]})
    return out


def _words(page):
    return [{"t": w[4], "x": (w[0] + w[2]) / 2, "x0": w[0], "x1": w[2], "y": (w[1] + w[3]) / 2}
            for w in page.get_text("words")]


def _rows(items, tol=4.0):
    """Group items into visual rows by y."""
    rows = []
    for it in sorted(items, key=lambda i: i["y"]):
        if rows and abs(rows[-1][0]["y"] - it["y"]) <= tol:
            rows[-1].append(it)
        else:
            rows.append([it])
    return [sorted(r, key=lambda i: i["x"]) for r in rows]


def _find_pages(doc, title):
    return [i for i, p in enumerate(doc) if p.get_text().lstrip().startswith(title)]


def _clean_name(s):
    return re.sub(r"\s+", " ", s).strip()


# --------------------------------------------------------------------------- #
# Page 1 — meta
# --------------------------------------------------------------------------- #
def parse_meta(doc):
    lines = [l.strip() for l in doc[0].get_text().splitlines() if l.strip()]
    head = lines[0]
    m = re.match(r"(.+?)\s+(\d+)\s*-\s*(\d+)\s+(.+)$", head)
    meta = {"home": m.group(1).strip(), "home_score": int(m.group(2)),
            "away_score": int(m.group(3)), "away": m.group(4).strip()} if m else {"raw": head}
    meta["stage"] = lines[1] if len(lines) > 1 else None
    meta["date"] = lines[2] if len(lines) > 2 else None
    meta["venue"] = next((l for l in lines[3:6] if "Kick Off" not in l and "REPORT" not in l), None)
    return meta


# --------------------------------------------------------------------------- #
# Page 2 — lineups, formation slots, minutes
# --------------------------------------------------------------------------- #
def parse_lineups(doc):
    page = doc[1]
    W = page.rect.width
    sp = _spans(page)
    drawings = page.get_drawings()

    # Small filled squares next to a minute = card icons.
    def card_at(x, y):
        for d in drawings:
            r, f = d["rect"], d.get("fill")
            if f and 4 < r.width < 9 and 6 < r.height < 12 and abs((r.y0 + r.y1) / 2 - y) < 6 \
                    and r.x1 <= x + 2 and x - r.x1 < 14:
                red, green, _ = f
                if red > 0.9 and green < 0.6:
                    return "red"
                if red > 0.9 and green > 0.6:
                    return "yellow"
        return None

    # Pitch / formation diagram region, and the two lineup columns.
    mid = [s for s in sp if 0.33 * W < s["x"] < 0.67 * W]
    # "FORMATION 4-1-2-3" may be one span or two, and some 2022 reports letter-space
    # it ("FO RMAT I O N 4 - 1- 2 - 3"), so drop spaces before matching.
    formations = []
    for s_ in sorted(sp, key=lambda s: s["x"]):
        m = re.search(r"\d(?:-\d){2,4}", s_["t"].replace(" ", ""))
        if m:
            formations.append(m.group(0))

    teams = {}
    for side, xsel in (("home", lambda x: x < 0.33 * W), ("away", lambda x: x > 0.67 * W)):
        col = [s for s in sp if xsel(s["x"])]
        section, players = None, []
        # Long names wrap onto two lines (±6pt around the row): fold those orphan
        # lines into the nearest row that carries a GK/DF/MF/FW code.
        rows = _rows(col, tol=3.5)
        is_anchor = [bool(re.search(r"\b(GK|DF|MF|FW)", " ".join(s["t"] for s in r))) for r in rows]
        merged = [list(r) for r in rows]
        for i, r in enumerate(rows):
            text = " ".join(s["t"] for s in r)
            if is_anchor[i] or "STARTING" in text or "SUBSTITUTES" in text:
                continue
            near = [j for j in range(len(rows)) if is_anchor[j] and abs(rows[j][0]["y"] - r[0]["y"]) <= 7.5]
            if near:
                j = min(near, key=lambda j: abs(rows[j][0]["y"] - r[0]["y"]))
                merged[j].extend(r)
                merged[i] = []
        for row in (sorted(r, key=lambda s: s["x"]) for r in merged if r):
            # Minute marks are read separately below; keep them out of the name text.
            text = " ".join(s["t"] for s in row if not MINUTE.fullmatch(s["t"].replace(" ", "")))
            if "STARTING" in text:
                section = "starting"; continue
            if "SUBSTITUTES" in text:
                section = "subs"; continue
            if section is None:
                continue
            m = re.search(r"\b(GK|DF|MF|FW)\s*(\d{1,2})?\b", text)
            if not m:
                continue
            pos = m.group(1)
            shirt = None
            if side == "home":
                n = re.match(r"^(\d{1,2})\b", text)
                shirt = int(n.group(1)) if n else None
                name = text[m.end():]
            else:
                shirt = int(m.group(2)) if m.group(2) else None
                if shirt is None:
                    n = re.search(r"\b(\d{1,2})\s*$", text)
                    shirt = int(n.group(1)) if n else None
                name = text[:m.start()]
            name = _clean_name(re.sub(r"\b\d{1,3}(?:'(?:\+\d+)?|\+\d*'?)|\(C\)", "", name))
            on = off = red = None
            goals = []
            for s in row:
                mm = MINUTE.fullmatch(s["t"].replace(" ", ""))
                if not mm:
                    continue
                minute = int(mm.group(1))
                if s["c"] == SUB_OFF:
                    off = minute
                elif s["c"] == SUB_ON:
                    on = minute
                else:
                    card = card_at(s["x0"], s["y"])
                    if card == "red":
                        red = minute
                    elif card is None:
                        goals.append(minute)
            players.append({"shirt": shirt, "name": name, "pos": pos,
                            "starter": section == "starting", "on": on, "off": off,
                            "red": red, "goal_minutes": goals})
        teams[side] = {"players": players}

    # Formation slots: shirt numbers drawn on the pitch diagram.
    nums = [s for s in mid if re.fullmatch(r"\d{1,2}", s["t"]) and 0.2 * page.rect.height < s["y"] < 0.65 * page.rect.height]
    if nums:
        X0, X1 = min(s["x"] for s in nums), max(s["x"] for s in nums)
        Y0, Y1 = min(s["y"] for s in nums), max(s["y"] for s in nums)
        for side, sel in (("home", lambda s: s["x"] < W / 2), ("away", lambda s: s["x"] > W / 2)):
            slots = {}
            for s in filter(sel, nums):
                fx = (s["x"] - X0) / (X1 - X0)
                fy = (s["y"] - Y0) / (Y1 - Y0)
                # Normalise so every team attacks left -> right, own goal at x=0:
                # depth 0..1 (own goal -> halfway), width 0..1 (top -> bottom of diagram).
                depth = fx / 0.5 if side == "home" else (1 - fx) / 0.5
                width = fy if side == "home" else 1 - fy
                slots[int(s["t"])] = (round(min(depth, 1.0), 3), round(width, 3))
            teams[side]["slots"] = slots

    teams["home"]["formation"] = formations[0] if formations else None
    teams["away"]["formation"] = formations[1] if len(formations) > 1 else None

    # Match length: the timeline axis ends at 120 for extra-time matches.
    axis = {s["t"] for s in mid if s["y"] > 0.7 * page.rect.height}
    length = 120 if "120" in axis or "105" in axis else 90
    return teams, length


# --------------------------------------------------------------------------- #
# Passing network matrix
# --------------------------------------------------------------------------- #
def parse_matrix(page):
    """Return (team_name, [row shirts], {(from_shirt, to_shirt): count})."""
    words = _words(page)
    W = page.rect.width
    title = page.get_text().splitlines()
    # Grid limits: the matrix sits left of the "Top 5" side table.
    top5 = next((w for w in words if w["t"] == "Top"), None)
    xmax = top5["x0"] - 5 if top5 else 0.79 * W
    grid = [w for w in words if w["x"] < xmax]

    hash_ = next(w for w in grid if w["t"] == "#")

    # Grid geometry from the filled diagonal squares: square k sits at (col k, row k).
    diag = []
    for d in page.get_drawings():
        r = d["rect"]
        if d.get("fill") and 15 < r.width < 60 and 15 < r.height < 40 and r.x0 > hash_["x1"] + 100 \
                and r.y0 > hash_["y"] and r.x1 < xmax:
            diag.append(((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2))
    # Some reports draw a square twice (slightly offset) — keep one per row.
    uniq = []
    for x, y in sorted(diag, key=lambda p: p[1]):
        if not uniq or y - uniq[-1][1] > 5:
            uniq.append((x, y))
    diag = uniq
    col_x = [x for x, _ in diag]
    row_y = [y for _, y in diag]
    n = len(diag)
    if n < 11 or any(b <= a for a, b in zip(col_x, col_x[1:])):
        raise ValueError(f"matrix: diagonal not found cleanly ({n} squares)")

    # Row labels: shirt number in the "#" column, nearest to each diagonal row.
    nums = [w for w in grid if w["x"] < hash_["x1"] + 8 and re.fullmatch(r"\d{1,2}", w["t"])]
    rows = []
    for y in row_y:
        # Some reports split a two-digit number into separate glyphs ("2" "2") — join them.
        near = sorted((w for w in nums if abs(w["y"] - y) <= 6), key=lambda w: w["x"])
        if not near:
            raise ValueError(f"matrix: no shirt number for row at y={y:.0f}")
        rows.append((int("".join(w["t"] for w in near)), y))
    if len({s for s, _ in rows}) != n:
        raise ValueError("matrix: duplicate shirt numbers in rows")

    half = (row_y[1] - row_y[0]) / 2
    cells = [w for w in grid if NUM.match(w["t"]) and row_y[0] - half <= w["y"] <= row_y[-1] + half
             and w["x0"] > col_x[0] - 40]

    mat = {}
    for c in cells:
        i = min(range(n), key=lambda k: abs(row_y[k] - c["y"]))
        j = min(range(n), key=lambda k: abs(col_x[k] - c["x"]))
        if i == j:
            continue
        mat[(rows[i][0], rows[j][0])] = int(c["t"])
    return [s for s, _ in rows], mat


# --------------------------------------------------------------------------- #
# Per-player tables (Distributions, Offers & Receptions)
# --------------------------------------------------------------------------- #
DIST_COLS = ["passes_attempted", "passes_completed", "pass_completion_pct", "switches_of_play",
             "crosses_attempted", "crosses_completed", "line_breaks_attempted",
             "line_breaks_completed", "line_break_completion_pct", "ball_progressions",
             "take_ons", "step_ins", "attempts_at_goal", "goals"]
OFFER_COLS = ["total_offers", "in_front", "in_between", "out_to_in", "in_to_out", "in_behind",
              "no_movement", "offers_received"]


def _num(t):
    t = t.rstrip("%")
    return float(t) if "." in t else int(t)


def parse_player_table(page, cols):
    words = _words(page)
    hash_ = next(w for w in words if w["t"] == "#")
    body = [w for w in words if w["y"] > hash_["y"] + 12]
    out = {}
    for row in _rows(body, tol=4):
        if not row or not re.fullmatch(r"\d{1,2}", row[0]["t"]) or row[0]["x"] > hash_["x1"] + 8:
            continue
        shirt = int(row[0]["t"])
        nums = [w for w in row[1:] if NUM.match(w["t"]) and w["x0"] > hash_["x1"] + 120]
        if len(nums) != len(cols):
            # some reports print blank instead of 0 for percentages with 0 attempts
            if len(nums) < len(cols):
                continue
            nums = nums[-len(cols):]
        out[shirt] = {k: _num(w["t"]) for k, w in zip(cols, nums)}
    return out


def _team_of(page):
    lines = [l.strip() for l in page.get_text().splitlines() if l.strip()]
    return lines[1] if len(lines) > 1 else None


# --------------------------------------------------------------------------- #
def parse_report(path):
    doc = pymupdf.open(path)
    meta = parse_meta(doc)
    teams, length = parse_lineups(doc)
    meta["length"] = length
    names = {"home": meta.get("home"), "away": meta.get("away")}

    result = {"meta": meta, "teams": {}}
    for side in ("home", "away"):
        result["teams"][side] = {"name": names[side], **teams[side], "matrix": {},
                                 "distribution": {}, "offers": {}}

    def side_for(page):
        t = _team_of(page)
        for side in ("home", "away"):
            if t and names[side] and t.lower() == names[side].lower():
                return side
        return None

    pn = _find_pages(doc, "Passing Networks")
    for k, i in enumerate(pn):
        side = side_for(doc[i]) or ("home" if k == 0 else "away")
        order, mat = parse_matrix(doc[i])
        result["teams"][side]["matrix_order"] = order
        result["teams"][side]["matrix"] = mat
    for title, key, cols in (("In Possession - Distributions", "distribution", DIST_COLS),
                             ("In Possession - Offers & Receptions", "offers", OFFER_COLS)):
        for k, i in enumerate(_find_pages(doc, title)):
            side = side_for(doc[i]) or ("home" if k == 0 else "away")
            result["teams"][side][key] = parse_player_table(doc[i], cols)
    return result


if __name__ == "__main__":
    import json, sys
    r = parse_report(sys.argv[1])
    for side, t in r["teams"].items():
        t["matrix"] = {f"{a}->{b}": v for (a, b), v in t["matrix"].items()}
        t["slots"] = {str(k): v for k, v in t.get("slots", {}).items()}
    print(json.dumps(r, indent=1, ensure_ascii=False)[:6000])
