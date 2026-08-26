#!/usr/bin/env bash
#
# LinguaFlow release automation
# ----------------------------------------
# One command to cut a release:
#   1. Write your changelog draft (markdown) into CHANGELOG.draft.md
#   2. export GH_TOKEN=github_pat_xxx   # fine-grained PAT, repo Contents: Read&Write
#      (or put the token in ~/.linguaflow_ghtoken, chmod 600)
#   3. ./scripts/release.sh v0.2.0        # explicit version
#      or: ./scripts/release.sh --patch | --minor | --major
#
# What it does:
#   - bumps package.json version
#   - prepends a dated CHANGELOG.md entry (from CHANGELOG.draft.md) + link ref
#   - commits, creates an annotated git tag, pushes commit + tag
#   - creates a GitHub Release whose notes == the new CHANGELOG section
#   - removes CHANGELOG.draft.md
#
# Safety:
#   - aborts if the working tree has uncommitted changes (other than the draft)
#   - aborts if the tag already exists
#   - never prints or stores the token in the repo
# ----------------------------------------

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ---------- parse args ----------
BUMP=""
EXPLICIT=""
for a in "$@"; do
  case "$a" in
    --patch) BUMP=patch ;;
    --minor) BUMP=minor ;;
    --major) BUMP=major ;;
    -*) echo "unknown flag: $a" >&2; exit 1 ;;
    *)  EXPLICIT="$a" ;;
  esac
done

# ---------- current version ----------
CUR=$(grep -m1 '"version"' package.json | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')
echo "current version: $CUR"

if [ -z "$EXPLICIT" ]; then
  IFS='.' read -r MAJ MIN PAT <<< "$CUR"
  case "$BUMP" in
    patch) PAT=$((PAT+1)) ;;
    minor) MIN=$((MIN+1)); PAT=0 ;;
    major) MAJ=$((MAJ+1)); MIN=0; PAT=0 ;;
    *) echo "specify a version (v0.2.0) or a bump flag (--patch/--minor/--major)" >&2; exit 1 ;;
  esac
  NEW="$MAJ.$MIN.$PAT"
else
  NEW="${EXPLICIT#v}"
fi
echo "new version:     $NEW"

# ---------- draft file ----------
DRAFT="$ROOT/CHANGELOG.draft.md"
if [ ! -f "$DRAFT" ]; then
  echo "ERROR: $DRAFT not found. Write your changelog draft there first." >&2
  exit 1
fi

# ---------- token (env, then local file) ----------
if [ -n "${GH_TOKEN:-}" ]; then
  TOKEN="$GH_TOKEN"
elif [ -f "$HOME/.linguaflow_ghtoken" ]; then
  TOKEN="$(cat "$HOME/.linguaflow_ghtoken")"
  echo "using token from ~/.linguaflow_ghtoken"
else
  echo "ERROR: GH_TOKEN not set and ~/.linguaflow_ghtoken missing." >&2
  echo "       export a fine-grained PAT (repo Contents: Read&Write) first." >&2
  exit 1
fi

# ---------- repo slug from remote ----------
REMOTE="$(git remote get-url origin)"
SLUG="$(echo "$REMOTE" | sed -E 's#.*[:/]([^/]+/[^/]+?)(\.git)?$#\1#')"
OWNER="$(echo "$SLUG" | cut -d/ -f1)"
REPO="$(echo "$SLUG" | cut -d/ -f2)"
echo "repo:            $OWNER/$REPO"

# ---------- guards ----------
BR="$(git rev-parse --abbrev-ref HEAD)"
[ "$BR" = "main" ] || { echo "ERROR: not on main (on $BR)" >&2; exit 1; }

if git rev-parse "v$NEW" >/dev/null 2>&1; then
  echo "ERROR: tag v$NEW already exists locally" >&2; exit 1
fi
if git ls-remote --tags origin "v$NEW" | grep -q "v$NEW$"; then
  echo "ERROR: tag v$NEW already exists on remote" >&2; exit 1
fi

if [ -n "$(git status --porcelain | grep -v 'CHANGELOG.draft.md')" ]; then
  echo "ERROR: working tree has uncommitted changes. Stash/commit first:" >&2
  git status --short
  exit 1
fi

DATE="$(date +%Y-%m-%d)"

# ---------- bump package.json + prepend CHANGELOG ----------
python3 - "$NEW" "$DATE" "$DRAFT" "$OWNER" "$REPO" <<'PY'
import sys, json, re
new_ver, date, draft, owner, repo = sys.argv[1:6]

# package.json
with open('package.json') as f:
    d = json.load(f)
d['version'] = new_ver
with open('package.json', 'w') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
    f.write('\n')

# changelog
with open(draft) as f:
    body = f.read().strip()
with open('CHANGELOG.md') as f:
    src = f.read()

m = re.search(r'^## \[', src, re.M)
header = src[:m.start()]
rest = src[m.start():]
entry = f"## [{new_ver}] - {date}\n\n{body}\n\n"
new_src = header + entry + rest

linkref = f"[{new_ver}]: https://github.com/{owner}/{repo}/releases/tag/v{new_ver}\n"
if re.search(r'^\[[\d.]+\]:', new_src, re.M):
    new_src = re.sub(r'^\[[\d.]+\]:', linkref + '\n' + r'\g<0>', new_src, count=1, flags=re.M)
else:
    new_src = new_src.rstrip() + '\n\n' + linkref
with open('CHANGELOG.md', 'w') as f:
    f.write(new_src)
print("package.json + CHANGELOG.md updated")
PY

# ---------- commit + tag + push ----------
git add package.json CHANGELOG.md
git commit -m "chore: release v$NEW"
git tag -a "v$NEW" -m "LinguaFlow $NEW

$(cat "$DRAFT")"
git push origin main
git push origin "v$NEW"
echo "pushed commit + tag v$NEW"

# ---------- extract the new section as release notes ----------
NOTES="$(python3 - "$NEW" <<'PY'
import sys, re
new_ver = sys.argv[1]
src = open('CHANGELOG.md').read()
pat = re.compile(r'^## \[' + re.escape(new_ver) + r'\](.*?)(?=^## \[|\Z)', re.M | re.S)
m = pat.search(src)
print(m.group(1).strip() if m else '')
PY
)"

python3 - "$NEW" "$NOTES" <<'PY'
import sys, json
tag, notes = sys.argv[1:3]
with open('/tmp/lf_release.json', 'w') as f:
    json.dump({
        "tag_name": "v" + tag,
        "name": "v" + tag,
        "body": notes,
        "draft": False,
        "prerelease": False,
    }, f)
PY

HTTP="$(curl -s -o /tmp/lf_release_resp.json -w "%{http_code}" -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/json" \
  -d @/tmp/lf_release.json \
  "https://api.github.com/repos/$OWNER/$REPO/releases")"

echo "GitHub API HTTP $HTTP"
if [ "$HTTP" = "201" ]; then
  URL="$(grep -o '"html_url": *"[^"]*"' /tmp/lf_release_resp.json | head -1 | sed 's/"html_url": *"//;s/"$//')"
  echo "RELEASE CREATED: $URL"
else
  echo "RELEASE FAILED:" >&2
  head -c 600 /tmp/lf_release_resp.json >&2
  echo "" >&2
fi

# ---------- cleanup ----------
rm -f "$DRAFT"
echo "done. Next version is v$NEW; CHANGELOG.draft.md consumed."
