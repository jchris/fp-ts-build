import { MemoryBlockstore } from '@alanshaw/pail/block'
import { BlockFetcher, AnyBlock, AnyLink, BulkResult, ClockHead, DbCarHeader, IdxCarHeader, IdxMeta, IdxMetaCar, BulkResultCar } from './types'
import { DbLoader, IdxLoader } from './loader'
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

abstract class FireproofBlockstore implements BlockFetcher {
  ready: Promise<IdxCarHeader|DbCarHeader>
  name: string | null = null

  loader: DbLoader | IdxLoader | null = null

  private transactions: Set<Transaction> = new Set()

  constructor(name?: string, loaderFactory?: (name: string) => DbLoader | IdxLoader) {
    if (name && loaderFactory) {
      this.name = name
      this.loader = loaderFactory(name)
      this.ready = this.loader.ready
    } else {
      this.ready = Promise.resolve({ head: [], cars: [], compact: [] })
    }
  }

  abstract commit(_t: Transaction, _done: IdxMeta|BulkResult, _indexes?: Map<string, IdxMeta>): Promise<AnyLink | undefined>

  abstract transaction(fn: (t: Transaction) => Promise<IdxMeta|BulkResult>, indexes?: Map<string, IdxMeta>): Promise<BulkResultCar|IdxMetaCar>

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

  // eslint-disable-next-line @typescript-eslint/require-await
  async commitCompaction(t: Transaction, head: ClockHead) {
    this.transactions.clear()
    this.transactions.add(t)
    // todo replace cars
    return await this.loader?.commit(t, { head }, true)
  }

  addTransaction(t: Transaction) {
    this.transactions.add(t)
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

  protected async executeTransaction<T, R>(
    fn: (t: Transaction) => Promise<T>,
    commitHandler: (t: Transaction, done: T) => Promise<{ car?: AnyLink, done: R }>
  ): Promise<R> {
    const t = new Transaction(this)
    this.addTransaction(t)
    const done: T = await fn(t)
    const { car, done: result } = await commitHandler(t, done)
    return car ? { ...result, car } : result
  }
}

export class IndexBlockstore extends FireproofBlockstore {
  declare ready: Promise<IdxCarHeader>

  constructor(name?: string) {
    super(name, (name) => new IdxLoader(name))
  }

  async commit(t: Transaction, done: IdxMeta, indexes: Map<string, IdxMeta>): Promise<AnyLink | undefined> {
    indexes.set(done.name, done)
    return await this.loader?.commit(t, { indexes })
  }

  async transaction(fn: (t: Transaction) => Promise<IdxMeta>, indexes: Map<string, IdxMeta>): Promise<IdxMetaCar> {
    return this.executeTransaction(fn, async (t, done) => {
      indexes.set(done.name, done)
      const car = await this.commit(t, done, indexes) as AnyLink
      return { car, done }
    })
  }
}

export class TransactionBlockstore extends FireproofBlockstore {
  declare ready: Promise<DbCarHeader>

  constructor(name?: string) {
    super(name, (name) => new DbLoader(name)) // todo this will be a map of headers by branch name
  }

  async commit(t: Transaction, done: BulkResult, _indexes?: Map<string, any>): Promise<AnyLink | undefined> {
    return await this.loader?.commit(t, done)
  }

  async transaction(fn: (t: Transaction) => Promise<BulkResult>): Promise<BulkResultCar> {
    return this.executeTransaction(fn, async (t, done) => {
      const car = await this.commit(t, done) as AnyLink
      return { car, done }
    })
  }
}
