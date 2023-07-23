import { CarReader } from '@ipld/car'

import { CarStoreFS, HeaderStoreFS } from './store-fs'
import { makeCarFile, parseCarFile } from './loader-helpers'
import { Transaction } from './transaction-blockstore'
import { AnyBlock, AnyLink, BulkResult, ClockHead } from './types'
import { CID } from 'multiformats'

export class Loader {
  name: string
  headerStore: HeaderStoreFS
  carStore: CarStoreFS
  carsReaders: Map<string, CarReader> = new Map()
  ready: Promise<{ head: ClockHead}> // todo this will be a map of headers by branch name
  constructor(name: string) {
    this.name = name
    this.headerStore = new HeaderStoreFS(name)
    this.carStore = new CarStoreFS(name)
    // todo config with multiple branches
    this.ready = this.headerStore.load('main').then(async header => {
      if (!header) return { head: [] }
      const car = await this.carStore.load(header.car)
      return await this.ingestCarFile(header.car, car)
    })
  }

  async commit(t: Transaction, done: BulkResult) {
    const car = await makeCarFile(t, done, [...this.carsReaders].reverse().map(([cid]) => (cid)))
    await this.carStore.save(car)
    await this.headerStore.save(car.cid)
  }

  async ingestCarFile(cid: AnyLink, car: AnyBlock): Promise<{ head: ClockHead, cars: AnyLink[]}> {
    const reader = await CarReader.fromBytes(car.bytes)
    this.carsReaders.set(cid.toString(), reader)
    const { head, cars } = await parseCarFile(reader)
    // console.log('ingested car file', cid.toString(), { head, cars: cars.length })
    await this.getMoreReaders(cars)
    return { head, cars }
  }

  async getMoreReaders(cids: AnyLink[]) {
    for (const cid of cids) {
      if (this.carsReaders.has(cid.toString())) continue
      const car = await this.carStore.load(cid)
      if (!car) throw new Error(`missing car file ${cid.toString()}`)
      const reader = await CarReader.fromBytes(car.bytes)
      this.carsReaders.set(cid.toString(), reader)
    }
  }

  async getBlock(cid: CID): Promise<AnyBlock | undefined> {
    for (const [, reader] of [...this.carsReaders].reverse()) { // reverse is faster
      const block = await reader.get(cid)
      if (block) return block
    }
  }
}
