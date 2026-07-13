"""
Build jufo-data.json (the bundled first-run/offline fallback dataset) from
the live JUFO REST API's nightly bulk export, instead of hand-downloaded CSV
exports.

This is only the *fallback* snapshot shipped with the extension package; the
extension itself refreshes its working copy live in the background (see
jufo-refresh.js) using the same source and the same transform rules
documented below and in REQUIREMENTS.md (FR-1/FR-8). Re-run this before
cutting a new release so a fresh install has reasonably current data even
before its first live refresh completes.

Usage:
  python build-data.py [path-to-local-massa.json.zip]

  With no argument, downloads the current bulk export from
  https://jufo-rest.csc.fi/v1.1/massa.json.zip. A local zip path can be
  passed for offline testing.
"""

import io
import json
import sys
import urllib.request
import zipfile
from datetime import datetime, timezone

BULK_URL = "https://jufo-rest.csc.fi/v1.1/massa.json.zip"


def fetch_bulk_export(source):
    if source:
        with open(source, "rb") as f:
            zip_bytes = f.read()
    else:
        print(f"Downloading {BULK_URL} ...")
        with urllib.request.urlopen(BULK_URL) as resp:
            zip_bytes = resp.read()

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        json_name = next(n for n in zf.namelist() if n.endswith(".json"))
        with zf.open(json_name) as f:
            return json.load(f)


def parse_level(raw):
    """"" -> None (non-ranked); "0".."3" -> int; missing/other -> None."""
    if raw is None or raw == "":
        return None
    try:
        return int(raw)
    except ValueError:
        return None


def entry_priority(entry):
    """Higher is preferred when two records collide on the same key."""
    active_rank = 1 if entry.get("_active") == "Active" else 0
    fi_rank = entry["fi"] if entry["fi"] is not None else -1
    return (active_rank, fi_rank)


def put_preferring_higher_priority(index, key, entry):
    existing = index.get(key)
    if existing is None or entry_priority(entry) > entry_priority(existing):
        index[key] = entry


def build_indexes(records):
    names = {}
    issn_index = {}
    level_counts = {"fi": {}, "no": {}}

    for row in records:
        name = (row.get("Name") or "").strip().lower()
        if not name:
            continue

        fi = parse_level(row.get("Level"))
        no = parse_level(row.get("Norway_Level"))
        level_counts["fi"][fi] = level_counts["fi"].get(fi, 0) + 1
        level_counts["no"][no] = level_counts["no"].get(no, 0) + 1

        try:
            jufo_id = int(row.get("Jufo_ID"))
        except (TypeError, ValueError):
            continue

        entry = {
            "id": jufo_id,
            "fi": fi,
            "no": no,
            "_active": row.get("Active"),  # stripped before writing out
        }

        put_preferring_higher_priority(names, name, entry)

        for issn_field in ("ISSN1", "ISSN2", "ISSNL"):
            issn = (row.get(issn_field) or "").strip()
            if issn:
                put_preferring_higher_priority(issn_index, issn, entry)

    # Drop the internal-only "_active" field before writing out.
    def public(entry):
        return {"id": entry["id"], "fi": entry["fi"], "no": entry["no"]}

    return (
        {k: public(v) for k, v in names.items()},
        {k: public(v) for k, v in issn_index.items()},
        level_counts,
    )


def main():
    source = sys.argv[1] if len(sys.argv) > 1 else None
    records = fetch_bulk_export(source)
    print(f"Loaded {len(records)} channel records")

    names, issn_index, level_counts = build_indexes(records)
    print(f"Indexed {len(names)} unique names, {len(issn_index)} unique ISSNs")
    print("Finland level distribution:", level_counts["fi"])
    print("Norway level distribution:", level_counts["no"])

    out = {
        "names": names,
        "issn": issn_index,
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }

    script_dir = __import__("os").path.dirname(__import__("os").path.abspath(__file__))
    out_path = __import__("os").path.join(script_dir, "jufo-data.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
