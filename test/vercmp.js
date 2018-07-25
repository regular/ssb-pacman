const test = require('tape')
const vercmp = require('../vercmp')

test('2 > 1', t => {
  t.equal(vercmp(2, 1), 1, 'result is positive')
  t.end()
})

test('1 < 2', t => {
  t.equal(vercmp(1, 2), -1, 'result is negative')
  t.end()
})

test('1 == 1', t => {
  t.equal(vercmp(1, 1), 0, 'result is zero')
  t.end()
})

test('satisfies', t => {
  t.ok(vercmp.satisfies(2, '>', 1), '2>1')
  t.notok(vercmp.satisfies(1, '>', 1), '1>1')
  t.notok(vercmp.satisfies(1, '>', 2), '1>2')

  t.ok(vercmp.satisfies(1, '<', 2), '1<2')
  t.notok(vercmp.satisfies(1, '<', 1), '1<1')
  t.notok(vercmp.satisfies(2, '<', 1), '2<1')

  t.ok(vercmp.satisfies(2, '>=', 1), '2>=1')
  t.ok(vercmp.satisfies(1, '>=', 1), '1>=1')
  t.notok(vercmp.satisfies(1, '>=', 2), '1>=2')

  t.ok(vercmp.satisfies(1, '<=', 2), '1<=2')
  t.ok(vercmp.satisfies(1, '<=', 1), '1<=1')
  t.notok(vercmp.satisfies(2, '<=', 1), '2<=1')

  t.notOk(vercmp.satisfies(1, '=', 2), '1=2')
  t.ok(vercmp.satisfies(1, '=', 1), '1=1')

  t.end()
})
