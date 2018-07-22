const test = require('tape')
const vercmp = require('../vercmp')

test('2 > 1', t => {
  vercmp(2, 1, (err, result) => {
    t.ok( result > 0, 'result is positive')
    t.end()
  })
})

test('1 < 2', t => {
  vercmp(1, 2, (err, result) => {
    t.ok( result < 0, 'result is negative')
    t.end()
  })
})

test('1 == 1', t => {
  vercmp(1, 1, (err, result) => {
    t.ok( result == 0, 'result is zero')
    t.end()
  })
})
