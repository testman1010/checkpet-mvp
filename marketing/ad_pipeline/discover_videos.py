#!/usr/bin/env python3
"""
discover_videos.py — TikTok Viral Pet Health Video Discovery Pipeline

Searches TikTok for viral pet health content using browser automation,
scrapes video metadata (views, likes, URL), ranks by virality, and
downloads the top N videos using yt-dlp.

Usage:
    python discover_videos.py
    python discover_videos.py --top-n 10 --output videos/
    python discover_videos.py --queries-only          # just show URLs, don't download
    python discover_videos.py --from-file urls.txt    # download from URL list
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn

console = Console()

# ─── Search Queries ─────────────────────────────────────────────────────
# Curated queries targeting viral pet health content relevant to CheckPet's
# audience (anxious pet parents, emergency scenarios, pet health tips).
SEARCH_QUERIES = [
    "dog ate something emergency",
    "pet emergency signs",
    "when to take dog to vet",
    "cat throwing up should I worry",
    "puppy health tips",
    "vet reacts pet emergency",
    "dog owner mistake vet",
    "pet health hack",
    "is my dog sick",
    "emergency vet visit story",
    "pet parent anxiety",
    "dog symptoms to watch for",
]


# ─── Helpers ────────────────────────────────────────────────────────────

def parse_view_count(view_str: str) -> int:
    """Parse TikTok view count strings like '1.2M', '450K', '5432' into integers."""
    if not view_str:
        return 0
    view_str = view_str.strip().upper().replace(",", "")
    try:
        if "B" in view_str:
            return int(float(view_str.replace("B", "")) * 1_000_000_000)
        elif "M" in view_str:
            return int(float(view_str.replace("M", "")) * 1_000_000)
        elif "K" in view_str:
            return int(float(view_str.replace("K", "")) * 1_000)
        else:
            return int(float(view_str))
    except (ValueError, TypeError):
        return 0


def format_views(count: int) -> str:
    """Format view count for display."""
    if count >= 1_000_000:
        return f"{count / 1_000_000:.1f}M"
    elif count >= 1_000:
        return f"{count / 1_000:.1f}K"
    return str(count)


def deduplicate_videos(videos: list[dict]) -> list[dict]:
    """Remove duplicate videos by video ID."""
    seen = set()
    unique = []
    for v in videos:
        url = v.get("url", "")
        # Extract video ID from URL
        match = re.search(r'/video/(\d+)', url)
        video_id = match.group(1) if match else url.rstrip("/").split("/")[-1].split("?")[0]
        if video_id and video_id not in seen:
            seen.add(video_id)
            unique.append(v)
    return unique


# ─── Browser-Based TikTok Search ───────────────────────────────────────

def search_tiktok_browser(queries: list[str], max_per_query: int = 15) -> list[dict]:
    """
    Use Playwright to search TikTok and extract video metadata.
    This is more reliable than yt-dlp since it uses a real browser.
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        console.print("[red]Playwright not installed. Run: pip install playwright && python -m playwright install chromium[/red]")
        return []

    all_videos = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        )

        for query in queries:
            page = context.new_page()
            search_url = f"https://www.tiktok.com/search/video?q={query.replace(' ', '%20')}"

            console.print(f"  🔍 Searching: [cyan]{query}[/cyan]")

            try:
                page.goto(search_url, wait_until="networkidle", timeout=30000)
                time.sleep(3)  # Let dynamic content load

                # Scroll down to load more results
                for _ in range(3):
                    page.evaluate("window.scrollBy(0, 1000)")
                    time.sleep(1.5)

                # Extract video cards from search results
                # TikTok search results have video links with view counts
                video_links = page.query_selector_all('a[href*="/video/"]')

                seen_urls = set()
                for link in video_links[:max_per_query * 2]:  # Grab extra, dedupe later
                    try:
                        href = link.get_attribute("href")
                        if not href or "/video/" not in href:
                            continue

                        # Normalize URL
                        if href.startswith("/"):
                            href = f"https://www.tiktok.com{href}"

                        # Skip duplicates within this query
                        video_id_match = re.search(r'/video/(\d+)', href)
                        if not video_id_match:
                            continue
                        video_id = video_id_match.group(1)
                        if video_id in seen_urls:
                            continue
                        seen_urls.add(video_id)

                        # Try to get view count from the card
                        # TikTok shows views on video thumbnails
                        view_text = ""
                        try:
                            # Look for view count text near this link
                            parent = link.query_selector("xpath=..")
                            if parent:
                                # Try to find text with view count patterns
                                all_text = parent.inner_text()
                                view_match = re.search(r'([\d.]+[KkMmBb]?)\s*(views?)?', all_text)
                                if view_match:
                                    view_text = view_match.group(1)
                        except Exception:
                            pass

                        # Try to get creator name from URL
                        creator_match = re.search(r'@([^/]+)', href)
                        creator = creator_match.group(1) if creator_match else "Unknown"

                        all_videos.append({
                            "url": href,
                            "title": "",
                            "view_count": parse_view_count(view_text),
                            "like_count": 0,
                            "creator": creator,
                            "duration": 0,
                            "query": query,
                            "source": "browser_search",
                        })

                    except Exception:
                        continue

                found_count = len(seen_urls)
                if found_count > 0:
                    console.print(f"    [green]✓[/green] Found {found_count} videos")
                else:
                    console.print(f"    [yellow]⚠[/yellow] No results (may need CAPTCHA)")

            except Exception as e:
                console.print(f"    [red]✗[/red] Search failed: {str(e)[:80]}")
            finally:
                page.close()

            time.sleep(2)  # Rate limit between queries

        browser.close()

    return all_videos


