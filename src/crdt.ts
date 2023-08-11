import { TransactionBlockstore, IndexBlockstore } from './transaction'
import { DocUpdate, BulkResult, ClockHead, DbCarHeader, IdxCarHeader, MapFn, IdxMeta } from './types'
import { clockChangesSince, applyBulkUpdateToCrdt, getValueFromCrdt, doCompact } from './crdt-helpers'
import { Indexer } from './indexer'

export class CRDT {
  name: string | null
  ready: Promise<[void, void]>
  blocks: TransactionBlockstore
  indexBlocks: IndexBlockstore

  indexers: Map<string, Indexer> = new Map()

  private _head: ClockHead

  constructor(name?: string, blocks?: TransactionBlockstore) {
    this.name = name || null
    this.blocks = blocks || new TransactionBlockstore(name)
    this.indexBlocks = new IndexBlockstore(name ? name + '.idx' : undefined)
    this._head = []
    this.ready = Promise.all([
      this.blocks.ready.then((header: DbCarHeader) => {
        this._head = header.head // todo multi head support here
      }),
      this.indexBlocks.ready.then(async (header: IdxCarHeader) => {
        if (header.indexes === undefined) return
        for (const [name, idx] of Object.entries(header.indexes)) {
          this.indexer(name, undefined, idx as IdxMeta)
        }
      })
    ])
  }

  async bulk(updates: DocUpdate[], options?: object): Promise<BulkResult> {
    await this.ready
    const tResult = await this.blocks.transaction(async (tblocks): Promise<BulkResult> => {
      const { head } = await applyBulkUpdateToCrdt(tblocks, this._head, updates, options)
      this._head = head // we need multi head support here if allowing calls to bulk in parallel
      return { head }
    })
    return tResult
  }

  // async getAll(rootCache: any = null): Promise<{root: any, cids: CIDCounter, clockCIDs: CIDCounter, result: T[]}> {

  async get(key: string) {
    await this.ready
    const result = await getValueFromCrdt(this.blocks, this._head, key)
    if (result.del) return null
    return result
  }

  async changes(since: ClockHead = []) {
    await this.ready
    return await clockChangesSince(this.blocks, this._head, since)
  }

  async compact() {
    await this.ready
    return await doCompact(this.blocks, this._head)
  }

  // async indexer(name: string, mapFn?: MapFn | string): Promise<Indexer> {
  //   await this.ready
  //   return this.indexer_int(name, mapFn)
  // }

  indexer(name: string, mapFn?: MapFn, meta?: IdxMeta): Indexer {
    if (mapFn && meta) throw new Error('cannot provide both mapFn and meta')
    if (mapFn && mapFn.constructor.name !== 'Function') throw new Error('mapFn must be a function')
    if (this.indexers.has(name)) {
      const idx = this.indexers.get(name)!
      idx.applyMapFn(name, mapFn, meta)
    } else {
      const idx = new Indexer(this.indexBlocks, this, name, mapFn, meta)
      this.indexers.set(name, idx)
    }
    return this.indexers.get(name)!
  }
}
