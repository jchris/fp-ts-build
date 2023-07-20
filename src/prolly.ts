import { Link, Block } from 'multiformats'
import { EventFetcher, EventLink } from '@alanshaw/pail/clock'
import { MemoryBlockstore as Blockstore } from '@alanshaw/pail/block'
// @ts-ignore
import { create, load } from 'prolly-trees/map'
// @ts-ignore
import { Node as BaseNode } from 'prolly-trees/base'
// @ts-ignore
import { nocache as cache } from 'prolly-trees/cache'
// @ts-ignore
import { CIDCounter, bf, simpleCompare as compare } from 'prolly-trees/utils'
import * as codec from '@ipld/dag-cbor'
import { sha256 as hasher } from 'multiformats/hashes/sha2'

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
const blockOpts = { cache, chunker: bf(30), codec, hasher, compare }

// Node type based on the Node from 'prolly-trees/base'
export interface Node extends BaseNode {
  entryList: EntryList;
  chunker: (entry: Entry, distance: number) => boolean;
  distance: number;
  getNode: (address: any) => Promise<Node>;
  compare: (a: any, b: any) => number;
  cache: any;
  block: Block
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
}

export class Prolly<T> {
  private _blocks: Blockstore
  private _head: EventLink<T>[]

  constructor(blocks: Blockstore, head: EventLink<T>[]) {
    this._blocks = blocks
    this._head = head
  }

  async put(event: ProllyEvent, options?: object): Promise<any> {
    // If the head is not empty, get the prolly root from the clock

    const prollyRoot = await getProllyRootFromClock(this._blocks, this._head)

    if (prollyRoot) {
      // we hve an existing database we can add to
    } else {
      const newProllyRoot = await createProllyRoot(this._blocks, event)
      return 'ok'
      // we have a new database
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

async function getProllyRootFromClock(blocks: Blockstore, head: EventLink<any>[]): Promise<Node | null> {
  const events = new EventFetcher(blocks)
  if (head.length === 0) {
    return null
  } else if (head.length === 1) {
    const event = await events.get(head[0])
    const eventData = event.value.data as EventData
    if (!('cid' in eventData.root)) {
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
    throw new Error('Multiple heads not implemented yet')
  }
  return null
}

async function createProllyRoot(blocks: Blockstore, event: ProllyEvent): Promise<Node> {
  console.log('new event', event)

  const loadOptions: ProllyOptions = {
    list: [event],
    get: blocks.get.bind(blocks),
    ...blockOpts
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const newBlocks = []
  let root: Node
  for await (const node of (create(loadOptions))) {
    root = node as Node
    newBlocks.push(await root.block)
  }

  return { root, blocks: newBlocks }
}
