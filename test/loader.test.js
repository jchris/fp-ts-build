/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable mocha/max-top-level-suites */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'

import { CID } from 'multiformats'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { assert, matches, equals } from './helpers.js'

import { Loader } from '../dist/loader.esm.js'
import { CRDT } from '../dist/crdt.esm.js'
import { TransactionBlockstore as Blockstore, Transaction } from '../dist/transaction.esm.js'

const decoder = new TextDecoder('utf-8')

describe('Loader', function () {
  /** @type {Loader} */
  let loader, blockstore, crdt
  const dbname = 'test-loader'
  beforeEach(function () {
    loader = new Loader(dbname)
    blockstore = new Blockstore(dbname, loader)
    crdt = new CRDT(dbname, blockstore)
  })
  it('should have a name', function () {
    equals(loader.name, dbname)
  })
  it('should commit a transaction', async function () {
    const done = await crdt.bulk([{ key: 'foo', value: { foo: 'bar' } }])
    assert(done.head)
  })
})
