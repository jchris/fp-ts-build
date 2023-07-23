import { CarReader } from '@ipld/car'

import { CarStoreFS, HeaderStoreFS } from './store-fs'
import { makeCarFile } from './loader-helpers'
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
      return await this.loadCarFile(header.car)
    })
  }

  async commit(t: Transaction, done: BulkResult) {
    const car = await makeCarFile(t, done, [...this.carsReaders].reverse().map(([cid]) => (cid)))
    await this.carStore.save(car)
    await this.headerStore.save(car.cid)
  }

  async loadCarFile(cid: AnyLink): Promise<{ head: ClockHead}> {
    const car = await this.carStore.load(cid)
    const reader = await CarReader.fromBytes(car.bytes)
    this.carsReaders.set(cid.toString(), reader)
    const roots = await reader.getRoots()
    const header = await reader.get(roots[0])
    if (!header) throw new Error('missing header block')
    const { fp: { head } } = await decode(header)
    return { head }
  }

  async getBlock(cid: CID): Promise<AnyBlock | undefined> {
    for (const [, reader] of [...this.carsReaders].reverse()) { // reverse is faster
      const block = await reader.get(cid)
      if (block) return block
    }
  }
}
