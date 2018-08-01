set -eu -o pipefail


re_sha="^.*/desc %SHA256SUM%$"
re_key="ssb %KEY%$"

installed () {
  pacman -Q | while read -ra fields; do
    printf "%s-%s/* " ${fields[@]}
  done
}

meta () {
  local syncdb=/var/lib/pacman/sync/${1}.db
  local pkgs=$(installed)
  tar --wildcards -xf $syncdb $pkgs --to-command='cat - | tr "\n" "\0" | xargs -L1 -0 printf "%s %s\n" "$TAR_FILENAME"' 2>/dev/null || true
}

all_meta () {
  for repo in $(ls /var/lib/pacman/sync|cut -d. -f1); do
    meta $repo
  done
}

getSHAandKey () {
  local SHA=false
  local KEY=false
  all_meta | while read -r line; do
    if [[ "$SHA" = true ]]; then
      SHA=false
       echo "SHA $line"
    fi
    if [[ "$KEY" = true ]]; then
      KEY=false
     echo "KEY $line"
    fi
    if [[ "$line" =~ $re_sha ]]; then
      SHA=true
    fi
    if [[ "$line" =~ $re_key ]]; then
      KEY=true
    fi
  done
}

fill () {
  local t
  local pkg
  local value
  getSHAandKey | while read -ra fields; do
    t=${fields[0]}
    pkg=$(echo "${fields[1]}"|cut -d/ -f1)
    value=${fields[2]}
    if [[ $t = KEY ]]; then
      keys[$pkg]="$value"
    fi
    if [[ $t = SHA ]]; then
      shas[$pkg]="$value"
    fi
  done
}

output () {
  pacman -Q | while read -ra fields; do
    pkg=$(printf "%s-%s" ${fields[@]})
    echo $pkg
    key="${keys[$pkg]}"
    sha="${shas[$pkg]}"
    printf "%s: %s %s\n" "$pkg" "$sha" "$key"
  done
}

declare -A keys
declare -A shas
fill
output
