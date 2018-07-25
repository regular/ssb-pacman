const {spawnSync} = require('child_process')

const allowed_result = {
  '=': [0],
  '>': [1],
  '<': [-1],
  '>=': [1, 0],
  '<=': [-1,0]
}

function satisfies(x, op, operand) {
  const allowed = allowed_result[op]
  if (!allowed) throw new Error('vercmp: illegal operator:' + op)
  const result = vercmp(x, operand)
  return allowed.includes(result)
}

function vercmp(v1, v2) {
  const {status, stdout, stderr} = spawnSync('/usr/bin/vercmp', [v1, v2])
  if (status) throw new Error(stderr.toString())
  return Number(stdout.toString())
}

module.exports = vercmp
module.exports.satisfies = satisfies
