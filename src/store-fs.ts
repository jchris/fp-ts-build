import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises'

import { AnyBlock, AnyLink } from './types'
import { HeaderStore, CarStore, StoredHeader } from './store'

export const FORMAT = '0.9'

const encoder = new TextEncoder()

export const defaultConfig = {
  dataDir: join(homedir(), '.fireproof', 'v' + FORMAT)
}

export class HeaderStoreFS extends HeaderStore {
  async load(branch?: string): Promise<StoredHeader|null> {
    branch = branch || 'main'
    const filepath = join(defaultConfig.dataDir, this.name, branch + '.json')
    const bytes = await readFile(filepath).catch((e: Error & { code: string}) => {
      if (e.code === 'ENOENT') return null
      throw e
    })
    return bytes ? this.parseHeader(bytes.toString()) : null
  }

  async save(carCid: AnyLink, branch?: string) {
    branch = branch || 'main'
    const filepath = join(defaultConfig.dataDir, this.name, branch + '.json')
    const bytes = this.makeHeader(carCid)
    await writePathFile(filepath, encoder.encode(bytes))
  }
}

export class CarStoreFS extends CarStore {
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
