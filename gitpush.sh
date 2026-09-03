#!/usr/bin/env bash
set -euo pipefail

# Publish the current working tree as a single root commit without changing
# the local branch, index, or working-tree files. Files matched by .gitignore
# are omitted from the remote snapshot.
cd "$(git rev-parse --show-toplevel)"

publish_tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/git-publish.XXXXXX")
trap 'rm -rf -- "$publish_tmp_dir"' EXIT

export GIT_INDEX_FILE="$publish_tmp_dir/index"
git read-tree --empty
git add -A -- .

tree=$(git write-tree)
commit=$(git commit-tree "$tree" -m "update")

unset GIT_INDEX_FILE
git push --force origin "$commit:refs/heads/main"
