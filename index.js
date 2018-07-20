console.log('HELLO!')
const zlib = require('zlib')

const pull = require('pull-stream')
const many = require('pull-many')
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
  get: 'async',
  updates: 'source',
  dependencies: 'source'
}

exports.init = function (ssb, config) {
  const ret = {}
  const importIfNew = ImportIfNew(ssb)
  const index = ssb._flumeUse('pacmanIndex', createIndex(
    10, function(kv) {
      const c = kv.value && kv.value.content
      const name = c && c.name
      const arch = c && c.arch
      const repo = c && c.repo
      if (!name || !arch || !repo) return []
      return [
        makeKey(arch, repo, name),
        ... makeDetailKeys(arch, repo, c.files || [])
      ]
    }
  ))

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
    if (!name || !arch) throw new Error('Required arguments: NAME --arch')
    const key = makeKey(arch, repo, name)
    console.log(key)
    pull(
      index.read(Object.assign({keys: false, values: true, seqs: false}, opts, {gte: key, lt: key + '}' })),
      pull.take(1),
      pull.collect( (err, results) => {
        if (err) return cb(err)
        if (results.length == 0) return cb(new Error(`Package not found: ${name}`))
        cb(null, results[0])
      })
    )
  }
  
  ret.versions = function(base, opts) {
    opts = opts || {}
    return pull(
      index.read(Object.assign({keys: true, values: false}, opts, {gte: base + '|', lt: base + '}' })),
      pull.map( o => o.key ),
      pull.map( parseDetailKey )
    )
  }

  ret.dependencies = transitiveDependenciesOf //directDependenciesOf;
    
  function directDependenciesOf(name, opts) {
    opts = opts || {}
    const version = opts.version
    const arch = opts.arcn

    const gt = ['DEP']
    if (name) {
      gt.push(name)
      if (version) {
        gt.push(version)
        if (arch) gt.push(arch)
      }
    }
    const lt = gt.slice()
    gt.push(null) 
    lt.push(undefined)

    return pull(
      index.read(Object.assign({
        values: false,
        seqs: false,
        keys: true
      }, opts, {
        gt, lt
      })),
      pull.map( k => k.slice(-1)[0] ),
      pull.unique(),
      pull.map(parseDependencySpec)
    )
  }

  function transitiveDependenciesOf(name, opts) {
    const seen = {}

    function _transDepsOf(name, level, opts) {
      if (seen[name]) return pull.empty()
      seen[name] = true
      
      return pull(
        directDependenciesOf(name, opts),
        pull.through( d => d.distance = level ),
        pull.map( d => many([
          pull.once(d),
          _transDepsOf(d.name, level + 1, opts)
        ])),
        pull.flatten()
      )
    }

    return pull(
      _transDepsOf(name, 1, opts),
      pull.through(console.log),
      pull.unique(d => `${d.name}`)
    )
  }

  ret.updates = function(opts) {
    return index.read(Object.assign({live: true, old: false}, opts))
  }

  ret.import = function(repopath, opts, cb) {
    return importIfNew(repopath, opts, cb)
  }
  return ret
}

function makeKey(arch, repo, name) {
  return `${arch}|${name}|${repo || ''}`
}

function makeDetailKeys(arch, repo, files) {
    const content = files.map( getFileContent ).join('\n')
    const p = parseFile(content)
    const deps = ary(p.DEPENDS || []).map( d => [
      'DEP', 
      p.NAME,
      p.VERSION, 
      arch, 
      d
    ])

    return [`${p.BASE || p.NAME}|${p.NAME}|${p.VERSION}|${arch}|${repo}|${p.CSIZE}|${p.ISIZE}|${p.BUILDDATE}`, ... deps]
}

function parseDetailKey(k) {
  const [base, name, version, arch, repo, csize, isize, builddate] = k.split('|')
  return {
    base, name, version, arch, repo, csize, isize, builddate
  }
}

function getFileContent(file) {
  if (file.encoding == 'utf8' || !file.encoding) return file.content
  let content = Buffer.from(file.content, file.encoding)
  if (file.compression == 'deflate') {
    content = zlib.inflateSync(content)
  } else if (file.compression) throw new Error('unsupported file compression: ' + file.compression)
  return content.toString()
}

function ary(x) {
  return Array.isArray(x) ? x : [x]
}


function parseDependencySpec(spec) {
  const m = spec.match(/^(.+?)(([=><]{1,2})(.+))?$/)
  if (!m) return null
  const [all, name, comparison, operator, operand] = m
  return {name, operator, operand}
}
