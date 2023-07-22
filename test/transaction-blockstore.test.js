/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable mocha/max-top-level-suites */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { assert, equals, notEquals, matches, equalsJSON } from './helpers.js'
import { TransactionBlockstore as Blockstore, Transaction } from '../dist/transaction-blockstore.esm.js'

describe('Fresh TransactionBlockstore', function () {
  /** @type {Blockstore} */
  let blocks
  beforeEach(function () {
    blocks = new Blockstore()
  })
  it('should not have a name', function () {
    assert(!blocks.name)
  })
  it('should not have a loader', function () {
    assert(!blocks._loader)
  })
  it('should not put', async function () {
    const e = await blocks.put('key', 'value').catch(e => e)
    matches(e.message, /transaction/)
  })
  it('should yield a transaction', async function () {
    const txR = await blocks.transaction((tblocks) => {
      assert(tblocks)
      assert(tblocks instanceof Transaction)
      return { head: [] }
    })
    assert(txR)
    equalsJSON(txR, { head: [] })
  })
})

describe('TransactionBlockstore with name', function () {
  /** @type {Blockstore} */
  let blocks
  beforeEach(function () {
    blocks = new Blockstore('test')
  })
  it('should have a name', function () {
    equals(blocks.name, 'test')
  })
  it('should have a loader', function () {
    assert(blocks.loader)
  })
  it('should get from loader', async function () {
    blocks.loader.getBlock = async (cid) => {
      return { cid, bytes: 'bytes' }
    }
    const value = await blocks.get('key')
    equalsJSON(value, { cid: 'key', bytes: 'bytes' })
  })
})

describe('A transaction', function () {
  /** @type {Transaction} */
  let tblocks, blocks
  beforeEach(async function () {
    blocks = new Blockstore()
    tblocks = new Transaction(blocks)
    blocks.transactions.add(tblocks)
  })
  it('should put and get', async function () {
    await tblocks.put('key', 'bytes')
    assert(blocks.transactions.has(tblocks))
    const got = await tblocks.get('key')
    assert(got)
    equals(got.cid, 'key')
    equals(got.bytes, 'bytes')
  })
})

describe('TransactionBlockstore with a completed transaction', function () {
  let blocks
  beforeEach(async function () {
    blocks = new Blockstore()
    await blocks.transaction(async (tblocks) => {
      return await tblocks.put('key', 'value')
    })
  })
  it('should get', async function () {
    const value = await blocks.get('key')
    equals(value.cid, 'key')
    equals(value.bytes, 'value')
  })
})
