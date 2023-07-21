/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { Link, Block, BlockView } from 'multiformats'
import { create as createBlock } from 'multiformats/block'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import * as codec from '@ipld/dag-cbor'

import { EventBlock, EventFetcher, EventLink, advance } from '@alanshaw/pail/clock'
import { TransactionBlockstore as Blockstore, Transaction, BlockFetcher } from './transaction-blockstore'
// @ts-ignore
import * as Map from 'prolly-trees/map'
// @ts-ignore
import { ProllyNode as BaseNode } from 'prolly-trees/base'
// @ts-ignore
import { nocache as cache } from 'prolly-trees/cache'
import {
  // CIDCounter,
  bf, simpleCompare as compare
// @ts-ignore
} from 'prolly-trees/utils'

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
const blockOpts = { cache, chunker: bf(30), codec, hasher, compare }

export class CRDT<T> {
  private _blocks: Blockstore
  private _head: EventLink<T>[]

  constructor(blocks: Blockstore, head: EventLink<T>[]) {
    this._blocks = blocks
    this._head = head
  }

  async bulk(updates: DocUpdate[], _options?: object): Promise<ProllyCrdtResult> {
    const prollyRoot = await getProllyRootFromClock(this._blocks, this._head)
    const tblocks = await this._blocks.transaction()
    if (prollyRoot) { // update existing database
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { root, blocks } = await prollyRoot.bulk(updates)
      const { head, event } = await advanceClock(tblocks, this._head, root as ProllyNode, updates)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      return { root, additions: [...blocks, event], head }
    } else { // create and update new database
      const { root, additions } = await createProllyRoot(tblocks, updates)
      const { head, event } = await advanceClock(tblocks, this._head, root, updates)
      this._head = head
      additions.push(event)
      return { root, additions, head }
    }

    // If the head is empty, the database is new.
    if (this._head.length === 0) {
      // Create a new prolly tree
      // Create a clock event for the new root
      // Advance the clock from the head with the new event
    }
    // Otherwise, the database is not new.
    // Find the current root based on the current head
    // Load the prolly tree from the root
    // Apply the event to the prolly tree, getting a new prolly root
    // Create a clock event for the new root
    // Advance the clock from the head with the new event
  }

  // async root(): Promise<any> {
  // async eventsSince(since: EventLink<T>): Promise<{clockCIDs: CIDCounter, result: T[]}> {
  // async getAll(rootCache: any = null): Promise<{root: any, cids: CIDCounter, clockCIDs: CIDCounter, result: T[]}> {
  // async get(key: string, rootCache: any = null): Promise<{result: any, cids: CIDCounter, clockCIDs: CIDCounter, root: any}> {

  async get(key: string) {
    const prollyRoot = await getProllyRootFromClock(this._blocks, this._head)
    if (!prollyRoot) throw new Error('no root')
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return await prollyRoot.get(key)
  }
}

function makeGetBlock(blocks: BlockFetcher) {
  return async (address: Link) => {
    const block = await blocks.get(address)
    if (!block) throw new Error(`Missing block ${address}`)
    const { cid, bytes } = block
    return createBlock({ cid, bytes, hasher, codec })
  }
}

async function advanceClock(blocks: Transaction, head: ClockHead, root: ProllyNode, bulk: DocUpdate[]): Promise<{head: ClockHead, event: BlockView}> {
  if (!root) throw new Error('missing root')
  const data: EventData = {
    root: (await root.address),
    bulk
  }
  const clockEvent = await EventBlock.create(data, head)

  // console.log('persisting clock', clockEvent.cid, clockEvent.bytes.length)
  await blocks.put(clockEvent.cid, clockEvent.bytes) // must be in blockstore before we can advance the clock

  const didAdvance: ClockHead = await advance(blocks, head, clockEvent.cid)
  return { head: didAdvance, event: clockEvent }
}

async function getProllyRootFromClock(blocks: Blockstore, head: ClockHead): Promise<ProllyNode | null> {
  const events = new EventFetcher(blocks)
  if (head.length === 0) {
    return null
  } else if (head.length === 1) {
    const event = await events.get(head[0])
    const eventData = event.value.data as EventData
    // if (!('cid' in eventData.root)) {
    //   console.log('event.value.data.root does not look like a Link:', eventData.root)
    //   throw new Error('event.value.data.root does not look like a Link')
    // }
    const root = eventData.root
    if (root) {
      const loadOptions: ProllyOptions = {
        cid: root,
        get: makeGetBlock(blocks),
        ...blockOpts
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      return (await Map.load(loadOptions) as ProllyNode)
    }
  } else {
    throw new Error(`Multiple heads not implemented yet. head.length = ${head.length}`)
  }
  return null
}

async function createProllyRoot(blocks: Transaction, updates: DocUpdate[]): Promise<ProllyResult> {
  if (!updates.sort) throw new Error('updates must be sortable')
  const loadOptions: ProllyOptions = {
    list: updates,
    get: makeGetBlock(blocks),
    ...blockOpts
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const newBlocks = []
  let root: ProllyNode | null = null
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  for await (const node of (Map.create(loadOptions))) {
    root = node as ProllyNode
    newBlocks.push(await root.block)
  }
  if (!root) throw new Error('failed to create root')
  return { root, additions: newBlocks }
}

type ClockHead = EventLink<any>[];

type ProllyResult = {
  root: ProllyNode
  additions: Block[]
}

export type ProllyCrdtResult = ProllyResult & {
  head: ClockHead
}

// ProllyNode type based on the ProllyNode from 'prolly-trees/base'
export interface ProllyNode extends BaseNode {
  get(key: string): unknown
  bulk(bulk: DocUpdate[]): { root: any; blocks: any } | PromiseLike<{ root: any; blocks: any }>
  address: Promise<Link>
  distance: number;
  compare: (a: any, b: any) => number;
  cache: any;
  block: Promise<Block>
}

export type DocUpdate = {
  key: string;
  value: EventLink<any>;
  del: boolean;
}

interface ProllyOptions {
  cid?: Link
  list?: DocUpdate[]
  get: (cid: any) => Promise<any>
  cache: any
  chunker: (entry: any, distance: number) => boolean
  codec: any
  hasher: any
  compare: (a: any, b: any) => number
}

interface EventData {
  root: Link;
  bulk: DocUpdate[];
}
