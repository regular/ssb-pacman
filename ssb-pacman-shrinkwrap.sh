set -eu -o pipefail

for p in $(pacman -Qe|tr " " "-"); do printf "%s explicit %s\n" $(cat /var/lib/pacman/local/$p/ssb-key) $p; done
for p in $(pacman -Qd|tr " " "-"); do printf "%s dependency %s\n" $(cat /var/lib/pacman/local/$p/ssb-key) $p; done