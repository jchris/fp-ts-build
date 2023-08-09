import { TransactionBlockstore } from './transaction'
import { DocUpdate, BulkResult, ClockHead, DbCarHeader, IdxCarHeader, MapFn } from './types'
import { clockChangesSince, applyBulkUpdateToCrdt, getValueFromCrdt, doCompact } from './crdt-helpers'
import { Indexer } from './indexer'

export class CRDT {
  name: string | null
  ready: Promise<[void, void]>
  blocks: TransactionBlockstore<DbCarHeader>
  indexBlocks: TransactionBlockstore<IdxCarHeader>

  private _head: ClockHead
  private _indexers: Map<string, Indexer> = new Map()

  constructor(name?: string, blocks?: TransactionBlockstore<DbCarHeader>) {
    this.name = name || null
    this.blocks = blocks || new TransactionBlockstore<DbCarHeader>(name)
    this.indexBlocks = new TransactionBlockstore(name ? name + '-idx' : undefined)
    this._head = []
    this.ready = Promise.all([
      this.blocks.ready.then((header: DbCarHeader) => {
        this._head = header.head // todo multi head support here
      }),
      this.indexBlocks.ready.then((header: IdxCarHeader) => {
        console.log('index header', header)
      })
    ])
  }

  async bulk(updates: DocUpdate[], options?: object): Promise<BulkResult> {
    await this.ready
    const tResult: BulkResult = await this.blocks.transaction(async tblocks => {
      const { head } = await applyBulkUpdateToCrdt(tblocks, this._head, updates, options)
      this._head = head // we want multi head support here if allowing calls to bulk in parallel
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

  async changes(since: ClockHead) {
    await this.ready
    return await clockChangesSince(this.blocks, this._head, since)
  }

  async compact() {
    await this.ready
    return await doCompact(this.blocks, this._head)
  }

  indexer(name: string, mapFn?: MapFn) {
    // await this.ready
    const idx = this._indexers.get(name) // maybe this should error if the mapfn is different
    if (idx) return idx
    const idx2 = new Indexer(this.indexBlocks, this, name, mapFn || name)
    this._registerIndexer(idx2)
    return this._indexers.get(name)
  }

  _registerIndexer(indexer: Indexer) {
    if (!indexer.name) throw new Error('Indexer must have a name')
    if (this._indexers.has(indexer.name)) {
      const existing = this._indexers.get(indexer.name)
      if (existing?.mapFnString !== indexer.mapFnString) throw new Error(`Indexer ${indexer.name} already registered with different map function`)
      // the new indexer might have a car file, etc, so we need to merge them
      // throw new Error('todo merge indexers')
    } else {
      this._indexers.set(indexer.name, indexer)
    }
  }
}
