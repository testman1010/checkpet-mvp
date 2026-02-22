import os
import json
import glob
import time
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv('.env.local')
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)

# We use gemini-3-flash-preview for the highest quality generations
MODEL = genai.GenerativeModel('gemini-3-flash-preview')

PROMPT_TEMPLATE = """You are an expert veterinary editor optimizing content for Answer Engine Optimization (AEO).

Given the following HTML content for a pet triage page:
1. Generate a "Bottom Line Up Front" (BLUF) summary. It should be 1-2 sentences, placed at the very beginning of the HTML. Format it as: <p><strong>TL;DR:</strong> Your summary here.</p>
2. Rewrite standard <h2> or <h3> headings (like "Symptoms" or "What to do") into full conversational questions (e.g. "What are the common symptoms if my cat eats a lily?"). Leave the HTML heading tags intact.
3. If there are dense paragraphs under an action-oriented heading (like first aid or treatment steps), convert those paragraphs into a semantic HTML bulleted list (<ul><li>...</li></ul>) to be scannable.

Return ONLY the updated raw HTML string. Do not include markdown code blocks or backticks.

Original HTML:
{html}
"""

def enrich_file(file_path):
    try:
        # Rate Limiting: 0.8 seconds per worker with 10 workers = 12.5 req/s = 750 RPM (under 800 limit)
        time.sleep(0.8)
        
        with open(file_path, 'r') as f:
            data = json.load(f)
            
        original_html = data.get('content_html', '')
        
        # Skip if already processed
        if "<strong>TL;DR:</strong>" in original_html:
            return f"Skipped (already processed): {os.path.basename(file_path)}"
            
        prompt = PROMPT_TEMPLATE.replace("{html}", original_html)
        response = MODEL.generate_content(prompt)
        
        new_html = response.text.strip()
        
        # Strip markdown syntax if Gemini hallucinated it
        if new_html.startswith("```html"):
            new_html = new_html[7:]
        if new_html.endswith("```"):
            new_html = new_html[:-3]
        new_html = new_html.strip()
        
        data['content_html'] = new_html
        
        with open(file_path, 'w') as f:
            json.dump(data, f, indent=2)
            
        return f"Successfully enriched: {os.path.basename(file_path)}"
        
    except Exception as e:
        return f"Error processing {os.path.basename(file_path)}: {e}"

def main():
    parser = argparse.ArgumentParser(description="Enrich pSEO pages for AEO.")
    parser.add_argument("--limit", type=int, help="Limit the number of files to process for testing.")
    args = parser.parse_args()

    pages_dir = '/Users/wilsonwu/pet-app-v2/checkpet_mvp_production/web-triage-funnel/src/data/pages'
    files = glob.glob(os.path.join(pages_dir, '*.json'))
    
    if args.limit:
        files = files[:args.limit]
        print(f"TEST RUN: Processing only {args.limit} files.")
    
    print(f"Found {len(files)} pSEO pages to enrich.")
    
    # Process files concurrently to speed up the 2,800+ API calls
    success_count = 0
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(enrich_file, f): f for f in files}
        
        for future in as_completed(futures):
            result = future.result()
            print(result)
            if "Successfully" in result:
                success_count += 1
                
    print(f"\nCompleted! Successfully enriched {success_count} files.")

if __name__ == '__main__':
    main()
