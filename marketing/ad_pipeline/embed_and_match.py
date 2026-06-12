#!/usr/bin/env python3
"""
embed_and_match.py — TikTok Ad Reverse-Engineering Pipeline (Step 1)

Embeds TikTok ad videos and CheckPet value propositions into the same
vector space using Gemini Embedding 2, then computes a cross-modal
cosine similarity matrix to find which winning ads best align with
each value proposition.

Usage:
    python embed_and_match.py
    python embed_and_match.py --videos path/to/videos --props value_props.json
    python embed_and_match.py --dimensions 768   # faster, smaller embeddings
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

import numpy as np
from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn

from google import genai
from google.genai import types

# ─── Constants ──────────────────────────────────────────────────────────
EMBEDDING_MODEL = "gemini-embedding-2-preview"
SUPPORTED_VIDEO_EXTS = {".mp4", ".mov"}
MAX_VIDEO_DURATION_SEC = 120  # Gemini limit: 120s without audio, 80s with
MAX_VIDEO_SIZE_MB = 50  # safety limit to avoid huge inline payloads
RATE_LIMIT_DELAY = 1.5  # seconds between API calls

console = Console()


# ─── Helpers ────────────────────────────────────────────────────────────
def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    a_arr = np.array(a)
    b_arr = np.array(b)
    dot = np.dot(a_arr, b_arr)
    norm_a = np.linalg.norm(a_arr)
    norm_b = np.linalg.norm(b_arr)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot / (norm_a * norm_b))


def get_video_files(video_dir: str) -> list[Path]:
    """Find all supported video files in directory."""
    video_path = Path(video_dir)
    if not video_path.exists():
        console.print(f"[red]Error:[/red] Video directory '{video_dir}' not found.")
        sys.exit(1)

    videos = sorted(
        f for f in video_path.iterdir()
        if f.suffix.lower() in SUPPORTED_VIDEO_EXTS
    )
    return videos


def load_value_props(props_file: str) -> list[dict]:
    """Load value propositions from JSON file."""
    props_path = Path(props_file)
    if not props_path.exists():
        console.print(f"[red]Error:[/red] Value props file '{props_file}' not found.")
        sys.exit(1)

    with open(props_path) as f:
        return json.load(f)


def validate_video(video_path: Path) -> bool:
    """Check video is within size limits."""
    size_mb = video_path.stat().st_size / (1024 * 1024)
    if size_mb > MAX_VIDEO_SIZE_MB:
        console.print(
            f"[yellow]Skipping[/yellow] {video_path.name} — "
            f"{size_mb:.1f}MB exceeds {MAX_VIDEO_SIZE_MB}MB limit"
        )
        return False
    return True


# ─── Embedding Functions ───────────────────────────────────────────────
def embed_video(client: genai.Client, video_path: Path, dimensions: int | None = None) -> list[float]:
    """Embed a single video file using Gemini Embedding 2."""
    with open(video_path, "rb") as f:
        video_bytes = f.read()

    mime = "video/mp4" if video_path.suffix.lower() == ".mp4" else "video/quicktime"

    kwargs = {
        "model": EMBEDDING_MODEL,
        "contents": [
            types.Part.from_bytes(data=video_bytes, mime_type=mime),
        ],
    }
    if dimensions:
        kwargs["config"] = types.EmbedContentConfig(output_dimensionality=dimensions)

    result = client.models.embed_content(**kwargs)
    return result.embeddings[0].values


def embed_text(client: genai.Client, text: str, dimensions: int | None = None) -> list[float]:
    """Embed a text string using Gemini Embedding 2."""
    kwargs = {
        "model": EMBEDDING_MODEL,
        "contents": text,
    }
    if dimensions:
        kwargs["config"] = types.EmbedContentConfig(output_dimensionality=dimensions)

    result = client.models.embed_content(**kwargs)
    return result.embeddings[0].values


# ─── Main Pipeline ─────────────────────────────────────────────────────
def run_pipeline(video_dir: str, props_file: str, output_dir: str, dimensions: int | None):
    """Run the full embed-and-match pipeline."""

    # Load inputs
    videos = get_video_files(video_dir)
    value_props = load_value_props(props_file)

    if not videos:
        console.print(
            f"\n[red]No video files found in '{video_dir}'.[/red]\n"
            f"Drop some .mp4 or .mov files in there and re-run.\n"
            f"[dim]Tip: Download TikToks with:[/dim]\n"
            f"  yt-dlp -o 'videos/%(title)s.%(ext)s' <tiktok_url>"
        )
        sys.exit(1)

    console.print(f"\n[bold cyan]🎬 TikTok Ad Reverse-Engineering Pipeline[/bold cyan]")
    console.print(f"   Videos:      {len(videos)} files in {video_dir}/")
    console.print(f"   Value Props: {len(value_props)} propositions")
    console.print(f"   Dimensions:  {dimensions or 3072} (default: 3072)")
    console.print()

    # Init Gemini client
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        console.print("[red]Error:[/red] GEMINI_API_KEY not set. Add it to .env or environment.")
        sys.exit(1)

    client = genai.Client(api_key=api_key)

    # ── Step 1: Embed all videos ──
    video_embeddings = {}
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task("Embedding videos...", total=len(videos))

        for video_path in videos:
            if not validate_video(video_path):
                progress.advance(task)
                continue

            progress.update(task, description=f"Embedding [cyan]{video_path.name}[/cyan]...")
            try:
                embedding = embed_video(client, video_path, dimensions)
                video_embeddings[video_path.name] = {
                    "path": str(video_path),
                    "embedding": embedding,
                    "size_mb": round(video_path.stat().st_size / (1024 * 1024), 2),
                }
                console.print(f"  [green]✓[/green] {video_path.name} ({len(embedding)} dims)")
            except Exception as e:
                console.print(f"  [red]✗[/red] {video_path.name}: {e}")

            progress.advance(task)
            time.sleep(RATE_LIMIT_DELAY)

    if not video_embeddings:
        console.print("[red]No videos were successfully embedded. Check errors above.[/red]")
        sys.exit(1)

    # ── Step 2: Embed all value propositions ──
    prop_embeddings = {}
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task("Embedding value propositions...", total=len(value_props))

        for prop in value_props:
            progress.update(task, description=f"Embedding [magenta]{prop['label']}[/magenta]...")
            try:
                embedding = embed_text(client, prop["text"], dimensions)
                prop_embeddings[prop["id"]] = {
                    "label": prop["label"],
                    "text": prop["text"],
                    "embedding": embedding,
                }
                console.print(f"  [green]✓[/green] {prop['label']} ({len(embedding)} dims)")
            except Exception as e:
                console.print(f"  [red]✗[/red] {prop['label']}: {e}")

            progress.advance(task)
            time.sleep(RATE_LIMIT_DELAY)

    # ── Step 3: Compute similarity matrix ──
    console.print("\n[bold]Computing cross-modal similarity matrix...[/bold]\n")

    results = []
    for prop_id, prop_data in prop_embeddings.items():
        prop_results = []
        for video_name, video_data in video_embeddings.items():
            sim = cosine_similarity(prop_data["embedding"], video_data["embedding"])
            prop_results.append({
                "video": video_name,
                "video_path": video_data["path"],
                "similarity": round(sim, 4),
            })
        # Sort by similarity descending
        prop_results.sort(key=lambda x: x["similarity"], reverse=True)
        results.append({
            "prop_id": prop_id,
            "prop_label": prop_data["label"],
            "prop_text": prop_data["text"],
            "matches": prop_results,
        })

    # ── Display results ──
    for result in results:
        table = Table(
            title=f"🎯 {result['prop_label']}",
            title_style="bold magenta",
            show_lines=True,
        )
        table.add_column("Rank", style="dim", width=5, justify="center")
        table.add_column("Video", style="cyan")
        table.add_column("Similarity", style="green", justify="right")
        table.add_column("Match Level", justify="center")

        for i, match in enumerate(result["matches"], 1):
            sim = match["similarity"]
            if sim >= 0.5:
                level = "🟢 Strong"
            elif sim >= 0.3:
                level = "🟡 Moderate"
            elif sim >= 0.15:
                level = "🟠 Weak"
            else:
                level = "⚪ Low"

            table.add_row(str(i), match["video"], f"{sim:.4f}", level)

        console.print(table)
        console.print()

    # ── Save results ──
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Strip embeddings from output (they're huge)
    output_data = {
        "metadata": {
            "model": EMBEDDING_MODEL,
            "dimensions": dimensions or 3072,
            "num_videos": len(video_embeddings),
            "num_props": len(prop_embeddings),
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        },
        "results": [
            {
                "prop_id": r["prop_id"],
                "prop_label": r["prop_label"],
                "prop_text": r["prop_text"],
                "matches": r["matches"],
            }
            for r in results
        ],
        # Save embeddings separately for generate_scripts.py
        "video_paths": {
            name: data["path"] for name, data in video_embeddings.items()
        },
    }

    matrix_path = output_path / "similarity_matrix.json"
    with open(matrix_path, "w") as f:
        json.dump(output_data, f, indent=2)

    console.print(f"[bold green]✅ Results saved to {matrix_path}[/bold green]\n")
    console.print(
        f"[dim]Next step: Generate ad scripts based on these matches:[/dim]\n"
        f"  python generate_scripts.py --results {matrix_path} --top-n 2\n"
    )


# ─── CLI ────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="Embed TikTok ads + CheckPet value props and find matches"
    )
    parser.add_argument(
        "--videos", default="videos",
        help="Directory containing .mp4/.mov video files (default: videos/)"
    )
    parser.add_argument(
        "--props", default="value_props.json",
        help="JSON file with value propositions (default: value_props.json)"
    )
    parser.add_argument(
        "--output", default="results",
        help="Output directory for results (default: results/)"
    )
    parser.add_argument(
        "--dimensions", type=int, choices=[768, 1536, 3072], default=None,
        help="Embedding dimensions via MRL (default: 3072). Use 768 for speed."
    )

    args = parser.parse_args()

    # Load .env from current dir and parent dirs
    load_dotenv()
    load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env.local")
    load_dotenv(Path(__file__).resolve().parent.parent.parent / "web-triage-funnel" / ".env.local")

    run_pipeline(args.videos, args.props, args.output, args.dimensions)


if __name__ == "__main__":
    main()
