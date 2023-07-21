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

  constructor(blocks?: AnyBlock[]) {
    if (blocks) {
      this.blocks = new Map(blocks.map(b => [b.cid.toString(), b.bytes]))
    }
  }

  async get(cid: AnyLink): Promise<AnyBlock | undefined> {
    const bytes = this.blocks.get(cid.toString())
    if (!bytes) return
    return { cid, bytes }
  }

  async put(cid: AnyLink, bytes: Uint8Array): Promise<void> {
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

}

export class TransactionBlockstore implements BlockFetcher {
  private committed: Map<string, Uint8Array> = new Map()
  // private transactions: Set
  put() {
    throw new Error('use a transaction to put')
  }

  async transaction() {
    return new Transaction()
  }
}
