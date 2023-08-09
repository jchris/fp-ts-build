import { BlockView, CID } from 'multiformats'
import { Block, encode, decode } from 'multiformats/block'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import * as raw from 'multiformats/codecs/raw'
import * as CBW from '@ipld/car/buffer-writer'
import * as codec from '@ipld/dag-cbor'
import { CarReader } from '@ipld/car'

import { Transaction } from './transaction'
import { AnyBlock, BulkResult, AnyLink, IndexerResult, DbCarHeader, IdxCarHeader, IdxMeta } from './types'

export async function makeCarFile(
  t: Transaction,
  result: BulkResult | IndexerResult,
  cars: AnyLink[],
  compact: boolean = false
): Promise<BlockView<unknown, number, number, 1>> {
  const head = result.head
  if (!head) throw new Error('no head -- ok for idx')

  let fp
  if (compact) {
    fp = { head, cars: [], compact: cars }
  } else {
    fp = { head, cars, compact: [] }
  }

  if (isIndexerResult(result)) {
    fp = { ...fp, indexes: result.indexes } as IdxCarHeader
  } else {
    fp = { ...fp } as DbCarHeader
  }

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
  const got = await decode({ bytes: header.bytes, hasher, codec })

  const { fp } = got.value as { fp: BulkResult | IndexerResult }

  if (isIndexHeader(fp)) {
    const { cars, compact, indexes } = fp
    return { cars, compact, indexes } as IdxCarHeader
  } else {
    const { head, cars, compact } = fp as DbCarHeader
    return { head, cars, compact }
  }
}

export function isIndexerResult(result: BulkResult | IndexerResult): result is IndexerResult {
  return !!(result as IndexerResult).indexes
}

export function isIndexHeader(result: DbCarHeader | IdxCarHeader): result is IdxCarHeader {
  return !!(result as IdxCarHeader).indexes
}

export function isIndexerMeta(result: BulkResult | IdxMeta): result is IdxMeta {
  return !!(result as IdxMeta).name
}
