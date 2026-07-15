#!/usr/bin/env python3
"""Collect E-Hentai master tags and their child tags from the taggroup tool."""

from __future__ import annotations

import argparse
import hashlib
import html
import http.cookiejar
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable


BASE_URL = "https://repo.e-hentai.org/tools/taggroup"
LOGIN_REQUIRED_TEXT = "You must be logged in to access tools."
DEFAULT_OUTPUT = Path(__file__).with_name("taggroup-data.json")
DEFAULT_CACHE_DIR = Path(__file__).with_name(".cache")


@dataclass(frozen=True)
class Link:
    href: str
    text: str


@dataclass(frozen=True)
class MasterTagRef:
    master_id: str
    label: str


class TagGroupHTMLParser(HTMLParser):
    """Collect links and values from the taggroup show selector."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[Link] = []
        self.show_values: set[str] = set()
        self._active_href: str | None = None
        self._active_text: list[str] = []
        self._show_select_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "a" and attributes.get("href"):
            self._active_href = attributes["href"]
            self._active_text = []
        elif tag == "select" and attributes.get("name", "").lower() == "show":
            self._show_select_depth += 1
        elif tag == "option" and self._show_select_depth and attributes.get("value"):
            value = attributes["value"] or ""
            match = re.search(r"(?:show=)?(\d+)$", value)
            if match:
                self.show_values.add(match.group(1))
        elif attributes.get("name", "").lower() == "show" and attributes.get("value"):
            value = attributes["value"] or ""
            if value.isdigit():
                self.show_values.add(value)

    def handle_data(self, data: str) -> None:
        if self._active_href is not None:
            self._active_text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._active_href is not None:
            self.links.append(Link(self._active_href, normalize_text("".join(self._active_text))))
            self._active_href = None
            self._active_text = []
        elif tag == "select" and self._show_select_depth:
            self._show_select_depth -= 1


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def parse_html(document: str) -> TagGroupHTMLParser:
    parser = TagGroupHTMLParser()
    parser.feed(document)
    parser.close()
    return parser


class CachedFetcher:
    """Fetch authenticated pages with retries, a shared rate limit, and disk cache."""

    def __init__(
        self,
        cookie_header: str,
        cookie_file: Path | None,
        cache_dir: Path,
        delay: float,
        refresh: bool,
    ) -> None:
        self.cache_dir = cache_dir
        self.delay = delay
        self.refresh = refresh
        self._request_lock = threading.Lock()
        self._last_request_at = 0.0
        handlers: list[urllib.request.BaseHandler] = []

        if cookie_file and is_netscape_cookie_file(cookie_file):
            cookie_jar = http.cookiejar.MozillaCookieJar(str(cookie_file))
            cookie_jar.load(ignore_discard=True, ignore_expires=True)
            handlers.append(urllib.request.HTTPCookieProcessor(cookie_jar))

        self.opener = urllib.request.build_opener(*handlers)
        self.headers = {
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Encoding": "identity",
            "User-Agent": "EViewer-TagGroup-Collector/1.0",
        }
        if cookie_header:
            self.headers["Cookie"] = cookie_header

    def get(self, url: str) -> str:
        cache_path = self.cache_dir / f"{hashlib.sha256(url.encode('utf-8')).hexdigest()}.html"
        if cache_path.exists() and not self.refresh:
            return cache_path.read_text(encoding="utf-8")

        for attempt in range(1, 4):
            try:
                with self._request_lock:
                    wait = self.delay - (time.monotonic() - self._last_request_at)
                    if wait > 0:
                        time.sleep(wait)
                    request = urllib.request.Request(url, headers=self.headers)
                    self._last_request_at = time.monotonic()

                with self.opener.open(request, timeout=30) as response:
                    document = response.read().decode("utf-8", errors="replace")
                if LOGIN_REQUIRED_TEXT in document:
                    raise PermissionError(
                        "The taggroup tool requires login. Provide EH_COOKIE or --cookie-file."
                    )

                self.cache_dir.mkdir(parents=True, exist_ok=True)
                cache_path.write_text(document, encoding="utf-8")
                return document
            except PermissionError:
                raise
            except (OSError, urllib.error.URLError) as error:
                if attempt == 3:
                    raise RuntimeError(f"Failed to fetch {url}: {error}") from error
                time.sleep(2 ** (attempt - 1))

        raise RuntimeError(f"Failed to fetch {url}")


def is_netscape_cookie_file(cookie_file: Path) -> bool:
    with cookie_file.open("r", encoding="utf-8", errors="replace") as stream:
        return stream.readline().startswith("# Netscape HTTP Cookie File")


def read_cookie_header(cookie_argument: str, cookie_file: Path | None) -> str:
    if cookie_argument:
        return cookie_argument.strip()
    if not cookie_file or is_netscape_cookie_file(cookie_file):
        return ""
    return cookie_file.read_text(encoding="utf-8").strip()


class TagGroupCollector:
    def __init__(self, fetcher: CachedFetcher, workers: int, output: Path) -> None:
        self.fetcher = fetcher
        self.workers = workers
        self.output = output

    def collect(self, requested_show_ids: list[str]) -> dict[str, dict[str, dict[str, object]]]:
        show_ids = requested_show_ids or self._discover_show_ids()
        if not show_ids:
            raise RuntimeError("No tag groups were found. Pass one or more --show values explicitly.")

        master_refs: dict[str, MasterTagRef] = {}
        for show_id in show_ids:
            group_refs = self._collect_group_master_tags(show_id)
            master_refs.update({reference.master_id: reference for reference in group_refs})
            print(f"show={show_id}: found {len(group_refs)} master tags", flush=True)

        result: dict[str, dict[str, dict[str, object]]] = {}
        completed = 0
        with ThreadPoolExecutor(max_workers=self.workers) as executor:
            futures = {
                executor.submit(self._collect_master_tag, reference): reference
                for reference in master_refs.values()
            }
            for future in as_completed(futures):
                namespace, name, display_name, child_tags = future.result()
                result.setdefault(namespace, {})[name] = {
                    "dispName": display_name,
                    "sub": child_tags,
                }
                completed += 1
                if completed % 100 == 0 or completed == len(master_refs):
                    self._write_result(result)
                    print(f"master tags: {completed}/{len(master_refs)}", flush=True)

        return result

    def _discover_show_ids(self) -> list[str]:
        document = self.fetcher.get(BASE_URL)
        parser = parse_html(document)
        show_ids = set(parser.show_values)
        for link in parser.links:
            query = urllib.parse.parse_qs(urllib.parse.urlparse(link.href).query)
            show_ids.update(query.get("show", []))
        show_ids.update(re.findall(r"[?&]show=(\d+)", document))
        return sorted((value for value in show_ids if value.isdigit()), key=int)

    def _collect_group_master_tags(self, show_id: str) -> list[MasterTagRef]:
        pending = [f"{BASE_URL}?show={urllib.parse.quote(show_id)}"]
        visited: set[str] = set()
        master_refs: dict[str, MasterTagRef] = {}

        while pending:
            url = pending.pop(0)
            if url in visited:
                continue
            visited.add(url)
            parser = parse_html(self.fetcher.get(url))

            for link in parser.links:
                absolute_url = urllib.parse.urljoin(BASE_URL, link.href)
                parsed_url = urllib.parse.urlparse(absolute_url)
                if parsed_url.path.rstrip("/") != "/tools/taggroup":
                    continue
                query = urllib.parse.parse_qs(parsed_url.query)
                master_ids = query.get("mastertag", [])
                if master_ids:
                    master_id = master_ids[0]
                    master_refs.setdefault(master_id, MasterTagRef(master_id, link.text))
                elif query.get("show") == [show_id]:
                    normalized = urllib.parse.urlunparse(parsed_url._replace(fragment=""))
                    if normalized not in visited and normalized not in pending:
                        pending.append(normalized)

        return list(master_refs.values())

    def _collect_master_tag(self, reference: MasterTagRef) -> tuple[str, str, str, list[str]]:
        url = f"{BASE_URL}?mastertag={urllib.parse.quote(reference.master_id)}"
        parser = parse_html(self.fetcher.get(url))
        namespace, name = split_master_label(reference.label)
        child_tags: list[str] = []

        for link in parser.links:
            parsed_url = urllib.parse.urlparse(urllib.parse.urljoin(url, link.href))
            if parsed_url.hostname not in {"e-hentai.org", "www.e-hentai.org", "exhentai.org"}:
                continue
            if not parsed_url.path.startswith("/tag/"):
                continue
            query = urllib.parse.parse_qs(parsed_url.query)
            if query.get("skip_mastertags") != ["1"]:
                continue

            raw_tag = urllib.parse.unquote_plus(parsed_url.path.removeprefix("/tag/")).strip("/")
            displayed_tag = normalize_text(link.text) or raw_tag
            alias_namespace, alias_name = split_master_label(displayed_tag, require_namespace=False)
            if not alias_namespace and ":" in raw_tag:
                alias_namespace, raw_name = split_master_label(raw_tag, require_namespace=False)
                if displayed_tag == raw_tag:
                    alias_name = raw_name
            if alias_namespace and not namespace:
                namespace = alias_namespace
            child_tags.append(alias_name)

        if not namespace or not name:
            for child_tag in child_tags:
                candidate_namespace, candidate_name = split_master_label(
                    child_tag, require_namespace=False
                )
                if candidate_namespace:
                    namespace, name = candidate_namespace, candidate_name
                    break
        if not namespace or not name:
            raise RuntimeError(
                f"Could not determine namespace/name for mastertag={reference.master_id} "
                f"from label {reference.label!r}"
            )

        normalized_children: list[str] = [name]
        for child_tag in child_tags:
            alias_namespace, alias_name = split_master_label(child_tag, require_namespace=False)
            if alias_namespace == namespace:
                child_tag = alias_name
            if child_tag and child_tag not in normalized_children:
                normalized_children.append(child_tag)
        return namespace, name, name, normalized_children

    def _write_result(self, result: dict[str, dict[str, dict[str, object]]]) -> None:
        ordered = {
            namespace: dict(sorted(tags.items()))
            for namespace, tags in sorted(result.items())
        }
        self.output.parent.mkdir(parents=True, exist_ok=True)
        temporary_output = self.output.with_suffix(self.output.suffix + ".tmp")
        temporary_output.write_text(
            json.dumps(ordered, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        temporary_output.replace(self.output)


def split_master_label(label: str, require_namespace: bool = True) -> tuple[str, str]:
    cleaned = normalize_text(label).strip("[] ")
    if ":" in cleaned:
        namespace, name = cleaned.split(":", 1)
        return namespace.strip().lower(), name.strip()
    return ("", "") if require_namespace else ("", cleaned)


def parse_arguments(arguments: Iterable[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--show", action="append", default=[], help="Collect only this show ID")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE_DIR)
    parser.add_argument("--cookie", default=os.environ.get("EH_COOKIE", ""))
    parser.add_argument("--cookie-file", type=Path)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--delay", type=float, default=0.25, help="Seconds between requests")
    parser.add_argument("--refresh", action="store_true", help="Ignore cached HTML")
    return parser.parse_args(list(arguments))


def main(arguments: Iterable[str] | None = None) -> int:
    options = parse_arguments(arguments if arguments is not None else sys.argv[1:])
    if options.workers < 1 or options.delay < 0:
        raise SystemExit("--workers must be positive and --delay cannot be negative")
    if options.cookie_file and not options.cookie_file.exists():
        raise SystemExit(f"Cookie file does not exist: {options.cookie_file}")

    cookie_header = read_cookie_header(options.cookie, options.cookie_file)
    fetcher = CachedFetcher(
        cookie_header=cookie_header,
        cookie_file=options.cookie_file,
        cache_dir=options.cache_dir,
        delay=options.delay,
        refresh=options.refresh,
    )
    collector = TagGroupCollector(fetcher, options.workers, options.output)
    try:
        result = collector.collect(options.show)
    except (PermissionError, RuntimeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1

    collector._write_result(result)
    total = sum(len(tags) for tags in result.values())
    print(f"wrote {total} master tags to {options.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
