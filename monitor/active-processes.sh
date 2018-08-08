#!/usr/bin/bash
set -eu -o pipefail
parentpid=$(pgrep -x ssb-pacman-sync|head -n1)
echo "sync parent pid: $parentpid"
ps -o "pid,command" --ppid "$parentpid" | grep ssb-pacman-sync-repo #| awk '{ print $1,$4,$5 }'

