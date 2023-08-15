import { TransactionBlockstore, IndexBlockstore } from './transaction'
import { clockChangesSince, applyBulkUpdateToCrdt, getValueFromCrdt, doCompact } from './crdt-helpers'
import type { DocUpdate, BulkResult, ClockHead, DbCarHeader } from './types'
import type { Indexer } from '.'

export class CRDT {
  name: string | null
  ready: Promise<void>
  blocks: TransactionBlockstore
  indexBlocks: IndexBlockstore

  indexers: Map<string, Indexer> = new Map()

  private _head: ClockHead = []

  constructor(name?: string, blocks?: TransactionBlockstore) {
    this.name = name || null
    this.blocks = blocks || new TransactionBlockstore(name)
    this.indexBlocks = new IndexBlockstore(name ? name + '.idx' : undefined)
    this.ready = this.blocks.ready.then((header: DbCarHeader) => {
      // @ts-ignore
      if (header.indexes) throw new Error('cannot have indexes in crdt header')
      if (header.head) { this._head = header.head } // todo multi head support here
    })
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
}
