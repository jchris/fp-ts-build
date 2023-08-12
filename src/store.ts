import { format, parse, encode, decode, ByteView, ToString } from '@ipld/dag-json'
import { AnyBlock, AnyLink, DbMeta, IndexCars } from './types'

export abstract class HeaderStore {
  tag: string = 'header-base'
  name: string
  constructor(name: string) {
    this.name = name
  }

  makeHeader(car: AnyLink, indexes: IndexCars): ToString<DbMeta> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    console.log('make header', { car, indexes })
    const encoded = format({ car, indexes } as DbMeta)
    // const encoded = encode({ car, indexes } as DbMeta)
    // const encoded = JSON.stringify({ car, indexes })
    console.log('made header', encoded)
    return encoded
  }

  parseHeader(headerData: ToString<DbMeta>): DbMeta {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    console.log('parse header', headerData)
    const got = parse<DbMeta>(headerData)
    // const got = decode(headerData)
    // const got = JSON.parse(headerData.toString())
    console.log('parsed header', got)
    return got
  }

  abstract load(branch?: string): Promise<DbMeta | null>
  abstract save(carCid: AnyLink, indexes: IndexCars, branch?: string): Promise<void>
}

export abstract class CarStore {
  tag: string = 'car-base'
  name: string
  constructor(name: string) {
    this.name = name
  }

  abstract load(cid: AnyLink): Promise<AnyBlock>
  abstract save(car: AnyBlock): Promise<void>
  abstract remove(cid: AnyLink): Promise<void>
}
