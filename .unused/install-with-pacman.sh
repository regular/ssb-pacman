#!/usr/bin/bash
set -eux
if [[ ! -d $2 ]]; then
  echo "Usage %msgid ROOT"
  exit 1
fi
root="$2"

# taken from arch-bootstrap
configure_minimal_system() {
  local DEST=$1
  
  mkdir -p "$DEST/dev"
  sed -ie 's/^root:.*$/root:$1$GT9AUpJe$oXANVIjIzcnmOpY07iaGi\/:14657::::::/' "$DEST/etc/shadow"
  sudo touch "$DEST/etc/group"
  echo "bootstrap" > "$DEST/etc/hostname"
  
  sudo sed -i "s/^[[:space:]]*\(CheckSpace\)/# \1/" "$DEST/etc/pacman.conf"
  # in contrast to arch-bootstrap, we actually check signatures
  # sed -i "s/^[[:space:]]*SigLevel[[:space:]]*=.*$/SigLevel = Never/" "$DEST/etc/pacman.conf"
}

configure_minimal_system "$root"

gpgdir=$HOME/.ssb-pacman/gpg
gpg="gpg --homedir $gpgdir"

key=$1
pkg_url=$(sbot pacman.get $1 | jsonpath-dl url)

tmpdir=$(mktemp -d)
wget -P $tmpdir $pkg_url{,.sig}
archive=$(ls $tmpdir --hide=*.sig)
echo

$gpg --verify $tmpdir/*.sig $tmpdir/$archive
echo
echo "Package signature is ok, installing ..."
echo
mkdir -p $root/tmp
cp $tmpdir/* $root/tmp/
sudo chroot $root bash -c "export GPGME_DEBUG=1; pacman -U /tmp/$archive --force --noconfirm --debug"
rm -rf $root/tmp/*
