/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable mocha/max-top-level-suites */
import { assert, equals, notEquals } from './helpers.js'
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
  })
  it('should accept multi-put and return results', async function () {
    const didPut = await crdt.bulk([{ key: 'ace', value: { points: 11 } }, { key: 'king', value: { points: 10 } }])
    const head = didPut.head
    equals(head.length, 1)
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
  it('should return the head', async function () {
    equals(firstPut.head.length, 1)
  })
  it('return the record on get', async function () {
    const got = await crdt.get('hello')
    assert(got)
    const value = got.doc
    equals(value.hello, 'world')
  })
  it('should accept another put and return results', async function () {
    const didPut = await crdt.bulk([{ key: 'nice', value: { nice: 'data' } }])
    const head = didPut.head
    equals(head.length, 1)
    const { doc } = await crdt.get('nice')
    equals(doc.nice, 'data')
  })
  it('should allow for a delete', async function () {
    const didDel = await crdt.bulk([{ key: 'hello', del: true }])
    assert(didDel.head)
    const got = await crdt.get('hello')
    assert(!got)
  })
  it('should offer changes', async function () {
    const { result } = await crdt.changes([])
    equals(result.length, 1)
    equals(result[0].key, 'hello')
    equals(result[0].value.hello, 'world')
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
    equals(firstPut.head.length, 1)
  })
  it('return the records on get', async function () {
    const { doc } = await crdt.get('ace')
    equals(doc.points, 11)

    const got2 = await crdt.get('king')
    assert(got2)
    equals(got2.doc.points, 10)
  })
  it('should accept another put and return results', async function () {
    const didPut = await crdt.bulk([{ key: 'queen', value: { points: 10 } }])
    const head = didPut.head
    equals(head.length, 1)
    const got = await crdt.get('queen')
    assert(got)
    equals(got.doc.points, 10)
  })
  it('should offer changes', async function () {
    const { result } = await crdt.changes([])
    equals(result.length, 2)
    equals(result[0].key, 'ace')
    equals(result[0].value.points, 11)
    equals(result[1].key, 'king')
  })
})

describe('CRDT with two multi-writes', function () {
  /** @type {CRDT} */
  let crdt, firstPut, secondPut
  beforeEach(async function () {
    crdt = new CRDT()
    firstPut = await crdt.bulk([{ key: 'ace', value: { points: 11 } }, { key: 'king', value: { points: 10 } }])
    secondPut = await crdt.bulk([{ key: 'queen', value: { points: 10 } }, { key: 'jack', value: { points: 10 } }])
  })
  it('should have a one-element head', async function () {
    const head = crdt._head
    equals(head.length, 1)
    equals(firstPut.head.length, 1)
    equals(secondPut.head.length, 1)
    notEquals(firstPut.head[0], secondPut.head[0])
  })
  it('return the records on get', async function () {
    const { doc } = await crdt.get('ace')
    equals(doc.points, 11)

    for (const key of ['king', 'queen', 'jack']) {
      const { doc } = await crdt.get(key)
      equals(doc.points, 10)
    }
  })
  it('should offer changes', async function () {
    const { result } = await crdt.changes([])
    equals(result.length, 4)
    equals(result[0].key, 'ace')
    equals(result[0].value.points, 11)
    equals(result[1].key, 'king')
    equals(result[2].key, 'queen')
    equals(result[3].key, 'jack')
  })
})
