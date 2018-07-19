const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const pull = require('pull-stream')
const BufferList = require('bl')
const toPull = require('stream-to-pull-stream')
const hyperquest = require('hyperquest')
const paramap = require('pull-paramap')

const parseFile = require('./parse-file')

const MAXMETAFILESIZE = 1024

const debug = console.log.bind(console)

/*
if (process.argv.length < 3) {
  console.error('required argument missing: arch-repo-directory')
  process.exit(1)
}
const repo = process.argv[2]
*/

module.exports = function(ssb) {
  return function(repo, opts) {
    if (!opts.arch || !opts.repo || !opts.url) throw new Error('Argument missing: "arch" and/or "repo" and/or "url"')
    const pkgs = fs.readdirSync(repo)
    const base_url = opts.url

    function importPackage(name, cb) {
      let filename
      pull(
        pull.values(fs.readdirSync(path.join(repo, name))),
        pull.asyncMap( (file, cb) => {
          fs.readFile(path.join(repo, name, file), {encoding: 'utf8'}, (err, content) => {
            if (err) return cb(err)
            
            if (file == 'desc') {
              filename = parseFile(content).FILENAME
            }

            let compression = null
            let encoding = 'utf8'
            if (content.length < MAXMETAFILESIZE) {
              return cb(null, {content, compression, encoding, name: file})
            }
            const dest = zlib.deflateSync(content)
            if (dest.toString('base64').length < content.length) {
              content = dest.toString('base64')
              compression = 'deflate'
              encoding = 'base64'
            } 
            cb(null, {content, compression, encoding, name: file})
          })
        }),
        pull.collect( (err, files) => {
          if (err) return cb(err)
          cb(null, {
            name,
            filename,
            arch: opts.arch,
            repo: opts.repo,
            files,
            type: 'pacman-package'
          })
        })
      )
    }

    return pull(
      pull.values(pkgs),
      //pull.take(2),
      pull.asyncMap( (name, cb) => {
        ssb.pacman.get(name, Object.assign({values: false, keys: false, seqs: false}, opts), err => {
          if (err) return cb(null, name)
          cb(null, null) // we have it already, filter this
        })
      }),
      pull.filter(),
      pull.asyncMap( importPackage ),
      pull.through( content  => {
        content.url = `${base_url}/${content.filename}`
      }),
      paramap( (content, cb) => {
      //pull.asyncMap( (content, cb) => {
        let size = 0, contentLength
        debug(`downloading ${content.url} ...`)
        pull(
          toPull.source(hyperquest(content.url, (err, res)=>{
            if (err) {
              console.error('http error: ', err.message)
            }
            if (res) {
              contentLength = Number(res.headers['content-length'])
            }
          })),
          pull.through( b => {
            size += b.length
            console.log(`${size} / ${contentLength}`)
          }),
          ssb.blobs.add( (err, hash) => {
            debug(`done downloading ${content.url}, err=${err && err.message}`)
            if (err) return cb(err)
            content.blob = hash
            content.blob_size = size
            cb(null, content)
          })
        )
      }, Number(opts.num_downloads || 6), false), // dont keep ordering
      pull.asyncMap( (content, cb) => {
        debug(`publishing ${content.name}`)
        ssb.publish(content, (err, kv) => {
          debug(`done publishing ${content.name}, err=${err && err.message}`)
          cb(err, kv)
        })
      })
    )
  }
}
