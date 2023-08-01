import { ClockHead, DocUpdate, MapFn, IndexUpdate, IndexerResult } from './types'
import { TransactionBlockstore as Blockstore } from './transaction'
import { bulkIndex, indexEntriesForChanges, byIdOpts, byKeyOpts, IndexTree } from './indexer-helpers'
import { CRDT } from './crdt'

export class Indexer {
  blocks: Blockstore
  crdt: CRDT
  name: string
  mapFn: MapFn
  byKey = new IndexTree()
  byId = new IndexTree()
  indexHead: ClockHead = []

  constructor(blocks: Blockstore, crdt: CRDT, name: string, mapFn: MapFn) {
    this.blocks = blocks
    this.crdt = crdt
    this.name = name
    this.mapFn = mapFn
  }

  async query() {
    await this._updateIndex()
    if (!this.byKey.root) return { result: [] }
  }

  async _updateIndex() {
    const { result, head } = await this.crdt.changes(this.indexHead)
    if (result.length === 0) {
      this.indexHead = head
      return { byId: this.byId, byKey: this.byKey }
    }
    let staleKeyIndexEntries: IndexUpdate[] = []
    let removeIdIndexEntries: IndexUpdate[] = []
    if (this.byId.root) {
      const removeIds = result.map(({ key }) => key)
      const { result: oldChangeEntries } = await this.byId.root.getMany(removeIds) as { result: Array<[string, string] | string> }
      staleKeyIndexEntries = oldChangeEntries.map(key => ({ key, del: true }))
      removeIdIndexEntries = oldChangeEntries.map((key) => ({ key: key[1], del: true }))
    }
    const indexEntries = indexEntriesForChanges(result, this.mapFn)
    const byIdIndexEntries: DocUpdate[] = indexEntries.map(({ key }) => ({ key: key[1], value: key }))
    return await this.blocks.indexTransaction(async (tblocks): Promise<IndexerResult> => {
      this.byId = await bulkIndex(
        tblocks,
        this.byId,
        removeIdIndexEntries.concat(byIdIndexEntries),
        byIdOpts
      )
      this.byKey = await bulkIndex(tblocks, this.byKey, staleKeyIndexEntries.concat(indexEntries), byKeyOpts)
      this.indexHead = head
      return { byId: this.byId, byKey: this.byKey }
    })
  }
}
