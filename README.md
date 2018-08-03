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
ssb-pacman-sync
```

This will take a long time to finish. You can use the scripts in `monitor` to watch the progress. (use tmux for a full dashboard-style experience)

Meanwhile, in yet another terminal:

```
ssb-pacman-init-keyring
```

## Install a minimal system in directory `root`

```
ssb-pacman-bootstrap root
```

This downloads and extracts the latest version of pacman and then runs it, so it can re-install itself properly (i.e. withe running package-specific
.INSTALL scripts and pacman hooks, both witch are not done by the initial extract pass)
This results in a clean, minimal system with a working package manager that uses the secure scuttlebutt network as its "mirror server".

## Use pacman to install a packages with dependencies in the chroot

```
# TODO: support multiple package names
ssb-pacman-install vim root
ssb-pacman-install sed root
ssb-pacman-install grep root
```

A pacman post-transaction hook is installed in the target root, that records
the exact hashes of installed packages. This is called the "shrinkwrap file". It's purpose
is similar to package-lock.json or npm's shrinkwrap file.


# Create shrinkwrap file

```
sudo arch-chroot /ssb-pacman-shrinkwrap
```

You can enter the chroot to test stuff out.

```
sudo arch chroot
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



