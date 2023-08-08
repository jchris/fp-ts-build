// @ts-ignore
import cargoQueue from 'async/cargoQueue'
import { CRDT } from './crdt'
import { Doc, BulkResult, DocUpdate, DbResponse, ClockHead, ChangesResponse, MapFn } from './types'
import { Indexer } from './indexer'

export class Database {
  name: string
  config: object
  _crdt: CRDT
  _writeQueue: any

  constructor(name: string, config = {}) {
    this.name = name
    this.config = config
    this._crdt = new CRDT(name)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    this._writeQueue = cargoQueue(async (updates: DocUpdate[]) => {
      return await this._crdt.bulk(updates)
    })
  }

  async put(doc: Doc): Promise<DbResponse> {
    const { _id, ...value } = doc
    const docId = _id || 'f' + Math.random().toString(36).slice(2) // todo uuid v7

    return await new Promise<DbResponse>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      this._writeQueue.push({ key: docId, value }, function (err: Error | null, result?: BulkResult) {
        if (err) reject(err)
        resolve({ id: docId, clock: result?.head } as DbResponse)
      })
    })
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
    return await new Promise<DbResponse>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      this._writeQueue.push({ key: id, del: true }, function (err: Error | null, result?: BulkResult) {
        if (err) reject(err)
        resolve({ id, clock: result?.head } as DbResponse)
      })
    })
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
    const idx = this._crdt.indexer(name)
    if (idx) return idx
    const idx2 = new Indexer(this._crdt.blocks, this._crdt, name, mapFn || name)
    this._crdt.registerIndexer(idx2)
    return idx2
  }
}
