const zlib = require('zlib')
const crypto = require('crypto')
const url = require('url')

const pull = require('pull-stream')
const many = require('pull-many')
const sort = require('pull-sort')
const defer = require('pull-defer')
const cat = require('pull-cat')
const createIndex = require('flumeview-level')
const createReduce = require('flumeview-reduce')
const hs = require('human-size')
const ref = require('ssb-ref')

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
  getAddress: 'sync',
  updates: 'source',
  dependencies: 'source',
  providers: 'source',
  candidates: 'source',
  sha256: 'async'
}

exports.init = function (ssb, config) {
  const ret = {}
  const importIfNew = ImportIfNew(ssb)
  const index = ssb._flumeUse('pacmanIndex', createIndex(
    23, function(kv) {
      const c = kv.value && kv.value.content
      const name = c && c.name
      const arch = c && c.arch
      const repo = c && c.repo
      const blob = c && c.blob
      const files = c.files || []
      
      if (!name || !arch || !repo) return []
      return [
        makeKey(arch, repo, name),
        ... makeDetailKeys(kv)
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

  ret.getAddress = function() {
    const addr = getPackageUrl('$repo', '$arch', '')
    return addr.substr(0, addr.length - 1)
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

  ret.get = function(nameOrKey, opts, cb) {
    if (typeof opts == 'function') {cb = opts; opts = {} }
    opts = opts || {}
    
    if (ref.isMsg(nameOrKey)) {
      ssb.get(nameOrKey, (err, v) => {
        if (err) return cb(err)
        const kkv = {value: {key: nameOrKey, value: v}}
        makeStdRecord(kkv)
        cb(null, kkv)
      })
      return
    }
    
    const name = nameOrKey
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
  
  function makeStdRecord(i) {
    i.key = i.value.key
    i.content = i.value.value.content
    i.record = parseFiles(i.content.files)
    delete i.content.files
    delete i.value
    i.url = getPackageUrl(i.content.repo, i.content.arch, i.record.FILENAME)
  }

  ret.versions = function(name, opts) {
    opts = opts || {}
    const {gt, lt} = query('NAVR', [
      name, opts.arch, opts.version, opts.repo
    ])
    return pull(
      index.read(Object.assign({}, opts, {gt, lt, values: true, keys: true, seqs: false} )),
      pull.through( i => i.index = parseNAVRKey(i.key) ),
      pull.unique( i => i.index.sha256 ),
      pull.through( makeStdRecord ) 
    )
  }

  ret.providers = function(provision, opts) {
    opts = opts || {}
    const arch = opts.arch
    const name = opts.name
    const version = string(opts.version)

    const {gt, lt} = query('PROV', [
      provision,
      arch,
      version,
      name
    ])

    console.log(gt, lt)

    return pull(
      index.read(Object.assign({
        values: true,
        seqs: false,
        keys: true
      }, opts, {
        gt, lt
      })),
      pull.through( i => i.index = parsePROVKey(i.key) ),
      pull.through( makeStdRecord ) 
    )
  }

  ret.dependencies = function(nameOrKey, opts) {
    console.log('dependencies', nameOrKey, JSON.stringify(opts))
    opts = opts || {}
    if (opts.transitive) return transitiveDependenciesOf(nameOrKey, opts)
    return directDependenciesOf(nameOrKey, opts)
  }

  ret.candidates = function (name, opts) {
    opts = opts || {}
    const operator = opts.operator
    const operand = string(opts.operand)
    return cat([
      pull(
        ret.versions(name, opts),
        pull.filter( ({index}) => {
          const version = index.version
          if (!operator) return true
          return vercmp.satisfies(version, operator, operand)
        }),
        sort( (a, b) => vercmp(b.index.version, a.index.version) ) // newest first
      ),

      pull(
        ret.providers(name, opts),
        pull.filter( ({index}) => {
          const version = index.prov_version
          if (!operator) return true
          return vercmp.satisfies(version, operator, operand)
        }),
        sort( (a, b) => vercmp(b.index.prov_version, a.index.prov_version) ) // newest first
      )
    ])
  }
    
  function directDependenciesOf(nameOrKey, opts) {
    console.log('direct', nameOrKey, JSON.stringify(opts))
    opts = opts || {}
    if (!nameOrKey) throw new Error('argument missing: nameOrKey')

    let name, key
    if (ref.isMsg(nameOrKey)) {
      key = nameOrKey
    } else {
      name = nameOrKey
    }

    const depends =
      key ? pull(
        pull.once(key),
        pull.asyncMap( ssb.get ),
        pull.map( value => {
          const content = value.content
          const arch = content.arch
          opts.arch = arch
          const files = content.files
          const p = parseFiles(files)
          return ary(p.DEPENDS || [])
        }),
        pull.flatten()
      ) : pull(
        index.read(Object.assign({
          values: false,
          seqs: false,
          keys: true
        }, opts, query('DEP', [
          name, opts.version, opts.arch
        ]))),
        pull.map( k => k.slice(-1)[0] ),
        pull.unique()
      )


    return pull(
      depends,
      pull.map(parseDependencySpec),
      pull.map( spec => Object.assign({}, spec, {
        candidates: ret.candidates(spec.name, Object.assign({}, opts, spec, {version: undefined}))
      })),
      pull.asyncMap( (spec, cb) => {
        pull(
          spec.candidates,
          /*
          pull.map( e => ({
            key: e.key,
            name: e.content.name,
            version: e.record.VERSION,
            arch: e.content.arch,
            repo: e.content.repo
          })),
          */
          pull.collect( (err, candidates) => {
            if (err) return cb(err)
            spec.candidates = candidates
            cb(null, spec)
          })
        )
      }),
    
      pull.asyncMap( (spec, cb) => {
        if (spec.candidates.length == 0) {
          return cb(new Error('Unable to resolve dependency' + JSON.stringify(spec)))
        }
        // simplistic candidate selection
        spec.alternatives = spec.candidates.length - 1
        cb(null, Object.assign({}, spec, spec.candidates[0], {candidates: undefined})) 
      })
    )
  }

  // get the key of a package described by opts
  function identify(name, opts, cb) {
    pull(
      ret.versions(name, opts),
      pull.collect( (err, versions)=>{
        if (err) return cb(err)
        if (!versions.length) return cb(new Error('identify: not found'))
        if (versions.length>1) return cb(new Error('identify: ambigious result'))
        cb(null, versions[0])
      })
    )
  }

  function transitiveDependenciesOf(nameOrKey, opts) {
    opts = opts || {}
    if (!nameOrKey) throw new Error('argument missing: nameOrKey')
    let name, key
    if (ref.isMsg(nameOrKey)) {
      key = nameOrKey
    } else {
      name = nameOrKey
    }

    const seen = {}
    function _transDepsOf(key, value, deppath, opts) {
      const level = deppath.length
      // record the highest level at which we've seen a package
      // (this determines installation order. (breadth first)
      if (seen[key]) {
        seen[key].level = Math.max(seen[key].level, level)
        if (!opts.sort) return pull.empty()
      } else {
        seen[key] = Object.assign({}, value, {level})
      }
      
      return pull(
        directDependenciesOf(key, opts),
        pull.through( d => {
          d.distance = level + 1
          d.deppath = deppath.concat([d.content.name])
        }),
        pull.map( d => many([
          pull.once(d),
          _transDepsOf(d.key, d, d.deppath, Object.assign({}, opts))
        ])),
        pull.flatten()
      )
    }

    function unsorted(key) {
      return pull(
        _transDepsOf(key, {key}, [], opts),
        pull.unique(d => d.key)
      )
    }

    function sorted(key) {
      return pull(
        pull.once('not relevant'),
        pull.asyncMap( (_, cb) => {
          pull(unsorted(key), pull.collect( err => {
            if (err) return cb(err)
            cb(null, Object.values(seen))
          }))
        }),
        pull.flatten(),
        pull.through( e => {
          e.distance = e.level
          delete e.level 
        }),
        pull.filter( e => e.key !== key ),
        sort( (a, b) => b.distance - a.distance )
      )
    }

    if (key) return opts.sort ? sorted(key) : unsorted(key)

    const deferred = defer.source()
    identify(name, opts, (err, key) => {
      if (err) return deferred.resolve(pull.error(err))
      const stream = opts.sort ? sorted(key) : unsorted(key)
      deferred.resolve(stream)
    })
    return deferred

  }

  ret.updates = function(opts) {
    return index.read(Object.assign({live: true, old: false}, opts))
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

function makeDetailKeys(kv) {
    const c = kv.value && kv.value.content
    const name = c && c.name
    const arch = c && c.arch
    const repo = c && c.repo
    const blob = c && c.blob
    const files = c.files || []
    const p = parseFiles(files)

    const deps = ary(p.DEPENDS || []).map( d => [
      'DEP', 
      p.NAME,
      p.VERSION, 
      arch, 
      d
    ])

    const provides = ary(p.PROVIDES || []).map( d => {
      const [provision, version] = d.split('=')
      return [
        'PROV', 
        provision,
        arch, 
        version || null,
        p.NAME,
        p.VERSION
      ]
    })

    return [
      ['NAVR', p.NAME, arch, p.VERSION, repo, p.CSIZE, p.ISIZE, p.BUILDDATE, p.SHA256SUM],
      ['RAF', repo, arch, p.FILENAME],
      ...deps,
      ...provides
    ]
}

function parsePROVKey(k) {
  const [_, provision, arch, prov_version, name, version] = k
  return {
    provision, prov_version, arch, name, version
  }
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

function string(n) {
  return typeof n == 'number' ? String(n) : n
}

function parseDependencySpec(spec) {
  const m = spec.match(/^(.+?)(([=><]{1,2})(.+))?$/)
  if (!m) return null
  const [all, name, comparison, operator, operand] = m
  return {name, operator, operand}
}
