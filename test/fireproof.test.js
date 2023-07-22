/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { assert, equals, notEquals, matches, equalsJSON } from './helpers.js'

import { Fireproof } from '../dist/fireproof.esm.js'
import { Database } from '../dist/database.esm.js'

describe('Reopening a database', function () {
  /** @type {Database} */
  let db
  beforeEach(async function () {
    // erase the existing test data

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

  // it('should have the same data on reopen after reopen and update', async function () {
  //   for (let i = 0; i < 100; i++) {
  //     const db = Fireproof.storage('test-reopen')
  //     const ok = await db.put({ _id: `test${i}`, foo: 'bar' })
  //     assert(ok)
  //     const doc = await db.get(`test${i}`)
  //     equals(doc.foo, 'bar')
  //   }
  // })
})
