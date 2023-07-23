/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable mocha/max-top-level-suites */
import { assert, equals, notEquals, matches } from './helpers.js'
import { CRDT } from '../dist/crdt.esm.js'

describe('Fresh crdt', function () {
  /** @type {CRDT} */
  let crdt
  beforeEach(function () {
    crdt = new CRDT()
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
  it('should accept multi-put and return results', async function () {
    const didPut = await crdt.bulk([{ key: 'ace', value: { points: 11 } }, { key: 'king', value: { points: 10 } }])
    const head = didPut.head
    equals(head.length, 1)
    matches(await didPut.root.address, /yfsv2ri4m2y/)
  })
})

describe('CRDT with one record', function () {
  /** @type {CRDT} */
  let crdt, firstPut
  beforeEach(async function () {
    crdt = new CRDT()
    firstPut = await crdt.bulk([{ key: 'hello', value: { hello: 'world' } }])
  })
  it('should have a one-element head', async function () {
    const head = crdt._head
    equals(head.length, 1)
  })
  it('return the record on get', async function () {
    const got = await crdt.get('hello')
    assert(got)
    assert(got.cids, 'should have cids')
    equals(got.cids._cids.size, 1)
    const value = got.result
    equals(value.hello, 'world')
  })
  it('should offer changes', async function () {
    const { result } = await crdt.changes([])
    equals(result.length, 1)
    equals(result[0].key, 'hello')
    equals(result[0].value.hello, 'world')
  })
  it('should accept another put and return results', async function () {
    const didPut = await crdt.bulk([{ key: 'nice', value: { nice: 'data' } }])

    const head = didPut.head
    equals(head.length, 1)
    matches(await didPut.root.address, /bf3tdqy4h4ae/)
    notEquals((await didPut.root.address).toString(), (await firstPut.root.address).toString())

    const got = await crdt.get('nice')
    assert(got)
    equals(got.result.nice, 'data')
  })
})

describe('CRDT with a multi-write', function () {
  /** @type {CRDT} */
  let crdt, firstPut
  beforeEach(async function () {
    crdt = new CRDT()
    firstPut = await crdt.bulk([{ key: 'ace', value: { points: 11 } }, { key: 'king', value: { points: 10 } }])
  })
  it('should have a one-element head', async function () {
    const head = crdt._head
    equals(head.length, 1)
  })
  it('return the records on get', async function () {
    const got = await crdt.get('ace')
    assert(got)
    const value = got.result
    equals(value.points, 11)

    const got2 = await crdt.get('king')
    assert(got2)
    equals(got2.result.points, 10)
  })
  it('should accept another put and return results', async function () {
    const didPut = await crdt.bulk([{ key: 'queen', value: { points: 10 } }])

    const head = didPut.head
    equals(head.length, 1)
    matches(await didPut.root.address, /zs4xrkvawuy/)
    notEquals((await didPut.root.address).toString(), (await firstPut.root.address).toString())

    const got = await crdt.get('queen')
    assert(got)
    equals(got.result.points, 10)
  })
})