def enrich_with_metadata(videos: list[dict], max_enrich: int = 30) -> list[dict]:
    """
    Use yt-dlp to get accurate view counts and metadata for discovered URLs.
    This is needed because browser scraping may not capture all metadata.
    """
    console.print(f"\n[bold]Enriching metadata for {min(len(videos), max_enrich)} videos...[/bold]\n")

    enriched = []
    for i, video in enumerate(videos[:max_enrich]):
        url = video.get("url", "")
        if not url:
            continue

        try:
            result = subprocess.run(
                [
                    sys.executable, "-m", "yt_dlp",
                    "--dump-json",
                    "--no-warnings",
                    "--quiet",
                    "--no-playlist",
                    url,
                ],
                capture_output=True,
                text=True,
                timeout=20,
            )

            if result.returncode == 0 and result.stdout.strip():
                data = json.loads(result.stdout.strip().split("\n")[0])
                video["view_count"] = data.get("view_count", 0) or video.get("view_count", 0)
                video["like_count"] = data.get("like_count", 0) or 0
                video["comment_count"] = data.get("comment_count", 0) or 0
                video["title"] = data.get("title") or data.get("description", "")[:100] or video.get("title", "")
                video["creator"] = data.get("uploader") or data.get("creator") or video.get("creator", "Unknown")
                video["duration"] = data.get("duration", 0) or 0
                video["enriched"] = True

                views = format_views(video["view_count"])
                console.print(f"  [green]✓[/green] @{video['creator']} — {views} views")
            else:
                video["enriched"] = False

        except subprocess.TimeoutExpired:
            video["enriched"] = False
        except Exception:
            video["enriched"] = False

        enriched.append(video)
        time.sleep(0.3)  # Light rate limiting

    return enriched


def download_videos(videos: list[dict], output_dir: str, max_videos: int = 10) -> list[dict]:
    """Download the top N videos using yt-dlp."""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    downloaded = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task("Downloading videos...", total=min(max_videos, len(videos)))

        for i, video in enumerate(videos[:max_videos]):
            url = video["url"]
            if not url:
                progress.advance(task)
                continue

            rank = i + 1
            creator = re.sub(r'[^\w\-]', '_', video.get("creator", "unknown"))[:30]
            views = format_views(video.get("view_count", 0))
            filename = f"{rank:02d}_{creator}_{views}"

            progress.update(task, description=f"Downloading [cyan]#{rank}[/cyan] ({views} views)...")

            try:
                result = subprocess.run(
                    [
                        sys.executable, "-m", "yt_dlp",
                        "-o", str(output_path / f"{filename}.%(ext)s"),
                        "--format", "best[ext=mp4]/best",
                        "--no-warnings",
                        "--quiet",
                        "--no-playlist",
                        url,
                    ],
                    capture_output=True,
                    text=True,
                    timeout=120,
                )

                if result.returncode == 0:
                    matches = list(output_path.glob(f"{filename}.*"))
                    if matches:
                        video["local_path"] = str(matches[0])
                        downloaded.append(video)
                        size_mb = matches[0].stat().st_size / (1024 * 1024)
                        console.print(
                            f"  [green]✓[/green] #{rank} @{video['creator']} "
                            f"({views} views, {size_mb:.1f}MB) → {matches[0].name}"
                        )
                    else:
                        console.print(f"  [yellow]⚠[/yellow] #{rank} — Downloaded but file not found")
                else:
                    err = result.stderr.strip()[:100] if result.stderr else "Unknown error"
                    console.print(f"  [red]✗[/red] #{rank} — {err}")

            except subprocess.TimeoutExpired:
                console.print(f"  [yellow]⏱[/yellow] #{rank} — Download timed out")
            except Exception as e:
                console.print(f"  [red]✗[/red] #{rank} — {e}")

            progress.advance(task)
            time.sleep(0.5)

    return downloaded


