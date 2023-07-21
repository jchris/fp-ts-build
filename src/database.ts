import { CRDT } from './crdt'
import { Doc, ClockHead } from './types'

type DbResponse = {
  id: string
  clock: ClockHead
}

export class Database {
  name: string
  config: object
  crdt: CRDT
  constructor(name: string, config = {}) {
    this.name = name
    this.config = config
    this.crdt = new CRDT()
  }

  async put(doc: Doc): Promise<DbResponse> {
    const { _id, ...body } = doc
    const { head } = await this.crdt.bulk([{ key: _id, value: body }])
    return { id: _id, clock: head }
  }

  async get(id: string): Promise<Doc> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const got = await this.crdt.get(id).catch((e) => { e.message = 'Not found: ' + e.message; throw e })
    if (!got) throw new Error('Not found')
    const { result } = got
    return { _id: id, ...result }
  }

  async del(id: string): Promise<DbResponse> {
    const { head } = await this.crdt.bulk([{ key: id, del: true }])
    return { id, clock: head }
  }
}
