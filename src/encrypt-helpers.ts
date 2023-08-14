// @ts-nocheck
import { CID } from 'multiformats'
import { Block } from 'multiformats/block'
import { sha256 } from 'multiformats/hashes/sha2'
import { encrypt, decrypt } from './crypto'
import { Buffer } from 'buffer'
import { bf } from 'prolly-trees/utils'
import { nocache as cache } from 'prolly-trees/cache'
import { innerMakeCarFile, encodeCarHeader, encodeCarFile } from './loader-helpers' // Import the existing function
import type { AnyBlock, CarMakeable, AnyCarHeader } from './types'
import type { Transaction } from './transaction'

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
const chunker = bf(30)

export async function encryptedMakeCarFile(key: string, fp: AnyCarHeader, t: Transaction): Promise<AnyBlock> {
  const { cid, bytes } = await encodeCarHeader(fp)
  await t.put(cid, bytes)
  return encryptedEncodeCarFile(cid, t)
}

async function encryptedEncodeCarFile(key: string, rootCid: AnyLink, t: CarMakeable): Promise<AnyBlock> {
  const encryptionKey = Buffer.from(key, 'hex')
  const encryptedBlocks: Block[] = []

  const cidsToEncrypt = [] as AnyLink[]
  for (const { cid } of t.entries()) {
    cidsToEncrypt.push(cid)
  }

  let last: Block
  for await (const block of encrypt({
    cids: cidsToEncrypt,
    get: async (cid: CID) => {
      return t.get(cid)
    },
    key: encryptionKey,
    hasher: sha256,
    chunker,
    cache,
    root: rootCid
  })) {
    encryptedBlocks.push(block)
    last = block
  }
}

export async function blocksToEncryptedCarBlock(
  innerBlockStoreClockRootCid: CID,
  blocks: Map<CID, Block>,
  keyMaterial: string,
  cids: CID[]
): Promise<Block> {
  const encryptionKey = Buffer.from(keyMaterial, 'hex')
  const encryptedBlocks: Block[] = []
  const theCids = cids
  let last: Block

  for await (const block of encrypt({
    cids: theCids,
    get: async (cid: CID) => {
      const got = blocks.get(cid)
      return got.block ? { cid, bytes: got.block } : got
    },
    key: encryptionKey,
    hasher: sha256,
    chunker,
    cache,
    root: innerBlockStoreClockRootCid
  })) {
    encryptedBlocks.push(block)
    last = block
  }

  const encryptedCar = await innerMakeCarFile(last.cid, encryptedBlocks)
  return encryptedCar
} // Assuming separate chunking utilities

export async function blocksFromEncryptedCarBlock(
  cid: CID,
  get: (cid: CID) => Promise<Block>,
  keyMaterial: string
): Promise<{ blocks: Block[]; cids: Set<string> }> {
  const decryptionKey = Buffer.from(keyMaterial, 'hex')
  const cids = new Set<string>()
  const decryptedBlocks: Block[] = []

  for await (const block of decrypt({
    root: cid,
    get,
    key: decryptionKey,
    chunker,
    hasher: sha256,
    cache
  })) {
    decryptedBlocks.push(block)
    cids.add(block.cid.toString())
  }

  return { blocks: decryptedBlocks, cids }
}
