#!/usr/bin/bash
set -eu
gpgdir=$HOME/.ssb-pacman/gpg
packey=(pacman-key --gpgdir $gpgdir)
gpg=(gpg --homedir $gpgdir)

# TODO: sort and pick latest
keyring_pkg_url=$(sbot pacman.versions archlinux-keyring --arch x86_64 | jsonpath-dl url)

tmpdir=$(mktemp -d)
wget -P $tmpdir $keyring_pkg_url{,.sig}
archive=$(ls $tmpdir --hide=*.sig)
bsdtar -C $tmpdir -xvJf $tmpdir/$archive
echo

git clone https://git.archlinux.org/archlinux-keyring.git $tmpdir/git-checkout
echo

keyringfile=$tmpdir/usr/share/pacman/keyrings/archlinux.gpg
$gpg --import $keyringfile

nopk=0
pkey=

while read -ra fields; do
  line="${fields[@]}"
  echo "$line"
  if grep -q "using ... key " < <(echo "$line") ; then
    pkey=$( echo "$line" | cut -d" " -f5 ) 
  fi
  if grep -q "No public" < <(echo "$line") ; then
    echo "Public key not available"
    nopk=1
  fi
done < <($gpg --verify $tmpdir/*.sig $tmpdir/*.xz 2>&1)
 
# It would be alarming, if the signing key is not contained in the package's keyring,
#if [[ nopk -gt 0 && -n pkey ]]; then
#  echo "Downloading key: $pkey"
#  $gpg --receive-key ${pkey: -16}
#fi

$gpg --list-sigs ${pkey: -16}

cat $tmpdir/usr/share/pacman/keyrings/archlinux-trusted | sort | cut -d":" -f1 > $tmpdir/packaged_keys
echo "Master keys listed in archlinux-keyring package:"
(cat $tmpdir/packaged_keys | xargs -I% $gpg --with-colons --list-key %) | node tools/parse-gpg.js
echo

cat $tmpdir/git-checkout/archlinux-trusted | sort | cut -d":" -f1 > $tmpdir/keys-from-git
echo "Master keys according to git.archlinux.org/archlinux-keyring.git:"
(cat $tmpdir/keys-from-git | xargs -I% $gpg --with-colons --list-key %) | node tools/parse-gpg.js
echo

node_modules/.bin/get-arch-master-keys | sort | cut -d"|" -f1 | tr -d ' ' > $tmpdir/keys-from-website
echo "Master keys listed on official website:"
node_modules/.bin/get-arch-master-keys | sort 
echo

pushd $tmpdir > /dev/null
diff -ws --to-file packaged_keys keys-from-git keys-from-website
popd > /dev/null

