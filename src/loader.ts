import { CarStoreFS, HeaderStoreFS } from './store-fs'
import { makeCarFile } from './loader-helpers'
import { Transaction } from './transaction-blockstore'
import { BulkResult } from './types'
import { StoredHeader } from './store'

export class Loader {
  name: string
  headerStore: HeaderStoreFS
  carStore: CarStoreFS
  ready: Promise<StoredHeader|null> // todo this will be a map of headers by branch name
  constructor(name: string) {
    this.name = name
    this.headerStore = new HeaderStoreFS(name)
    this.carStore = new CarStoreFS(name)
    this.ready = this.headerStore.load()
  }

  async commit(t: Transaction, done: BulkResult) {
    const car = await makeCarFile(t, done)
    await this.carStore.save(car)
    await this.headerStore.save(car.cid)
  }
}
