#!/usr/bin/env bash
# Deploy modules to meta.wikimedia.org User: pages.
# See DEPLOY.md for setup instructions.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="https://meta.wikimedia.org/w/api.php"
USER_PREFIX="User:Sadrettin"
UA="sadrettin-userscripts-deploy/1.0 (https://github.com/Sadrettin86/sadrettin-userscripts; ademozcna@gmail.com)"

if ! command -v jq >/dev/null 2>&1; then
    echo "Error: jq is required (brew install jq)" >&2
    exit 1
fi

if [[ -z "${MEDIAWIKI_USER:-}" || -z "${MEDIAWIKI_PASSWORD:-}" ]]; then
    cat >&2 <<EOF
Error: MEDIAWIKI_USER and MEDIAWIKI_PASSWORD must be set.

Create a bot password at:
  https://meta.wikimedia.org/wiki/Special:BotPasswords

Then export:
  export MEDIAWIKI_USER='Sadrettin@deploy-bot'
  export MEDIAWIKI_PASSWORD='generated-bot-password'
EOF
    exit 1
fi

# File → User: subpage mapping (relative to repo root)
declare -a TARGETS=(
    "core.js                              core.js"
    "modules/heading-buttons.js           heading-buttons.js"
    "modules/p373-helper.js               p373-helper.js"
    "modules/p527-to-p361.js              p527-to-p361.js"
    "modules/commons-category-creator.js  commons-category-creator.js"
    "modules/commons-infobox.js           commons-infobox.js"
    "modules/commons-p180-bulk.js         commons-p180-bulk.js"
    "styles/common.css                    global.css"
)

COOKIES="$(mktemp)"
trap 'rm -f "$COOKIES"' EXIT

echo "→ Logging in as $MEDIAWIKI_USER"

LOGIN_TOKEN="$(curl -sS -A "$UA" -c "$COOKIES" -b "$COOKIES" \
    "$API?action=query&meta=tokens&type=login&format=json" \
    | jq -r '.query.tokens.logintoken')"

LOGIN_RESULT="$(curl -sS -A "$UA" -c "$COOKIES" -b "$COOKIES" -X POST "$API" \
    --data-urlencode "action=login" \
    --data-urlencode "lgname=$MEDIAWIKI_USER" \
    --data-urlencode "lgpassword=$MEDIAWIKI_PASSWORD" \
    --data-urlencode "lgtoken=$LOGIN_TOKEN" \
    --data-urlencode "format=json" \
    | jq -r '.login.result // "Unknown"')"

if [[ "$LOGIN_RESULT" != "Success" ]]; then
    echo "Login failed: $LOGIN_RESULT" >&2
    exit 1
fi

CSRF_TOKEN="$(curl -sS -A "$UA" -c "$COOKIES" -b "$COOKIES" \
    "$API?action=query&meta=tokens&type=csrf&format=json" \
    | jq -r '.query.tokens.csrftoken')"

if [[ -z "$CSRF_TOKEN" || "$CSRF_TOKEN" == "+\\" ]]; then
    echo "Failed to get CSRF token" >&2
    exit 1
fi

echo "→ Logged in. Deploying ${#TARGETS[@]} files."
echo

GIT_SHA="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo 'local')"
SUMMARY="Deploy from sadrettin-userscripts @ $GIT_SHA"

FAILED=0
for entry in "${TARGETS[@]}"; do
    # parse "src target" (whitespace-separated, multiple spaces ok)
    src="$(echo "$entry" | awk '{print $1}')"
    target="$(echo "$entry" | awk '{print $2}')"
    page_title="${USER_PREFIX}/${target}"
    src_path="$REPO_ROOT/$src"

    if [[ ! -f "$src_path" ]]; then
        echo "✗ $page_title  (source missing: $src)"
        FAILED=$((FAILED+1))
        continue
    fi

    response="$(curl -sS -A "$UA" -c "$COOKIES" -b "$COOKIES" -X POST "$API" \
        --data-urlencode "action=edit" \
        --data-urlencode "title=$page_title" \
        --data-urlencode "text@$src_path" \
        --data-urlencode "summary=$SUMMARY" \
        --data-urlencode "token=$CSRF_TOKEN" \
        --data-urlencode "format=json" \
        --data-urlencode "bot=1")"

    result="$(echo "$response" | jq -r '.edit.result // empty' 2>/dev/null || true)"
    error="$(echo "$response" | jq -r '.error.code // empty' 2>/dev/null || true)"

    if [[ -z "$result" && -z "$error" ]]; then
        echo "✗ $page_title  (malformed response)"
        echo "    $response" >&2
        FAILED=$((FAILED+1))
        continue
    fi

    if [[ "$result" == "Success" ]]; then
        nochange="$(echo "$response" | jq -r '.edit.nochange // empty')"
        if [[ -n "$nochange" ]]; then
            echo "= $page_title  (no change)"
        else
            echo "✓ $page_title"
        fi
    else
        echo "✗ $page_title  (${error:-unknown error})"
        echo "    $response" >&2
        FAILED=$((FAILED+1))
    fi
done

echo
if [[ $FAILED -gt 0 ]]; then
    echo "Done with $FAILED failure(s)." >&2
    exit 1
fi
echo "Done."
