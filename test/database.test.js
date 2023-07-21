/* eslint-disable mocha/max-top-level-suites */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { assert, equals, notEquals, matches } from './helpers.js'
import { Database } from '../dist/database.esm.js'
// import { Doc } from '../dist/types.d.esm.js'

/**
 * @typedef {Object.<string, any>} DocBody
 */

/**
 * @typedef {Object} Doc
 * @property {string} _id
 * @property {DocBody} [property] - an additional property
 */

describe('basic Database', function () {
  /** @type {Database} */
  let db
  beforeEach(function () {
    db = new Database()
  })
  it('should put', async function () {
    /** @type {Doc} */
    const doc = { _id: 'hello', value: 'world' }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const ok = await db.put(doc)
    equals(ok.id, 'hello')
    matches(ok.clock, /7qllfhvv3pfi/)
  })
  it('get missing should throw', async function () {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
    const e = await (db.get('missing')).catch(e => e)
    matches(e.message, /Not found/)
  })
  it('del missing should throw', async function () {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
    const e = await (db.del('missing')).catch(e => e)
    matches(e.message, /Not found/)
  })
})

describe('basic Database with record', function () {
  /** @type {Database} */
  let db
  beforeEach(async function () {
    db = new Database()
    /** @type {Doc} */
    const doc = { _id: 'hello', value: 'world' }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const ok = await db.put(doc)
    equals(ok.id, 'hello')
  })
  it('should get', async function () {
    const doc = await db.get('hello')
    assert(doc)
    equals(doc._id, 'hello')
  })
  it('should del last record', async function () {
    const ok = await db.del('hello')
    equals(ok.id, 'hello')
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    const e = await (db.get('hello')).catch(e => e)
    matches(e.message, /Not found/)
  })
})

describe('basic Database parallel writes', function () {
  /** @type {Database} */
  let db
  const writes = []
  beforeEach(async function () {
    db = new Database()
    /** @type {Doc} */
    for (let i = 0; i < 10; i++) {
      const doc = { _id: `id-${i}`, value: 'world' }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      writes.push(db.put(doc))
    }
    await Promise.all(writes)
  })
  it('should have one head', function () {
    const crdt = db._crdt
    equals(crdt._head.length, 1)
  })
  it('should write all', async function () {
    for (let i = 0; i < 10; i++) {
      const id = `id-${i}`
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const got = await db.get(id).catch(e => e)
      assert(got)
      equals(got._id, id)
      equals(got.value, 'world')
    }
  })
  it('should del all', async function () {
    for (let i = 0; i < 10; i++) {
      const id = `id-${i}`
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const ok = await db.del(id)
      equals(ok.id, id)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      const e = await (db.get(id)).catch(e => e)
      matches(e.message, /Not found/)
    }
  })
  it('should delete all in parallel', async function () {
    const deletes = []
    for (let i = 0; i < 10; i++) {
      const id = `id-${i}`
      deletes.push(db.del(id))
    }
    await Promise.all(deletes)
    for (let i = 0; i < 10; i++) {
      const id = `id-${i}`
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      const e = await (db.get(id)).catch(e => e)
      matches(e.message, /Not found/)
    }
  })
})
