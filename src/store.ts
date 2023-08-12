import { format, parse, ToString } from '@ipld/dag-json'
import { AnyBlock, AnyLink, DbMeta } from './types'

abstract class VersionedStore {
  VERSION: string = '0.9'
}

export abstract class HeaderStore extends VersionedStore {
  tag: string = 'header-base'
  name: string
  constructor(name: string) {
    super()
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

export abstract class CarStore extends VersionedStore {
  tag: string = 'car-base'
  name: string
  constructor(name: string) {
    super()
    this.name = name
  }

  abstract load(cid: AnyLink): Promise<AnyBlock>
  abstract save(car: AnyBlock): Promise<void>
  abstract remove(cid: AnyLink): Promise<void>
}
