import { BlockView, CID } from 'multiformats'
import { Block, encode, decode } from 'multiformats/block'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import * as raw from 'multiformats/codecs/raw'
import * as CBW from '@ipld/car/buffer-writer'
import * as codec from '@ipld/dag-cbor'
import { CarReader } from '@ipld/car'

import { Transaction } from './transaction'
import { AnyBlock, BulkResult, ClockHead, AnyLink } from './types'

export async function makeCarFile(
  t: Transaction,
  { head }: BulkResult,
  cars: string[]
): Promise<BlockView<unknown, number, number, 1>> {
  if (!head) throw new Error('no head')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const fpCarHeaderBlock = (await encode({
    value: { fp: { head, cars: cars.map(car => CID.parse(car)) } },
    hasher,
    codec
  })) as AnyBlock
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

export async function parseCarFile(reader: CarReader): Promise<{ head: ClockHead; cars: AnyLink[] }> {
  const roots = await reader.getRoots()
  const header = await reader.get(roots[0])
  if (!header) throw new Error('missing header block')
  const got = await decode({ bytes: header.bytes, hasher, codec })
  const {
    fp: { head, cars }
  } = got.value as { fp: { head: ClockHead; cars: AnyLink[] } }
  return { head, cars }
}
