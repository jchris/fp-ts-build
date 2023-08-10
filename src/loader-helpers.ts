import { BlockView, CID } from 'multiformats'
import { Block, encode, decode } from 'multiformats/block'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import * as raw from 'multiformats/codecs/raw'
import * as CBW from '@ipld/car/buffer-writer'
import * as codec from '@ipld/dag-cbor'
import { CarReader } from '@ipld/car'

import { Transaction } from './transaction'
import { AnyBlock, BulkResult, AnyLink, IndexerResult, DbCarHeader, IdxCarHeader } from './types'

export async function makeDbCarFile(
  t: Transaction,
  result: BulkResult,
  cars: AnyLink[],
  compact: boolean = false
): Promise<BlockView<unknown, number, number, 1>> {
  const head = result.head
  if (!head) throw new Error('no head')

  const fp = compact ? { head, cars: [], compact: cars } : { head, cars, compact: [] } as DbCarHeader

  return await innerMakeCarFile(fp, t)
}

async function innerMakeCarFile(fp: DbCarHeader|IdxCarHeader, t: Transaction) {
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

export async function makeIdxCarFile(
  t: Transaction,
  { indexes }: IndexerResult,
  cars: AnyLink[],
  compact: boolean = false
): Promise<BlockView<unknown, number, number, 1>> {
  const fp = compact ? { indexes, cars: [], compact: cars } : { indexes, cars, compact: [] } as IdxCarHeader

  return await innerMakeCarFile(fp, t)
}

export async function parseDbCarFile(reader: CarReader): Promise<DbCarHeader> {
  return await readerValue(reader) as DbCarHeader
}

export async function parseIdxCarFile(reader: CarReader): Promise<IdxCarHeader> {
  return await readerValue(reader) as IdxCarHeader
}

async function readerValue(reader: CarReader): Promise<DbCarHeader | IdxCarHeader> {
  const roots = await reader.getRoots()
  const header = await reader.get(roots[0])
  if (!header) throw new Error('missing header block')
  const { value } = await decode({ bytes: header.bytes, hasher, codec })
  const { fp } = value as { fp: DbCarHeader | IdxCarHeader }
  return fp
}

// export function isIndexerResult(result: BulkResult | IndexerResult): result is IndexerResult {
//   return !!(result as IndexerResult).indexes
// }

// export function isIndexHeader(result: DbCarHeader | IdxCarHeader): result is IdxCarHeader {
//   return !!(result as IdxCarHeader).indexes
// }

// export function isIndexerMeta(result: BulkResult | IdxMeta): result is IdxMeta {
//   return !!(result as IdxMeta).name
// }
