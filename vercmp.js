const pull = require('pull-stream')
const spawn = require('pull-spawn-process')

module.exports = function(v1, v2, cb) {
  pull(
    spawn('/usr/bin/vercmp', [v1, v2]),
    pull.collect( (err, result) => {
      if (err) return cb(err)
      console.log(Buffer.concat(result).toString())
      cb(null, Number(Buffer.concat(result).toString()))
    })
  )
}


