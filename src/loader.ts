import { CarReader } from '@ipld/car'
import { innerMakeCarFile, parseCarFile } from './loader-helpers'
import { Transaction } from './transaction'
import type { AnyBlock, AnyLink, BulkResult, CarCommit, DbCarHeader, IdxCarHeader, IdxMetaMap } from './types'
import { CID } from 'multiformats'
import { CarStore, HeaderStore } from './store'

abstract class Loader {
  name: string
  headerStore: HeaderStore | undefined
  carStore: CarStore | undefined
  carLog: AnyLink[] = []
  carReaders: Map<string, CarReader> = new Map()
  ready: Promise<DbCarHeader | IdxCarHeader>
  key: string | undefined
  keyId: string | undefined

  constructor(name: string) {
    this.name = name

    this.ready = this.initializeStores().then(async () => {
      if (!this.headerStore || !this.carStore) throw new Error('stores not initialized')
      const header = await this.headerStore.load('main')
      return await this.ingestCarHead(header?.car)
    })
  }

  async commit(t: Transaction, done: IndexerResult | BulkResult, compact: boolean = false): Promise<AnyLink> {
    await this.ready
    if (!this.headerStore || !this.carStore) throw new Error('stores not initialized')
    const fp = this.makeCarHeader(t, done, this.carLog, compact)
    const { cid, bytes } = await innerMakeCarFile(fp, t)
    await this.carStore.save({ cid, bytes })
    if (compact) {
      for (const cid of this.carLog) {
        await this.carStore.remove(cid)
      }
      this.carLog.splice(0, this.carLog.length, cid)
    } else {
      this.carLog.push(cid)
    }
    await this.headerStore.save({ car: cid, key: null })
    return cid
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

  protected abstract makeCarHeader(
    _t: Transaction,
    _result: BulkResult | IndexerResult,
    _cars: AnyLink[],
    _compact: boolean
  ): DbCarHeader | IdxCarHeader;

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

  protected async ingestCarHead(cid?: AnyLink): Promise<DbCarHeader | IdxCarHeader> {
    if (!this.headerStore || !this.carStore) throw new Error('stores not initialized')
    if (!cid) return this.defaultCarHeader()
    const car = await this.carStore.load(cid)
    const reader = await CarReader.fromBytes(car.bytes)
    this.carReaders.set(cid.toString(), reader)
    this.carLog = [cid] // this.carLog.push(cid)
    const carHeader = await parseCarFile(reader)
    await this.getMoreReaders(carHeader.cars)
    return carHeader
  }

  protected async getMoreReaders(cids: AnyLink[]) {
    await Promise.all(cids.map(cid => this.loadCar(cid)))
  }

  async getBlock(cid: CID): Promise<AnyBlock | undefined> {
    for (const [, reader] of [...this.carReaders]) {
      const block = await reader.get(cid)
      if (block) {
        return block
      }
    }
  }

  protected abstract defaultCarHeader(): DbCarHeader | IdxCarHeader
}

export class DbLoader extends Loader {
  declare ready: Promise<DbCarHeader> // todo this will be a map of headers by branch name

  protected makeCarHeader(
    t: Transaction,
    result: BulkResult,
    cars: AnyLink[],
    compact: boolean = false
  ): DbCarHeader {
    const head = result.head
    if (!head) throw new Error('no head')
    return compact ? { head, cars: [], compact: cars } : { head, cars, compact: [] }
  }

  protected defaultCarHeader(): DbCarHeader {
    return { head: [], cars: [], compact: [] }
  }
}

export class IdxLoader extends Loader {
  declare ready: Promise<IdxCarHeader>

  protected makeCarHeader(
    t: Transaction,
    result: IndexerResult,
    cars: AnyLink[],
    compact: boolean = false
  ): IdxCarHeader {
    const indexes = result.indexes
    return compact ? { indexes, cars: [], compact: cars } : { indexes, cars, compact: [] }
  }

  protected defaultCarHeader(): IdxCarHeader {
    return { cars: [], compact: [], indexes: new Map() }
  }
}

type IndexerResult = CarCommit & IdxMetaMap
