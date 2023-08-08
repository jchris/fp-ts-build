/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable mocha/max-top-level-suites */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { assert, equals, notEquals, matches, equalsJSON, resetDirectory } from './helpers.js'

import { Fireproof } from '../dist/fireproof.esm.js'
import { Database } from '../dist/database.esm.js'
import { CarStoreFS, defaultConfig, HeaderStoreFS } from '../dist/store-fs.esm.js'

describe('basic database', function () {
  /** @type {Database} */
  let db
  beforeEach(async function () {
    // erase the existing test data
    await resetDirectory(defaultConfig.dataDir, 'test-basic')

    db = Fireproof.storage('test-basic')
  })
  it('can put with id', async function () {
    const ok = await db.put({ _id: 'test', foo: 'bar' })
    assert(ok)
    equals(ok.id, 'test')
  })
  it('can put without id', async function () {
    const ok = await db.put({ foo: 'bam' })
    assert(ok)
    const got = await db.get(ok.id)
    equals(got.foo, 'bam')
  })
  it('can define an index', async function () {
    const ok = await db.put({ _id: 'test', foo: 'bar' })
    assert(ok)
    const idx = db.index('test-index', (doc) => doc.foo)
    const result = await idx.query()
    assert(result)
    assert(result.rows)
    equals(result.rows.length, 1)
    equals(result.rows[0].key, 'bar')
  })
})

describe('Reopening a database', function () {
  /** @type {Database} */
  let db
  beforeEach(async function () {
    // erase the existing test data
    await resetDirectory(defaultConfig.dataDir, 'test-reopen')

    db = Fireproof.storage('test-reopen')
    const ok = await db.put({ _id: 'test', foo: 'bar' })
    assert(ok)
    equals(ok.id, 'test')

    assert(db._crdt._head)
    equals(db._crdt._head.length, 1)
  })

  it('should persist data', async function () {
    const doc = await db.get('test')
    equals(doc.foo, 'bar')
  })

  it('should have the same data on reopen', async function () {
    const db2 = Fireproof.storage('test-reopen')
    const doc = await db2.get('test')
    equals(doc.foo, 'bar')
    assert(db2._crdt._head)
    equals(db2._crdt._head.length, 1)
    equalsJSON(db2._crdt._head, db._crdt._head)
  })

  it.skip('passing slow, should have the same data on reopen after reopen and update', async function () {
    for (let i = 0; i < 100; i++) {
      const db = Fireproof.storage('test-reopen')
      const ok = await db.put({ _id: `test${i}`, fire: 'proof'.repeat(50 * 1024) })
      assert(ok)
      const doc = await db.get(`test${i}`)
      equals(doc.fire, 'proof'.repeat(50 * 1024))
    }
  }).timeout(20000)
})

describe('Reopening a database with indexes', function () {
  /** @type {Database} */
  let db
  beforeEach(async function () {
    // erase the existing test data
    await resetDirectory(defaultConfig.dataDir, 'test-reopen-idx')

    db = Fireproof.storage('test-reopen-idx')
    const ok = await db.put({ _id: 'test', foo: 'bar' })
    equals(ok.id, 'test')

    // const idx = db.index('foo')
  })

  it('should persist data', async function () {
    const doc = await db.get('test')
    equals(doc.foo, 'bar')
  })

  it('should have the same data on reopen', async function () {
    const db2 = Fireproof.storage('test-reopen-idx')
    const doc = await db2.get('test')
    equals(doc.foo, 'bar')
    assert(db2._crdt._head)
    equals(db2._crdt._head.length, 1)
    equalsJSON(db2._crdt._head, db._crdt._head)
  })
})
