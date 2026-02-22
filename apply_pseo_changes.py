import os
import json

def main():
    with open('redirects.json', 'r') as f:
        redirects = json.load(f)
        
    print(f"Loaded {len(redirects)} redirects to apply")
    
    # 1. DELETE FILES
    pages_dir = '/Users/wilsonwu/pet-app-v2/checkpet_mvp_production/web-triage-funnel/src/data/pages'
    deleted = 0
    for dup_slug in redirects.keys():
        file_path = os.path.join(pages_dir, f"{dup_slug}.json")
        if os.path.exists(file_path):
            os.remove(file_path)
            deleted += 1
    print(f"Deleted {deleted} duplicate pages.")
    
    # 2. UPDATE PSEO MAP
    map_file = '/Users/wilsonwu/pet-app-v2/checkpet_mvp_production/web-triage-funnel/src/data/pseo-map.json'
    with open(map_file, 'r') as f:
        pseo_map = json.load(f)
        
    # Update featured list
    new_featured = []
    seen_featured = set()
    for item in pseo_map.get('featured', []):
        slug = item['slug']
        actual_slug = redirects.get(slug, slug)
        
        if actual_slug not in seen_featured:
            new_item = item.copy()
            new_item['slug'] = actual_slug
            new_featured.append(new_item)
            seen_featured.add(actual_slug)
            
    pseo_map['featured'] = new_featured
    
    # Update related dictionary
    new_related = {}
    
    for key_slug, related_slugs in pseo_map.get('related', {}).items():
        actual_key = redirects.get(key_slug, key_slug)
        
        # We need to map all related_slugs to their canonical versions and deduplicate
        mapped_related = set()
        for r_slug in related_slugs:
            actual_r = redirects.get(r_slug, r_slug)
            # Don't link a page to itself
            if actual_r != actual_key:
                mapped_related.add(actual_r)
                
        # If actual_key already exists in new_related, merge them (this happens if two keys map to the same canonical)
        if actual_key in new_related:
            new_related[actual_key] = list(set(new_related[actual_key] + list(mapped_related)))
        else:
            new_related[actual_key] = list(mapped_related)
            
    pseo_map['related'] = new_related
    
    with open(map_file, 'w') as f:
        json.dump(pseo_map, f, indent=2)
        
    print("Updated pseo-map.json.")
    
    with open('next_redirects_code.txt', 'w') as f:
        f.write("      // PSEO De-duplication Redirects\n")
        f.write("      const pseoRedirects = [\n")
        for dup, keep in redirects.items():
            f.write(f"        {{ source: '/symptoms/{dup}', destination: '/symptoms/{keep}', permanent: true }},\n")
        f.write("      ];\n")
        f.write("      return [...pseoRedirects, /* ...existing redirects */];\n")
        
    print("Code for next.config.ts redirects written to next_redirects_code.txt")

if __name__ == '__main__':
    main()
