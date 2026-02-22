import os
import json
import glob

def strip_parens(s):
    return s.replace('(', '').replace(')', '').replace('-)', '').replace('-(', '-').replace('--', '-').strip('-')

pages_dir = '/Users/wilsonwu/pet-app-v2/checkpet_mvp_production/web-triage-funnel/src/data/pages'
pseo_map_file = '/Users/wilsonwu/pet-app-v2/checkpet_mvp_production/web-triage-funnel/src/data/pseo-map.json'
redirects_file = '/Users/wilsonwu/pet-app-v2/checkpet_mvp_production/redirects.json'

files = glob.glob(os.path.join(pages_dir, '*.json'))
renamed_count = 0
for f in files:
    filename = os.path.basename(f)
    if '(' in filename or ')' in filename:
        new_filename = strip_parens(filename)
        os.rename(f, os.path.join(pages_dir, new_filename))
        renamed_count += 1
print(f"Renamed {renamed_count} files to remove parentheses.")

with open(pseo_map_file, 'r') as f:
    pseo_map = json.load(f)
    
new_featured = []
for item in pseo_map.get('featured', []):
    item['slug'] = strip_parens(item['slug'])
    new_featured.append(item)
pseo_map['featured'] = new_featured

new_related = {}
for k, v in pseo_map.get('related', {}).items():
    new_k = strip_parens(k)
    new_v = [strip_parens(s) for s in v]
    new_related[new_k] = list(set(new_v))
pseo_map['related'] = new_related

with open(pseo_map_file, 'w') as f:
    json.dump(pseo_map, f, indent=2)
print("Updated pseo-map.json.")

with open(redirects_file, 'r') as f:
    redirects = json.load(f)
new_redirects = {}
for k, v in redirects.items():
    new_redirects[strip_parens(k)] = strip_parens(v)
with open(redirects_file, 'w') as f:
    json.dump(new_redirects, f, indent=2)
print("Updated redirects.json.")
