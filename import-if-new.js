const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const pull = require('pull-stream')
const BufferList = require('bl')

const MAXMETAFILESIZE = 1024

/*
if (process.argv.length < 3) {
  console.error('required argument missing: arch-repo-directory')
  process.exit(1)
}
const repo = process.argv[2]
*/

module.exports = function(ssb) {
  return function(repo, opts) {
    if (!opts.arch || !opts.repo) throw new Error('Argument missing: "arch" and/or "repo"')
    const pkgs = fs.readdirSync(repo)

    function importPackage(name, cb) {
      pull(
        pull.values(fs.readdirSync(path.join(repo, name))),
        pull.asyncMap( (file, cb) => {
          fs.readFile(path.join(repo, name, file), {encoding: 'utf8'}, (err, content) => {
            if (err) return cb(err)
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
          ssb.publish({
            name,
            arch: opts.arch,
            repo: opts.repo,
            files,
            type: 'pacman-package'
          }, cb)
        })
      )
    }

    return pull(
      pull.values(pkgs),
      //pull.take(2),
      pull.asyncMap( (name, cb) => {
        ssb.pacman.get(name, opts, err => {
          if (err) return cb(null, name)
          cb(null, null) // we have it already, filter this
        })
      }),
      pull.filter(),
      pull.asyncMap( importPackage )
    )
  }
}
