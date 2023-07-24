import { openDB, IDBPDatabase } from 'idb'

import { AnyBlock, AnyLink } from './types'
import { HeaderStore, StoredHeader } from './store'

export const FORMAT = '0.9'

export class CarStoreIDB {
  keyId: string = 'public'
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  idb: IDBPDatabase<unknown> | null = null
  name: string = 'default'
  async withDB(dbWorkFun: (arg0: any) => any) {
    if (!this.idb) {
      const dbName = `fp.${FORMAT}.${this.keyId}.${this.name}.valet`
      const options = {
        upgrade(db: IDBDatabase) {
          db.createObjectStore('cars')
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      this.idb = await openDB(dbName, 0, options)
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await dbWorkFun(this.idb)
  }

  async load(cid: AnyLink): Promise<AnyBlock> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.withDB(async (db: IDBPDatabase<unknown>) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      const tx = db.transaction(['cars'], 'readonly')
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      const bytes = (await tx.objectStore('cars').get(cid.toString())) as Uint8Array
      if (!bytes) throw new Error(`missing block ${cid.toString()}`)
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

  headerKey(branch: string) {
    return `fp.${FORMAT}.${this.keyId}.${this.name}.${branch}`
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async load(branch: string = 'main'): Promise<StoredHeader | null> {
    // try {
    const bytes = localStorage.getItem(this.headerKey(branch))
    return bytes ? this.parseHeader(bytes.toString()) : null
    // } catch (e) {}
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async save(carCid: AnyLink, branch: string = 'main') {
    // try {
    const headerKey = this.headerKey(branch)
    return localStorage.setItem(headerKey, this.makeHeader(carCid))
    // } catch (e) {}
  }
}
