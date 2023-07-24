import { CarReader } from '@ipld/car'

// import { CarStoreFS, HeaderStoreFS } from './store-fs'
import { CarStoreIDB as CarStore, HeaderStoreLS as HeaderStore } from './store-browser'
import { makeCarFile, parseCarFile } from './loader-helpers'
import { Transaction } from './transaction'
import { AnyBlock, AnyLink, BulkResult, ClockHead } from './types'
import { CID } from 'multiformats'

export class Loader {
  name: string
  headerStore: HeaderStore
  carStore: CarStore
  carLog: AnyLink[] = []
  carsReaders: Map<string, CarReader> = new Map()
  ready: Promise<{ head: ClockHead}> // todo this will be a map of headers by branch name
  constructor(name: string) {
    this.name = name
    this.headerStore = new HeaderStore(name)
    this.carStore = new CarStore(name)
    // todo config with multiple branches
    this.ready = this.headerStore.load('main').then(async header => {
      if (!header) return { head: [] }
      const car = await this.carStore.load(header.car)
      return await this.ingestCarHead(header.car, car)
    })
  }

  async commit(t: Transaction, done: BulkResult): Promise<AnyLink> {
    const car = await makeCarFile(t, done, this.carLog)
    await this.carStore.save(car)
    this.carLog.push(car.cid)
    await this.headerStore.save(car.cid)
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

  async ingestCarHead(cid: AnyLink, car: AnyBlock): Promise<{ head: ClockHead, cars: AnyLink[]}> {
    const reader = await CarReader.fromBytes(car.bytes)
    this.carsReaders.set(cid.toString(), reader)
    const { head, cars } = await parseCarFile(reader)
    await this.getMoreReaders(cars)
    return { head, cars }
  }

  async getMoreReaders(cids: AnyLink[]) {
    for (const cid of cids) {
      await this.loadCar(cid)
    }
  }

  async getBlock(cid: CID): Promise<AnyBlock | undefined> {
    for (const [, reader] of [...this.carsReaders].reverse()) { // reverse is faster
      const block = await reader.get(cid)
      if (block) return block
    }
  }
}
