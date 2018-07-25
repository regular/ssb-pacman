const zlib = require('zlib')
const crypto = require('crypto')
const url = require('url')

const pull = require('pull-stream')
const many = require('pull-many')
const sort = require('pull-sort')
const createIndex = require('flumeview-level')
const createReduce = require('flumeview-reduce')
const hs = require('human-size')

const ImportIfNew = require('./import-if-new')
const parseFile = require('./parse-file')
const vercmp = require('./vercmp')

exports.name = 'pacman'
exports.version = require('./package.json').version
exports.manifest = {
  'import': 'source',
  versions: 'source',
  stats: 'async',
  get: 'async',
  updates: 'source',
  dependencies: 'source',
  providers: 'source',
  sha256: 'async'
}

exports.init = function (ssb, config) {
  const ret = {}
  const importIfNew = ImportIfNew(ssb)
  const index = ssb._flumeUse('pacmanIndex', createIndex(
    16, function(kv) {
      const c = kv.value && kv.value.content
      const name = c && c.name
      const arch = c && c.arch
      const repo = c && c.repo
      const blob = c && c.blob
      if (!name || !arch || !repo) return []
      return [
        makeKey(arch, repo, name),
        ... makeDetailKeys(arch, repo, c.files || [], blob)
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

  ssb.ws.use(function (req, res, next) {
    if(!(req.method === "GET" || req.method == 'HEAD')) return next()
    const u = url.parse('http://makeurlparseright.com'+req.url)
    const m = u.pathname.match(/^\/archlinux\/([^\/]+)\/([^\/]+)\/(.+?)(\.sig)?$/)
    if (!m) return next()
    const [_, repo, arch, filename, sig] = m

    console.log('HTTP', repo, arch, filename)
    index.get(['RAF', repo, arch, filename], (err, kv) => {
      if (err) return res.end('Not found', 404)
      if (sig) {
        const files = kv.value && kv.value.content && kv.value.content.files
        const pgpsig = Buffer.from(parseFiles(files).PGPSIG, 'base64')
        res.setHeader('Content-Type', 'application/octet-stream')
        res.setHeader('Content-Length', pgpsig.length)
        res.end(pgpsig)
        return
      }
      const blob = kv.value && kv.value.content && kv.value.content.blob
      req.url = `/blobs/get/${encodeURIComponent(blob)}`
      //res.end(JSON.stringify(kv, null, 2))    
      next()
    })
  })

  function getPackageUrl(repo, arch, filename) {
    const addr = ssb.ws.getAddress()
    const m =  addr.match(/\:\/\/(.*?)\~/)
    const http_host = m[1]
    return `http://${http_host}/archlinux/${repo}/${arch}/${filename}`
  }
  
  ret.sha256 = function(name, opts, cb) {
    ret.get(name, opts, (err, {value}) => {
      if (err) return cb(err)
      const p = parseFiles(value.content.files)
      const expectedSHA = p.SHA256SUM

      pull(
        ssb.blobs.get(value.content.blob),
        pull.reduce(
          (hash, buf)  => hash.update(buf),
          crypto.createHash('sha256'),
          (err, hash) =>{
            const actualSHA = hash.digest('hex')
            if (err) return cb(err)
            cb(null, {
              actualSHA,
              expectedSHA,
              matches: actualSHA == expectedSHA
            })
          }
        )
      )
    })
  }

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
    if (typeof opts == 'function') {cb = opts; opts = {} }
    opts = opts || {}
    const arch = opts && opts.arch
    const repo = opts && opts.repo
    if (!name || !arch) throw new Error('Required arguments: NAME --arch')
    const key = makeKey(arch, repo, name)
    pull(
      index.read(Object.assign({keys: false, values: true, seqs: false}, opts, {gte: key, lt: key + '}' })),
      pull.take(1),
      pull.collect( (err, results) => {
        if (err) return cb(err)
        console.log(results)
        if (results.length == 0) return cb(new Error(`Package not found: ${name}`))
        cb(null, results[0])
      })
    )
  }
  
  ret.versions = function(name, opts) {
    opts = opts || {}
    const {gt, lt} = query('NAVR', [
      name, opts.arch, opts.version, opts.repo
    ])
    return pull(
      index.read(Object.assign({}, opts, {gt, lt, values: true, keys: true} )),
      pull.through( i => i.key = parseNAVRKey(i.key) ),
      pull.unique( i => i.key.sha256 ),
      pull.through( i => {
        i.content = i.value.value.content
        i.record = parseFiles(i.content.files)
        delete i.content.files
        delete i.value
        i.url = getPackageUrl(i.content.repo, i.content.arch, i.record.FILENAME)
      })
    )
  }

  ret.dependencies = function(name, opts) {
    if (opts.transitive) return transitiveDependenciesOf(name, opts)
    return directDependenciesOf(name, opts)
  }

  function candidates(name, opts) {
    opts = opts || {}
    const {operator, operand} = opts
    return pull(
      ret.versions(name, opts),
      pull.filter( ({key}) => {
        const version = key.version
        if (!operator) return true
        return vercmp.satisfies(version, operator, operand)
      }),
      sort( (a, b) => vercmp(b.key.version, a.key.version) ) // newest first
    )
  }
    
  function directDependenciesOf(name, opts) {
    opts = opts || {}
    const version = opts.version
    const arch = opts.arch

    const {gt, lt} = query('DEP', [
      name, version, arch
    ])

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
      pull.map(parseDependencySpec),
      pull.map( spec => Object.assign(spec, {
        candidates: candidates(spec.name, Object.assign({}, opts, spec)) 
      })),
      pull.asyncMap( (spec, cb) => {
        pull(
          spec.candidates, 
          pull.map( ({content}) => content.filename),
          pull.collect( (err, filenames) => {
            if (err) return cb(err)
            spec.candidates = filenames
            cb(null, spec)
          }) 
        )
      })
    )
  }

  function transitiveDependenciesOf(name, opts) {
    opts = opts || {}
    const seen = {}

    function _transDepsOf(name, level, opts) {
      // record the highest level at which we've seen a package
      // (this determines installation order. (breadth first)
      if (seen[name]) {
        seen[name] = Math.max(seen[name], level)
        return pull.empty()
      }
      seen[name] = level
      
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

    const trans_deps = pull(
      _transDepsOf(name, 1, opts),
      pull.through(console.log),
      pull.unique(d => `${d.name}`)
      // TODO: resolve abstract/provision (like "sh")
      // TODO: get versions for concrete packages and pick a candidate (resolve dep specs)
    )

    if (!opts.sort) return trans_deps
    return pull(
      pull.once('not relevant'),
      pull.asyncMap( (_, cb) => {
        pull(trans_deps, pull.collect( err => {
          if (err) return cb(err)
          cb(null, Object.entries(seen))
        }))
      }),
      pull.flatten(),
      pull.map( ([name, level]) => ({name, level}) ),
      sort( (a, b) => b.level - a.level )
    )
  }

  ret.updates = function(opts) {
    return index.read(Object.assign({live: true, old: false}, opts))
  }

  ret.providers = function(provision, opts) {
    opts = opts || {}
    const arch = opts.arch
    const name = opts.name
    const version = opts.version

    const {gt, lt} = query('PROV', [
      provision,
      arch,
      name,
      version
    ])

    return pull(
      index.read(Object.assign({
        values: false,
        seqs: false,
        keys: true
      }, opts, {
        gt, lt
      }))
    )
  }

  ret.import = function(repopath, opts, cb) {
    return importIfNew(repopath, opts, cb)
  }
  return ret
}

function query(indexName, values) {
  const gt = [indexName]
  for(let i=0; i<values.length; ++i) {
    if (typeof values[i] == 'undefined') break
    gt.push(values[i])
  }
  const lt = gt.slice()
  gt.push(null) 
  lt.push(undefined)
  return {lt, gt}
}

function makeKey(arch, repo, name) {
  return `${arch}|${name}|${repo || ''}`
}

function parseFiles(files) {
  const content = files.map( getFileContent ).join('\n')
  return parseFile(content)
}

function makeDetailKeys(arch, repo, files, blob) {
    const p = parseFiles(files)
    const deps = ary(p.DEPENDS || []).map( d => [
      'DEP', 
      p.NAME,
      p.VERSION, 
      arch, 
      d
    ])

    const provides = ary(p.PROVIDES || []).map( d => [
      'PROV', 
      d,
      arch, 
      p.NAME,
      p.VERSION
    ])

    return [
      ['NAVR', p.NAME, arch, p.VERSION, repo, p.CSIZE, p.ISIZE, p.BUILDDATE, p.SHA256SUM],
      ['RAF', repo, arch, p.FILENAME],
      ...deps,
      ...provides
    ]
}

function parseNAVRKey(k) {
  const [_, name, arch, version, repo, csize, isize, builddate, sha256] = k
  return {
    name, version, arch, repo, csize, isize, builddate, sha256
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
