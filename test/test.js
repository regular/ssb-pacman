const fs = require('fs')
const path = require('path')
const test = require('tape')
const parse = require('../parse-file')

test('Parse file with single-line and multi-line values', t=>{
  const content = fs.readFileSync(path.join(__dirname, 'fixture'), {encoding: 'utf8'})
  const result = parse(content)
  t.deepEqual(result, {
    FILENAME: 'pacman-5.1.0-2-armv7h.pkg.tar.xz',
    NAME: 'pacman',
    BASE: 'pacman',
    VERSION: '5.1.0-2',
    DESC: 'A library-based package manager with dependency support',
    GROUPS: [ 'base', 'base-devel' ],
    CSIZE: '744736',
    ISIZE: '5188608',
    MD5SUM: '639da2991bf0046bcb2eef95cab02807',
    SHA256SUM: '614a8dc2b5d6155ee6356ddd55afc18b390d43f17ab248b469eb454e2074fc46',
    PGPSIG: 'iQIzBAABCAAdFiEEaLNTfzmjE7PldNBndxk/FSvb5qYFAlsR008ACgkQdxk/FSvb5qZ9Jw/9FfkDztu2qKsX55iIeWc8o/eHQM/6uRqa4MikB1vjxnLvs5qfeDDgfoSSdksiOrqCpfyxtBPw0J7q/9+ybiXItOcMGNkQyBwXFcdxYf/+Sv+V+oquFZLrDHLVclPz5dPGEVRyTkokIXUnoX7DLQmObIEr3VqgOqDxni7NCS/ii9v/VZ8ZXKskb5Hfo4lzZaimoEEVy7vc8iLjaDD4DC//olzbHd7pemQ880/8fPtZ15Nfzgv98LBt747etvVYjHdFx72sDU85TdUF4tpNOHpHDLeCRJwDqV08CHHW3hmZoC3rF1vVSzlvwA/Qv1roAT9bqfYMUOeW0mvOUPckMYw1JJULJq0xPnn0Lbk52LLxFW/1o0g2KgtrUzuoVenE+CUwS2UIMFyrHCzRUFhQKQPji9OHGvYc21PfcDAgDrMrlPox/VLjIitw1qOCDKQBlNXkC6qx1r/VofM6cRHwn2eCpusriSuGtSdr1c408r5rJeijD3OxXjX87PQ4PCJxAoT1KzD+Ug9lPSZmeZypBHiPyThd/tWNKHkFWWeujsTwpud72qiMRXHsTsowk5LAjMUZyxQHZBTxxF+5E2vHJqOfFjMSrjbCDaRfazdBPwnDqQNsVDhULCcgVWYao09B+X1ECbx3d4PavRwT5tD/KYCDK/emuT2cYMNFQ1vUiuBySGw=',
    URL: 'http://www.archlinux.org/pacman/',
    LICENSE: 'GPL',
    ARCH: 'armv7h',
    BUILDDATE: '1527894784',
    PACKAGER: 'Arch Linux ARM Build System <builder+xu9@archlinuxarm.org>'
  })
  t.end()
})
