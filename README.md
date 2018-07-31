# Examples

## Install dependencies of pacman to direcotry `root`

sbot pacman.versions pacman --arch x86_64| jsonpath-dl record.VERSION key
sbot pacman.dependencies %znSz0++uDsr2q0ukmkltIxi3ZxmerngQPVvBZyG65mU=.sha256 --transitive --sort|jsonpath-dl key content.name record.DESC > pacman-deps
pacman-deps|cut -d" " -f3 | xargs -I% ./install.sh % root

## then install pacman itself
./install.sh %znSz0++uDsr2q0ukmkltIxi3ZxmerngQPVvBZyG65mU=.sha256 root

cp -r ~/.ssb-pacman/gpg root/etc/pacman.d/gnupg
sudo chroot root chown -R root:root /etc/pacman.d/gnupg
