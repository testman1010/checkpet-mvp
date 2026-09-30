#!/bin/bash
# Serve a candidate analyze-symptom locally so the suites can run against it BEFORE deploying:
#
#   ./serve-local.sh                      # serves supabase/functions/analyze-symptom/index.ts on :8787
#   ANALYZE_URL=http://127.0.0.1:8787/ node golden-cases.mjs candidate both
#   ANALYZE_URL=http://127.0.0.1:8787/ node safety-suite.mjs
#
# Uses production's Gemini key and Supabase project from web-triage-funnel/.env.local (values are never
# printed). The function only reads from Supabase (the match_merck_v2 RPC), so this writes nothing.
#
# Deno 2 removed Deno.serveHttp, which std@0.168.0's serve() depends on; an import map swaps in a
# Deno.serve shim so the function source runs unmodified.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FN="${1:-$ROOT/supabase/functions/analyze-symptom/index.ts}"
ENVF="$ROOT/web-triage-funnel/.env.local"
export PORT="${PORT:-8787}"

get() { grep -E "^[[:space:]]*$1[[:space:]]*=" "$ENVF" | head -1 | sed -E "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//; s/^[\"']//; s/[\"'][[:space:]]*$//"; }
export GEMINI_API_KEY="$(get GEMINI_API_KEY)"
export SUPABASE_URL="$(get NEXT_PUBLIC_SUPABASE_URL)"
export SUPABASE_SERVICE_ROLE_KEY="$(get SUPABASE_SERVICE_ROLE_KEY)"
for v in GEMINI_API_KEY SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY; do
  [ -n "${!v}" ] || { echo "missing $v in $ENVF" >&2; exit 1; }
done

SHIM_DIR="$(mktemp -d)"
trap 'rm -rf "$SHIM_DIR"' EXIT
cat > "$SHIM_DIR/std-server.ts" <<'EOF'
export function serve(handler: (req: Request) => Response | Promise<Response>, opts: { port?: number } = {}) {
  return Deno.serve({ hostname: '127.0.0.1', port: opts.port ?? Number(Deno.env.get('PORT') ?? 8787) }, handler);
}
EOF
cat > "$SHIM_DIR/import_map.json" <<EOF
{ "imports": { "https://deno.land/std@0.168.0/http/server.ts": "$SHIM_DIR/std-server.ts" } }
EOF

echo "Serving $FN on http://127.0.0.1:$PORT/"
npx -y deno run --allow-net --allow-env --import-map="$SHIM_DIR/import_map.json" "$FN"