# ─── Main Pipeline ─────────────────────────────────────────────────────

def run_pipeline(top_n: int, output_dir: str, queries_only: bool, custom_queries: list[str] | None):
    """Run the full discovery → enrich → rank → download pipeline."""

    queries = custom_queries or SEARCH_QUERIES

    console.print(f"\n[bold cyan]🔍 TikTok Pet Health Video Discovery[/bold cyan]")
    console.print(f"   Queries:   {len(queries)}")
    console.print(f"   Top-N:     {top_n}")
    console.print(f"   Output:    {output_dir}/")
    console.print(f"   Strategy:  Browser search → metadata enrichment → rank → download")
    console.print()

    # ── Step 1: Discover videos via browser ──
    console.print("[bold]Step 1: Searching TikTok via browser...[/bold]\n")
    all_videos = search_tiktok_browser(queries)

    if not all_videos:
        console.print("\n[red]No videos found via browser search.[/red]")
        console.print("This may be due to TikTok requiring login or CAPTCHA.\n")
        console.print("[bold]Alternatives:[/bold]")
        console.print("  1. Create 'manual_urls.txt' with TikTok URLs (one per line)")
        console.print("     Then run: python discover_videos.py --from-file manual_urls.txt")
        console.print("  2. Browse TikTok manually, copy URLs of pet health videos")
        console.print("     Paste them into manual_urls.txt and use --from-file")
        sys.exit(1)

    # ── Step 2: Deduplicate ──
    unique_videos = deduplicate_videos(all_videos)
    console.print(f"\n  📊 Found {len(all_videos)} results, {len(unique_videos)} unique\n")

    # ── Step 3: Enrich metadata using yt-dlp ──
    # Enrich more than top_n so we have good data to rank by
    enriched_videos = enrich_with_metadata(unique_videos, max_enrich=min(len(unique_videos), top_n * 3))

    # ── Step 4: Rank by view count ──
    enriched_videos.sort(
        key=lambda v: (v.get("view_count", 0), v.get("like_count", 0)),
        reverse=True,
    )

    # ── Display rankings ──
    display_count = min(top_n, len(enriched_videos))
    table = Table(
        title=f"🏆 Top {display_count} Viral Pet Health Videos",
        title_style="bold green",
        show_lines=True,
    )
    table.add_column("Rank", style="dim", width=5, justify="center")
    table.add_column("Creator", style="cyan", max_width=20)
    table.add_column("Views", style="green", justify="right")
    table.add_column("Likes", style="magenta", justify="right")
    table.add_column("Dur", justify="center", width=5)
    table.add_column("Query", style="dim", max_width=25)
    table.add_column("URL", style="dim", max_width=45)

    for i, video in enumerate(enriched_videos[:display_count], 1):
        duration = f"{video.get('duration', 0)}s" if video.get('duration') else "?"
        url_display = video.get("url", "")
        if len(url_display) > 45:
            url_display = url_display[:42] + "..."
        table.add_row(
            str(i),
            f"@{video.get('creator', '?')}",
            format_views(video.get("view_count", 0)),
            format_views(video.get("like_count", 0)),
            duration,
            video.get("query", ""),
            url_display,
        )

    console.print(table)

    # ── Save discovery results ──
    results_dir = Path(output_dir).parent / "results" if "videos" in output_dir else Path("results")
    results_dir.mkdir(parents=True, exist_ok=True)
    discovery_path = results_dir / "discovered_videos.json"

    discovery_data = {
        "metadata": {
            "queries": queries,
            "total_found": len(all_videos),
            "unique_found": len(unique_videos),
            "enriched": sum(1 for v in enriched_videos if v.get("enriched")),
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        },
        "videos": [
            {k: v for k, v in video.items() if k != "embedding"}
            for video in enriched_videos[:top_n * 2]
        ],
    }

    with open(discovery_path, "w") as f:
        json.dump(discovery_data, f, indent=2)

    console.print(f"\n[dim]Discovery results saved to {discovery_path}[/dim]\n")

    if queries_only:
        console.print("[yellow]--queries-only mode: skipping downloads.[/yellow]")
        urls_path = results_dir / "video_urls.txt"
        with open(urls_path, "w") as f:
            for v in enriched_videos[:top_n]:
                f.write(v.get("url", "") + "\n")
        console.print(f"URLs saved to {urls_path}")
        return

    # ── Step 5: Download top videos ──
    console.print(f"[bold]Step 5: Downloading top {top_n} videos...[/bold]\n")
    downloaded = download_videos(enriched_videos, output_dir, top_n)

    console.print(f"\n[bold green]✅ Downloaded {len(downloaded)}/{top_n} videos to {output_dir}/[/bold green]")

    if downloaded:
        console.print(
            f"\n[dim]Next step: Run the embedding pipeline:[/dim]\n"
            f"  python embed_and_match.py --videos {output_dir}\n"
        )


