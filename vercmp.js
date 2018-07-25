const {spawnSync} = require('child_process')

module.exports = function(v1, v2) {
  const {status, stdout, stderr} = spawnSync('/usr/bin/vercmp', [v1, v2])
  if (status) throw new Error(stderr.toString())
  return Number(stdout.toString())
}


