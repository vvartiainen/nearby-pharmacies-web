#!/usr/bin/env python3
"""Independent computation of the expected values in ranking-v1.json.

Standard library only, written separately from the TypeScript ranking code so the two check each
other. It uses the atan2 form of the haversine formula, which equals the asin form used by the
apps to well under a micrometre at these distances.

    python3 -I fixtures/ranking/compute_expected.py --check   # exit 1 if the fixture disagrees
    python3 -I fixtures/ranking/compute_expected.py --write   # rewrite expected values in place

After --write, run `pnpm run format fixtures/ranking/ranking-v1.json`; --check compares parsed
values, so formatting does not matter.
"""

import json
import math
import sys
from pathlib import Path

FIXTURE = Path(__file__).with_name("ranking-v1.json")
EARTH_RADIUS_M = 6371008.8  # IUGG mean radius R1
STORED_DECIMALS = 6
SUFFIX = {"en": " straight line", "fi": " linnuntietä"}


def distance_m(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return EARTH_RADIUS_M * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def utf16_key(text):
    return text.encode("utf-16-be")


def half_up(value):
    return math.floor(value + 0.5)


def group(integer, locale):
    text = f"{integer:,}"
    return text.replace(",", " ") if locale == "fi" else text


def format_distance(meters, locale):
    tens = half_up(meters / 10) * 10
    if tens < 1000:
        return f"{group(tens, locale)} m"
    tenths = half_up(meters / 100)
    if tenths < 100:
        separator = "," if locale == "fi" else "."
        return f"{tenths // 10}{separator}{tenths % 10} km"
    return f"{group(half_up(meters / 1000), locale)} km"


def compute(fixture):
    origins = []
    for origin in fixture["origins"]:
        rows = []
        for pharmacy in fixture["pharmacies"]:
            d = distance_m(origin["lat"], origin["lon"], pharmacy["lat"], pharmacy["lon"])
            rows.append((d, utf16_key(pharmacy["id"]), pharmacy["id"]))
        rows.sort()
        origins.append(
            [
                {
                    "id": pid,
                    "distanceMeters": round(d, STORED_DECIMALS),
                    "label": {loc: format_distance(d, loc) + SUFFIX[loc] for loc in ("en", "fi")},
                }
                for d, _, pid in rows
            ]
        )
    display = [
        {loc: format_distance(case["meters"], loc) for loc in ("en", "fi")}
        for case in fixture["displayCases"]
    ]
    return origins, display


def check(fixture, origins, display):
    tolerance = fixture["distanceToleranceMeters"]
    problems = []
    for origin, expected in zip(fixture["origins"], origins):
        stored = origin.get("expected", [])
        if [row["id"] for row in stored] != [row["id"] for row in expected]:
            problems.append(f"{origin['id']}: order differs")
            continue
        for got, want in zip(stored, expected):
            if abs(got["distanceMeters"] - want["distanceMeters"]) > tolerance:
                problems.append(f"{origin['id']} {got['id']}: distance {got['distanceMeters']}")
            if got["label"] != want["label"]:
                problems.append(f"{origin['id']} {got['id']}: label {got['label']}")
    for case, want in zip(fixture["displayCases"], display):
        if {loc: case.get(loc) for loc in ("en", "fi")} != want:
            problems.append(f"display {case['meters']}: {case.get('en')} / {case.get('fi')}")
    return problems


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "--check"
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    origins, display = compute(fixture)
    if mode == "--write":
        for origin, expected in zip(fixture["origins"], origins):
            origin["expected"] = expected
        for case, labels in zip(fixture["displayCases"], display):
            case.update(labels)
        FIXTURE.write_text(json.dumps(fixture, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"wrote {FIXTURE}")
        return 0
    problems = check(fixture, origins, display)
    for problem in problems:
        print(problem, file=sys.stderr)
    if not problems:
        print(f"fixture OK: {len(fixture['origins'])} origins, {len(fixture['displayCases'])} display cases")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