def run_from_file(urls_file: str, top_n: int, output_dir: str):
    """Download videos from a manually-curated URL file."""
    urls_path = Path(urls_file)
    if not urls_path.exists():
        console.print(f"[red]Error:[/red] File '{urls_file}' not found.")
        sys.exit(1)

    urls = [line.strip() for line in open(urls_path) if line.strip() and not line.startswith("#")]

    if not urls:
        console.print(f"[red]Error:[/red] No URLs found in '{urls_file}'.")
        sys.exit(1)

    console.print(f"\n[bold cyan]📋 Manual URL Mode[/bold cyan]")
    console.print(f"   URLs:    {len(urls)}")
    console.print(f"   Output:  {output_dir}/")
    console.print()

    # Get metadata for each URL
    videos = []
    console.print("[bold]Fetching metadata...[/bold]\n")

    for url in urls[:top_n]:
        try:
            result = subprocess.run(
                [
                    sys.executable, "-m", "yt_dlp",
                    "--dump-json",
                    "--no-warnings",
                    "--quiet",
                    "--no-playlist",
                    url,
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode == 0 and result.stdout.strip():
                data = json.loads(result.stdout.strip().split("\n")[0])
                videos.append({
                    "url": url,
                    "title": data.get("title", "Untitled"),
                    "view_count": data.get("view_count", 0) or 0,
                    "like_count": data.get("like_count", 0) or 0,
                    "comment_count": data.get("comment_count", 0) or 0,
                    "creator": data.get("uploader") or data.get("channel", "Unknown"),
                    "duration": data.get("duration", 0),
                    "query": "manual",
                    "source": "manual_url",
                })
                views = format_views(data.get("view_count", 0))
                console.print(f"  [green]✓[/green] @{data.get('uploader', '?')} — {views} views")
            else:
                videos.append({
                    "url": url, "title": "Untitled", "view_count": 0,
                    "creator": "Unknown", "query": "manual", "source": "manual_url",
                })
                console.print(f"  [yellow]⚠[/yellow] Metadata unavailable: {url[:50]}...")

        except Exception as e:
            console.print(f"  [red]✗[/red] {url[:50]}...: {e}")
            videos.append({
                "url": url, "view_count": 0, "creator": "Unknown",
                "query": "manual", "source": "manual_url",
            })

    # Sort by views
    videos.sort(key=lambda v: v.get("view_count", 0), reverse=True)

    # Download
    console.print(f"\n[bold]Downloading {len(videos)} videos...[/bold]\n")
    downloaded = download_videos(videos, output_dir, top_n)

    console.print(f"\n[bold green]✅ Downloaded {len(downloaded)}/{len(videos)} videos to {output_dir}/[/bold green]\n")

    if downloaded:
        console.print(
            f"[dim]Next step: Run the embedding pipeline:[/dim]\n"
            f"  python embed_and_match.py --videos {output_dir}\n"
        )


# ─── CLI ────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Discover and download top viral pet health TikTok videos"
    )
    parser.add_argument(
        "--top-n", type=int, default=10,
        help="Number of top videos to download (default: 10)"
    )
    parser.add_argument(
        "--output", default="videos",
        help="Output directory for downloaded videos (default: videos/)"
    )
    parser.add_argument(
        "--queries-only", action="store_true",
        help="Only discover and rank — don't download"
    )
    parser.add_argument(
        "--from-file", type=str, default=None,
        help="Path to a text file with one TikTok URL per line (manual mode)"
    )
    parser.add_argument(
        "--queries", nargs="+", default=None,
        help="Custom search queries (overrides defaults)"
    )

    args = parser.parse_args()

    # Load .env
    load_dotenv()
    load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env.local")

    # Check yt-dlp is available
    try:
        subprocess.run(
            [sys.executable, "-m", "yt_dlp", "--version"],
            capture_output=True, timeout=5,
        )
    except Exception:
        console.print("[red]Error:[/red] yt-dlp not found. Install it: pip install yt-dlp")
        sys.exit(1)

    if args.from_file:
        run_from_file(args.from_file, args.top_n, args.output)
    else:
        run_pipeline(args.top_n, args.output, args.queries_only, args.queries)


if __name__ == "__main__":
    main()
