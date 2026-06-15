"""PHASE 2 STUB — WC 2026 adapter.

Do not implement now (PRD §12). When reliable post-match WC 2026 event data is
available, this adapter must emit the SAME TeamNetwork shape (schema.py) into
/public/data/wc2026/, joining on StatsBomb player_id. Its existence is the seam
that keeps phase 2 cheap; building it is explicitly out of scope for v1.
"""


def main() -> None:
    raise NotImplementedError(
        "WC 2026 adapter is a phase-2 stub. See PRD §12. "
        "Emit the identical TeamNetwork schema into public/data/wc2026/ when triggered."
    )


if __name__ == "__main__":
    main()
