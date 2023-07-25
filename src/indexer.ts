import { parse } from 'multiformats/link'
import { AnyLink } from './types'
import { Database } from './database'

export class Indexer {
  database: Database
  name: string
  mapFn: Function

  constructor(database: Database, name: string, mapFn: Function) {
    this.database = database
    this.name = name
    this.mapFn = mapFn
  }

  async query() {

  }
}
