import { Block, CID } from 'multiformats'
import { ClockHead } from './types'

export class HeaderLoader { // should belong to database?
  async get(_cid: CID<unknown, number, number, 1>) {
  }

  async set(_cid: CID<unknown, number, number, 1>, _head: ClockHead) {
  }
}

export class CarLoader {
  name: string
  constructor(name: string) {
    this.name = name
  }
}
