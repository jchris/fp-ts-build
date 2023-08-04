import { CarReader } from '@ipld/car'

import { CarStoreFS as CarStore, HeaderStoreFS as HeaderStore } from './store-fs'
// import { CarStoreIDB as CarStore, HeaderStoreLS as HeaderStore } from './store-browser'
import { makeCarFile, parseCarFile, isIndexerResult } from './loader-helpers'
import { Transaction } from './transaction'
import { AnyBlock, AnyLink, BulkResult, ClockHead, IndexCars, IndexerResult } from './types'
import { CID } from 'multiformats'

export class Loader {
  name: string
  headerStore: HeaderStore
  carStore: CarStore
  carLog: AnyLink[] = []
  indexCarLogs: Map<string, AnyLink[]> = new Map()
  carsReaders: Map<string, CarReader> = new Map()
  ready: Promise<{ head: ClockHead, cars: AnyLink[] }> // todo this will be a map of headers by branch name

  constructor(name: string) {
    this.name = name
    this.headerStore = new HeaderStore(name)
    this.carStore = new CarStore(name)
    // todo config with multiple branches
    this.ready = this.headerStore.load('main').then(async header => {
      if (!header) return { head: [], cars: [] }
      const carHead = await this.ingestCarHead(header.car)
      console.log('header.indexes', header.indexes)
      // const indexHeads = await this.loadIndexCars(header.indexes)

      // carHead.head is used to set crdt head
      return carHead
    })
  }

  async commit(t: Transaction, done: BulkResult | IndexerResult, compact: boolean = false): Promise<AnyLink> {
    const commitCarLog = this.carLogForResult(done)
    const car = await makeCarFile(t, done, commitCarLog, compact)
    await this.carStore.save(car)
    if (compact) {
      for (const cid of commitCarLog) {
        await this.carStore.remove(cid)
      }
      commitCarLog.splice(0, commitCarLog.length, car.cid)
    } else {
      commitCarLog.push(car.cid)
    }
    await this.headerStore.save(car.cid, {})
    return car.cid
  }

  async loadCar(cid: AnyLink): Promise<CarReader> {
    if (this.carsReaders.has(cid.toString())) return this.carsReaders.get(cid.toString()) as CarReader
    const car = await this.carStore.load(cid)
    if (!car) throw new Error(`missing car file ${cid.toString()}`)
    const reader = await CarReader.fromBytes(car.bytes)
    this.carsReaders.set(cid.toString(), reader)
    return reader
  }

  async ingestCarHead(cid: AnyLink): Promise<{ head: ClockHead, cars: AnyLink[] }> {
    const car = await this.carStore.load(cid)
    const reader = await CarReader.fromBytes(car.bytes)
    this.carsReaders.set(cid.toString(), reader)
    const { head, cars } = await parseCarFile(reader)
    await this.getMoreReaders(cars)
    return { head, cars }
  }

  async ingestIndexCars(indexCars: IndexCars) {
    for (const [, cid] of Object.entries(indexCars)) {
      const car = await this.carStore.load(cid)
      const reader = await CarReader.fromBytes(car.bytes)
      this.carsReaders.set(cid.toString(), reader)
      const { cars } = await parseCarFile(reader)
      await this.getMoreReaders(cars)
    }
  }

  async getMoreReaders(cids: AnyLink[]) {
    for (const cid of cids) {
      // todo if loadCar stores promises we can parallelize this
      await this.loadCar(cid)
    }
  }

  async getBlock(cid: CID): Promise<AnyBlock | undefined> {
    for (const [, reader] of [...this.carsReaders].reverse()) { // reverse is faster
      const block = await reader.get(cid)
      if (block) return block
    }
  }

  carLogForResult(result: BulkResult | IndexerResult): AnyLink[] {
    if (isIndexerResult(result)) {
      if (!this.indexCarLogs.has(result.name)) this.indexCarLogs.set(result.name, [])
      return this.indexCarLogs.get(result.name) as AnyLink[]
    }
    return this.carLog
  }
}
