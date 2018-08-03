#!/usr/bin/bash
set -eux -o pipefail

# ARM
for arch in aarch64 arm armv6h armv7h; do
  for repo in alarm aur community core extra; do
    base_url=http://de.mirror.archlinuxarm.org/$arch/$repo
    ./update.sh $arch $repo "$base_url" 2>&1 >/dev/null &
  done
done

# x86_64
for arch in x86_64; do
  for repo in community core extra multilib; do
    base_url=http://mirrors.evowise.com/archlinux/$repo/os/$arch
    ./update.sh $arch $repo "$base_url" 2>&1 >/dev/null &
  done
done

sbot pacman.updates --no-values|jsonpath-dl key|tr "|" "\t"
