// import { parse } from 'multiformats/link'
import { encode, decode, ByteView } from '@ipld/dag-json'
import { AnyLink, DbHeader, HeaderStoreInterface, IndexCars } from './types'

export abstract class HeaderStore implements HeaderStoreInterface {
  name: string
  constructor(name: string) {
    this.name = name
  }

  makeHeader(car: AnyLink, indexes: IndexCars): ByteView<DbHeader> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return encode({ car, indexes } as DbHeader) as ByteView<DbHeader>
  }

  parseHeader(headerData: Uint8Array) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return decode(headerData) as DbHeader
  }

  abstract load(branch?: string): Promise<DbHeader|null>
  abstract save(carCid: AnyLink, indexes: IndexCars, branch?: string): Promise<void>
}

export class CarStore {
  name: string
  constructor(name: string) {
    this.name = name
  }
}
