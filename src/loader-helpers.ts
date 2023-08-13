import { CID } from 'multiformats'
import { Block, encode, decode } from 'multiformats/block'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import * as raw from 'multiformats/codecs/raw'
import * as CBW from '@ipld/car/buffer-writer'
import * as codec from '@ipld/dag-cbor'
import { CarReader } from '@ipld/car'

import { Transaction } from './transaction'
import { AnyBlock, DbCarHeader, IdxCarHeader } from './types'

export async function innerMakeCarFile(fp: DbCarHeader|IdxCarHeader, t: Transaction) {
  const fpCarHeaderBlock = (await encode({
    value: { fp },
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

export async function parseCarFile(reader: CarReader): Promise<DbCarHeader | IdxCarHeader> {
  const roots = await reader.getRoots()
  const header = await reader.get(roots[0])
  if (!header) throw new Error('missing header block')
  const { value } = await decode({ bytes: header.bytes, hasher, codec })
  const { fp } = value as { fp: DbCarHeader | IdxCarHeader }
  return fp
}
