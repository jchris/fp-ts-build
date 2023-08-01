import { Link } from 'multiformats'
import { EventLink } from '@alanshaw/pail/clock'
import { EventData } from '@alanshaw/pail/crdt'
import { AnyLink, Doc, DocBody, ProllyNode } from './types'

export type ClockHead = EventLink<EventData>[]

export type BulkResult = {
  head: ClockHead
  car?: AnyLink
}

type DocBody = {
  [key: string]: any
}

export type Doc = DocBody & {
  _id: string
}

export type DocUpdate = {
  key: string
  value?: DocBody
  del?: boolean
}

export type DocValue = {
  doc?: DocBody
  del?: boolean
}

export type IndexUpdate = {
  key: [string, string] | string
  value?: DocFragment
  del?: boolean
}

type IdxTree = {
  cid: AnyLink | null
  root: ProllyNode | null
}

export type IndexerResult = {
  byId: IdxTree
  byKey: IdxTree
}

export type QueryOpts = { descending?: boolean; limit?: number; includeDocs?: boolean }

export type AnyLink = Link<unknown, number, number, 1 | 0>
export type AnyBlock = { cid: AnyLink; bytes: Uint8Array }
export type BlockFetcher = { get: (link: AnyLink) => Promise<AnyBlock | undefined> }

export type DbResponse = {
  id: string
  clock: ClockHead
}

export type ChangesResponse = {
  clock: ClockHead
  rows: { key: string; value: Doc }[]
}

// ProllyNode type based on the ProllyNode from 'prolly-trees/base'
export interface ProllyNode extends BaseNode {
  getAllEntries(): PromiseLike<{ [x: string]: any; result: IndexUpdate[] }>
  getMany(removeIds: string[]): Promise<{result: any[]}>
  get(key: string): unknown
  bulk(bulk: IndexUpdate[]): PromiseLike<{ root: ProllyNode | null; blocks: Block[] }>
  address: Promise<Link>
  distance: number
  compare: (a: any, b: any) => number
  cache: any
  block: Promise<Block>
}
// export interface CIDCounter {
//   add(node: ProllyNode): void
//   all(): Promise<Set<string | Promise<string>>>
// }

export interface StaticProllyOptions {
  cache: any
  chunker: (entry: any, distance: number) => boolean
  codec: any
  hasher: any
  compare: (a: any, b: any) => number
}

export type ProllyOptions = StaticProllyOptions & {
  cid?: Link
  list?: DocUpdate[]
  get: (cid: any) => Promise<any>
}

export type DocFragment = string | number | boolean | null | DocFragment[] | { [key: string]: DocFragment }

type CallbackFn = (k: string, v: DocFragment) => void

export type MapFn = (doc: Doc, map: CallbackFn) => DocBody | null
