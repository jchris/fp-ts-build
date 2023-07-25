import { MemoryBlockstore } from '@alanshaw/pail/block'
import { BlockFetcher, AnyBlock, AnyLink, BulkResult, ClockHead } from './types'
import { Loader } from './loader'
import { CID } from 'multiformats'

/** forked from
 * https://github.com/alanshaw/pail/blob/main/src/block.js
 * thanks Alan
**/

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

  constructor(name?: string, loader?: Loader) {
    if (name) {
      this.name = name
      this.loader = loader || new Loader(name)
      this.ready = this.loader.ready
    } else {
      this.ready = Promise.resolve({ head: [] })
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async put() {
    throw new Error('use a transaction to put')
  }

  async get(cid: AnyLink): Promise<AnyBlock | undefined> {
    for (const f of this.transactions) {
      const v = await f.superGet(cid)
      if (v) return v
    }
    if (!this.loader) return
    return await this.loader.getBlock(cid as CID)
  }

  async transaction(fn: (t: Transaction) => Promise<BulkResult>) {
    const t = new Transaction(this)
    this.transactions.add(t)
    const done: BulkResult = await fn(t)
    if (done) { return { ...done, car: await this.commit(t, done) } }
    return done
  }

  async commit(t: Transaction, done: BulkResult): Promise<AnyLink | undefined> {
    return await this.loader?.commit(t, done)
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async compact(t: Transaction) {
    this.transactions.clear()
    this.transactions.add(t)
    // todo replace cars
  }

  async * entries(): AsyncIterableIterator<AnyBlock> {
    const seen: Set<string> = new Set()
    for (const t of this.transactions) {
      for await (const blk of t.entries()) {
        if (seen.has(blk.cid.toString())) continue
        seen.add(blk.cid.toString())
        yield blk
      }
    }
  }
}
