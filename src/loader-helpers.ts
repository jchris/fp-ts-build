import { BlockView, CID } from 'multiformats'
import { Block, encode } from 'multiformats/block'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import * as raw from 'multiformats/codecs/raw'
import * as CBW from '@ipld/car/buffer-writer'
import * as codec from '@ipld/dag-cbor'

import { Transaction } from './transaction-blockstore'
import { AnyBlock, BulkResult } from './types'

export async function makeCarFile(t: Transaction, { head }: BulkResult, cars: string[]): Promise<BlockView<unknown, number, number, 1>> {
  if (!head) throw new Error('no head')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const fpCarHeaderBlock = await encode({ value: { fp: { head, cars: cars.map((car) => CID.parse(car)) } }, hasher, codec }) as AnyBlock
  await t.put(fpCarHeaderBlock.cid, fpCarHeaderBlock.bytes)

  let size = 0
  const headerSize = CBW.headerLength({ roots: [fpCarHeaderBlock.cid as CID<unknown, number, number, 1>] })
  size += headerSize
  for (const { cid, bytes } of t.entries()) {
    size += CBW.blockLength({ cid, bytes } as Block<unknown, number, number, 1>)
  }
  const buffer = new Uint8Array(size)
  const writer = CBW.createWriter(buffer, { headerSize })

  writer.addRoot(fpCarHeaderBlock.cid as CID<unknown, number, number, 1>)

  for (const { cid, bytes } of t.entries()) {
    writer.write({ cid, bytes } as Block<unknown, number, number, 1>)
  }
  writer.close()
  return await encode({ value: writer.bytes, hasher, codec: raw })
}

// const value = { fp: { last: innerBlockstore.lastCid, clock: innerBlockstore.head, cars: this.carLog } }
// const header = await Block.encode({ value, hasher: blockOpts.hasher, codec: blockOpts.codec })

// async readHeaderCar (carCid) {
//   const carMapReader = await this.getCarReader(carCid)
//   // await this.getWriteableCarReader(carCid)
//   // console.log('readHeaderCar', carCid, carMapReader)
//   // now when we load the root cid from the car, we get our new custom root node
//   const bytes = await carMapReader.get(carMapReader.root.cid)
//   const decoded = await Block.decode({ bytes, hasher: blockOpts.hasher, codec: blockOpts.codec })
//   // @ts-ignore
//   const { fp: { cars, clock } } = decoded.value
//   return { cars, clock, reader: carMapReader }
// }
