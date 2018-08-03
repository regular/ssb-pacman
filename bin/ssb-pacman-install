#!/usr/bin/bash
set -eux
if [[ ! -d $2 ]]; then
  echo "Usage package-name ROOT"
  exit 1
fi
pkg="$1"
root="$2"

# taken from arch-bootstrap
configure_minimal_system() {
  local DEST=$1
  
  mkdir -p "$DEST/dev"
  sed -ie 's/^root:.*$/root:$1$GT9AUpJe$oXANVIjIzcnmOpY07iaGi\/:14657::::::/' "$DEST/etc/shadow"
  sudo touch "$DEST/etc/group"
  echo "bootstrap" > "$DEST/etc/hostname"

  local ADDR=$(sbot pacman.getAddress|tr -d \" | sed "s/localhost/127.0.0.1/")
  
  cat pacman.conf.in | sed "s|\(Server[[:space:]]*=\).*|\1 $ADDR|" > "$DEST/etc/pacman.conf"
}

configure_minimal_system "$root"

sudo arch-chroot "$root" bash -c "export GPGME_DEBUG=1; pacman -Sy"
sudo arch-chroot "$root" bash -c "export GPGME_DEBUG=1; pacman -S $pkg --debug --force"
sudo arch-chroot "$root" bash -c "pacman -Scc --debug --noconfirm" &>/dev/null
