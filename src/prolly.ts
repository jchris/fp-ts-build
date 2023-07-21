import { Link, Block, BlockView } from 'multiformats'
import { EventBlock, EventFetcher, EventLink, advance } from '@alanshaw/pail/clock'
import { MemoryBlockstore as Blockstore } from '@alanshaw/pail/block'
// @ts-ignore
import { create, load } from 'prolly-trees/map'
// @ts-ignore
import { Node as BaseNode } from 'prolly-trees/base'
// @ts-ignore
import { nocache as cache } from 'prolly-trees/cache'
import {
  // CIDCounter,
  bf, simpleCompare as compare
// @ts-ignore
} from 'prolly-trees/utils'
import * as codec from '@ipld/dag-cbor'
import { sha256 as hasher } from 'multiformats/hashes/sha2'

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
const blockOpts = { cache, chunker: bf(30), codec, hasher, compare }

export class Prolly<T> {
  private _blocks: Blockstore
  private _head: EventLink<T>[]

  constructor(blocks: Blockstore, head: EventLink<T>[]) {
    this._blocks = blocks
    this._head = head
  }

  async put(event: ProllyEvent, _options?: object): Promise<ProllyCrdtResult> {
    // If the head is not empty, get the prolly root from the clock

    const prollyRoot = await getProllyRootFromClock(this._blocks, this._head)

    if (prollyRoot) {
      // we hve an existing database we can add to
      // do the update

    } else {
      // we have a new database
      const { root, additions } = await createProllyRoot(this._blocks, event)
      // add the new root to the clock
      const newHead = await advanceClock(this._blocks, this._head, root, event)
      this._head = newHead.head
      return { root, additions, head: newHead }
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
    const result = await prollyRoot.get(key)
    return result
  }
}

async function advanceClock(blocks: Blockstore, head: ClockHead, root: Node, event: ProllyEvent): Promise<{head: ClockHead, event: BlockView}> {
  const data: EventData = {
    root: (await root.address),
    key: event.key,
    type: event.del ? 'del' : 'put',
    value: event.del ? null : event.value
  }

  const clockEvent = await EventBlock.create(data, head)

  await blocks.put(clockEvent.cid, clockEvent.bytes) // hmm

  const didAdvance: ClockHead = await advance(blocks, head, clockEvent.cid)
  return { head: didAdvance, event: clockEvent }
}

async function getProllyRootFromClock(blocks: Blockstore, head: ClockHead): Promise<Node | null> {
  const events = new EventFetcher(blocks)
  if (head.length === 0) {
    return null
  } else if (head.length === 1) {
    const event = await events.get(head[0])
    const eventData = event.value.data as EventData
    if (!('cid' in eventData.root)) {
      console.log('event.value.data.root does not look like a Link:', eventData.root)
      throw new Error('event.value.data.root does not look like a Link')
    }
    const root = eventData.root
    if (root) {
      const loadOptions: ProllyOptions = {
        cid: root,
        get: blocks.get.bind(blocks),
        ...blockOpts
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      return (await load(loadOptions) as Node)
    }
  } else {
    console.log(`Multiple heads: ${head}`, head)
    throw new Error('Multiple heads not implemented yet')
  }
  return null
}

async function createProllyRoot(blocks: Blockstore, event: ProllyEvent): Promise<ProllyResult> {
  const loadOptions: ProllyOptions = {
    list: [event],
    get: blocks.get.bind(blocks), // add a cid set for reads?
    ...blockOpts
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const newBlocks = []
  let root: Node | null = null
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  for await (const node of (create(loadOptions))) {
    root = node as Node
    newBlocks.push(await root.block)
  }
  if (!root) throw new Error('failed to create root')
  return { root, additions: newBlocks }
}

type ClockHead = EventLink<any>[];

type ProllyResult = {
  root: Node
  additions: Block[]
}

export type ProllyCrdtResult = ProllyResult & {
  head: ClockHead
}

// Node type based on the Node from 'prolly-trees/base'
export interface Node extends BaseNode {
  address: Promise<Link>
  entryList: EntryList;
  chunker: (entry: Entry, distance: number) => boolean;
  distance: number;
  getNode: (address: any) => Promise<Node>;
  compare: (a: any, b: any) => number;
  cache: any;
  block: Promise<Block>
}

export type Entry = {
  key: any;
  address: any;
};

export type EntryList = {
  entries: Entry[];
  closed: boolean;
};

export type ProllyEvent = {
  key: string;
  value: EventLink<any>;
  del: boolean;
}

interface ProllyOptions {
  cid?: Link
  list?: ProllyEvent[]
  get: (cid: any) => Promise<any>
  cache: any
  chunker: (entry: any, distance: number) => boolean
  codec: any
  hasher: any
  compare: (a: any, b: any) => number
}

interface EventData {
  root: Link;
  key: string;
  value: any;
  type: 'del' | 'put';
}
