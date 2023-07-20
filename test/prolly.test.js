import { equals } from './helpers.js'
import { Prolly } from '../dist/prolly.esm.js'
import { MemoryBlockstore as Blockstore } from '@alanshaw/pail/block'

describe('Fresh prolly crdt', function () {
  let prollyCrdt
  beforeEach(function () {
    const blocks = new Blockstore()
    prollyCrdt = new Prolly(blocks, [])
  })
  it('should accept put', async function () {
    const didPut = await prollyCrdt.put('Hello, World!')
    equals(didPut, 'Hello, World!')
  })
})
