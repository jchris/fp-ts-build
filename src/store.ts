import { format, parse, ToString } from '@ipld/dag-json'
import { AnyBlock, AnyLink, DbMeta } from './types'

export abstract class HeaderStore {
  tag: string = 'header-base'
  name: string
  constructor(name: string) {
    this.name = name
  }

  makeHeader(car: AnyLink): ToString<DbMeta> {
    const encoded = format({ car } as DbMeta)
    return encoded
  }

  parseHeader(headerData: ToString<DbMeta>): DbMeta {
    const got = parse<DbMeta>(headerData)
    return got
  }

  abstract load(branch?: string): Promise<DbMeta | null>
  abstract save(carCid: AnyLink, branch?: string): Promise<void>
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
