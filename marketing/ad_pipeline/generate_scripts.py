#!/usr/bin/env python3
"""
generate_scripts.py — TikTok Ad Reverse-Engineering Pipeline (Step 2)

Takes the similarity matrix from embed_and_match.py and generates
tailored CheckPet ad scripts by analyzing the top-matching winning
ads and applying their creative DNA to each value proposition.

Usage:
    python generate_scripts.py
    python generate_scripts.py --results results/similarity_matrix.json --top-n 3
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.markdown import Markdown

from google import genai
from google.genai import types

# ─── Constants ──────────────────────────────────────────────────────────
GENERATION_MODEL = "gemini-2.0-flash"
RATE_LIMIT_DELAY = 2.0

console = Console()

SYSTEM_PROMPT = """You are an expert short-form video ad strategist specializing in 
direct-to-consumer pet health apps. You have deep expertise in TikTok/Reels ad formats, 
hooks, pacing, and emotional storytelling.

Your job is to analyze a winning ad video and reverse-engineer its creative structure, 
then write a new ad script for CheckPet that uses the same creative DNA.

CheckPet is a free AI-powered pet health triage tool. Key facts:
- Instant AI triage for pet emergencies — answers in 30 seconds
- No sign-up or account required — 100% anonymous
- Powered by veterinary science (RAG from Merck Vet Manual)
- Active Monitoring: sends SMS check-in 2 hours after triage
- Completely free
- Website: checkpet.vet"""

SCRIPT_PROMPT_TEMPLATE = """## Your Task

I'm going to show you a winning TikTok/Reels ad. Analyze its creative structure and write 
a CheckPet ad script that captures the same energy.

### Value Proposition to Promote
**{prop_label}**: {prop_text}

### Instructions

