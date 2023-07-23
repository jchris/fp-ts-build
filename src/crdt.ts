/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { TransactionBlockstore as Blockstore } from './transaction-blockstore'
import { DocUpdate, BulkResult, CIDCounter, ClockHead } from './types'
import { getProllyRootFromClock, updateProllyRoot, createProllyRoot, advanceClock, clockChangesSince } from './crdt-helpers'
// import { StoredHeader } from './store'

export class CRDT {
  name: string | null
  ready: Promise<void>

  private _blocks: Blockstore
  private _head: ClockHead

  constructor(name?: string) {
    this.name = name || null
    this._blocks = new Blockstore(name)
    this._head = []
    this.ready = this._blocks.ready.then(({ head }: { head: ClockHead }) => {
      this._head = head // todo multi head support here
    })
  }

  /* this is the way from Pail, I think we can skip the historical event application when head length == 1
// zoom back to lca for root
// load root from lca
// calculate events from lca to head
// apply the events to the root
// (in the below this could be prollyRootWithEvents) wanna get the events while we are in there

// now do my new update
// record the new root with the new event
// prepare the result
*/

  async bulk(updates: DocUpdate[], _options?: object): Promise<BulkResult> {
    await this.ready
    const prollyRoot = await getProllyRootFromClock(this._blocks, this._head)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const tResult: BulkResult = await this._blocks.transaction(async tblocks => {
      const { root } = prollyRoot ? await updateProllyRoot(tblocks, prollyRoot, updates) : await createProllyRoot(tblocks, updates)
      const { head } = await advanceClock(tblocks, this._head, root, updates)
      this._head = head // we want multi head support here if allowing calls to bulk in parallel
      return { root, head }
    })
    return tResult
  }

  // async root(): Promise<any> {
  // async eventsSince(since: EventLink<T>): Promise<{clockCIDs: CIDCounter, result: T[]}> {
  // async getAll(rootCache: any = null): Promise<{root: any, cids: CIDCounter, clockCIDs: CIDCounter, result: T[]}> {

  async get(key: string) {
    await this.ready
    const prollyRoot = await getProllyRootFromClock(this._blocks, this._head)
    if (!prollyRoot) throw new Error('no root')
    const { result, cids } = await prollyRoot.get(key) as { result: DocUpdate, cids: CIDCounter }
    return { result, cids }
  }

  changes(since: ClockHead) {

  }
}
