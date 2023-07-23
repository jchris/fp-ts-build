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
import { TransactionBlockstore as Blockstore, Transaction } from '../dist/transaction.esm.js'

const decoder = new TextDecoder('utf-8')

describe('Loader', function () {
  /** @type {Loader} */
  let loader
  beforeEach(function () {
    loader = new Loader('test')
  })
  it('should have a name', function () {
    equals(loader.name, 'test')
  })
  it('should commit a transaction', async function () {
    const t = new Transaction()
  })
})
