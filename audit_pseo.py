import os
import json
import glob
import re
from collections import defaultdict

def clean_title(title):
    # Remove boilerplate phrases and common stop words
    boilerplate = {
        "causes", "urgency", "next", "steps", "emergency", "triage", "guide",
        "symptoms", "advice", "care", "veterinary", "vet", "treatment", "tips",
        "when", "to", "see", "a", "worry", "what", "do", "how", "help", "is",
        "it", "an", "the", "for", "and", "or", "in", "on", "of", "with", "from",
        "at", "why", "my", "your", "does", "can", "if"
    }
    # keep only alphanumeric
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
    print(f"Found {len(files)} files in {pages_dir}")
    for f in files:
        with open(f, 'r') as file:
            try:
                data = json.load(file)
                title = data.get('title', '')
                clean_t = clean_title(title)
                
                content = data.get('content_html', '')
                faqs = data.get('faqs', [])
                
                content_len = len(content) + sum(len(faq.get('answer', '')) for faq in faqs)
                
                pages.append({
                    'file': os.path.basename(f),
                    'path': f,
                    'clean_title_set': set(clean_t.split()),
                    'title': title,
                    'content_len': content_len
                })
            except Exception as e:
                pass
                
    # Sort pages by title to have some consistency
    pages.sort(key=lambda x: x['title'])
    print(f"Processed {len(pages)} pages")
    
    clusters = []
    # threshold for Jaccard similarity
    threshold = 0.60
    
    print("Clustering...")
    for i, page in enumerate(pages):
        if i % 1000 == 0:
            print(f"Clustered {i} / {len(pages)} pages...")
            
        page_species = 'cat' if 'cat' in page['title'].lower() else ('dog' if 'dog' in page['title'].lower() else 'unknown')
            
        added = False
        for cluster in clusters:
            cluster_species = 'cat' if 'cat' in cluster[0]['title'].lower() else ('dog' if 'dog' in cluster[0]['title'].lower() else 'unknown')
            if page_species != 'unknown' and page_species != cluster_species:
                continue
                
            # Check against the cluster center (first element)
            sim = get_similarity(page['clean_title_set'], cluster[0]['clean_title_set'])
            if sim >= threshold:
                cluster.append(page)
                added = True
                break
        if not added:
            clusters.append([page])
            
    print(f"Generated {len(clusters)} clusters. Writing results...")
    
    has_dups = False
    with open('audit_results.txt', 'w') as out_f:
        out_f.write("Found following duplicate clusters:\n")
        out_f.write("====================================\n")
        
        # Only keep clusters with > 1 item
        dup_clusters = [c for c in clusters if len(c) > 1]
        
        # Sort duplicate clusters by size
        dup_clusters.sort(key=len, reverse=True)
        
        for cluster in dup_clusters:
            has_dups = True
            # Sort cluster by content_len descending so the best one is first
            cluster.sort(key=lambda x: x['content_len'], reverse=True)
            
            out_str = f"\nCluster: {cluster[0]['title']} (and variants) - {len(cluster)} pages\n"
            out_f.write(out_str)
            
            for j, p in enumerate(cluster):
                marker = " (RECOMMENDED KEEP)" if j == 0 else " (DUPLICATE)"
                line = f"  - Title: '{p['title']}' | File: {p['file']} | Content Score: {p['content_len']}{marker}\n"
                out_f.write(line)
                
        if not has_dups:
            msg = "\nNo significant duplicates found.\n"
            out_f.write(msg)
            print(msg)
            
    print("Complete! Results written to audit_results.txt")

if __name__ == '__main__':
    main()
