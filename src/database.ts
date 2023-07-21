import { CRDT } from './crdt'
import { Doc, ClockHead } from './types'

type DbResponse = {
  id: string
  clock: ClockHead
}

export class Database {
  name: string
  config: object
  _crdt: CRDT
  constructor(name: string, config = {}) {
    this.name = name
    this.config = config
    this._crdt = new CRDT()
  }

  async put(doc: Doc): Promise<DbResponse> {
    const { _id, ...body } = doc
    const { head } = await this._crdt.bulk([{ key: _id, value: body }])
    return { id: _id, clock: head }
  }

  async get(id: string): Promise<Doc> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const got = await this._crdt.get(id).catch((e) => { e.message = `Not found: ${id} - ` + e.message; throw e })
    if (!got) throw new Error(`Not found: ${id}`)

    const { result } = got
    return { _id: id, ...result }
  }

  async del(id: string): Promise<DbResponse> {
    const { head } = await this._crdt.bulk([{ key: id, del: true }])
    return { id, clock: head }
  }
}
