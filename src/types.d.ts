import { Link } from 'multiformats'
import { EventLink } from '@alanshaw/pail/clock'
import { EventData } from '@alanshaw/pail/crdt'

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

export type AnyLink = Link<unknown, number, number, 1 | 0>
export type AnyBlock = { cid: AnyLink; bytes: Uint8Array }
export type BlockFetcher = { get: (link: AnyLink) => Promise<AnyBlock | undefined> }

export type DbResponse = {
  id: string
  clock: ClockHead
}
