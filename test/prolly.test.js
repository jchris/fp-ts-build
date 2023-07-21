/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable mocha/max-top-level-suites */
import { equals, notEquals, matches } from './helpers.js'
import { Prolly } from '../dist/prolly.esm.js'
import { MemoryBlockstore as Blockstore } from '@alanshaw/pail/block'

describe('Fresh prolly crdt', function () {
  /** @type {Prolly} */
  let prollyCrdt
  beforeEach(function () {
    const blocks = new Blockstore()
    prollyCrdt = new Prolly(blocks, [])
  })
  it('should have an empty head', async function () {
    const head = prollyCrdt._head
    equals(head.length, 0)
  })
  it('should accept put and return results', async function () {
    const didPut = await prollyCrdt.put({ key: 'hello', value: { hello: 'world' } })
    const head = didPut.head
    equals(head.length, 1)
    matches(await didPut.root.address, /vdrhrci/)
  })
})

describe('Prolly crdt with one record', function () {
  /** @type {Prolly} */
  let prollyCrdt, firstPut
  beforeEach(async function () {
    const blocks = new Blockstore()
    prollyCrdt = new Prolly(blocks, [])
    firstPut = await prollyCrdt.put({ key: 'hello', value: { hello: 'world' } })
    await persistResult(blocks, firstPut)
  })
  it('should have a one-element head', async function () {
    const head = prollyCrdt._head
    equals(head.length, 1)
  })
  it('return the record on get', async function () {
    const { value } = await prollyCrdt.get('hello')
    equals(value.hello, 'world')
  })
  it('should accept put and return results', async function () {
    const didPut = await prollyCrdt.put({ key: 'nice', value: { nice: 'data' } })
    const head = didPut.head
    equals(head.length, 1)
    matches(await didPut.root.address, /272pceze/)
    notEquals((await didPut.root.address).toString(), (await firstPut.root.address).toString())
  })
})

async function persistResult(blocks, result) {
  for (const block of result.additions) {
    console.log('persisting block', block.cid)
    await blocks.put(block.cid, block.bytes)
  }
}
