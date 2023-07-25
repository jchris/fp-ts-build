import { parse } from 'multiformats/link'
import { AnyLink } from './types'
import { Database } from './database'

export class Indexer {
  database: Database

  constructor(database: Database, name: string, mapper: Function) {
    this.database = database
  }

  async query() {

  }
}
