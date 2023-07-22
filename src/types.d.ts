import { Link, Block, Link } from 'multiformats'
import { EventLink } from '@alanshaw/pail/clock'
import { ProllyNode as BaseNode } from 'prolly-trees/base'
import { AnyLink, ClockHead } from './types'

export type ClockHead = EventLink<any>[]
export type ProllyResult = {
  root: ProllyNode
}

export type BulkResult = {
  head: ClockHead
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
export interface EventData {
  root: Link | null
  bulk: DocUpdate[]
}

// ProllyNode type based on the ProllyNode from 'prolly-trees/base'
export interface ProllyNode extends BaseNode {
  get(key: string): unknown
  bulk(bulk: DocUpdate[]): { root: any; blocks: any } | PromiseLike<{ root: any; blocks: any }>
  address: Promise<Link>
  distance: number
  compare: (a: any, b: any) => number
  cache: any
  block: Promise<Block>
}
export interface CIDCounter {
  add(node: ProllyNode): void
  all(): Promise<Set<string | Promise<string>>>
}

export interface ProllyOptions {
  cid?: Link
  list?: DocUpdate[]
  get: (cid: any) => Promise<any>
  cache: any
  chunker: (entry: any, distance: number) => boolean
  codec: any
  hasher: any
  compare: (a: any, b: any) => number
}

export type AnyLink = Link<unknown, number, number, 1 | 0>
export type AnyBlock = { cid: AnyLink; bytes: Uint8Array }
export type BlockFetcher = { get: (link: AnyLink) => Promise<AnyBlock | undefined> }

export type DbResponse = {
  id: string
  clock: ClockHead
}
