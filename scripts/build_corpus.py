"""Async postmortem corpus builder — fetches, chunks, and indexes incident reports."""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import asyncio
import re

import httpx
import trafilatura

from core import vector_store

POSTMORTEM_README_URL = (
    "https://raw.githubusercontent.com/danluu/post-mortems/master/README.md"
)
MAX_URLS = 150
REQUEST_DELAY = 0.3
USER_AGENT = "Compass/1.0 Research Bot"


def _extract_urls(content: str) -> list[str]:
    """Extract and deduplicate postmortem article URLs from README content."""
    raw_urls = re.findall(r"https?://[^\s\)\]\"]+", content)
    seen: set[str] = set()
    urls: list[str] = []
    for url in raw_urls:
        url = url.rstrip(".,;)")
        if "github.com" in url.lower():
            continue
        if url not in seen:
            seen.add(url)
            urls.append(url)
    return urls


def _split_into_chunks(text: str, url: str) -> list[dict]:
    """Split extracted article text into ~150-word chunks."""
    sentences = text.split(". ")
    chunks: list[dict] = []
    current_chunk: list[str] = []
    word_count = 0

    for sent in sentences:
        current_chunk.append(sent)
        word_count += len(sent.split())
        if word_count >= 150:
            chunks.append(
                {
                    "text": ". ".join(current_chunk) + ".",
                    "url": url,
                    "chunk_index": len(chunks),
                }
            )
            current_chunk = []
            word_count = 0

    if current_chunk:
        chunks.append(
            {
                "text": ". ".join(current_chunk),
                "url": url,
                "chunk_index": len(chunks),
            }
        )

    return chunks


async def _fetch_and_chunk(
    client: httpx.AsyncClient, url: str, index: int, total: int
) -> list[dict]:
    """Fetch a single URL and return text chunks, or empty list on failure."""
    if index % 10 == 0:
        print(f"  [{index}/{total}] {url[:60]}")

    try:
        response = await client.get(url)
        if response.status_code != 200:
            return []

        extracted = trafilatura.extract(response.text)
        if extracted is None or len(extracted) < 200:
            return []

        return _split_into_chunks(extracted, url)
    except Exception:
        return []
    finally:
        await asyncio.sleep(REQUEST_DELAY)


async def build_corpus() -> None:
    """Fetch postmortem articles and index them into ChromaDB."""
    async with httpx.AsyncClient(
        timeout=15, follow_redirects=True, headers={"User-Agent": USER_AGENT}
    ) as client:
        readme_response = await client.get(POSTMORTEM_README_URL)
        readme_response.raise_for_status()
        urls = _extract_urls(readme_response.text)[:MAX_URLS]
        print(f"Found {len(urls)} unique postmortem URLs")

        all_chunks: list[dict] = []
        sources = 0

        for i, url in enumerate(urls, start=1):
            chunks = await _fetch_and_chunk(client, url, i, len(urls))
            if chunks:
                all_chunks.extend(chunks)
                sources += 1

    total = vector_store.index_chunks(all_chunks)
    print(f"Indexed {total} chunks from {sources} sources")

    results = vector_store.search_incidents(
        "redis connection failure production outage single maintainer"
    )
    print(f"Verification search returned {len(results)} results")
    if results:
        print(
            f"  Top match ({results[0]['similarity']}): "
            f"{results[0]['excerpt'][:100]}"
        )


def main() -> None:
    """Entry point for the corpus build script."""
    backend_dir = os.path.join(os.path.dirname(__file__), "..", "backend")
    os.chdir(backend_dir)
    try:
        asyncio.run(build_corpus())
    except KeyboardInterrupt:
        print("\nInterrupted — partial progress preserved in ChromaDB.")


if __name__ == "__main__":
    main()
