// @ts-nocheck
// from https://github.com/mikeal/encrypted-block
// import randomBytes from 'randombytes'
// import aes from 'js-crypto-aes'

import { Crypto } from '@peculiar/webcrypto'

import { CID } from 'multiformats'
import { Buffer } from 'buffer'

import * as rbCrypto from 'crypto'
import { AnyLink } from './types'

const crypto = new Crypto()

export function randomBytes(size: number) {
  // if (rbCrypto && rbCrypto.randomBytes) {
  //   return rbCrypto.randomBytes(size)
  //   const iv = crypto.getRandomValues(new Uint8Array(12))

  // }

  const bytes = Buffer.allocUnsafe(size)
  if (size > 0) {
    crypto.getRandomValues(bytes)
  }
  return bytes
}

const enc32 = value => {
  value = +value
  const buff = new Uint8Array(4)
  buff[3] = (value >>> 24)
  buff[2] = (value >>> 16)
  buff[1] = (value >>> 8)
  buff[0] = (value & 0xff)
  return buff
}

const readUInt32LE = (buffer) => {
  const offset = buffer.byteLength - 4
  return ((buffer[offset]) |
    (buffer[offset + 1] << 8) |
    (buffer[offset + 2] << 16)) +
    (buffer[offset + 3] * 0x1000000)
}

const encode = ({ iv, bytes }) => concat([iv, bytes])
const decode = bytes => {
  const iv = bytes.subarray(0, 12)
  bytes = bytes.slice(12)
  return { iv, bytes }
}

const code = 0x300000 + 1337

const concat = buffers => Uint8Array.from(buffers.map(b => [...b]).flat())

const decrypt = async ({ key, value }): Promise<{ cid: AnyLink, bytes: Uint8Array }> => {
  let { bytes, iv } = value
  bytes = await aes.decrypt(bytes, key, { name: 'AES-GCM', iv, tagLength: 16 })
  const len = readUInt32LE(bytes.subarray(0, 4))
  const cid = CID.decode(bytes.subarray(4, 4 + len))
  bytes = bytes.subarray(4 + len)
  return { cid, bytes }
}
const encrypt = async ({ key, cid, bytes }: { key: Uint8Array, cid: AnyLink, bytes: Uint8Array }) => {
  const len = enc32(cid.bytes.byteLength)
  // console.log('len', len)
  // const iv = randomBytes(12)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const msg = concat([len, cid.bytes, bytes])
  try {
    const cryKey = await crypto.subtle.importKey(
      'raw', // raw or jwk
      key, // raw data
      'AES-CTR',
      false, // extractable
      ['encrypt', 'decrypt']
    )
    bytes = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv, // BufferSource
        tagLength: 128 // 32, 64, 96, 104, 112, 120 or 128 (default)
      },
      cryKey, // AES key
      msg // BufferSource
    )
    // bytes = await aes.encrypt(msg, key, { name: 'AES-GCM', iv, tagLength: 16 })
  } catch (e) {
    console.log('e', e)
    throw e
  }
  return { value: { bytes, iv } }
}

const cryptoFn = key => {
  return { encrypt: opts => encrypt({ key, ...opts }), decrypt: opts => decrypt({ key, ...opts }) }
}

const name = 'mikeal@encrypted-block:aes-gcm'

export { encode, decode, code, name, encrypt, decrypt, cryptoFn as crypto }
