#!/usr/bin/bash
set -eu -o pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 ROOT"
  exit 1
fi
root="$1"

mkdir -p "$root"

# TODO: get pacman-deps
cat pacman-deps | cut -d" " -f3 | xargs -n 1 sh -c './install.sh "$0" "'$root'" || exit 255'

# then install pacman itself
./install.sh "%znSz0++uDsr2q0ukmkltIxi3ZxmerngQPVvBZyG65mU=.sha256" "$root"

# we install tar, because it is needed by the post-transaction hook
./install.sh "%D9L4VqSmUupC1nYj8GzU19btnDdXn27cWJnKnN0bqM4=.sha256" "$root"

sudo cp -r ~/.ssb-pacman/gpg $root/etc/pacman.d/gnupg
sudo arch-chroot $root chown -R root:root /etc/pacman.d/gnupg

# TODO: Why exactly do we need this?
sudo arch-chroot $root /usr/bin/pacman-key --init

# set up the post-transaction hook
sudo mkdir -p "$root/etc/pacman.d/hooks/"
sudo cp 99-add-ssb-key.hook "$root/etc/pacman.d/hooks/"
# TODO: where to put this?
sudo cp ssb-pacman-add-key "$root" 
sudo cp ssb-pacman-shrinkwrap.sh "$root" 

# re-install pacman and tar
# This executes .INSTALL scripts and our
# post-transaction hook, needed for
# creating a shrinkwrap file.
./ssb-pacman-install.sh pacman "$root"
./ssb-pacman-install.sh tar "$root"
echo
echo == Shrinkwrap ==
echo
sudo arch-chroot "$root" /ssb-pacman-shrinkwrap.sh
echo "== DONE =="
