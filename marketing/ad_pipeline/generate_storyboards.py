#!/usr/bin/env python3
"""
generate_storyboards.py — Ad Asset Generation with Real Screenshots + Nano Banana 2

Uses NB2's visual grounding (Google Image Search) to create photorealistic
ad assets that look native to TikTok — not AI-generated.

Key NB2 features used:
- Google Image Search grounding (anchors output in real web photos)
- 9:16 aspect ratio at 2K resolution
- Image editing (screenshot → phone-in-context mockup)

Usage:
    python generate_storyboards.py
    python generate_storyboards.py --asset-type phone_mockup
    python generate_storyboards.py --asset-type cta_card
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types
from PIL import Image
from rich.console import Console
from rich.table import Table

console = Console()

# ─── UGC-Authentic Asset Configs ────────────────────────────────────────

# Each asset uses grounded, UGC-style prompts that reference real-world
# photographic conventions instead of generic "polished" language.

ASSET_CONFIGS = [
    # ── Phone Mockups (UGC POV style) ──
    {
        "screenshot": "03_input_filled.png",
        "label": "Symptom Input (POV)",
        "assets": [
            {
                "type": "phone_mockup",
                "use_grounding": True,
                "prompt": (
                    "Use image search to find what an iPhone 16 Pro looks like when someone takes "
                    "a first-person POV photo of themselves holding it. "
                    "Create an ultra-realistic, raw photo: a first-person perspective looking down at an iPhone 16 Pro. "
                    "Only the edge of a thumb is visible holding the phone naturally. Avoid complex hand poses. "
                    "Background: a golden retriever lying on a carpet, slightly out of focus. "
                    "Lighting: warm tungsten table lamp, nighttime. Cozy but slightly moody. "
                    "The phone screen MUST display the exact provided screenshot content without alteration. "
                    "Photorealistic, 8k resolution, shot on iPhone 16 Pro, f/1.8, natural film grain, no HDR look. "
                    "Must look like an authentic, candid photo taken by a stressed pet owner."
                ),
                "filename": "mockup_symptom_pov.png",
            },
        ],
    },
    {
        "screenshot": "08_result.png",
        "label": "Triage Result (Concerned)",
        "assets": [
            {
                "type": "phone_mockup",
                "use_grounding": True,
                "prompt": (
                    "Use image search to find what authentic UGC TikTok content looks like when someone "
                    "films themselves on their couch with a pet. "
                    "Create an ultra-realistic raw photo: a young woman in a hoodie sitting on a grey sofa, "
                    "gently holding her iPhone. A sick golden retriever is resting its head on her lap. "
                    "Crucial detail: She must have a subtle, natural expression of WORRY and CONCERN, NOT smiling. "
                    "Her face must have realistic skin texture, visible pores, and subtle imperfections. Do NOT smooth or make her look plastic/AI-generated. "
                    "Lighting: soft, diffused overcast window light. "
                    "The phone screen shows the exact provided screenshot. "
                    "Shallow depth of field (f/1.4). Natural hand positioning, no distorted fingers. "
                    "Highest photorealism, feels like a genuine, unpolished documentary moment."
                ),
                "filename": "mockup_result_couch.png",
            },
        ],
    },
    {
        "screenshot": "04_loading.png",
        "label": "AI Analyzing (Kitchen)",
        "assets": [
            {
                "type": "phone_mockup",
                "use_grounding": True,
                "prompt": (
                    "Use image search to find candid photography of a modern kitchen. "
                    "Create an ultra-realistic raw photo: an iPhone resting on a kitchen counter "
                    "propped up slightly against a coffee mug, with this app loading on screen. "
                    "A small tired dog is sitting on the floor in the slightly blurred background. "
                    "No human hands visible to ensure perfect realism. "
                    "Morning window light reflecting softly on the counter. "
                    "The phone shows the exact provided screenshot perfectly integrated. "
                    "Photorealistic, 8k, shot on DSLR with 50mm lens f/2.8. Natural everyday messiness. "
                    "Zero plastic AI feeling."
                ),
                "filename": "mockup_analyzing_kitchen.png",
            },
        ],
    },
    {
        "screenshot": "05_question_1.png",
        "label": "Investigation (Desk)",
        "assets": [
            {
                "type": "phone_mockup",
                "use_grounding": False,
                "prompt": (
                    "Ultra-realistic raw macro photography. An iPhone 16 Pro lying flat on a wooden desk. "
                    "The screen displays the exact provided screenshot perfectly integrated into the display. "
                    "Next to the phone: a pair of glasses and a handwritten note. "
                    "In the deep blurred background, a labrador retriever is resting on a pet bed. "
                    "No hands visible. Soft, natural overcast lighting from a nearby window. "
                    "Absolutely photorealistic, highest quality 8k, natural textures, zero AI distortion."
                ),
                "filename": "mockup_investigation_tap.png",
            },
        ],
    },

    # ── Hook Thumbnails (dramatic, attention-grabbing) ──
    {
        "screenshot": "03_input_filled.png",
        "label": "Hook: Late Night Panic",
        "assets": [
            {
                "type": "hook_thumb",
                "use_grounding": True,
                "prompt": (
                    "Use image search to find cinematic long-exposure night photography. "
                    "Create an ultra-realistic, moody photo: A person sitting up in bed in pitch darkness, "
                    "face lit entirely by the harsh blue-white glow of their smartphone screen. "
                    "Their expression is intensely WORRIED and exhausted. "
                    "Skin texture must be hyper-realistic: visible pores, sleepy eyes, unpolished, no plastic smoothing. "
                    "The phone is angled, showing the exact provided screenshot glowing brightly. "
                    "A sick dog's head is resting near them on the blankets. "
                    "Cinematic noise, high ISO grain typical of dark smartphone photos. "
                    "Bold white text at the very top: 'MY DOG WON'T STOP VOMITING' "
                    "in authentic TikTok caption style (white sans-serif with strong black drop shadow)."
                ),
                "filename": "hook_late_night.png",
            },
        ],
    },
    {
        "screenshot": "08_result.png",
        "label": "Hook: AI Diagnosis",
        "assets": [
            {
                "type": "hook_thumb",
                "use_grounding": False,
                "prompt": (
                    "Ultra-realistic raw macro photography of an iPhone screen showing this app result in focus. "
                    "The phone rests vertically on a modern wooden stand. "
                    "Deeply blurred in the background: an out-of-focus veterinary clinic setting. "
                    "Dramatic, cinematic side lighting. High resolution 8k, photorealistic textures. "
                    "The phone screen perfectly and seamlessly displays the exact provided screenshot content. "
                    "Bold yellow-white text overlaid at top of image: 'THE AI FOUND SOMETHING' "
                    "in a bold sans-serif font with a strong drop shadow. "
                    "Below that, smaller text: '⚠️ Watch till the end'. "
                    "Highly polished but absolutely photorealistic, no AI distortions."
                ),
                "filename": "hook_ai_diagnosis.png",
            },
        ],
    },

    # ── CTA End Cards (clean, branded) ──
    {
        "screenshot": "01_landing.png",
        "label": "CTA: Free Triage",
        "assets": [
            {
                "type": "cta_card",
                "use_grounding": True,
                "prompt": (
                    "Use image search to find high-end 3D product renders of smartphones. "
                    "Create a hyper-realistic product ad render: a sleek iPhone 16 Pro floating in center space. "
                    "The phone screen perfectly maps the exact provided screenshot. "
                    "Background: premium smooth gradient from deep navy (#0a1628) to dark blue (#1a2a4a). "
                    "Top-left: bold white text 'Your pet can't Google their symptoms.' in a premium sans-serif. "
                    "Bottom: 'checkpet.vet' in large white bold text, with '100% Free • No Signup' underneath. "
                    "Subtle, realistic rim lighting on the phone edges. Studio quality 8k render."
                ),
                "filename": "cta_free_triage.png",
            },
        ],
    },
    {
        "screenshot": "08_result.png",
        "label": "CTA: Stop Googling",
        "assets": [
            {
                "type": "cta_card",
                "use_grounding": True,
                "prompt": (
                    "Use image search to find premium brutalist poster designs. "
                    "Create a high-resolution, ultra-clean TikTok end card. "
                    "Left side: A photorealistic iPhone 16 Pro facing straight on, perfectly displaying "
                    "the exact provided screenshot. Realistic glass reflections. "
                    "Right side: bold stacked text: 'STOP' (red), 'GOOGLING' (white), 'PET SYMPTOMS' (white). "
                    "Background: dark charcoal (#1a1a1a) with subtle film grain. "
                    "Below the phone: 'Try Free → checkpet.vet' inside a clean blue (#4A9FE5) pill button. "
                    "No cartoony elements, zero AI distortion. Clean, sharp, photorealistic graphic design."
                ),
                "filename": "cta_stop_googling_v2.png",
            },
        ],
    },
]


def generate_asset(
    client: genai.Client,
    screenshot_path: str,
    prompt: str,
    output_path: str,
    model: str,
    use_grounding: bool = False,
    max_retries: int = 3,
) -> bool:
    """Generate a single ad asset using Nano Banana 2 with optional visual grounding."""
    img = Image.open(screenshot_path)

    # Build config with NB2 features
    config_kwargs = {
        "response_modalities": ["Image"],
        "image_config": types.ImageConfig(
            aspect_ratio="9:16",
            image_size="2K",
        ),
    }

    # Add visual grounding (Google Image Search) if enabled
    if use_grounding:
        config_kwargs["tools"] = [
            types.Tool(
                google_search=types.GoogleSearch(
                    search_types=types.SearchTypes(
                        image_search=types.ImageSearch()
                    )
                )
            )
        ]

    config = types.GenerateContentConfig(**config_kwargs)

    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=model,
                contents=[prompt, img],
                config=config,
            )

            for part in response.parts:
                if hasattr(part, 'inline_data') and part.inline_data is not None:
                    result_img = part.as_image()
                    result_img.save(output_path)
                    return True

            if attempt < max_retries - 1:
                console.print(f"      [yellow]⚠ No image returned, retrying ({attempt + 2}/{max_retries})...[/yellow]")
                time.sleep(5)

        except Exception as e:
            error_msg = str(e)
            if "429" in error_msg or "quota" in error_msg.lower() or "rate" in error_msg.lower():
                wait = (attempt + 1) * 20
                console.print(f"      [yellow]⏱ Rate limited, waiting {wait}s...[/yellow]")
                time.sleep(wait)
            elif attempt < max_retries - 1:
                console.print(f"      [yellow]⚠ {error_msg[:80]}, retrying...[/yellow]")
                time.sleep(5)
            else:
                console.print(f"      [red]✗ Failed: {error_msg[:120]}[/red]")
                return False

    return False


def run_pipeline(
    screenshots_dir: str,
    output_dir: str,
    model: str,
    asset_type_filter: str | None,
):
    screenshots_path = Path(screenshots_dir)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        console.print("[red]Error:[/red] GEMINI_API_KEY not found.")
        sys.exit(1)

    client = genai.Client(api_key=api_key)

    total = sum(
        len([a for a in cfg["assets"] if not asset_type_filter or asset_type_filter == "all" or a["type"] == asset_type_filter])
        for cfg in ASSET_CONFIGS
    )

    console.print(f"\n[bold cyan]🎨 Ad Asset Generator v2 (Nano Banana 2 + Visual Grounding)[/bold cyan]")
    console.print(f"   Model:       {model}")
    console.print(f"   Screenshots: {screenshots_dir}/")
    console.print(f"   Output:      {output_dir}/")
    console.print(f"   Assets:      {total}")
    console.print(f"   Resolution:  9:16 @ 2K")
    console.print(f"   Grounding:   Google Image Search (for marked assets)")
    console.print()

    generated = 0
    failed = 0

    for cfg in ASSET_CONFIGS:
        screenshot_file = screenshots_path / cfg["screenshot"]
        if not screenshot_file.exists():
            console.print(f"  [yellow]⚠ Missing: {cfg['screenshot']}[/yellow]")
            continue

        for asset in cfg["assets"]:
            if asset_type_filter and asset_type_filter != "all" and asset["type"] != asset_type_filter:
                continue

            out_file = output_path / asset["filename"]
            grounded = "🌐" if asset.get("use_grounding") else "  "

            console.print(f"  {grounded} [cyan]{cfg['label']}[/cyan] → {asset['type']}: {asset['filename']}")

            success = generate_asset(
                client=client,
                screenshot_path=str(screenshot_file),
                prompt=asset["prompt"],
                output_path=str(out_file),
                model=model,
                use_grounding=asset.get("use_grounding", False),
            )

            if success:
                size_kb = out_file.stat().st_size / 1024
                console.print(f"      [green]✓[/green] {size_kb:.0f}KB")
                generated += 1
            else:
                failed += 1

            time.sleep(4)  # Rate limiting between generations

    console.print(f"\n[bold green]✅ Generated {generated}/{generated + failed} ad assets[/bold green]")
    console.print(f"   Output: {output_dir}/\n")

    if generated > 0:
        table = Table(title="Generated Ad Assets", show_lines=True)
        table.add_column("File", style="cyan")
        table.add_column("Type", style="green")
        table.add_column("Grounded", justify="center")
        table.add_column("Source", style="dim")
        table.add_column("Size", justify="right")

        for f in sorted(output_path.glob("*.png")):
            asset_type, grounded, source = "?", "—", "?"
            for cfg in ASSET_CONFIGS:
                for a in cfg["assets"]:
                    if a["filename"] == f.name:
                        asset_type = a["type"]
                        grounded = "🌐" if a.get("use_grounding") else "—"
                        source = cfg["screenshot"]
            table.add_row(f.name, asset_type, grounded, source, f"{f.stat().st_size / 1024:.0f}KB")

        console.print(table)


def main():
    parser = argparse.ArgumentParser(
        description="Generate UGC-authentic ad assets from real CheckPet screenshots using Nano Banana 2"
    )
    parser.add_argument("--screenshots", default="screenshots")
    parser.add_argument("--output", default="results/ad_assets_v2")
    parser.add_argument("--model", default="gemini-3.1-flash-image-preview")
    parser.add_argument(
        "--asset-type", default="all",
        choices=["phone_mockup", "cta_card", "hook_thumb", "all"],
    )

    args = parser.parse_args()

    load_dotenv()
    load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env.local")
    load_dotenv(Path(__file__).resolve().parent.parent.parent / "web-triage-funnel" / ".env.local")

    run_pipeline(
        screenshots_dir=args.screenshots,
        output_dir=args.output,
        model=args.model,
        asset_type_filter=args.asset_type,
    )


if __name__ == "__main__":
    main()
