#!/usr/bin/env python3
"""Export taggroup-data.json to a multi-sheet Excel workbook."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.cell.cell import ILLEGAL_CHARACTERS_RE
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter


DEFAULT_INPUT = Path(__file__).with_name("taggroup-data.json")
DEFAULT_OUTPUT = Path(__file__).with_name("taggroup-data.xlsx")
HEADER_FILL = PatternFill("solid", fgColor="2F5597")
HEADER_FONT = Font(color="FFFFFF", bold=True)


def clean_cell(value: str) -> str:
    return ILLEGAL_CHARACTERS_RE.sub("", value)


def export_excel(input_path: Path, output_path: Path) -> dict[str, tuple[int, int]]:
    data = json.loads(input_path.read_text(encoding="utf-8"))
    workbook = Workbook()
    workbook.remove(workbook.active)
    workbook.properties.title = "E-Hentai Tag Groups"
    workbook.properties.subject = "Master tags and flattened child tags"
    workbook.properties.creator = "EViewer taggroup tool"
    workbook.properties.lastModifiedBy = "EViewer taggroup tool"
    summary: dict[str, tuple[int, int]] = {}

    for namespace, tags in data.items():
        worksheet = workbook.create_sheet(namespace)
        max_children = max((len(item["sub"]) for item in tags.values()), default=0)
        headers = ["小类", "显示名"] + [f"子类{i}" for i in range(1, max_children + 1)]
        worksheet.append(headers)

        for name, item in tags.items():
            children = [clean_cell(str(child)) for child in item["sub"]]
            worksheet.append([clean_cell(name), clean_cell(item["dispName"]), *children])

        for cell in worksheet[1]:
            cell.fill = HEADER_FILL
            cell.font = HEADER_FONT
            cell.alignment = Alignment(horizontal="center", vertical="center")

        worksheet.freeze_panes = "C2"
        worksheet.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{len(tags) + 1}"
        worksheet.sheet_view.showGridLines = False
        worksheet.row_dimensions[1].height = 24
        worksheet.column_dimensions["A"].width = 30
        worksheet.column_dimensions["B"].width = 30
        for column_index in range(3, len(headers) + 1):
            worksheet.column_dimensions[get_column_letter(column_index)].width = 22
        for row in worksheet.iter_rows(min_row=2):
            for cell in row:
                cell.alignment = Alignment(vertical="top", wrap_text=True)

        summary[namespace] = (len(tags), max_children)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_output = output_path.with_suffix(output_path.suffix + ".tmp")
    workbook.save(temporary_output)
    temporary_output.replace(output_path)
    return summary


def validate_workbook(output_path: Path, summary: dict[str, tuple[int, int]]) -> None:
    workbook = load_workbook(output_path, read_only=True, data_only=True)
    if workbook.sheetnames != list(summary):
        raise RuntimeError("Generated sheet names do not match JSON namespaces")
    for namespace, (tag_count, max_children) in summary.items():
        worksheet = workbook[namespace]
        if worksheet.max_row != tag_count + 1 or worksheet.max_column != max_children + 2:
            raise RuntimeError(
                f"Invalid dimensions for {namespace}: "
                f"{worksheet.max_row}x{worksheet.max_column}"
            )
    workbook.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    options = parser.parse_args()
    if not options.input.exists():
        raise SystemExit(f"Input file does not exist: {options.input}")

    summary = export_excel(options.input, options.output)
    validate_workbook(options.output, summary)
    total = sum(tag_count for tag_count, _ in summary.values())
    print(f"wrote {total} rows across {len(summary)} sheets to {options.output}")
    for namespace, (tag_count, max_children) in summary.items():
        print(f"{namespace}: rows={tag_count}, child_columns={max_children}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
