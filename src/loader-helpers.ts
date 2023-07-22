import { BlockView, CID } from 'multiformats'
import { Block, encode } from 'multiformats/block'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import * as raw from 'multiformats/codecs/raw'
import * as CBW from '@ipld/car/buffer-writer'

import { Transaction } from './transaction-blockstore'
import { BulkResult } from './types'

export async function makeCarFile(t: Transaction, { head }: BulkResult): Promise<BlockView<unknown, number, number, 1>> {
  if (!head) throw new Error('no head')
  const roots = head.map(link => link as CID<unknown, number, number, 1>)
  let size = 0
  const headerSize = CBW.headerLength({ roots })
  size += headerSize
  for (const { cid, bytes } of t.entries()) {
    size += CBW.blockLength({ cid, bytes } as Block<unknown, number, number, 1>)
  }
  const buffer = new Uint8Array(size)
  const writer = CBW.createWriter(buffer, { headerSize })

  for (const cid of roots) {
    writer.addRoot(cid)
  }

  for (const { cid, bytes } of t.entries()) {
    writer.write({ cid, bytes } as Block<unknown, number, number, 1>)
  }
  writer.close()
  return await encode({ value: writer.bytes, hasher, codec: raw })
}
