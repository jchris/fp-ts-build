// @ts-ignore
// import cargoQueue from 'async/cargoQueue'
import { WriteQueue, writeQueue } from './write-queue'
import { CRDT } from './crdt'
import { Doc, BulkResult, DocUpdate, DbResponse, ClockHead, ChangesResponse, MapFn, ListenerFn } from './types'

export class Database {
  name: string
  config: object
  listeners: Set<ListenerFn> = new Set()
  _crdt: CRDT
  _writeQueue: WriteQueue

  constructor(name: string, config = { blocks: null }) {
    this.name = name
    this.config = config
    this._crdt = new CRDT(name)

    this._writeQueue = writeQueue(async (updates: DocUpdate[]) => {
      const r = await this._crdt.bulk(updates)
      if (this.listeners.size) {
        const docs = updates.map(({ key, value }) => ({ _id: key, ...value }))
        for (const listener of this.listeners) {
          await listener(docs)
        }
      }
      return r
    })
  }

  async put(doc: Doc): Promise<DbResponse> {
    const { _id, ...value } = doc
    const docId = _id || 'f' + Math.random().toString(36).slice(2) // todo uuid v7

    // Push the DocUpdate into the _writeQueue and await the result
    const result: BulkResult = await this._writeQueue.push({ key: docId, value } as DocUpdate)

    return { id: docId, clock: result?.head } as DbResponse
  }

  async get(id: string): Promise<Doc> {
    const got = await this._crdt.get(id).catch(e => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      e.message = `Not found: ${id} - ` + e.message
      throw e
    })
    if (!got) throw new Error(`Not found: ${id}`)
    const { doc } = got
    return { _id: id, ...doc }
  }

  async del(id: string): Promise<DbResponse> {
    // Push the delete operation into the _writeQueue and await the result
    const result = await this._writeQueue.push({ key: id, del: true })

    return { id, clock: result?.head } as DbResponse
  }

  async changes(since: ClockHead): Promise<ChangesResponse> {
    const { result, head } = await this._crdt.changes(since)
    const rows = result.map(({ key, value }) => ({
      key,
      value: { _id: key, ...value } as Doc
    }))
    return { rows, clock: head }
  }

  index(name: string, mapFn?: MapFn) {
    return this._crdt.index(name, mapFn)
  }

  subscribe(listener: ListenerFn): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}
