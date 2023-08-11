import { openDB, IDBPDatabase } from 'idb'

import { AnyBlock, AnyLink, DbMeta, IndexCars } from './types'
import { CarStore as CarStoreBase, HeaderStore as HeaderStoreBase } from './store'

export const FORMAT = '0.9'

export class CarStore extends CarStoreBase {
  tag: string = 'car-browser-idb'
  keyId: string = 'public'
  idb: IDBPDatabase<unknown> | null = null
  name: string = 'default'

  async _withDB(dbWorkFun: (arg0: any) => any) {
    if (!this.idb) {
      const dbName = `fp.${FORMAT}.${this.keyId}.${this.name}.valet`
      this.idb = await openDB(dbName, 1, {
        upgrade(db): void {
          db.createObjectStore('cars')
        }
      })
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await dbWorkFun(this.idb)
  }

  async load(cid: AnyLink): Promise<AnyBlock> {
    console.log('loading', cid.toString())
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this._withDB(async (db: IDBPDatabase<unknown>) => {
      const tx = db.transaction(['cars'], 'readonly')
      const bytes = (await tx.objectStore('cars').get(cid.toString())) as Uint8Array
      if (!bytes) throw new Error(`missing idb block ${cid.toString()}`)
      return { cid, bytes }
    })
  }

  async save(car: AnyBlock): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this._withDB(async (db: IDBPDatabase<unknown>) => {
      const tx = db.transaction(['cars'], 'readwrite')
      await tx.objectStore('cars').put(car.bytes, car.cid.toString())
      return await tx.done
    })
  }
}

export class HeaderStore extends HeaderStoreBase {
  tag: string = 'header-browser-ls'
  keyId: string = 'public'
  name: string = 'default'
  decoder: TextDecoder
  encoder: TextEncoder

  constructor(name: string) {
    super(name)
    this.decoder = new TextDecoder()
    this.encoder = new TextEncoder()
  }

  headerKey(branch: string) {
    return `fp.${FORMAT}.${this.keyId}.${this.name}.${branch}`
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async load(branch: string = 'main'): Promise<DbMeta | null> {
    try {
      const bytes = localStorage.getItem(this.headerKey(branch))
      return bytes ? this.parseHeader(this.encoder.encode(bytes)) : null
    } catch (e) {
      return null
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async save(carCid: AnyLink, indexes: IndexCars, branch: string = 'main'): Promise<void> {
    try {
      const headerKey = this.headerKey(branch)
      const bytes = this.makeHeader(carCid, indexes) as Uint8Array
      return localStorage.setItem(headerKey, bytes.toString())
    } catch (e) {}
  }
}
