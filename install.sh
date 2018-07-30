#!/usr/bin/bash
set -eux
if [[ ! -d $2 ]]; then
  echo "Usage %msgid ROOT"
  exit 1
fi
root="$2"

gpgdir=$HOME/.ssb-pacman/gpg
gpg="gpg --homedir $gpgdir"

# TODO
key=$1
pkg_url=$(sbot pacman.get $1 | jsonpath-dl url)
name=$(sbot pacman.get $1 | jsonpath-dl content.name)
arch=$(sbot pacman.get $1 | jsonpath-dl content.arch)

tmpdir=$(mktemp -d)
wget -P $tmpdir $pkg_url{,.sig}
archive=$(ls $tmpdir --hide=*.sig)
echo

$gpg --verify $tmpdir/*.sig $tmpdir/$archive
echo
echo "Package signature is ok, unpacking ..."
echo
mkdir $tmpdir/root
bsdtar -C $tmpdir/root -xvJf $tmpdir/$archive
echo

cp -r $tmpdir/root/* $root

if [[ -s $tmpdir/root/.INSTALL ]]; then
  msgfile=$tmpdir/ignored-install-script
  echo "# This installer ignores the following install scripts for package" > $msgfile
  echo "# $name $arch $key" >> $msgfile
  echo >> $msgfile
  cat $tmpdir/root/.INSTALL >> $msgfile
  less $msgfile
fi
