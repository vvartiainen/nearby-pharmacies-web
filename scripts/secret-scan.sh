#!/usr/bin/env bash
set -o pipefail

root=$(cd "$(dirname "$0")/.." && pwd -P) || exit 1
cd "$root" || exit 1

findings_status=42
scan_flags=(--redact=100 --no-color --no-banner --exit-code "$findings_status" --verbose)

scan_worktree() {
  git ls-files --cached --others --exclude-standard --deduplicate -z |
    (
      files=()
      while IFS= read -r -d '' path; do
        if [[ -f "$path" && ! -L "$path" ]]; then
          files+=("./$path")
        fi
      done
      if (( ${#files[@]} > 0 )); then
        betterleaks dir "${scan_flags[@]}" -- "${files[@]}"
      fi
    )
}

scan() {
  if ! command -v betterleaks >/dev/null; then
    printf '%s\n' 'Betterleaks is missing. Enter the Nix shell or install Betterleaks 1.x.' >&2
    return 1
  fi
  if [[ $(git rev-parse --show-toplevel) != "$root" ]]; then
    printf '%s\n' 'Run the secret scan from a Git checkout of this repository.' >&2
    return 1
  fi

  local worktree_status=0 staged_status=0 status
  scan_worktree || worktree_status=$?
  betterleaks git --staged "${scan_flags[@]}" . || staged_status=$?

  for status in "$worktree_status" "$staged_status"; do
    if (( status != 0 && status != findings_status )); then
      return 1
    fi
  done
  if (( worktree_status == findings_status || staged_status == findings_status )); then
    return "$findings_status"
  fi
}

case "${1:-}" in
  "")
    scan
    ;;
  --hook)
    stop_hook_active=$(jq -r '.stop_hook_active // false' 2>/dev/null) || stop_hook_active=true
    status=0
    scan >/dev/null 2>&1 || status=$?
    if (( status == findings_status )); then
      if [[ "$stop_hook_active" == true ]]; then
        printf '%s\n' '{"systemMessage":"Betterleaks still reports possible secrets. Review the redacted findings with scripts/secret-scan.sh."}'
      else
        printf '%s\n' '{"decision":"block","reason":"Betterleaks found possible secrets. Run scripts/secret-scan.sh for redacted locations and resolve the findings before finishing."}'
      fi
    elif (( status != 0 )); then
      printf '%s\n' '{"systemMessage":"The Betterleaks scan could not complete. Run scripts/secret-scan.sh for diagnostics. The Nix shell provides Betterleaks and jq."}'
    fi
    ;;
  *)
    printf '%s\n' 'Usage: scripts/secret-scan.sh [--hook]' >&2
    exit 1
    ;;
esac
