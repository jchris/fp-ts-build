import * as codec from './encrypted-block.js'
// @ts-ignore
import { create, load } from 'prolly-trees/cid-set'
import { CID, MultihashHasher, ToString } from 'multiformats'
import { encode, decode, create as mfCreate } from 'multiformats/block'
import * as dagcbor from '@ipld/dag-cbor'
// import { sha256 as hasher } from 'multiformats/hashes/sha2'
import { AnyBlock, AnyDecodedBlock, AnyLink } from './types.js'

// const createBlock = (bytes: Uint8Array, cid: AnyLink) => mfCreate({ cid, bytes, hasher, codec })

const encrypt = async function * ({
  get, cids, hasher,
  key, cache, chunker, root
}:
  {
    get: (cid: AnyLink) => Promise<AnyBlock | undefined>,
    key: ArrayBuffer, cids: AnyLink[], hasher: MultihashHasher<number>
    chunker: (bytes: Uint8Array) => AsyncGenerator<Uint8Array>,
    cache: (cid: AnyLink) => Promise<AnyBlock>,
    root: AnyLink
  }): AsyncGenerator<any, void, unknown> {
  const set = new Set<ToString<AnyLink>>()
  let eroot
  for (const cid of cids) {
    // console.log('string', string.constructor, string)
    // const cid = CID.parse(string)
    const unencrypted = await get(cid)
    // if (!unencrypted.cid) {
    //   unencrypted = { cid, bytes: unencrypted }
    // }
    if (!unencrypted) throw new Error('missing cid: ' + cid.toString())
    // console.log('unencrypted', unencrypted)
    const encrypted = await codec.encrypt({ ...unencrypted, key })
    // console.log('encrypted', encrypted)

    // const testConcat = codec.encode(encrypted.value)
    // console.log('testConcat', testConcat)

    const block = await encode({ ...encrypted, codec, hasher })
    // console.log(`encrypting ${string} as ${block.cid}`)
    yield block
    set.add(block.cid.toString())
    if (unencrypted.cid.equals(root)) eroot = block.cid
  }
  if (!eroot) throw new Error('cids does not include root')
  const list = [...set].map(s => CID.parse(s))
  let last
  for await (const node of create({ list, get, cache, chunker, hasher, codec: dagcbor })) {
    const block = await node.block
    yield block
    last = block
  }
  const head = [eroot, last.cid]
  const block = await encode({ value: head, codec: dagcbor, hasher })
  yield block
}

const decrypt = async function * ({ root, get, key, cache, chunker, hasher }: {
  root: AnyLink,
  get: (cid: AnyLink) => Promise<AnyBlock | undefined>,
  key: ArrayBuffer,
  cache: (cid: AnyLink) => Promise<AnyBlock>,
  chunker: (bytes: Uint8Array) => AsyncGenerator<Uint8Array>,
  hasher: MultihashHasher<number>
}): AsyncGenerator<AnyBlock, void, undefined> {
  const getWithDecode = async (cid: AnyLink) => get(cid).then(async (block) => {
    if (!block) return
    const decoded = await decode({ ...block, codec: dagcbor, hasher })
    return decoded
  })
  const getWithDecrypt = async (cid: AnyLink) => get(cid).then(async (block) => {
    if (!block) return
    const decoded = await decode({ ...block, codec, hasher })
    return decoded
  })
  const decodedRoot = await getWithDecode(root)
  if (!decodedRoot) throw new Error('missing root')
  if (!decodedRoot.bytes) throw new Error('missing bytes')
  // const o = { ...got, codec: dagcbor, hasher }!
  // const decodedRoot = await decode(o) as { value: [AnyLink, AnyLink] }
  // console.log('decodedRoot', decodedRoot)
  const { value: [eroot, tree] } = decodedRoot as { value: [AnyLink, AnyLink] }
  const rootBlock = await get(eroot) as AnyDecodedBlock
  if (!rootBlock) throw new Error('missing root block')

  const rootTree = await get(tree) as AnyDecodedBlock

  // console.log('abou tot load CID set', rootBlock, rootTree)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const cidset = await load({ cid: tree, get: getWithDecode, cache, chunker, codec, hasher })
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const { result: nodes } = await cidset.getAllEntries() as { result: { cid: CID }[] }
  const unwrap = async (eblock: AnyDecodedBlock | undefined) => {
    if (!eblock) throw new Error('missing block')
    // console.log('unwrap', eblock)
    if (!eblock.value) { eblock = await decode({ ...eblock, codec, hasher }) as AnyDecodedBlock }
    const { bytes, cid } = await codec.decrypt({ ...eblock, key }).catch(e => {
      throw e
    })
    const block = await mfCreate({ cid, bytes, hasher, codec })
    return block
  }
  const promises = []
  for (const { cid } of nodes) {
    if (!rootBlock.cid.equals(cid)) promises.push(getWithDecrypt(cid).then(unwrap))
  }
  yield * promises
  yield unwrap(rootBlock)
}

export {
  encrypt,
  decrypt
}
