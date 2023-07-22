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
  })

  it('should have the same data on reopen', async function () {
    const db2 = Fireproof.storage('test-reopen')
    const doc = await db2.get('test')
    equals(doc.foo, 'bar')
  })
})
