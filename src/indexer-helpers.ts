import { BlockView, Link, Block } from 'multiformats'
import {
  create
  // , encode, decode
} from 'multiformats/block'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import * as codec from '@ipld/dag-cbor'

// @ts-ignore
import charwise from 'charwise'
// @ts-ignore
import * as DbIndex from 'prolly-trees/db-index'
// @ts-ignore
import { bf, simpleCompare } from 'prolly-trees/utils'
// @ts-ignore
import { nocache as cache } from 'prolly-trees/cache'

import { AnyLink, DocUpdate, MapFn, DocFragment, StaticProllyOptions, BlockFetcher, ProllyNode, IndexKey, IndexUpdate, QueryOpts } from './types'
import { Transaction } from './transaction'
import { CRDT } from './crdt'

export class IndexTree {
  cid: AnyLink | null = null
  root: ProllyNode | null = null
}

type CompareRef = string | number
type CompareKey = [string | number, CompareRef]

const refCompare = (aRef: CompareRef, bRef: CompareRef) => {
  if (Number.isNaN(aRef)) return -1
  if (Number.isNaN(bRef)) throw new Error('ref may not be Infinity or NaN')
  if (aRef === Infinity) return 1
  // if (!Number.isFinite(bRef)) throw new Error('ref may not be Infinity or NaN')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  return simpleCompare(aRef, bRef) as number
}

const compare = (a: CompareKey, b: CompareKey) => {
  const [aKey, aRef] = a
  const [bKey, bRef] = b
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const comp: number = simpleCompare(aKey, bKey)
  if (comp !== 0) return comp
  return refCompare(aRef, bRef)
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
      for await (const node of await DbIndex.create({ get: makeProllyGetBlock(tblocks), list: indexEntries, ...opts }) as ProllyNode[]) {
        const block = await node.block as Block
        await tblocks.put(block.cid, block.bytes)
        returnRootBlock = block
        returnNode = node
      }
      if (!returnNode || !returnRootBlock) throw new Error('failed to create index')
      return { root: returnNode, cid: returnRootBlock.cid }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      inIndex.root = await DbIndex.load({ cid: inIndex.cid, get: makeProllyGetBlock(tblocks), ...opts }) as ProllyNode
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

// eslint-disable-next-line @typescript-eslint/require-await
export async function applyQuery(crdt: CRDT, resp: { result: IndexRow[] }, query: QueryOpts) {
  // console.log('pre-result', resp.result)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call

  if (query.descending) {
    resp.result = resp.result.reverse()
  }
  if (query.limit) {
    resp.result = resp.result.slice(0, query.limit)
  }
  if (query.includeDocs) {
    resp.result = await Promise.all(
      resp.result.map(async row => {
        const { doc } = await crdt.get(row.id)
        return { ...row, doc: { _id: row.id, ...doc } }
      })
    )
  }
  return {
    rows: resp.result.map(row => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      row.key = (charwise.decode(row.key) as IndexKey)
      return row
    })
  }
}

export function encodeRange(range: [DocFragment, DocFragment]): [IndexKey, IndexKey] {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  return range.map(key => charwise.encode(key) as IndexKey) as [IndexKey, IndexKey]
}

export function encodeKey(key: string): string {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  return charwise.encode(key) as string
}
