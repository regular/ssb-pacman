#!/usr/bin/bash
set -eu -o pipefail
parentpid=$(pgrep update-all)
echo "update-all parent pid: $parentpid"
ps -o "pid,command" --ppid $parentpid | grep update.sh | awk '{ print $1,$4,$5 }'

