const pull = require('pull-stream')
const stdio = require('pull-stdio')
const split = require('pull-split')
const group = require('pull-group')

pull(
  stdio.stdin(),
  split(),
  pull.map( l => l.split(':') ),
  (function() { // filter fingerprints, except for the 1st after pub
    let allow={}
    return pull.filter( fields => {
      const t = fields[0]
      if (t == 'pub') {
        allow.uid = 1
        allow.fpr = 1
        return false
      }
      if (allow[t]) {
        allow[t]--
        return true
      }
      return false
    })
  })(),
  pull.map( fields => ({[fields[0]]: fields[9]}) ),
  group(2),
  pull.map( x => Object.assign.apply({}, x) ),
  pull.drain( ({uid, fpr}) => {
    console.log(`${fpr} | ${uid}`)
  }, (err, acc) => {
    if (err) {
      console.error(err.msg)
      process.exit(1)
    }
  })
)
