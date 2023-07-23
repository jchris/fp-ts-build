import { Link } from 'multiformats'
import { create, encode, decode } from 'multiformats/block'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import * as codec from '@ipld/dag-cbor'
import { put, get } from '@alanshaw/pail/crdt'

import { TransactionBlockstore as Blockstore, Transaction } from './transaction-blockstore'
import { DocUpdate, ClockHead, BlockFetcher, AnyLink, DocValue } from './types'

export function makeGetBlock(blocks: BlockFetcher) {
  return async (address: Link) => {
    const block = await blocks.get(address)
    if (!block) throw new Error(`Missing block ${address.toString()}`)
    const { cid, bytes } = block
    return create({ cid, bytes, hasher, codec })
  }
}

export async function applyBulkUpdateToCrdt(
  tblocks: Transaction,
  head: ClockHead,
  updates: DocUpdate[],
  options?: object
): Promise<{ head: ClockHead }> {
  for (const update of updates) {
    const link = await makeLinkForDoc(tblocks, update)
    const result = await put(tblocks, head, update.key, link, options)
    for (const { cid, bytes } of [...result.additions, ...result.removals, result.event]) {
      tblocks.putSync(cid, bytes)
    }
    head = result.head
  }
  return { head }
}

async function makeLinkForDoc(blocks: Transaction, update: DocUpdate): Promise<AnyLink> {
  let value: DocValue
  if (update.del) {
    value = { del: true }
  } else {
    value = { doc: update.value }
  }
  const block = await encode({ value, hasher, codec })
  blocks.putSync(block.cid, block.bytes)
  return block.cid
}

export async function getValueFromCrdt(blocks: Blockstore, head: ClockHead, key: string): Promise<DocValue> {
  const link = await get(blocks, head, key)
  if (!link) throw new Error(`Not found: ${key}`)
  const block = await blocks.get(link)
  if (!block) throw new Error(`Missing block ${link.toString()}`)
  const { value } = (await decode({ bytes: block.bytes, hasher, codec })) as { value: DocValue }
  return value
}

export async function clockChangesSince(
  _blocks: Blockstore,
  _head: ClockHead,
  _since: ClockHead
): Promise<{ result: DocUpdate[] }> {
  await Promise.resolve()
  throw new Error('unimplemented')
}
