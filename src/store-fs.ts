import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

import { parse } from 'multiformats/link'

import { AnyBlock, AnyLink } from './types'

import { FORMAT } from './database'
import { HeaderStore, CarStore } from './store'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const defaultConfig = {
  dataDir: join(homedir(), '.fireproof', 'v' + FORMAT)
}

export class StoredHeader {
  car: AnyLink
  constructor(jsonHeader: { cid: string}) {
    this.car = parse(jsonHeader.cid)
  }
}

export class HeaderStoreFS extends HeaderStore {
  async get(branch?: string) {
    branch = branch || 'main'
    const filepath = join(defaultConfig.dataDir, this.name, branch + '.json')
    const bytes = await readFile(filepath)
    const jsonHeader = JSON.parse(decoder.decode(bytes)) as { cid: string}
    const header = new StoredHeader(jsonHeader)
    return header
  }

  async save(carCid: AnyLink, branch?: string) {
    const filepath = join(defaultConfig.dataDir, this.name, branch + '.json')
    const bytes = this.makeHeader(carCid)
    await writePathFile(filepath, encoder.encode(bytes))
  }
}

export class CarStoreFS extends CarStore {
  async save(car: AnyBlock) {
    const filepath = join(defaultConfig.dataDir, this.name, car.cid.toString() + '.car')
    await writePathFile(filepath, car.bytes)
  }

  async load(cid: AnyLink) {
    const filepath = join(defaultConfig.dataDir, this.name, cid.toString() + '.car')
    const bytes = await readFile(filepath)
    return { cid, bytes: new Uint8Array(bytes) }
  }
}

async function writePathFile(path: string, data: Uint8Array) {
  await mkdir(dirname(path), { recursive: true })
  return await writeFile(path, data)
}
