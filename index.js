console.log('HELLO!')
const zlib = require('zlib')

const pull = require('pull-stream')
const createIndex = require('flumeview-level')
const createReduce = require('flumeview-reduce')
const hs = require('human-size')

const ImportIfNew = require('./import-if-new')
const parseFile = require('./parse-file')

exports.name = 'pacman'
exports.version = require('./package.json').version
exports.manifest = {
  'import': 'source',
  versions: 'source',
  stats: 'async',
  get: 'async'
}

exports.init = function (ssb, config) {
  const ret = {}
  const importIfNew = ImportIfNew(ssb)
  const index = ssb._flumeUse('pacmanIndex', createIndex(2, function(kv) {
    const c = kv.value && kv.value.content
    const name = c && c.name
    const arch = c && c.arch
    const repo = c && c.repo
    if (!name || !arch || !repo) return []
    return [makeKey(arch, repo, name)]
  }))

  const reduce = ssb._flumeUse('pacmanReduce', createReduce(4, {
    initial: {stats: {}},

    map: function(kv) {
      const c = kv.value && kv.value.content
      const arch = c && c.arch
      const repo = c && c.repo
      const files = c && c.files
      const meta_size = JSON.stringify(kv.value).length
      if (!arch || !repo || !files) return
      const desc = files.find( f => f.name == 'desc')
      if (!desc) return
      const content = getFileContent(desc)
      const props = parseFile(content)
      return {
        arch,
        repo,
        meta_size,
        csize: Number(props.CSIZE),
        isize: Number(props.ISIZE)
      }
    },
    reduce: function(acc, {arch, repo, meta_size, csize, isize}) {
      const stats = acc.stats
      if (!stats[arch]) stats[arch] = {}
      if (!stats[arch][repo]) stats[arch][repo] = {}
      const s = stats[arch][repo]
      s.count = (s.count || 0) + 1
      s.csize = (s.csize || 0) + csize
      s.isize = (s.isize || 0) + isize
      s.meta_size = (s.meta_size || 0) + meta_size
      return acc
    }
  }))

  ret.stats = function(opts, cb) {
    opts = opts || {}
    reduce.get(opts, (err, view) => {
      const stats = view.value.stats

      if (err) return cb(err)
      if (!opts.human) return cb(null, stats)

      let s = ''
      let total = 0
      Object.keys(stats).forEach( arch => {
        s += `\n${arch}\n` 
        let sum = 0
        Object.keys(stats[arch]).forEach( repo => {
          const r = stats[arch][repo]
          s += `- ${repo}: ${r.count} packages, ${hs(r.csize)} (${hs(r.isize)} uncompressed), meta data: ${hs(r.meta_size)}\n`
          sum += r.csize
        })
        s += `space required: ${hs(sum)}\n`
        total += sum
      })
      s += `\n\nTotal space required for all architectures: ${hs(total)}\n`
      cb(null, s)
    })
  }

  ret.get = function(name, opts, cb) {
    opts = opts || {}
    const arch = opts && opts.arch
    const repo = opts && opts.repo
    if (!name || !arch || !repo) throw new Error('Required options: --arch, --repo')
    const key = makeKey(arch, repo, name)
    index.get(key, cb)
  }
  
  ret.versions = function(name, opts) {
    opts = opts || {}
    const arch = opts && opts.arch
    const repo = opts && opts.repo
    if (!name || !arch || !repo) throw new Error('Required options: --arch, --repo')
    const key = makeKey(arch, repo, name)
    return index.read(Object.assign({keys: true, values: false}, opts, {gte: key + '-', lt: key + '.'}))
  }

  ret.import = function(repopath, opts, cb) {
    return importIfNew(repopath, opts, cb)
  }
  return ret
}

function makeKey(arch, repo, name) {
  return `${arch}|${repo}|${name}`
}

function getFileContent(file) {
  if (file.encoding == 'utf8' || !file.encoding) return file.content
  let content = Buffer.from(file.content, file.encoding)
  if (file.compression == 'deflate') {
    content = zlib.inflateSync(content)
  } else if (file.compression) throw new Error('unsupported file compression: ' + file.compression)
  return content.toString()
}
