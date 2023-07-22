import { AnyLink } from './types'

export class HeaderStore {
  name: string
  constructor(name: string) {
    this.name = name
  }

  makeHeader(car: AnyLink) {
    return JSON.stringify({ car: car.toString() })
  }
}

export class CarStore {
  name: string
  constructor(name: string) {
    this.name = name
  }
}
