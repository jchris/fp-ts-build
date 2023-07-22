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
    // await db2._crdt.ready
    // assert(db2._crdt._head)
    // equals(db2._crdt._head.length, 1)

    const doc = await db2.get('test')
    equals(doc.foo, 'bar')
  })
})
