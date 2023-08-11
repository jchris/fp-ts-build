import { encode, decode, ByteView } from '@ipld/dag-json'
import { AnyLink, DbMeta, IndexCars } from './types'

export abstract class HeaderStore {
  tag: string = 'header-base'
  name: string
  constructor(name: string) {
    this.name = name
  }

  makeHeader(car: AnyLink, indexes: IndexCars): ByteView<DbMeta> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    // console.log('make header', { car, indexes })
    return encode({ car, indexes } as DbMeta)
  }

  parseHeader(headerData: Uint8Array): DbMeta {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return decode(headerData)
  }

  abstract load(branch?: string): Promise<DbMeta|null>
  abstract save(carCid: AnyLink, indexes: IndexCars, branch?: string): Promise<void>
}

export abstract class CarStore {
  tag: string = 'car-base'
  name: string
  constructor(name: string) {
    this.name = name
  }
}
