import { MemoryBlockstore } from '@alanshaw/pail/block'
import { BlockFetcher, AnyBlock, AnyLink, BulkResult, ClockHead, DbCarHeader, IdxCarHeader, IdxMeta, IdxMetaCar, BulkResultCar, IndexerResult } from './types'
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

export class FireproofBlockstore implements BlockFetcher {
  ready: Promise<IdxCarHeader|DbCarHeader>
  name: string | null = null

  loader: DbLoader | IdxLoader | null = null

  private transactions: Set<Transaction> = new Set()

  constructor(name?: string) {
    if (name) {
      this.name = name
      this.loader = this.this_Loader(name) as unknown as DbLoader | IdxLoader
      this.ready = this.loader.ready
    } else {
      this.ready = Promise.resolve({ head: [], cars: [], compact: [] })
    }
  }

  this_Loader(_name: string) {
    throw new Error('not implemented')
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

  // eslint-disable-next-line @typescript-eslint/require-await
  async commit(_t: Transaction, _done: IdxMeta|BulkResult, _indexes?: Map<string, IdxMeta>): Promise<AnyLink | undefined> {
    throw new Error('not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async compact(t: Transaction, head: ClockHead) {
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
}

export class IndexBlockstore extends FireproofBlockstore {
  declare ready: Promise<IdxCarHeader>

  this_Loader(name: string) {
    return new IdxLoader(name)
  }

  async commit(t: Transaction, done: IdxMeta, indexes: Map<string, IdxMeta>): Promise<AnyLink | undefined> {
    // IndexerResult
    indexes.set(done.name, done)
    return await this.loader?.commit(t, { indexes })
  }

  async transaction(fn: (t: Transaction) => Promise<IdxMeta>, indexes: Map<string, IdxMeta>): Promise<IdxMetaCar> {
    const t = new Transaction(this)
    this.addTransaction(t)
    const done: IdxMeta = await fn(t)
    indexes.set(done.name, done)
    const car = await this.commit(t, done, indexes) as AnyLink
    if (car) return { ...done, car }
    return done
  }
}

export class TransactionBlockstore extends FireproofBlockstore {
  declare ready: Promise<DbCarHeader> // todo this will be a map of headers by branch name

  this_Loader(name: string) {
    return new DbLoader(name)
  }

  async commit(t: Transaction, done: BulkResult, _indexes?: Map<string, any>): Promise<AnyLink | undefined> {
    return await this.loader?.commit(t, done)
  }

  // declare async transaction(fn: (t: Transaction) => Promise<BulkResult>): Promise<BulkResult>
  async transaction(fn: (t: Transaction) => Promise<BulkResult>): Promise<BulkResultCar> {
    const t = new Transaction(this)
    this.addTransaction(t)
    const done: BulkResult = await fn(t)
    const car = await this.commit(t, done) as AnyLink
    if (car) return { ...done, car }
    return done
  }
}
