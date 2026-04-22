"""
Merge JUFO field CSV exports into jufo-data.json for the extension.

Usage:
  1. Place the 24 CSV exports in the same directory as this script.
  2. Run:  python build-data.py
  3. Move jufo-data.json into the jufo-scholar/ extension directory.
"""

import csv
import json
import glob
import os

import sys
script_dir = os.path.dirname(os.path.abspath(__file__))
search_dir = sys.argv[1] if len(sys.argv) > 1 else script_dir
csv_files = glob.glob(os.path.join(search_dir, "*.csv"))

if not csv_files:
    print("No CSV files found in", script_dir)
    exit(1)

print(f"Found {len(csv_files)} CSV file(s)")

# Peek at the first file to detect delimiter and column names
with open(csv_files[0], encoding="utf-8") as f:
    header = f.readline()
delimiter = ";" if header.count(";") > header.count(",") else ","
print(f"Detected delimiter: '{delimiter}'")
print(f"Header: {header.strip()}")

data = {}
for path in csv_files:
    with open(path, encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=delimiter)
        for row in reader:
            # Try common column name variants
            name = (row.get("Name") or row.get("name") or row.get("Nimi") or "").strip().lower()
            level_raw = (row.get("Level") or row.get("level") or row.get("Taso") or "").strip()
            try:
                level = int(level_raw)
            except ValueError:
                continue
            if name and (name not in data or level > data[name]):
                data[name] = level

out_path = os.path.join(script_dir, "jufo-data.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

print(f"Exported {len(data)} venues to {out_path}")
