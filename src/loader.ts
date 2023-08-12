import { CarReader } from '@ipld/car'
import { makeDbCarFile, makeIdxCarFile, parseDbCarFile, parseIdxCarFile } from './loader-helpers'
import { Transaction } from './transaction'
import { AnyBlock, AnyLink, BulkResult, DbCarHeader, DbMeta, IdxCarHeader, IdxMeta, IndexCars, IndexerResult } from './types'
import { BlockView, CID } from 'multiformats'
import { CarStore, HeaderStore } from './store'

class Loader {
  name: string
  headerStore: HeaderStore | undefined
  carStore: CarStore | undefined
  carLog: AnyLink[] = []
  carReaders: Map<string, CarReader> = new Map()
  ready: Promise<DbCarHeader | IdxCarHeader>

  constructor(name: string) {
    this.name = name

    const initializePromise = new Promise<void>((resolve, reject) => {
      const isBrowser = typeof window !== 'undefined'
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const module = isBrowser ? require('./store-browser') : require('./store-fs')
      if (module) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        this.headerStore = new module.HeaderStore(name) as HeaderStore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        this.carStore = new module.CarStore(name) as CarStore
        resolve()
      } else {
        reject(new Error('Failed to initialize stores.'))
      }
    })

    this.ready = initializePromise.then(() => {
      if (!this.headerStore || !this.carStore) throw new Error('stores not initialized')
      return this.headerStore.load('main').then(async (header?: DbMeta|null) => {
        return await this.ingestCarHead(header?.car)
      })
    })
  }

  async commit(t: Transaction, done: IndexerResult|BulkResult, compact: boolean = false): Promise<AnyLink> {
    await this.ready
    if (!this.headerStore || !this.carStore) throw new Error('stores not initialized')
    const car = await this.this_makeCarFile(t, done, this.carLog, compact)
    await this.carStore.save(car)
    if (compact) {
      for (const cid of this.carLog) {
        await this.carStore.remove(cid)
      }
      this.carLog.splice(0, this.carLog.length, car.cid)
    } else {
      this.carLog.push(car.cid)
    }
    await this.headerStore.save(car.cid)
    return car.cid
  }

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

  protected async ingestCarHead(cid?: AnyLink): Promise<DbCarHeader|IdxCarHeader> {
    if (!this.headerStore || !this.carStore) throw new Error('stores not initialized')
    if (!cid) return this.this_defaultCarHeader()
    const car = await this.carStore.load(cid)
    const reader = await CarReader.fromBytes(car.bytes)
    this.carReaders.set(cid.toString(), reader)
    this.carLog = [cid] // this.carLog.push(cid)
    const carHeader = await this.this_parseCarFile(reader)
    await this.getMoreReaders(carHeader.cars)
    return carHeader
  }

  protected async getMoreReaders(cids: AnyLink[]) {
    await Promise.all(cids.map(cid => this.loadCar(cid)))
  }

  async getBlock(cid: CID): Promise<AnyBlock | undefined> {
    for (const [, reader] of [...this.carReaders]) { // .reverse()) { // reverse is faster
      const block = await reader.get(cid)
      if (block) return block
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  protected async this_parseCarFile(_reader: CarReader): Promise<DbCarHeader|IdxCarHeader> {
    throw new Error('this_parseCarFile not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  protected async this_makeCarFile(
    _t: Transaction,
    _result: BulkResult | IndexerResult,
    _cars: AnyLink[],
    _compact: boolean = false
  ): Promise<BlockView<unknown, number, number, 1>> {
    throw new Error('this_makeCarFile not implemented')
  }

  protected this_defaultCarHeader(): DbCarHeader|IdxCarHeader {
    throw new Error('this_defaultCarHeader not implemented')
  }
}

export class DbLoader extends Loader {
  declare ready: Promise<DbCarHeader> // todo this will be a map of headers by branch name

  protected async this_parseCarFile(reader: CarReader): Promise<DbCarHeader> {
    return await parseDbCarFile(reader)
  }

  protected async this_makeCarFile(
    t: Transaction,
    result: BulkResult,
    cars: AnyLink[],
    compact: boolean = false
  ): Promise<BlockView<unknown, number, number, 1>> {
    return await makeDbCarFile(t, result, cars, compact)
  }

  protected this_defaultCarHeader(): DbCarHeader {
    return { head: [], cars: [], compact: [] }
  }
}

export class IdxLoader extends Loader {
  declare ready: Promise<IdxCarHeader>

  protected async this_parseCarFile(reader: CarReader): Promise<IdxCarHeader> {
    return await parseIdxCarFile(reader)
  }

  protected async this_makeCarFile(
    t: Transaction,
    result: IndexerResult,
    cars: AnyLink[],
    compact: boolean = false
  ): Promise<BlockView<unknown, number, number, 1>> {
    return await makeIdxCarFile(t, result, cars, compact)
  }

  protected this_defaultCarHeader(): IdxCarHeader {
    return { cars: [], compact: [], indexes: new Map() }
  }
}
