import os
import json
import glob
import re
from collections import defaultdict
import shutil

MUST_KEEP = {
    'dog-allergic-reaction-with-difficulty-breathing',
    'dog-acting-depressed-after-returning-from-kennel',
    'dog-ate-a-box-of-raisins',
    'cat-abdomen-feels-hard-and-bloated',
    'cat-acting-spaced-out-and-staring-at-shadows',
    'cat-ate-a-lily-leaf'
}

def clean_title(title):
    boilerplate = {
        "causes", "urgency", "next", "steps", "emergency", "triage", "guide",
        "symptoms", "advice", "care", "veterinary", "vet", "treatment", "tips",
        "when", "to", "see", "a", "worry", "what", "do", "how", "help", "is",
        "it", "an", "the", "for", "and", "or", "in", "on", "of", "with", "from",
        "at", "why", "my", "your", "does", "can", "if"
    }
    words = re.findall(r'\b\w+\b', title.lower())
    clean_words = [w for w in words if w not in boilerplate]
    return " ".join(clean_words)

def get_similarity(set_a, set_b):
    if not set_a or not set_b:
        return 0
    return len(set_a.intersection(set_b)) / len(set_a.union(set_b))

def main():
    pages_dir = '/Users/wilsonwu/pet-app-v2/checkpet_mvp_production/web-triage-funnel/src/data/pages'
    files = glob.glob(os.path.join(pages_dir, '*.json'))
    
    pages = []
    for f in files:
        with open(f, 'r') as file:
            try:
                data = json.load(file)
                title = data.get('title', '')
                clean_t = clean_title(title)
                content = data.get('content_html', '')
                faqs = data.get('faqs', [])
                content_len = len(content) + sum(len(faq.get('answer', '')) for faq in faqs)
                
                slug = os.path.basename(f).replace('.json', '')
                
                pages.append({
                    'file': os.path.basename(f),
                    'slug': slug,
                    'path': f,
                    'clean_title_set': set(clean_t.split()),
                    'title': title,
                    'content_len': content_len
                })
            except Exception as e:
                pass
                
    pages.sort(key=lambda x: x['title'])
    
    clusters = []
    threshold = 0.60
    
    for i, page in enumerate(pages):
        page_species = 'cat' if 'cat' in page['title'].lower() else ('dog' if 'dog' in page['title'].lower() else 'unknown')
        added = False
        for cluster in clusters:
            cluster_species = 'cat' if 'cat' in cluster[0]['title'].lower() else ('dog' if 'dog' in cluster[0]['title'].lower() else 'unknown')
            if page_species != 'unknown' and page_species != cluster_species:
                continue
                
            sim = get_similarity(page['clean_title_set'], cluster[0]['clean_title_set'])
            if sim >= threshold:
                cluster.append(page)
                added = True
                break
        if not added:
            clusters.append([page])
            
    dup_clusters = [c for c in clusters if len(c) > 1]
    
    redirects_map = {}
    
    for cluster in dup_clusters:
        # Determine the "keep" element
        # If any element in cluster has a slug in MUST_KEEP, make it the first/keep element
        keep_idx = -1
        for j, p in enumerate(cluster):
            if p['slug'] in MUST_KEEP:
                keep_idx = j
                break
                
        if keep_idx == -1:
            # Sort by content_len if no MUST_KEEP found
            cluster.sort(key=lambda x: x['content_len'], reverse=True)
        else:
            # Move the MUST_KEEP element to the front
            keep_item = cluster.pop(keep_idx)
            cluster.insert(0, keep_item)
            
        keep_slug = cluster[0]['slug']
        
        for p in cluster[1:]:
            redirects_map[p['slug']] = keep_slug
            
    # Write out the redirect map
    with open('redirects.json', 'w') as f:
        json.dump(redirects_map, f, indent=2)
        
    print(f"Generated {len(redirects_map)} redirects. Saved to redirects.json")

if __name__ == '__main__':
    main()
