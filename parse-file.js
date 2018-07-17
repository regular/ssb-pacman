const pull = require('pull-stream')
const split = require('pull-split')

module.exports = function parse(content) {
  let currKey
  const ret = {}
  pull(
    pull.values([content]),
    split(),
    pull.map( line => {
      if (line.match(/^\s*$/)) return null
      const m = line.match(/^%([^%]+)%\s*$/)
      if (m) {
        currKey = m[1]
        return null
      }
      return line
    }),
    pull.filter(),
    pull.through( v => {
      if (!currKey) throw Error('Syntax Error: value line without key:' + v)
      if (!ret[currKey]) ret[currKey] = []
      ret[currKey].push(v)
    }),
    pull.collect( err => {
      if (err) throw err
      Object.keys(ret).forEach( k => {
        if (ret[k].length == 1) ret[k] = ret[k][0]
      })
    })
  )
  return ret // we can do this, because the pull-stream has no async parts
}
