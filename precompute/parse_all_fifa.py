"""Parse every FIFA report PDF in raw/fifa<year>/ into raw/fifa<year>.json (build-time)."""
import glob, json, os, sys, traceback
import fifa_pdf

HERE = os.path.dirname(os.path.abspath(__file__))

def run(year):
    out, errors = [], []
    for path in sorted(glob.glob(os.path.join(HERE, "..", "raw", f"fifa{year}", "*.pdf"))):
        try:
            r = fifa_pdf.parse_report(path)
            r["source_file"] = os.path.basename(path)
            for t in r["teams"].values():
                t["matrix"] = [[a, b, n] for (a, b), n in t["matrix"].items()]
                t["slots"] = {str(k): v for k, v in t.get("slots", {}).items()}
                t["distribution"] = {str(k): v for k, v in t["distribution"].items()}
                t["offers"] = {str(k): v for k, v in t["offers"].items()}
            out.append(r)
        except Exception as e:
            errors.append((os.path.basename(path), repr(e)))
    with open(os.path.join(HERE, "..", "raw", f"fifa{year}.json"), "w") as f:
        json.dump(out, f, ensure_ascii=False)
    print(f"{year}: parsed {len(out)}, errors {len(errors)}")
    for e in errors: print("  ERR", *e)

for y in sys.argv[1:]:
    run(y)
