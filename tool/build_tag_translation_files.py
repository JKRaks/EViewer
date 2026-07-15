#!/usr/bin/env python3
"""Split translated tag groups into official and unofficial runtime files."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

from openpyxl import load_workbook


TOOL_DIR = Path(__file__).parent
ROOT_DIR = TOOL_DIR.parent
DEFAULT_GROUPS = TOOL_DIR / "taggroup-data.json"
DEFAULT_WORKBOOK = TOOL_DIR / "taggroup-data-translated.xlsx"
DEFAULT_LEGACY = TOOL_DIR / "officialTagTranslations.legacy.json"
DEFAULT_OFFICIAL = ROOT_DIR / "src/core/data/officialTagTranslations.json"
DEFAULT_UNOFFICIAL = ROOT_DIR / "src/core/data/unofficialTagTranslations.json"
DEFAULT_AUDIT = TOOL_DIR / "tag-translation-split-audit.json"


def normalized(value: str) -> str:
    return value.strip().lower()


def unique_values(values: list[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        value = value.strip()
        key = normalized(value)
        if value and key not in seen:
            seen.add(key)
            result.append(value)
    return result


def read_workbook_translations(path: Path) -> dict[str, dict[str, str]]:
    workbook = load_workbook(path, read_only=True, data_only=True)
    translations: dict[str, dict[str, str]] = {}
    for sheet_name in workbook.sheetnames:
        rows: dict[str, str] = {}
        for row in workbook[sheet_name].iter_rows(min_row=2, values_only=True):
            if not row or row[0] in (None, ""):
                continue
            master = str(row[0]).strip()
            display_name = str(row[1]).strip() if len(row) > 1 and row[1] not in (None, "") else master
            rows[normalized(master)] = display_name
        translations[sheet_name.lower()] = rows
    workbook.close()
    return translations


def build_translation_files(
    groups_path: Path,
    workbook_path: Path,
    legacy_path: Path,
) -> tuple[dict, dict, dict]:
    groups = json.loads(groups_path.read_text(encoding="utf-8"))
    legacy = json.loads(legacy_path.read_text(encoding="utf-8"))
    workbook = read_workbook_translations(workbook_path)
    alias_owners: dict[str, dict[str, list[str]]] = {}

    for namespace, entries in groups.items():
        owners: dict[str, list[str]] = defaultdict(list)
        for master, entry in entries.items():
            for alias in unique_values([master, *entry.get("sub", [])]):
                key = normalized(alias)
                if master not in owners[key]:
                    owners[key].append(master)
        alias_owners[namespace] = owners

    official_masters: dict[str, set[str]] = defaultdict(set)
    unmatched_legacy: list[dict[str, str]] = []
    ambiguous_legacy: list[dict[str, object]] = []
    for namespace, translations in legacy.items():
        owners = alias_owners.get(namespace, {})
        for tag, display_name in translations.items():
            candidates = owners.get(normalized(tag), [])
            if len(candidates) == 1:
                official_masters[namespace].add(candidates[0])
            elif not candidates:
                unmatched_legacy.append(
                    {"namespace": namespace, "tag": tag, "dispName": display_name}
                )
            else:
                ambiguous_legacy.append(
                    {"namespace": namespace, "tag": tag, "masters": candidates}
                )

    if ambiguous_legacy:
        raise RuntimeError(f"Legacy official tags have ambiguous owners: {ambiguous_legacy}")

    official: dict[str, dict[str, dict[str, object]]] = {}
    unofficial: dict[str, dict[str, dict[str, object]]] = {}
    for namespace, entries in groups.items():
        for master, entry in entries.items():
            display_name = workbook.get(namespace, {}).get(
                normalized(master), str(entry.get("dispName") or master).strip()
            )
            converted = {
                "dispName": display_name,
                "sub": unique_values([master, *entry.get("sub", [])]),
            }
            target = official if master in official_masters.get(namespace, set()) else unofficial
            target.setdefault(namespace, {})[master] = converted

    for item in unmatched_legacy:
        namespace = item["namespace"]
        tag = item["tag"]
        official.setdefault(namespace, {})[tag] = {
            "dispName": item["dispName"],
            "sub": [tag],
        }

    official_count = sum(len(entries) for entries in official.values())
    unofficial_count = sum(len(entries) for entries in unofficial.values())
    audit = {
        "sourceMasterGroups": sum(len(entries) for entries in groups.values()),
        "legacyOfficialTags": sum(len(entries) for entries in legacy.values()),
        "coveredOfficialMasterGroups": sum(len(entries) for entries in official_masters.values()),
        "standaloneOfficialTags": len(unmatched_legacy),
        "officialRecords": official_count,
        "unofficialRecords": unofficial_count,
        "combinedRecords": official_count + unofficial_count,
        "officialByNamespace": {key: len(value) for key, value in official.items()},
        "unofficialByNamespace": {key: len(value) for key, value in unofficial.items()},
        "workbookNamespaces": list(workbook),
        "untranslatedNamespaces": sorted(set(groups) - set(workbook)),
        "standaloneOfficial": unmatched_legacy,
    }
    return official, unofficial, audit


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--groups", type=Path, default=DEFAULT_GROUPS)
    parser.add_argument("--workbook", type=Path, default=DEFAULT_WORKBOOK)
    parser.add_argument("--legacy", type=Path, default=DEFAULT_LEGACY)
    parser.add_argument("--official-output", type=Path, default=DEFAULT_OFFICIAL)
    parser.add_argument("--unofficial-output", type=Path, default=DEFAULT_UNOFFICIAL)
    parser.add_argument("--audit-output", type=Path, default=DEFAULT_AUDIT)
    options = parser.parse_args()

    official, unofficial, audit = build_translation_files(
        options.groups, options.workbook, options.legacy
    )
    write_json(options.official_output, official)
    write_json(options.unofficial_output, unofficial)
    write_json(options.audit_output, audit)
    print(json.dumps(audit, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
