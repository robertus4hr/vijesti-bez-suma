#!/usr/bin/env python3
"""Fetch and normalize the Index.hr RSS feed into a small JSON file."""

from __future__ import annotations

import argparse
import email.utils
import html
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

FEED_URL = "https://www.index.hr/rss"
USER_AGENT = "VijestiBezSuma/1.0 (personal RSS reader)"


class TextOnly(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def plain_text(value: str | None) -> str:
    if not value:
        return ""
    parser = TextOnly()
    parser.feed(value)
    return re.sub(r"\s+", " ", html.unescape(" ".join(parser.parts))).strip()


def child_text(item: ET.Element, name: str) -> str:
    for child in item:
        if child.tag.rsplit("}", 1)[-1] == name:
            return "".join(child.itertext()).strip()
    return ""


def iso_date(value: str) -> str:
    if value:
        try:
            parsed = email.utils.parsedate_to_datetime(value)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc).isoformat()
        except (TypeError, ValueError, OverflowError):
            pass
    return ""


def fetch() -> bytes:
    request = urllib.request.Request(
        FEED_URL,
        headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/xml;q=0.9, */*;q=0.8"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        if response.status != 200:
            raise RuntimeError(f"RSS server returned HTTP {response.status}")
        return response.read()


def normalize(xml_data: bytes) -> dict[str, object]:
    root = ET.fromstring(xml_data)
    items: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in root.findall("./channel/item"):
        link = child_text(item, "link")
        guid = child_text(item, "guid") or link
        if not link or guid in seen:
            continue
        seen.add(guid)
        description = child_text(item, "description")
        content = child_text(item, "content")
        summary = plain_text(content) or plain_text(description)
        items.append(
            {
                "id": guid,
                "title": plain_text(child_text(item, "title")),
                "url": link,
                "category": plain_text(child_text(item, "category")) or "Ostalo",
                "published": iso_date(child_text(item, "pubDate")),
                "summary": summary,
            }
        )

    items.sort(key=lambda item: item["published"], reverse=True)
    if not items:
        raise RuntimeError("RSS feed contains no usable news items")
    return {
        "source": "Index.hr",
        "sourceUrl": FEED_URL,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "items": items[:150],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="data/feed.json", help="Output JSON path")
    args = parser.parse_args()
    output = Path(args.output)
    try:
        data = normalize(fetch())
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        print(f"Wrote {len(data['items'])} news items to {output}")
        return 0
    except Exception as exc:  # Keep a failed scheduled run visible in Actions.
        print(f"Feed update failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
