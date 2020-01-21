const tap = require('tap')
const { foo } = require('./index')

tap.test('a test', async t => {
  t.equal(foo, 'bar')
})
