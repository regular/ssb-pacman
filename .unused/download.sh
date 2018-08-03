#!/usr/bin/bash
set -eux
if [[ ! -d $2 ]]; then
  echo "Usage %msgid ROOT"
  exit 1
fi
root="$2"

key=$1
pkg_url=$(sbot pacman.get $1 | jsonpath-dl url)

wget -P $root $pkg_url{,.sig}
