#!/usr/bin/bash
set -eux -o pipefail

if [[ ! -d $1 ]]; then
  echo "Usage ROOT"
  exit 1
fi
root="$1"

mkdir -p $root
#cat pacman-deps | cut -d" " -f3 | xargs -I% ./install.sh % $root

# then install pacman itself
./install.sh "%znSz0++uDsr2q0ukmkltIxi3ZxmerngQPVvBZyG65mU=.sha256" $root

sudo cp -r ~/.ssb-pacman/gpg $root/etc/pacman.d/gnupg
sudo chroot $root chown -R root:root /etc/pacman.d/gnupg
sudo chroot $root /usr/bin/pacman-key --init

cat pacman-deps | cut -d" " -f3 | xargs -I% ./install-with-pacman.sh "%" $root

## then install pacman itself
./install-with-pacman.sh "%znSz0++uDsr2q0ukmkltIxi3ZxmerngQPVvBZyG65mU=.sha256" $root
