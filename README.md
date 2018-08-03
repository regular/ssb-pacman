# Objective

- enable offline instalation of packages
- keep old version of archlinux and archlinuxarm  packages
- sync metadata via ssb
- allow peer-to-peer installations
- enable reproducable rootfs builds
- mimic a local mirror server that pacman can use
- create custom syncdb on demand, fitlering packages not in a given shrinkwrap file

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
# TODO

- [ ] bindings for vercmp instead of spawning the binary

- [ ] check SHA before adding blob
- [ ] clean up bootstrap
- [ ] clean up signing (rename to keyring-setup)
- [ ] rename install.sh to extract
- [ ] unified binary
- [ ] sbot pacman.startSession ID
        returns stream of events
- [ ] sbot pacman.applyShrinkwrap --session ID
        write shrinkwrap file into session
- [ ] sbot pacman.getAddress --session ID

# Surprises

- arch=any packages like "archlinux-keyring" are in all of the sync databases for each architecture. However, they actaully have different SHA256SUM entries in the sync db. So, we can not de-dupe based on SHA (or blobid). The reason for this is most likely the inclusion ov BUILDDATE in the metadata.


# IDEAS

## Reducing space requirements

Because all packages are compressed individually, we cannot take advantage of any overlap of binaty data between packages or differnt versions of packages. (First being relevant for data contained in packages for differnt architecture, latter being relevant for patches and bug fixes that only affect a few files in a big package)

One way to solve this could be to put the blob store onto a filesystem that has de-dupe and compression capabilites and then uncompress packages before storing them. We should set up an experiment to test this theory.