1. **Analyze the Reference Ad** (the video I'm providing):
   - What is the hook strategy? (first 1-3 seconds)
   - What emotions does it evoke?
   - What's the pacing and structure? (transitions, text overlays, etc.)
   - What's the CTA style?
   - Why does this format work for the target audience?

2. **Write a CheckPet Ad Script** using that analysis:

Format your output EXACTLY as:

---

## 📊 Reference Ad Analysis
[Your analysis of the winning ad's creative structure]

## 🎬 CheckPet Ad Script: "{prop_label}"

**Format:** [TikTok/Reels, 15-30 sec]
**Target Audience:** [Specific persona]
**Emotional Arc:** [e.g., Panic → Relief → Trust]

### HOOK (0-3 sec)
[Exact text/visual/audio for the hook — this is the most critical part]

### BODY (3-20 sec)  
[Scene-by-scene breakdown with on-screen text, voiceover, and visuals]

### CTA (last 3-5 sec)
[Clear call to action with screen direction]

### 💡 Production Notes
- Filming style recommendations
- Music/sound suggestions  
- Text overlay style
- Estimated production difficulty (Easy/Medium/Hard)

---"""


# ─── Main Pipeline ─────────────────────────────────────────────────────
def run_generation(results_file: str, top_n: int, output_dir: str):
    """Generate ad scripts from similarity matrix results."""

    # Load similarity results
    results_path = Path(results_file)
    if not results_path.exists():
        console.print(f"[red]Error:[/red] Results file '{results_file}' not found.")
        console.print("[dim]Run embed_and_match.py first.[/dim]")
        sys.exit(1)

    with open(results_path) as f:
        data = json.load(f)

    results = data["results"]
    video_paths = data.get("video_paths", {})

    # Init Gemini client
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        console.print("[red]Error:[/red] GEMINI_API_KEY not set.")
        sys.exit(1)

    client = genai.Client(api_key=api_key)

    console.print(f"\n[bold cyan]📝 Ad Script Generator[/bold cyan]")
    console.print(f"   Value Props:  {len(results)}")
    console.print(f"   Top-N Videos: {top_n} per prop")
    console.print(f"   Model:        {GENERATION_MODEL}")
    console.print()

    all_scripts = []
    total_tasks = sum(min(top_n, len(r["matches"])) for r in results)

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task("Generating scripts...", total=total_tasks)

        for result in results:
            prop_label = result["prop_label"]
            prop_text = result["prop_text"]
            top_matches = result["matches"][:top_n]

            prop_scripts = {
                "prop_label": prop_label,
                "prop_text": prop_text,
                "scripts": [],
            }

            for match in top_matches:
                video_name = match["video"]
                similarity = match["similarity"]
                video_path = video_paths.get(video_name, match.get("video_path"))

                progress.update(
                    task,
                    description=f"[magenta]{prop_label}[/magenta] × [cyan]{video_name}[/cyan]"
                )

                if not video_path or not Path(video_path).exists():
                    console.print(
                        f"  [yellow]⚠[/yellow] Video not found: {video_name} — skipping"
                    )
                    progress.advance(task)
                    continue

                # Read video bytes
                with open(video_path, "rb") as f:
                    video_bytes = f.read()

                mime = "video/mp4" if video_name.lower().endswith(".mp4") else "video/quicktime"

                # Build the prompt
                prompt = SCRIPT_PROMPT_TEMPLATE.format(
                    prop_label=prop_label,
                    prop_text=prop_text,
                )

                try:
                    response = client.models.generate_content(
                        model=GENERATION_MODEL,
                        contents=[
                            types.Content(
                                parts=[
                                    types.Part.from_bytes(data=video_bytes, mime_type=mime),
                                    types.Part(text=prompt),
                                ]
                            )
                        ],
                        config=types.GenerateContentConfig(
                            system_instruction=SYSTEM_PROMPT,
                            temperature=0.8,
                            max_output_tokens=2048,
                        ),
                    )

                    script_text = response.text
                    prop_scripts["scripts"].append({
                        "reference_video": video_name,
                        "similarity_score": similarity,
                        "script": script_text,
                    })

                    console.print(
                        f"  [green]✓[/green] Generated script for "
                        f"[magenta]{prop_label}[/magenta] × [cyan]{video_name}[/cyan] "
                        f"(sim: {similarity:.4f})"
                    )

                except Exception as e:
                    console.print(
                        f"  [red]✗[/red] Failed for {prop_label} × {video_name}: {e}"
                    )

                progress.advance(task)
                time.sleep(RATE_LIMIT_DELAY)

            all_scripts.append(prop_scripts)

    # ── Write output ──
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    md_lines = [
        "# 🎬 CheckPet Ad Scripts",
        f"*Generated from {data['metadata']['num_videos']} reference ads*",
        f"*Model: {GENERATION_MODEL} | Embeddings: {data['metadata']['model']}*",
        "",
    ]

    for prop_data in all_scripts:
        md_lines.append(f"---\n")
        md_lines.append(f"# 🎯 {prop_data['prop_label']}\n")
        md_lines.append(f"> {prop_data['prop_text']}\n")

        if not prop_data["scripts"]:
            md_lines.append("*No scripts generated — reference videos not found.*\n")
            continue

        for i, script in enumerate(prop_data["scripts"], 1):
            md_lines.append(
                f"## Script {i} — Reference: `{script['reference_video']}` "
                f"(similarity: {script['similarity_score']:.4f})\n"
            )
            md_lines.append(script["script"])
            md_lines.append("\n")

    scripts_path = output_path / "ad_scripts.md"
    with open(scripts_path, "w") as f:
        f.write("\n".join(md_lines))

    # Also save raw JSON for programmatic access
    json_path = output_path / "ad_scripts.json"
    with open(json_path, "w") as f:
        json.dump(all_scripts, f, indent=2)

    console.print(f"\n[bold green]✅ Ad scripts saved to:[/bold green]")
    console.print(f"   📄 {scripts_path}")
    console.print(f"   📦 {json_path}")
    console.print()

    # Show preview of first script
    if all_scripts and all_scripts[0]["scripts"]:
        console.print("[bold]Preview of first script:[/bold]\n")
        console.print(Markdown(all_scripts[0]["scripts"][0]["script"]))


# ─── CLI ────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="Generate CheckPet ad scripts from similarity matches"
    )
    parser.add_argument(
        "--results", default="results/similarity_matrix.json",
        help="Path to similarity_matrix.json from embed_and_match.py"
    )
    parser.add_argument(
        "--top-n", type=int, default=2,
        help="Number of top-matching videos to use per value prop (default: 2)"
    )
    parser.add_argument(
        "--output", default="results",
        help="Output directory (default: results/)"
    )

    args = parser.parse_args()

    # Load .env
    load_dotenv()
    load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env.local")
    load_dotenv(Path(__file__).resolve().parent.parent.parent / "web-triage-funnel" / ".env.local")

    run_generation(args.results, args.top_n, args.output)


if __name__ == "__main__":
    main()
