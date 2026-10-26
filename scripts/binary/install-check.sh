#!/usr/bin/env bash
# Checks `openspec-cn install` against a release served at OPENSPEC_DOWNLOAD_URL:
# run from the Node build, as an npm user would, and by the binary on itself,
# which reinstalls in place. Needs `pnpm build`.
#
#   OPENSPEC_DOWNLOAD_URL=http://127.0.0.1:8766 bash scripts/binary/install-check.sh dist-bin/openspec-cn-<asset>
set -euo pipefail

asset=$1
ext=""
case "$asset" in *.exe) ext=".exe" ;; esac
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
export XDG_CONFIG_HOME="$work/config" XDG_DATA_HOME="$work/data" OPENSPEC_TELEMETRY=0 OPENSPEC_NO_UPDATE_CHECK=1
fail() { echo "FAIL: $*" >&2; exit 1; }

# 1. From the Node build, into a fresh folder.
OPENSPEC_INSTALL_DIR="$work/from-node" node bin/openspec.js install
cmp "$work/from-node/openspec-cn$ext" "$asset" || fail "从 Node 安装写入的文件不正确"
"$work/from-node/openspec-cn$ext" version | grep -q '(standalone)' || fail "安装的副本不是独立版"

# 2. The binary replacing itself where it is, under its own (custom) name.
# Twice: on Windows the running exe is set aside, and the next run removes it.
mkdir "$work/self"
self="$work/self/my-openspec$ext"
cp "$asset" "$self"
for run in 1 2; do
  out=$(env -u OPENSPEC_INSTALL_DIR -u OPENSPEC_INSTALL_NAME "$self" install 2>&1) || fail "自安装第 $run 次运行失败：$out"
  case "$out" in *"已安装 openspec-cn"*"my-openspec$ext"*) ;; *) fail "自安装第 $run 次未能替换自身：$out" ;; esac
  cmp "$self" "$asset" || fail "自安装第 $run 次写入的文件不正确"
done
"$self" version | grep -q '(standalone)' || fail "重新安装的副本不是独立版"
leftovers=$(find "$work/self" -mindepth 1 -maxdepth 1 ! -name "my-openspec$ext" | wc -l | tr -d ' ')
[ "$leftovers" -le 1 ] || fail "二进制旁边的文件堆积：$(ls -A "$work/self")"

echo "OK: openspec-cn install ($asset)"
