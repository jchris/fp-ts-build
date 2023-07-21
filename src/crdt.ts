/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { EventLink } from '@alanshaw/pail/clock'
import { TransactionBlockstore as Blockstore } from './transaction-blockstore'
import { DocUpdate, BulkResult, CIDCounter } from './types'
import { getProllyRootFromClock, updateProllyRoot, createProllyRoot, advanceClock } from './crdt-helpers'

export class CRDT<T> {
  private _blocks: Blockstore
  private _head: EventLink<T>[]

  constructor(blocks: Blockstore, head: EventLink<T>[]) {
    this._blocks = blocks
    this._head = head
  }

  async bulk(updates: DocUpdate[], _options?: object): Promise<BulkResult> {
    const prollyRoot = await getProllyRootFromClock(this._blocks, this._head)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const tResult: BulkResult = await this._blocks.transaction(async tblocks => {
      const { root } = prollyRoot ? await updateProllyRoot(tblocks, prollyRoot, updates) : await createProllyRoot(tblocks, updates)
      const { head } = await advanceClock(tblocks, this._head, root, updates)
      this._head = head
      return { root, head }
    })
    return tResult
  }

  // async root(): Promise<any> {
  // async eventsSince(since: EventLink<T>): Promise<{clockCIDs: CIDCounter, result: T[]}> {
  // async getAll(rootCache: any = null): Promise<{root: any, cids: CIDCounter, clockCIDs: CIDCounter, result: T[]}> {
  // async get(key: string, rootCache: any = null): Promise<{result: any, cids: CIDCounter, clockCIDs: CIDCounter, root: any}> {

  async get(key: string) {
    const prollyRoot = await getProllyRootFromClock(this._blocks, this._head)
    if (!prollyRoot) throw new Error('no root')
    const { result, cids } = await prollyRoot.get(key) as { result: DocUpdate, cids: CIDCounter }
    return { result, cids }
  }
}
