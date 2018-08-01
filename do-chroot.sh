set -exu

source ./pacstrap.lib

chroot_setup $1
chroot $1
