/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable mocha/max-top-level-suites */
import { assert, equals, notEquals, matches } from './helpers.js'
import { CRDT } from '../dist/crdt.esm.js'
import { TransactionBlockstore as Blockstore } from '../dist/transaction-blockstore.esm.js'

describe('Fresh crdt', function () {
  /** @type {CRDT} */
  let crdt
  beforeEach(function () {
    const blocks = new Blockstore()
    crdt = new CRDT(blocks, [])
  })
  it('should have an empty head', async function () {
    const head = crdt._head
    equals(head.length, 0)
  })
  it('should accept put and return results', async function () {
    const didPut = await crdt.bulk([{ key: 'hello', value: { hello: 'world' } }])
    const head = didPut.head
    equals(head.length, 1)
    matches(await didPut.root.address, /vdrhrci/)
  })
})

describe('CRDT with one record', function () {
  /** @type {CRDT} */
  let crdt, firstPut
  const blocks = new Blockstore()
  beforeEach(async function () {
    crdt = new CRDT(blocks, [])
    firstPut = await crdt.bulk([{ key: 'hello', value: { hello: 'world' } }])
  })
  it('should have a one-element head', async function () {
    const head = crdt._head
    equals(head.length, 1)
  })
  it('return the record on get', async function () {
    const got = await crdt.get('hello')
    assert(got.cids, 'should have cids')
    console.log('got', got)
    equals(got.cids._cids.size, 1)
    const value = got.result
    equals(value.hello, 'world')
  })
  it('should accept another put and return results', async function () {
    const didPut = await crdt.bulk([{ key: 'nice', value: { nice: 'data' } }])

    const head = didPut.head
    equals(head.length, 1)
    matches(await didPut.root.address, /272pceze/)
    notEquals((await didPut.root.address).toString(), (await firstPut.root.address).toString())
  })
})
