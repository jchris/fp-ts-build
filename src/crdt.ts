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
    this.ready = Promise.all([ // load the meta here, use it to load the car headers
      this.blocks.ready.then((header: DbCarHeader) => {
        this._head = header.head // todo multi head support here
      }),
      this.indexBlocks.ready.then((header: IdxCarHeader) => {
        console.log('index header', header.indexes)
        if (header.indexes === undefined) return
        // this is where the indexers get wet
        for (const [name, idx] of Object.entries(header.indexes)) {
          const idxM = idx as IdxMeta
          const ix = this.indexer(name, idxM.map) // todo eval
          ix.byId.cid = idxM.byId
          ix.byKey.cid = idxM.byKey
          ix.indexHead = idxM.head
        }
        // this.indexer()
      })
    ])
  }

  async bulk(updates: DocUpdate[], options?: object): Promise<BulkResult> {
    await this.ready
    const tResult = await this.blocks.transaction(async (tblocks): Promise<BulkResult> => {
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

  indexer(name: string, mapFn?: MapFn | string): Indexer {
    // await this.ready
    const idx = this.indexers.get(name) // maybe this should error if the mapfn is different
    if (idx) {
      if (!idx.mapFn && idx.mapFnString) {
        if (mapFn && mapFn.toString() !== idx.mapFnString) throw new Error('Indexer already registered with different map function')
        idx.mapFn = mapFn
      }
      if (idx.mapFn && mapFn && idx.mapFn.toString() !== mapFn.toString()) throw new Error('Indexer already registered with different map function')
      return idx
    }
    const idx2 = new Indexer(this.indexBlocks, this, name, mapFn || name)
    this._registerIndexer(idx2)
    const indx = this.indexers.get(name)
    if (!indx) throw new Error('indexer not registered')
    return indx
  }

  _registerIndexer(indexer: Indexer) {
    if (!indexer.name) throw new Error('Indexer must have a name')
    if (this.indexers.has(indexer.name)) {
      const existing = this.indexers.get(indexer.name)
      if (existing?.mapFnString !== indexer.mapFnString) throw new Error(`Indexer ${indexer.name} already registered with different map function`)
      // the new indexer might have a car file, etc, so we need to merge them
      // throw new Error('todo merge indexers')
    } else {
      this.indexers.set(indexer.name, indexer)
    }
    // console.log('registered indexer', indexer.name, this.indexers)
    // console.log('blockstore indexers', this.indexers)
  }
}
