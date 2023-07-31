import { Link } from 'multiformats'
import { create, encode, decode } from 'multiformats/block'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import * as codec from '@ipld/dag-cbor'
import { put, get, entries, EventData } from '@alanshaw/pail/crdt'
import { EventFetcher } from '@alanshaw/pail/clock'
import { TransactionBlockstore as Blockstore, Transaction } from './transaction'
import { DocUpdate, ClockHead, BlockFetcher, AnyLink, DocValue, BulkResult } from './types'

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
): Promise<BulkResult> {
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
  if (!link) throw new Error(`Missing key ${key}`)
  return await getValueFromLink(blocks, link)
}

export async function getValueFromLink(blocks: Blockstore, link: AnyLink): Promise<DocValue> {
  const block = await blocks.get(link)
  if (!block) throw new Error(`Missing block ${link.toString()}`)
  const { value } = (await decode({ bytes: block.bytes, hasher, codec })) as { value: DocValue }
  return value
}

export async function clockChangesSince(
  blocks: Blockstore,
  head: ClockHead,
  since: ClockHead
): Promise<{ result: DocUpdate[], head: ClockHead }> {
  const eventsFetcher = new EventFetcher<EventData>(blocks)
  const keys: Set<string> = new Set()
  const updates = await gatherUpdates(blocks, eventsFetcher, head, since, [], keys)
  return { result: updates.reverse(), head }
}

async function gatherUpdates(
  blocks: Blockstore,
  eventsFetcher: EventFetcher<EventData>,
  head: ClockHead,
  since: ClockHead,
  updates: DocUpdate[] = [],
  keys: Set<string>
): Promise<DocUpdate[]> {
  for (const link of since) {
    if (head.includes(link)) {
      throw new Error('found since in head, this is good, remove this error ' + updates.length)
      return updates
    }
  }
  for (const link of head) {
    const { value: event } = await eventsFetcher.get(link)
    const { key, value } = event.data
    if (keys.has(key)) continue
    keys.add(key)
    const docValue = await getValueFromLink(blocks, value)
    updates.push({ key, value: docValue.doc, del: docValue.del })
    if (event.parents) {
      updates = await gatherUpdates(blocks, eventsFetcher, event.parents, since, updates, keys)
    }
  }
  return updates
}

export async function doCompact(blocks: Blockstore, head: ClockHead) {
  const blockLog = new LoggingFetcher(blocks)
  const newBlocks = new Transaction(blocks)

  for await (const [, link] of entries(blockLog, head)) {
    const bl = await blocks.get(link)
    if (!bl) throw new Error('Missing block: ' + link.toString())
    await newBlocks.put(link, bl.bytes)
  }

  for (const cid of blockLog.cids) {
    const bl = await blocks.get(cid)
    if (!bl) throw new Error('Missing block: ' + cid.toString())
    await newBlocks.put(cid, bl.bytes)
  }

  await blocks.compact(newBlocks, head)
}

class LoggingFetcher implements BlockFetcher {
  blocks: BlockFetcher
  cids: Set<AnyLink> = new Set()
  constructor(blocks: BlockFetcher) {
    this.blocks = blocks
  }

  async get(cid: AnyLink) {
    this.cids.add(cid)
    return await this.blocks.get(cid)
  }
}
