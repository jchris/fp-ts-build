/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { Link } from 'multiformats'
import { create as createBlock } from 'multiformats/block'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import * as codec from '@ipld/dag-cbor'

import { EventLink } from '@alanshaw/pail/clock'
import { TransactionBlockstore as Blockstore } from './transaction-blockstore'
import { BlockFetcher, DocUpdate, BulkResult, CIDCounter } from './types'
// @ts-ignore
// @ts-ignore
// @ts-ignore
import { nocache as cache } from 'prolly-trees/cache'
import {
  CIDCounter,
  bf,
  simpleCompare as compare
  // @ts-ignore
} from 'prolly-trees/utils'
import { getProllyRootFromClock, updateProllyRoot, createProllyRoot, advanceClock } from './getProllyRootFromClock'

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
export const blockOpts = { cache, chunker: bf(30), codec, hasher, compare }

export class CRDT<T> {
  private _blocks: Blockstore
  private _head: EventLink<T>[]

  constructor(blocks: Blockstore, head: EventLink<T>[]) {
    this._blocks = blocks
    this._head = head
  }

  async bulk(updates: DocUpdate[], _options?: object): Promise<BulkResult> {
    const prollyRoot = await getProllyRootFromClock(this._blocks, this._head)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const tResult: BulkResult = await this._blocks.transaction(async tblocks => {
      const { root } = prollyRoot ? await updateProllyRoot(tblocks, prollyRoot, updates) : await createProllyRoot(tblocks, updates)
      const { head } = await advanceClock(tblocks, this._head, root, updates)
      this._head = head
      return { root, head }
    })
    return tResult
  }

  // async root(): Promise<any> {
  // async eventsSince(since: EventLink<T>): Promise<{clockCIDs: CIDCounter, result: T[]}> {
  // async getAll(rootCache: any = null): Promise<{root: any, cids: CIDCounter, clockCIDs: CIDCounter, result: T[]}> {
  // async get(key: string, rootCache: any = null): Promise<{result: any, cids: CIDCounter, clockCIDs: CIDCounter, root: any}> {

  async get(key: string) {
    const prollyRoot = await getProllyRootFromClock(this._blocks, this._head)
    if (!prollyRoot) throw new Error('no root')
    const { result, cids } = await prollyRoot.get(key) as { result: DocUpdate, cids: CIDCounter }
    return { result, cids }
  }
}

export function makeGetBlock(blocks: BlockFetcher) {
  return async (address: Link) => {
    const block = await blocks.get(address)
    if (!block) throw new Error(`Missing block ${address}`)
    const { cid, bytes } = block
    return createBlock({ cid, bytes, hasher, codec })
  }
}
