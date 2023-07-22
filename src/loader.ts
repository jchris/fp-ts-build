import { ClockHead, AnyLink } from './types'

export class HeaderLoader { // should belong to database?
  async get(_cid: AnyLink) {
  }

  async set(_cid: AnyLink, _head: ClockHead) {
  }
}

export class CarLoader {
  name: string
  constructor(name: string) {
    this.name = name
  }
}
