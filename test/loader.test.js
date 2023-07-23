/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable mocha/max-top-level-suites */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { assert, matches, equals, resetDirectory, notEquals } from './helpers.js'

import { parseCarFile } from '../dist/loader-helpers.esm.js'

import { Loader } from '../dist/loader.esm.js'
import { CRDT } from '../dist/crdt.esm.js'
import { TransactionBlockstore as Blockstore } from '../dist/transaction.esm.js'

import { defaultConfig } from '../dist/store-fs.esm.js'

describe('Loader with a committed transaction', function () {
  /** @type {Loader} */
  let loader, blockstore, crdt, done
  const dbname = 'test-loader'
  beforeEach(async function () {
    await resetDirectory(defaultConfig.dataDir, 'test-loader')
    loader = new Loader(dbname)
    blockstore = new Blockstore(dbname, loader)
    crdt = new CRDT(dbname, blockstore)
    done = await crdt.bulk([{ key: 'foo', value: { foo: 'bar' } }])
  })
  it('should have a name', function () {
    equals(loader.name, dbname)
  })
  it('should commit a transaction', function () {
    assert(done.head)
    assert(done.car)
    equals(blockstore.transactions.size, 1)
    equals(loader.carLog.length, 1)
  })
  it('can load the car', async function () {
    const reader = await loader.loadCar(done.car)
    assert(reader)
    const parsed = await parseCarFile(reader)
    assert(parsed.cars)
    equals(parsed.cars.length, 0)
    assert(parsed.head)
  })
})

describe('Loader with two committed transactions', function () {
  /** @type {Loader} */
  let loader, blockstore, crdt, done1, done2
  const dbname = 'test-loader'
  beforeEach(async function () {
    await resetDirectory(defaultConfig.dataDir, 'test-loader')
    loader = new Loader(dbname)
    blockstore = new Blockstore(dbname, loader)
    crdt = new CRDT(dbname, blockstore)
    done1 = await crdt.bulk([{ key: 'apple', value: { foo: 'bar' } }])
    done2 = await crdt.bulk([{ key: 'orange', value: { foo: 'bar' } }])
  })
  it('should commit two transactions', function () {
    assert(done1.head)
    assert(done1.car)
    assert(done2.head)
    assert(done2.car)
    notEquals(done1.head, done2.head)
    notEquals(done1.car, done2.car)
    equals(blockstore.transactions.size, 2)
    equals(loader.carLog.length, 2)
    equals(loader.carLog.indexOf(done1.car), 0)
    equals(loader.carLog.indexOf(done2.car), 1)
  })
  it('can load the car', async function () {
    const reader = await loader.loadCar(done2.car)
    assert(reader)
    const parsed = await parseCarFile(reader)
    assert(parsed.cars)
    equals(parsed.cars.length, 1)
    assert(parsed.head)
  })
})

describe('Loader with many committed transactions', function () {
  /** @type {Loader} */
  let loader, blockstore, crdt
  const dbname = 'test-loader'
  const dones = []
  const count = 10
  beforeEach(async function () {
    await resetDirectory(defaultConfig.dataDir, 'test-loader')
    loader = new Loader(dbname)
    blockstore = new Blockstore(dbname, loader)
    crdt = new CRDT(dbname, blockstore)
    for (let i = 0; i < count; i++) {
      const did = await crdt.bulk([{ key: `apple${i}`, value: { foo: 'bar' } }])
      dones.push(did)
    }
  })
  it('should commit many transactions', function () {
    for (const done of dones) {
      assert(done.head)
      assert(done.car)
    }
    equals(blockstore.transactions.size, count)
    equals(loader.carLog.length, count)
  })
  it('can load the car', async function () {
    const reader = await loader.loadCar(dones[5].car)
    assert(reader)
    const parsed = await parseCarFile(reader)
    assert(parsed.cars)
    equals(parsed.cars.length, 5)
    assert(parsed.head)
  })
})
