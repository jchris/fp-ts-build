import { CarReader } from '@ipld/car'
import { innerMakeCarFile, parseCarFile } from './loader-helpers'
import { Transaction } from './transaction'
import type {
  AnyBlock, AnyCarHeader, AnyLink, BulkResult,
  CarCommit, DbCarHeader, DbMeta, IdxCarHeader,
  IdxMeta, IdxMetaMap
} from './types'
import { CID } from 'multiformats'
import { CarStore, HeaderStore } from './store'
import { encryptedMakeCarFile } from './encrypt-helpers'
import { randomBytes } from './encrypted-block'

abstract class Loader {
  name: string
  headerStore: HeaderStore | undefined
  carStore: CarStore | undefined
  carLog: AnyLink[] = []
  carReaders: Map<string, CarReader> = new Map()
  ready: Promise<AnyCarHeader>
  key: string | undefined
  keyId: string | undefined

  static defaultHeader: AnyCarHeader
  abstract defaultHeader: AnyCarHeader

  constructor(name: string) {
    this.name = name

    this.ready = this.initializeStores().then(async () => {
      if (!this.headerStore || !this.carStore) throw new Error('stores not initialized')
      const meta = await this.headerStore.load('main')
      return await this.ingestCarHeadFromMeta(meta)
    })
  }

  async commit(t: Transaction, done: IndexerResult | BulkResult, compact: boolean = false): Promise<AnyLink> {
    await this.ready
    const fp = this.makeCarHeader(done, this.carLog, compact)
    const { cid, bytes } = this.key ? await encryptedMakeCarFile(this.key, fp, t) : await innerMakeCarFile(fp, t)
    await this.carStore!.save({ cid, bytes })
    if (compact) {
      for (const cid of this.carLog) {
        await this.carStore!.remove(cid)
      }
      this.carLog.splice(0, this.carLog.length, cid)
    } else {
      this.carLog.push(cid)
    }
    await this.headerStore!.save({ car: cid, key: this.key || null })
    return cid
  }

  async getBlock(cid: CID): Promise<AnyBlock | undefined> {
    for (const [, reader] of [...this.carReaders]) {
      const block = await reader.get(cid)
      if (block) {
        return block
      }
    }
  }

  protected async initializeStores() {
    const isBrowser = typeof window !== 'undefined'
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const module = isBrowser ? await require('./store-browser') : await require('./store-fs')
    if (module) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      this.headerStore = new module.HeaderStore(this.name) as HeaderStore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      this.carStore = new module.CarStore(this.name) as CarStore
    } else {
      throw new Error('Failed to initialize stores.')
    }
  }

  protected abstract makeCarHeader(_result: BulkResult | IndexerResult, _cars: AnyLink[], _compact: boolean): AnyCarHeader;

  protected async loadCar(cid: AnyLink): Promise<CarReader> {
    if (!this.headerStore || !this.carStore) throw new Error('stores not initialized')
    if (this.carReaders.has(cid.toString())) return this.carReaders.get(cid.toString()) as CarReader
    const car = await this.carStore.load(cid)
    if (!car) throw new Error(`missing car file ${cid.toString()}`)
    const reader = await CarReader.fromBytes(car.bytes)
    this.carReaders.set(cid.toString(), reader)
    this.carLog.push(cid)
    return reader
  }

  protected setKey(key: string) {
    this.key = key
    this.keyId = key.split('').reverse().join('')
  }

  protected async ingestCarHeadFromMeta(meta: DbMeta | null): Promise<AnyCarHeader> {
    if (!this.headerStore || !this.carStore) throw new Error('stores not initialized')
    if (!meta) {
      // this.setKey(randomBytes(32).toString('hex'))
      return this.defaultHeader
    }
    const { car: cid, key } = meta
    console.log('ingesting car head from meta', { car: cid, key })
    if (key) {
      this.setKey(key)
    }// use loadCar
    const reader = await this.loadCar(cid)
    this.carLog = [cid] // this.carLog.push(cid)
    const carHeader = await parseCarFile(reader)
    await this.getMoreReaders(carHeader.cars)
    return carHeader
  }

  protected async getMoreReaders(cids: AnyLink[]) {
    await Promise.all(cids.map(cid => this.loadCar(cid)))
  }
}

export class DbLoader extends Loader {
  declare ready: Promise<DbCarHeader> // todo this will be a map of headers by branch name

  static defaultHeader = { cars: [], compact: [], head: [] }
  defaultHeader = DbLoader.defaultHeader

  protected makeCarHeader({ head }: BulkResult, cars: AnyLink[], compact: boolean = false): DbCarHeader {
    return compact ? { head, cars: [], compact: cars } : { head, cars, compact: [] }
  }
}

export class IdxLoader extends Loader {
  declare ready: Promise<IdxCarHeader>

  static defaultHeader = { cars: [], compact: [], indexes: new Map() as Map<string, IdxMeta> }
  defaultHeader = IdxLoader.defaultHeader

  protected makeCarHeader({ indexes }: IndexerResult, cars: AnyLink[], compact: boolean = false): IdxCarHeader {
    return compact ? { indexes, cars: [], compact: cars } : { indexes, cars, compact: [] }
  }
}

type IndexerResult = CarCommit & IdxMetaMap
