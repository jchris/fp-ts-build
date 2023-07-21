/* eslint-disable @typescript-eslint/require-await */
import { Link } from 'multiformats'
import { parse } from 'multiformats/link'

/** forked from
 * https://github.com/alanshaw/pail/blob/main/src/block.js
 * thanks Alan
**/

// Define and export the AnyLink type
export type AnyLink = Link<unknown, number, number, 1|0>;
type AnyBlock = { cid: AnyLink, bytes: Uint8Array };
export type BlockFetcher = { get: (link: AnyLink) => Promise<AnyBlock | undefined> };

export class MemoryBlockstore implements BlockFetcher {
  private blocks: Map<string, Uint8Array> = new Map()
  private instanceId: string = Math.random().toString(36).slice(2, 8)

  constructor(blocks?: AnyBlock[]) {
    if (blocks) {
      this.blocks = new Map(blocks.map(b => [b.cid.toString(), b.bytes]))
    }
  }

  async get(cid: AnyLink): Promise<AnyBlock | undefined> {
    console.log('s get', this.instanceId, cid.toString())
    const bytes = this.blocks.get(cid.toString())
    if (!bytes) return
    return { cid, bytes }
  }

  async put(cid: AnyLink, bytes: Uint8Array): Promise<void> {
    console.log('s put', this.instanceId, cid.toString())
    this.blocks.set(cid.toString(), bytes)
  }

  putSync(cid: AnyLink, bytes: Uint8Array): void {
    this.blocks.set(cid.toString(), bytes)
  }

  async delete(cid: AnyLink): Promise<void> {
    this.blocks.delete(cid.toString())
  }

  deleteSync(cid: AnyLink): void {
    this.blocks.delete(cid.toString())
  }

  * entries() {
    for (const [str, bytes] of this.blocks) {
      yield { cid: parse(str), bytes }
    }
  }
}

export class MultiBlockFetcher {
  private fetchers: BlockFetcher[]

  constructor(...fetchers: BlockFetcher[]) {
    this.fetchers = fetchers
  }

  async get(link: AnyLink): Promise<AnyBlock | undefined> {
    for (const f of this.fetchers) {
      const v = await f.get(link)
      if (v) return v
    }
  }
}

export class Transaction extends MemoryBlockstore {
  constructor(private parent: BlockFetcher) {
    super()
  }

  async get(cid: AnyLink): Promise<AnyBlock | undefined> {
    return super.get(cid) ?? this.parent.get(cid)
  }
}

export class TransactionBlockstore implements BlockFetcher {
  // private committed: Map<string, Uint8Array> = new Map()
  private transactions: Set<Transaction> = new Set()
  put() {
    throw new Error('use a transaction to put')
  }

  async get(cid: AnyLink): Promise<AnyBlock | undefined> {
    console.log('get', cid.toString())
    for (const f of this.transactions) {
      const v = await f.get(cid)
      if (v) return v
    }
  }

  async transaction(fn: (t: Transaction) => Promise<any>) {
    const t = new Transaction(this)
    this.transactions.add(t)
    return fn(t)
  }
}
