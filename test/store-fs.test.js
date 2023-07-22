/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable mocha/max-top-level-suites */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { equals } from './helpers.js'

import { CarStoreFS, defaultConfig } from '../dist/store-fs.esm.js'

const decoder = new TextDecoder('utf-8')

describe('CarStoreFS', function () {
  /** @type {CarStoreFS} */
  let loader
  beforeEach(function () {
    loader = new CarStoreFS('test')
  })
  it('should have a name', function () {
    equals(loader.name, 'test')
  })
  it('should save a car', async function () {
    const car = {
      cid: 'cid',
      bytes: new Uint8Array([55, 56, 57])
    }
    await loader.save(car)
    const path = join(defaultConfig.dataDir, loader.name, car.cid + '.car')
    const data = await readFile(path)
    equals(data.toString(), decoder.decode(car.bytes))
  })
})

describe('CarStoreFS with a saved car', function () {
  /** @type {CarStoreFS} */
  let loader, car
  beforeEach(async function () {
    loader = new CarStoreFS('test2')
    car = {
      cid: 'cid',
      bytes: new Uint8Array([55, 56, 57, 80])
    }
    await loader.save(car)
  })
  it('should have a car', async function () {
    const path = join(defaultConfig.dataDir, loader.name, car.cid + '.car')
    const data = await readFile(path)
    equals(data.toString(), decoder.decode(car.bytes))
  })
  it('should load a car', async function () {
    const loaded = await loader.load(car.cid)
    equals(loaded.cid, car.cid)
    equals(loaded.bytes.constructor.name, 'Uint8Array')
    equals(loaded.bytes.toString(), car.bytes.toString())
  })
})
