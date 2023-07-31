/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { TransactionBlockstore as Blockstore } from './transaction-blockstore'
import {
  DocUpdate,
  BulkResult,
  CIDCounter,
  ClockHead,
  DocUpdate,
  ClockHead,
  ProllyNode,
  EventData,
  ProllyOptions,
  ProllyResult,
  BlockFetcher,
  AnyBlock
} from './types'

// External Imports
import { BlockView, Link } from 'm
ultiformats'
import { create } from 'multiformats/block'

import { sha256 as hasher } from 'multiformats/hashes/sha2'
import * as codec from '@ipld/dag-cbor'
import { EventBlock, EventFetcher, advance } from '@alanshaw/pail/clock'

// Local Imports
import { TransactionBlockstore as Blockstore, Transaction } from './transaction-blockstore'

// Ignored Imports
// @ts-ignore
import * as Map from 'prolly-trees/map'
// @ts-ignore
import { bf, simpleCompare as compare } from 'prolly-trees/utils'
// @ts-ignore
import { nocache as cache } from 'prolly-trees/cache'
// import { StoredHeader } from './store'

export class Indexder {
  name: string | null
  ready: Promise<void>

  private indexBlocks: Blockstore
  private dbHead: ClockHead

  constructor() {

  }

  async bulk(updates: DocUpdate[], _options?: object): Promise<BulkResult> {
    await this.ready
    const prollyRoot = await getProllyRootFromClock(this._blocks, this._head)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const tResult: BulkResult = await this._blocks.transaction(async tblocks => {
      const { root } = prollyRoot
        ? await updateProllyRoot(tblocks, prollyRoot, updates)
        : await createProllyRoot(tblocks, updates)
      const { head } = await advanceClock(tblocks, this._head, root, updates)
      this._head = head // we want multi head support here if allowing calls to bulk in parallel
      return { root, head }
    })
    return tResult
  }

  // async root(): Promise<any> {
  // async eventsSince(since: EventLink<T>): Promise<{clockCIDs: CIDCounter, result: T[]}> {
  // async getAll(rootCache: any = null): Promise<{root: any, cids: CIDCounter, clockCIDs: CIDCounter, result: T[]}> {

  async get(key: string) {
    await this.ready
    const prollyRoot = await getProllyRootFromClock(this._blocks, this._head)
    if (!prollyRoot) throw new Error('no root')
    const { result, cids } = (await prollyRoot.get(key)) as { result: DocUpdate; cids: CIDCounter }
    return { result, cids }
  }

  async changes(since: ClockHead) {
    return await clockChangesSince(this._blocks, this._head, since)
  }
}

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
    if (!eventData) throw new Error(`missing eventData ${head[0].toString()}`)
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
  blocks: Transaction,
  prollyRoot: ProllyNode,
  updates: DocUpdate[]
): Promise<ProllyResult> {
  const { root, blocks: bulkBlocks } = (await prollyRoot.bulk(updates)) as { root: ProllyNode; blocks: AnyBlock[] }

  /* @type {Block} */
  for (const block of bulkBlocks) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    await blocks.put(block.cid, block.bytes)
  }

  return { root }
}

export async function createProllyRoot(blocks: Transaction, updates: DocUpdate[]): Promise<ProllyResult> {
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

export async function clockChangesSince(
  blocks: Blockstore,
  head: ClockHead,
  since: ClockHead
): Promise<{ result: DocUpdate[] }> {}
