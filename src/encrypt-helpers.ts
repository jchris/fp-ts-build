import { CID } from 'multiformats'
// import { Block } from 'multiformats/block'
import { sha256 } from 'multiformats/hashes/sha2'
import { encrypt, decrypt } from './crypto'
import { Buffer } from 'buffer'
// @ts-ignore
import { bf } from 'prolly-trees/utils'
// @ts-ignore
import { nocache as cache } from 'prolly-trees/cache'
import { encodeCarHeader, encodeCarFile } from './loader-helpers' // Import the existing function
import type { AnyBlock, CarMakeable, AnyCarHeader, AnyLink } from './types'
import type { Transaction } from './transaction'
import { MemoryBlockstore } from '@alanshaw/pail/block'

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
const chunker = bf(30)

export async function encryptedMakeCarFile(key: string, fp: AnyCarHeader, t: Transaction): Promise<AnyBlock> {
  const { cid, bytes } = await encodeCarHeader(fp)
  await t.put(cid, bytes)
  return encryptedEncodeCarFile(key, cid, t)
}

async function encryptedEncodeCarFile(key: string, rootCid: AnyLink, t: CarMakeable): Promise<AnyBlock> {
  const encryptionKey = Buffer.from(key, 'hex')
  const encryptedBlocks = new MemoryBlockstore()
  const cidsToEncrypt = [] as AnyLink[]
  for (const { cid } of t.entries()) {
    cidsToEncrypt.push(cid)
  }
  let last: AnyBlock | null = null
  for await (const block of encrypt({
    cids: cidsToEncrypt,
    get: t.get.bind(t),
    key: encryptionKey,
    hasher: sha256,
    chunker,
    cache,
    root: rootCid
  }) as AsyncGenerator<AnyBlock, void, unknown>) {
    await encryptedBlocks.put(block.cid, block.bytes)
    last = block
  }
  if (!last) throw new Error('no blocks encrypted')
  const encryptedCar = await encodeCarFile(last.cid, encryptedBlocks)
  return encryptedCar
}

// export async function blocksToEncryptedCarBlock(
//   innerBlockStoreClockRootCid: AnyLink,
//   blocks: Map<AnyLink, AnyBlock>,
//   keyMaterial: string,
//   cids: AnyLink[]
// ): Promise<AnyBlock> {
//   const encryptionKey = Buffer.from(keyMaterial, 'hex')
//   const encryptedBlocks = new MemoryBlockstore()
//   let last: AnyBlock

//   for await (const block of encrypt({
//     cids,
//     get: async (cid: CID) => {
//       const got = blocks.get(cid)
//       return got.block ? { cid, bytes: got.block } : got
//     },
//     key: encryptionKey,
//     hasher: sha256,
//     chunker,
//     cache,
//     root: innerBlockStoreClockRootCid
//   })) {
//     encryptedBlocks.push(block)
//     last = block
//   }

//   const encryptedCar = await encodeCarFile(last.cid, encryptedBlocks)
//   return encryptedCar
// } // Assuming separate chunking utilities

// async function blocksFromEncryptedCarBlock(
//   cid: CID,
//   get: (cid: CID) => Promise<AnyBlock>,
//   keyMaterial: string
// ): Promise<{ blocks: AnyBlock[]; cids: Set<string> }> {
//   const decryptionKey = Buffer.from(keyMaterial, 'hex')
//   const cids = new Set<string>()
//   const decryptedBlocks: AnyBlock[] = []

//   for await (const block of decrypt({
//     root: cid,
//     get,
//     key: decryptionKey,
//     chunker,
//     hasher: sha256,
//     cache
//   })) {
//     decryptedBlocks.push(block)
//     cids.add(block.cid.toString())
//   }

//   return { blocks: decryptedBlocks, cids }
// }
