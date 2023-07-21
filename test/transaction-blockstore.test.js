/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable mocha/max-top-level-suites */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { assert, equals, notEquals, matches } from './helpers.js'
import { CRDT } from '../dist/crdt.esm.js'
import { TransactionBlockstore as Blockstore } from '../dist/transaction-blockstore.esm.js'

describe('Fresh TransactionBlockstore', function () {
  /** @type {Blockstore} */
  let blocks
  beforeEach(function () {
    blocks = new Blockstore()
  })
  it('should not put', async function () {
    const e = await blocks.put('key', 'value').catch(e => e)
    matches(e.message, /transaction/)
  })
  it('should yield a transaction', async function () {
    const tx = await blocks.transaction()
    assert(tx)
  })
})
