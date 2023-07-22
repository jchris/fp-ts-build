// External Imports
import { BlockView, CID, Link } from 'multiformats'
import { Block, encode, create } from 'multiformats/block'
import * as raw from 'multiformats/codecs/raw'
import * as CBW from '@ipld/car/buffer-writer'

import { sha256 as hasher } from 'multiformats/hashes/sha2'
import * as codec from '@ipld/dag-cbor'
import { EventBlock, EventFetcher, advance } from '@alanshaw/pail/clock'

// Local Imports
import { TransactionBlockstore as Blockstore, Transaction } from './transaction-blockstore'
import { DocUpdate, ClockHead, ProllyNode, EventData, ProllyOptions, ProllyResult, BlockFetcher, BulkResult, BulkResult, AnyLink } from './types'

// Ignored Imports
// @ts-ignore
import * as Map from 'prolly-trees/map'
// @ts-ignore
import { bf, simpleCompare as compare } from 'prolly-trees/utils'
// @ts-ignore
import { nocache as cache } from 'prolly-trees/cache'

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
export const blockOpts = { cache, chunker: bf(30), codec, hasher, compare }

export function makeGetBlock(blocks: BlockFetcher) {
  return async (address: Link) => {
    const block = await blocks.get(address)
    if (!block) throw new Error(`Missing block ${address.toString()}`)
    const { cid, bytes } = block
    return create({ cid, bytes, hasher, codec })
  }
}

export async function advanceClock(
  blocks: Transaction,
  head: ClockHead,
  root: ProllyNode,
  bulk: DocUpdate[]
): Promise<{ head: ClockHead; event: BlockView }> {
  // if (!root) throw new Error('missing root')

  const data: EventData = {
    root: root ? await root.address : null,
    bulk
  }

  const clockEvent = await EventBlock.create(data, head)
  await blocks.put(clockEvent.cid, clockEvent.bytes)
  const didAdvance: ClockHead = await advance(blocks, head, clockEvent.cid)

  return { head: didAdvance, event: clockEvent }
}

export async function getProllyRootFromClock(blocks: Blockstore, head: ClockHead): Promise<ProllyNode | null> {
  const events = new EventFetcher(blocks)

  if (head.length === 0) {
    return null
  } else if (head.length === 1) {
    const event = await events.get(head[0])
    const eventData = event.value.data as EventData
    const root = eventData.root

    if (root) {
      const loadOptions: ProllyOptions = {
        cid: root,
        get: makeGetBlock(blocks),
        ...blockOpts
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      return (await Map.load(loadOptions)) as ProllyNode
    }
  } else {
    throw new Error(`Multiple heads not implemented yet. head.length = ${head.length}`)
  }

  return null
}

export async function updateProllyRoot(
  tblocks: Transaction,
  prollyRoot: ProllyNode,
  updates: DocUpdate[]
): Promise<ProllyResult> {
  const { root, blocks } = (await prollyRoot.bulk(updates)) as { root: ProllyNode; blocks: Block[] }

  /* @type {Block} */
  for (const block of blocks) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    await tblocks.put(block.cid as AnyLink, block.bytes as Uint8Array)
  }

  return { root }
}

export async function createProllyRoot(blocks: Transaction, updates: DocUpdate[]): Promise<ProllyResult> {
  // if any update has a del, throw not found
  for (const update of updates) {
    if (update.del) throw new Error('Not found')
  }

  const loadOptions: ProllyOptions = {
    list: updates,
    get: makeGetBlock(blocks),
    ...blockOpts
  }

  let root: ProllyNode | null = null

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  for await (const node of Map.create(loadOptions)) {
    root = node as ProllyNode
    const { cid, bytes } = await root.block
    await blocks.put(cid, bytes)
  }

  if (!root) throw new Error('failed to create root')

  return { root }
}

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
