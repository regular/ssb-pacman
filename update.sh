#!/usr/bin/bash
set -eux

if [ $# -lt 4 ]; then
  echo "Usage: $0 ARCH REPO URL"
fi

cache=$(dirname $(sbot config|jsonpath-dl config) )/pacman-cache
mkdir -p $cache
tmp=$(mktemp -d)
arch=$1
repo=$2
file=$arch-$repo.db.tar.gz
## NOTE: none of the (working) mirrors support https!
## Thus, the list of packages cannot be trusted (it is not signed)
base_url=$3
url=$base_url/$repo.db.tar.gz

etag=$(grep "< ETag:" <(curl -vL -z $cache/$file -o $cache/$file $url 2>&1) | cut '-d ' -f3 | tr -d "\"\r" )

if [ "$(cat $cache/$arch-$repo-etag || echo "n/a")" == "$etag" ]; then
  echo "Nothing to do" >&2
  exit 0
fi

rm -rf $tmp/$arch-$repo || true
mkdir -p $tmp/$arch-$repo
tar -xz -C $tmp/$arch-$repo -f $cache/$file
sbot pacman.import $(realpath $tmp/$arch-$repo) --arch $arch --repo $repo --url "$base_url"
echo -n $etag > $cache/$arch-$repo-etag
