// @ts-ignore
import cargoQueue from 'async/cargoQueue'
import { CRDT } from './crdt'
import { Doc, BulkResult, DocUpdate, DbResponse, ClockHead } from './types'

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

  async changes(since: ClockHead): Promise<{ rows: { key: string; value: Doc }[] }> {
    const { result } = await this._crdt.changes(since)
    const rows = result.map(({ key, value }) => ({
      key,
      value: { _id: key, ...value } as Doc
    }))
    return { rows }
  }
}
