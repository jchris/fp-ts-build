import { BlockView, Link, Block } from 'multiformats'
import { create, encode, decode } from 'multiformats/block'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import * as codec from '@ipld/dag-cbor'

// @ts-ignore
import charwise from 'charwise'
// @ts-ignore
import * as Map from 'prolly-trees/map'
// @ts-ignore
import { bf, simpleCompare } from 'prolly-trees/utils'
// @ts-ignore
import { nocache as cache } from 'prolly-trees/cache'

import { ClockHead, DocUpdate, MapFn, DocFragment, IndexTree, BulkResult, StaticProllyOptions, BlockFetcher, ProllyNode, IndexUpdate } from './types'
import { CRDT } from './crdt'
import { Transaction } from './transaction'

const compare = (a, b) => {
  const [aKey, aRef] = a
  const [bKey, bRef] = b
  const comp = simpleCompare(aKey, bKey)
  if (comp !== 0) return comp
  return refCompare(aRef, bRef)
}

const refCompare = (aRef, bRef) => {
  if (Number.isNaN(aRef)) return -1
  if (Number.isNaN(bRef)) throw new Error('ref may not be Infinity or NaN')
  if (aRef === Infinity) return 1 // need to test this on equal docids!
  // if (!Number.isFinite(bRef)) throw new Error('ref may not be Infinity or NaN')
  return simpleCompare(aRef, bRef)
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
export const byKeyOpts: StaticProllyOptions = { cache, chunker: bf(30), codec, hasher, compare }
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
export const byIdOpts: StaticProllyOptions = { cache, chunker: bf(30), codec, hasher, compare: simpleCompare }

// todo test about DocFragment unwrapped values
export function indexEntriesForChanges(
  changes: DocUpdate[],
  mapFn: MapFn
): { key: [string, string]; value: DocFragment }[] {
  const indexEntries: { key: [string, string]; value: DocFragment }[] = []
  changes.forEach(({ key: _id, value, del }) => {
    // key is _id, value is the document
    if (del || !value) return
    let mapCalled = false
    const mapReturn = mapFn({ _id, ...value }, (k: string, v: DocFragment) => {
      mapCalled = true
      if (typeof k === 'undefined') return
      indexEntries.push({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        key: [charwise.encode(k) as string, _id],
        value: v || null
      })
    })
    if (!mapCalled && mapReturn) {
      indexEntries.push({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        key: [charwise.encode(mapReturn) as string, _id],
        value: null
      })
    }
  })
  return indexEntries
}

export function makeProllyGetBlock(blocks: BlockFetcher): (address: Link) => Promise<BlockView<unknown, number, number, 1>> {
  // @ts-ignore
  return async (address: Link) => {
    const block = await blocks.get(address)
    if (!block) throw new Error(`Missing block ${address.toString()}`)
    const { cid, bytes } = block
    return create({ cid, bytes, hasher, codec })
  }
}

export async function bulkIndex(tblocks: Transaction, inIndex: IndexTree, indexEntries: IndexUpdate[], opts: StaticProllyOptions): Promise<IndexTree> {
  if (!indexEntries.length) return inIndex
  if (!inIndex.root) {
    if (!inIndex.cid) {
      let returnRootBlock: Block | null = null
      let returnNode: ProllyNode | null = null
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      for await (const node of await Map.create({ get: makeProllyGetBlock(tblocks), list: indexEntries, ...opts }) as ProllyNode[]) {
        const block = await node.block as Block
        await tblocks.put(block.cid, block.bytes)
        returnRootBlock = block
        returnNode = node
      }
      if (!returnNode || !returnRootBlock) throw new Error('failed to create index')
      return { root: returnNode, cid: returnRootBlock.cid }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      inIndex.root = await Map.load({ cid: inIndex.cid, get: makeProllyGetBlock(tblocks), ...opts }) as ProllyNode
    }
  }
  const { root, blocks: newBlocks } = await inIndex.root.bulk(indexEntries)
  if (root) {
    for await (const block of newBlocks as Block[]) {
      await tblocks.put(block.cid, block.bytes)
    }
    // await tblocks.put((returnRootBlock.cid, returnRootBlock.bytes)
    return { root, cid: (await root.block as Block).cid }
  } else {
    return { root: null, cid: null }
  }
}
