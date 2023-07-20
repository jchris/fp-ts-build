/* eslint-disable @typescript-eslint/no-unused-vars */
import { EventFetcher, EventLink } from '@alanshaw/pail/clock'
import { MemoryBlockstore as Blockstore } from '@alanshaw/pail/block'
// @ts-ignore
import { create, load } from 'prolly-trees/map'
// @ts-ignore
import { nocache as cache } from 'prolly-trees/cache'
// @ts-ignore
import { CIDCounter, bf, simpleCompare as compare } from 'prolly-trees/utils'
import * as codec from '@ipld/dag-cbor'
import { sha256 as hasher } from 'multiformats/hashes/sha2'

const blockOpts = { cache, chunker: bf(30), codec, hasher, compare }

export class Prolly<T> {
  private _blocks: Blockstore
  private _head: EventLink<T>[]

  constructor(blocks: Blockstore, head: EventLink<T>[]) {
    this._blocks = blocks
    this._head = head
  }

  async put(event: {key: string, value: EventLink<T>}, options?: object): Promise<any> {
    // If the head is not empty, get the prolly root from the clock

    const prollyRoot = await getProllyRootFromClock(this._head, this._blocks)

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

async function getProllyRootFromClock(head: EventLink<any>[], blocks: Blockstore) {
  const events = new EventFetcher(blocks)
  if (head.length === 0) {
    return null
  } else if (head.length === 1) {
    const event = await events.get(head[0])
    const { root } = event.value.data
    if (root) {
      return load({ cid: root, get: blocks.get.bind(head), ...blockOpts })
    }
  } else {
    throw new Error('Multiple heads not implemented yet')
  }
}
