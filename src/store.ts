// import { parse } from 'multiformats/link'
import { encode, decode, ByteView } from '@ipld/dag-json'
import { AnyLink, DbMeta, HeaderStoreInterface, IndexCars } from './types'

export abstract class HeaderStore implements HeaderStoreInterface {
  name: string
  constructor(name: string) {
    this.name = name
  }

  makeHeader(car: AnyLink, indexes: IndexCars): ByteView<DbMeta> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    console.log('make header', { car, indexes })
    return encode({ car, indexes } as DbMeta)
  }

  parseHeader(headerData: Uint8Array) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return decode(headerData)
  }

  abstract load(branch?: string): Promise<DbMeta|null>
  abstract save(carCid: AnyLink, indexes: IndexCars, branch?: string): Promise<void>
}

export class CarStore {
  name: string
  constructor(name: string) {
    this.name = name
  }
}
