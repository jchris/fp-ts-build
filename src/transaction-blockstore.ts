/* eslint-disable @typescript-eslint/require-await */
import { parse } from 'multiformats/link'
import { BlockFetcher, AnyBlock, AnyLink, BulkResult } from './types'
import { Block } from 'multiformats'
import { makeCarFile } from './crdt-helpers'

export class MemoryBlockstore implements BlockFetcher {
  private blocks: Map<string, Uint8Array> = new Map()

  constructor(blocks?: AnyBlock[]) {
    if (blocks) {
      this.blocks = new Map(blocks.map(b => [b.cid.toString(), b.bytes]))
    }
  }

  async get(cid: AnyLink): Promise<AnyBlock | undefined> {
    const bytes = this.blocks.get(cid.toString())
    if (!bytes) return
    return { cid, bytes }
  }

  async put(cid: AnyLink, bytes: Uint8Array): Promise<void> {
    this.blocks.set(cid.toString(), bytes)
  }

  * entries() {
    for (const [str, bytes] of this.blocks) {
      yield { cid: parse(str), bytes }
    }
  }
}

// export class MultiBlockFetcher {
//   private fetchers: BlockFetcher[]

//   constructor(...fetchers: BlockFetcher[]) {
//     this.fetchers = fetchers
//   }

//   async get(link: AnyLink): Promise<AnyBlock | undefined> {
//     for (const f of this.fetchers) {
//       const v = await f.get(link)
//       if (v) return v
//     }
//   }
// }

export class Transaction extends MemoryBlockstore {
  constructor(private parent: BlockFetcher) {
    super()
    this.parent = parent
  }

  async get(cid: AnyLink): Promise<AnyBlock | undefined> {
    return this.parent.get(cid)
  }

  async superGet(cid: AnyLink): Promise<AnyBlock | undefined> {
    return super.get(cid)
  }
}

export class TransactionBlockstore implements BlockFetcher {
  _loader = new Loader()
  private transactions: Set<Transaction> = new Set()
  async put() {
    throw new Error('use a transaction to put')
  }

  async get(cid: AnyLink): Promise<AnyBlock | undefined> {
    for (const f of this.transactions) {
      const v = await f.superGet(cid)
      if (v) return v
    }
  }

  async transaction(fn: (t: Transaction) => Promise<BulkResult>) {
    const t = new Transaction(this)
    this.transactions.add(t)
    const done: BulkResult = await fn(t)
    if (done) { await this.commit(t, done) }
    return done
  }

  async commit(t: Transaction, done: BulkResult) {
    const car = await makeCarFile(t, done)
    await this._loader.save(car)
  }
}

class Loader {
  async save(car: Block) {

  }
}
