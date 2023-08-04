import { Link } from 'multiformats'
import { EventLink } from '@alanshaw/pail/clock'
import { EventData } from '@alanshaw/pail/crdt'
import { AnyLink } from './types'

export type ClockHead = EventLink<EventData>[]

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

type IndexCars = {
  [key: string]: AnyLink
}

export type IndexKey = [string, string] | string

export type IndexUpdate = {
  key: IndexKey
  value?: DocFragment
  del?: boolean
}

export type IndexRow = {
  id: string
  key: IndexKey
  doc?: Doc | null
  value?: DocFragment
  del?: boolean
}

type IdxTree = {
  cid: AnyLink | null
  root: ProllyNode | null
}

export type BulkResult = {
  head: ClockHead
  car?: AnyLink
}

export type IndexerResult = BulkResult & {
  byId: IdxTree
  byKey: IdxTree
  map: string
  name: string
}

export type QueryOpts = {
  descending?: boolean
  limit?: number
  includeDocs?: boolean
  range?: [IndexKey, IndexKey]
  key?: string // these two can be richer than keys...
  prefix?: string | [string]
}

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
  getAllEntries(): PromiseLike<{ [x: string]: any; result: IndexRow[] }>
  getMany(removeIds: string[]): Promise<{ [x: string]: any; result: IndexKey[] }>
  range(a: IndexKey, b: IndexKey): Promise<{ result: IndexRow[] }>
  get(key: string): Promise<{ result: IndexRow[] }>
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

export type MapFn = (doc: Doc, map: CallbackFn) => DocFragment | void

export interface HeaderStoreInterface {
  name: string
  makeHeader(car: AnyLink, indexes: IndexCars): ByteView<DbHeader>
  parseHeader(headerData: Uint8Array): DbHeader
  load(branch?: string): Promise<DbHeader | null>
  save(carCid: AnyLink, indexes: IndexCars, branch?: string): Promise<void>
}

export type DbHeader = { car: AnyLink, indexes: IndexCars}
