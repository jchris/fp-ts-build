import { parse } from 'multiformats/link'
import { AnyLink } from './types'

export class StoredHeader {
  car: AnyLink
  constructor(jsonHeader: { car: string }) {
    this.car = parse(jsonHeader.car)
  }
}

export class HeaderStore {
  name: string
  constructor(name: string) {
    this.name = name
  }

  makeHeader(car: AnyLink) {
    return JSON.stringify({ car: car.toString() })
  }

  parseHeader(headerData: string) {
    const header = JSON.parse(headerData) as { car: string }
    return new StoredHeader(header)
  }
}

export class CarStore {
  name: string
  constructor(name: string) {
    this.name = name
  }
}
