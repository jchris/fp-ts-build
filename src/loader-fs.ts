import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

import { Block, CID } from 'multiformats'

import { FORMAT } from './database'
import { CarLoader } from './loader'

export const defaultConfig = {
  dataDir: join(homedir(), '.fireproof', 'v' + FORMAT)
}

export class CarLoaderFS extends CarLoader {
  async save(car: Block) {
    const filepath = join(defaultConfig.dataDir, this.name, car.cid.toString() + '.car')
    await writePathFile(filepath, car.bytes)
  }

  async load(cid: CID) {
    const filepath = join(defaultConfig.dataDir, this.name, cid.toString() + '.car')
    const bytes = await readFile(filepath)
    return { cid, bytes: new Uint8Array(bytes) }
  }
}

async function writePathFile(path: string, data: Uint8Array) {
  await mkdir(dirname(path), { recursive: true })
  return await writeFile(path, data)
}
