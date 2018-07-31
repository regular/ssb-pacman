# Examples

## Install dependencies of pacman to direcotry `root`

sbot pacman.versions pacman --arch x86_64| jsonpath-dl record.VERSION key
sbot pacman.dependencies %znSz0++uDsr2q0ukmkltIxi3ZxmerngQPVvBZyG65mU=.sha256 --transitive --sort|jsonpath-dl key content.name record.DESC > pacman-deps
pacman-deps|cut -d" " -f3 | xargs -I% ./install.sh % root

## then install pacman itself
./install.sh %znSz0++uDsr2q0ukmkltIxi3ZxmerngQPVvBZyG65mU=.sha256 root

## Create an execution environment for pacman in the chroot and re-install pacman deps using pacman itself

./bootstrap.sh root


## Use pacman to install a single package in the chroot

./install-with-pacman.sh "%znSz0++uDsr2q0ukmkltIxi3ZxmerngQPVvBZyG65mU=.sha256" root

## Use pacman to install a packages with dependencies in the chroot

./ssb-pacman-install sed grep vim

