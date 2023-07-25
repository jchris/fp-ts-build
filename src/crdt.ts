import { TransactionBlockstore as Blockstore } from './transaction'
import { DocUpdate, BulkResult, ClockHead } from './types'
import { clockChangesSince, applyBulkUpdateToCrdt, getValueFromCrdt, doCompact } from './crdt-helpers'

export class CRDT {
  name: string | null
  ready: Promise<void>

  private _blocks: Blockstore
  private _head: ClockHead

  constructor(name?: string, blocks?: Blockstore) {
    this.name = name || null
    this._blocks = blocks || new Blockstore(name)
    this._head = []
    this.ready = this._blocks.ready.then(({ head }: { head: ClockHead }) => {
      this._head = head // todo multi head support here
    })
  }

  async bulk(updates: DocUpdate[], options?: object): Promise<BulkResult> {
    await this.ready
    const tResult: BulkResult = await this._blocks.transaction(async tblocks => {
      const { head } = await applyBulkUpdateToCrdt(tblocks, this._head, updates, options)
      this._head = head // we want multi head support here if allowing calls to bulk in parallel
      return { head }
    })
    return tResult
  }

  // async root(): Promise<any> {
  // async eventsSince(since: EventLink<T>): Promise<{clockCIDs: CIDCounter, result: T[]}> {
  // async getAll(rootCache: any = null): Promise<{root: any, cids: CIDCounter, clockCIDs: CIDCounter, result: T[]}> {

  async get(key: string) {
    await this.ready
    const result = await getValueFromCrdt(this._blocks, this._head, key)
    if (result.del) return null
    return result
  }

  async changes(since: ClockHead) {
    return await clockChangesSince(this._blocks, this._head, since)
  }

  async compact() {
    return await doCompact(this._blocks, this._head)
  }
}
