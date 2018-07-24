#!/usr/bin/bash
set -eux
gpgdir=$HOME/.ssb-pacman/gpg
packey=(pacman-key --gpgdir $gpgdir)
gpg=(gpg --homedir $gpgdir)

# TODO: sort and pick latest
keyring_pkg_url=$(sbot pacman.versions archlinux-keyring --arch x86_64 | jsonpath-dl url)

tmpdir=$(mktemp -d)
wget -P $tmpdir $keyring_pkg_url{,.sig}
archive=$(ls $tmpdir --hide=*.sig)
bsdtar -C $tmpdir -xvJf $archive

keyringfile=$tmpdir/usr/share/pacman/keyrings/archlinux.gpg
$gpg --import $keyringfile

nopk=0
pkey=

while read -ra fields; do
  line="${fields[@]}"
  if grep -q "using ... key " < <(echo "$line") ; then
    pkey=$( echo "$line" | cut -d" " -f5 ) 
  fi
  if grep -q "No public" < <(echo "$line") ; then
    echo "Public key not available"
    nopk=1
  fi
done < <($gpg --verify $tmpdir/*.sig $tmpdir/*.xz 2>&1)
  
if [[ nopk -gt 0 && -n pkey ]]; then
  echo "Downloading key: $pkey"
  $gpg --receive-key ${pkey: -16}
fi

$gpg --list-sigs ${pkey: -16}

echo "Master keys listed in archlinux-keyring package:"

rm pipe1 || true
mkfifo pipe1
(cat $tmpdir/usr/share/pacman/keyrings/archlinux-trusted | cut -d":" -f1 | sort | xargs -I% $gpg --with-colons --list-key %) | node tools/parse-gpg.js
echo
echo "Master keys listed on website:"
node node_modules/get-arch-master-keys/index.js | sort
