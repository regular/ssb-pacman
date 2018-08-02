# TODO

- [ ] check SHA before adding blob
- [ ] clean up bootstrap
- [ ] clean up signing (rename to keyring-setup)
- [ ] rename install.sh to extract
- [x] install post-transaction hook
- [ ] unified binary
- [ ] sbot pacman.startSession ID
        returns stream of events
- [ ] sbot pacman.applyShrinkwrap --session ID
        write shrinkwrap file into session
- [ ] sbot pacman.getAddress --session ID

# Installation

## Install sbot and ssb-pacman

```
npm -g i scuttlebot-release
mkdir -p ~/.ssb-pacman/node_modules
cd ~/.ssb-pacman/node_modules/
git clone git@github.com:regular/ssb-pacman
cd ssb-pacman
npm i
npm -g link
cp sbot.config ../../config
export ssb_appname=ssb-pacman
sbot start
```

in a different terminal


```
# should be: ssb-pacman sync
cd ~/.ssb-pacman/node_modules/ssb-pacman
./update-all.sh
```

(this will take a long time to finish)

Meanwhile, in yet another terminal:

```
./signing.sh
# should be: ssb-pacman keyring-setup
```

## Install a minimal system in directory `root`

```
sbot pacman.versions pacman --arch x86_64| jsonpath-dl record.VERSION key
sbot pacman.dependencies %znSz0++uDsr2q0ukmkltIxi3ZxmerngQPVvBZyG65mU=.sha256 --transitive --sort|jsonpath-dl key content.name record.DESC > pacman-deps
./bootstrap.sh root
```

## Use pacman to install a packages with dependencies in the chroot

```
# should be: ssb-pacman install --root=root sed grep vim
./ssb-pacman-install sed root
./ssb-pacman-install grep root
./ssb-pacman-install vim root
```

# Create shrinkwrap file

```
# should be: ssb-pacman shrinkwrap root
sudo arch-chroot /ssb-pacman-shrinkwrap.sh
```

