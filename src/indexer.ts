import { AnyLink, ClockHead, ProllyNode } from './types'

import { updateIndex } from './indexer-helpers'
import { CRDT } from './crdt'

class Index {
  cid: AnyLink | null = null
  root: ProllyNode | null = null
}

export class Indexer {
  crdt: CRDT
  name: string
  mapFn: Function
  byKey = new Index()
  byId = new Index()
  indexHead: ClockHead = []

  constructor(crdt: CRDT, name: string, mapFn: Function) {
    this.crdt = crdt
    this.name = name
    this.mapFn = mapFn
  }

  async query() {
    await this._updateIndex()
  }

  async _updateIndex() {
    const { result, head } = await this.crdt.changes(this.indexHead)
    if (result.length === 0) {
      this.indexHead = head
    }
  }
}
