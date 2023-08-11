import { join, dirname } from 'path'
import { homedir } from 'os'
import { mkdir, readFile, writeFile, unlink } from 'fs/promises'

import { AnyBlock, AnyLink, IndexCars, DbMeta } from './types'
import { HeaderStore as HeaderStoreBase, CarStore as CarStoreBase } from './store'

export const FORMAT = '0.9'

export const defaultConfig = {
  dataDir: join(homedir(), '.fireproof', 'v' + FORMAT)
}

export class HeaderStore extends HeaderStoreBase {
  tag: string = 'header-node-fs'
  keyId: string = 'public'

  async load(branch: string = 'main'): Promise<DbMeta|null> {
    const filepath = join(defaultConfig.dataDir, this.name, branch + '.json')
    const bytes = await readFile(filepath).catch((e: Error & { code: string}) => {
      if (e.code === 'ENOENT') return null
      throw e
    })
    return bytes ? this.parseHeader(bytes) : null
  }

  async save(carCid: AnyLink, indexes: IndexCars, branch: string = 'main'): Promise<void> {
    const filepath = join(defaultConfig.dataDir, this.name, branch + '.json')
    const bytes = this.makeHeader(carCid, indexes) as Uint8Array
    await writePathFile(filepath, bytes)
  }
}

export class CarStore extends CarStoreBase {
  tag: string = 'car-node-fs'

  async save(car: AnyBlock): Promise<void> {
    const filepath = join(defaultConfig.dataDir, this.name, car.cid.toString() + '.car')
    await writePathFile(filepath, car.bytes)
  }

  async load(cid: AnyLink): Promise<AnyBlock> {
    const filepath = join(defaultConfig.dataDir, this.name, cid.toString() + '.car')
    const bytes = await readFile(filepath)
    return { cid, bytes: new Uint8Array(bytes) }
  }

  async remove(cid: AnyLink) {
    const filepath = join(defaultConfig.dataDir, this.name, cid.toString() + '.car')
    await unlink(filepath)
  }
}

async function writePathFile(path: string, data: Uint8Array) {
  await mkdir(dirname(path), { recursive: true })
  return await writeFile(path, data)
}
