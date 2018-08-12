#!/usr/bin/bash
set -eu -o pipefail
parentpid=$(pgrep -x ssb-pacman-sync|head -n1)
echo "sync parent pid: $parentpid"
ps -wwo "pid,command" --ppid "$parentpid" | grep repo | awk '{ print $1,$4,$5 }'

