import { parse } from 'multiformats/link'
import { AnyLink, ClockHead } from './types'
import { Database } from './database'

import { updateIndex } from './indexer-helpers'

export class Indexer {
  database: Database
  name: string
  mapFn: Function
  indexHead: ClockHead = []
  indexRoot: ProllyNode

  constructor(database: Database, name: string, mapFn: Function) {
    this.database = database
    this.name = name
    this.mapFn = mapFn
  }

  async query() {
    const indexRoot = await updateIndex(this.database, this.indexHead, this.mapFn)
  }
}
