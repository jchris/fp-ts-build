// @ts-ignore
import cargoQueue from 'async/cargoQueue'
import { CRDT } from './crdt'
import { Doc, ClockHead, BulkResult, DocUpdate } from './types'

type DbResponse = {
  id: string
  clock: ClockHead
}

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
    return await new Promise<DbResponse>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      this._writeQueue.push({ key: _id, value }, function (err: Error | null, result?: BulkResult) {
        if (err) reject(err)
        resolve({ id: doc._id, clock: result?.head } as DbResponse)
      })
    })
  }

  async get(id: string): Promise<Doc> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const got = await this._crdt.get(id).catch((e) => { e.message = `Not found: ${id} - ` + e.message; throw e })
    if (!got) throw new Error(`Not found: ${id}`)
    const { result } = got
    return { _id: id, ...result }
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
}
