/* eslint-disable @typescript-eslint/require-await */
import { parse } from 'multiformats/link'
import { BlockFetcher, AnyBlock, AnyLink, BulkResult, ClockHead } from './types'
import { Loader } from './loader'
import { CID } from 'multiformats'

/** forked from
 * https://github.com/alanshaw/pail/blob/main/src/block.js
 * thanks Alan
**/

export class MemoryBlockstore implements BlockFetcher {
  private blocks: Map<string, Uint8Array> = new Map()

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
  name: string | null = null
  ready: Promise<{ head: ClockHead }> // todo this will be a map of headers by branch name

  private transactions: Set<Transaction> = new Set()
  private loader: Loader | null = null

  constructor(name?: string) {
    if (name) {
      this.name = name
      this.loader = new Loader(name)
      this.ready = this.loader.ready
    } else {
      this.ready = Promise.resolve({ head: [] })
    }
  }

  async put() {
    throw new Error('use a transaction to put')
  }

  async get(cid: AnyLink): Promise<AnyBlock | undefined> {
    for (const f of this.transactions) {
      const v = await f.superGet(cid)
      if (v) return v
    }
    if (!this.loader) return
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return await this.loader.getBlock(cid as CID)
  }

  async transaction(fn: (t: Transaction) => Promise<BulkResult>) {
    const t = new Transaction(this)
    this.transactions.add(t)
    const done: BulkResult = await fn(t)
    if (done) { await this.commit(t, done) }
    return done
  }

  async commit(t: Transaction, done: BulkResult) {
    if (!this.loader) return
    await this.loader.commit(t, done)
  }
}
