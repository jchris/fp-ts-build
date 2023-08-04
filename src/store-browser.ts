import { openDB, IDBPDatabase } from 'idb'

import { AnyBlock, AnyLink, DbHeader, IndexCars } from './types'
import { CarStore, HeaderStore } from './store'

export const FORMAT = '0.9'

export class CarStoreIDB extends CarStore {
  keyId: string = 'public'
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  idb: IDBPDatabase<unknown> | null = null
  name: string = 'default'
  async withDB(dbWorkFun: (arg0: any) => any) {
    if (!this.idb) {
      const dbName = `fp.${FORMAT}.${this.keyId}.${this.name}.valet`
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      this.idb = await openDB(dbName, 1, {
        upgrade(db): void {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
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
    return await this.withDB(async (db: IDBPDatabase<unknown>) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      const tx = db.transaction(['cars'], 'readonly')
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      const bytes = (await tx.objectStore('cars').get(cid.toString())) as Uint8Array
      if (!bytes) throw new Error(`missing idb block ${cid.toString()}`)
      return { cid, bytes }
    })
  }

  async save(car: AnyBlock): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.withDB(async (db: IDBPDatabase<unknown>) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      const tx = db.transaction(['cars'], 'readwrite')
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      await tx.objectStore('cars').put(car.bytes, car.cid.toString())
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
      return await tx.done
    })
  }
}

export class HeaderStoreLS extends HeaderStore {
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
  async load(branch: string = 'main'): Promise<DbHeader | null> {
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
