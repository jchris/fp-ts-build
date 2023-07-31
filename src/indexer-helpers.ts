import { sha256 as hasher } from 'multiformats/hashes/sha2'
import * as codec from '@ipld/dag-cbor'

// @ts-ignore
import charwise from 'charwise'
// @ts-ignore
import * as Map from 'prolly-trees/map'
// @ts-ignore
import { bf, simpleCompare } from 'prolly-trees/utils'
// @ts-ignore
import { nocache as cache } from 'prolly-trees/cache'

import { ClockHead } from './types'
import { CRDT } from './crdt'

const compare = (a, b) => {
  const [aKey, aRef] = a
  const [bKey, bRef] = b
  const comp = simpleCompare(aKey, bKey)
  if (comp !== 0) return comp
  return refCompare(aRef, bRef)
}

const refCompare = (aRef, bRef) => {
  if (Number.isNaN(aRef)) return -1
  if (Number.isNaN(bRef)) throw new Error('ref may not be Infinity or NaN')
  if (aRef === Infinity) return 1 // need to test this on equal docids!
  // if (!Number.isFinite(bRef)) throw new Error('ref may not be Infinity or NaN')
  return simpleCompare(aRef, bRef)
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
const dbIndexOpts = { cache, chunker: bf(30), codec, hasher, compare }
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
const idIndexOpts = { cache, chunker: bf(30), codec, hasher, compare: simpleCompare }

export async function updateIndex(crdt: CRDT, indexHead: ClockHead, mapFn: Function) {
  const { result, head } = await crdt.changes(indexHead)
  if (result.rows.length === 0) {
    return result.clock
  }
}

const indexEntriesForChanges = (changes, mapFn) => {
  const indexEntries = []
  changes.forEach(({ key: _id, value, del }) => {
    // key is _id, value is the document
    if (del || !value) return
    let mapCalled = false
    const mapReturn = mapFn(makeDoc({ key: _id, value }), (k, v) => {
      mapCalled = true
      if (typeof k === 'undefined') return
      indexEntries.push({
        key: [charwise.encode(k), _id],
        value: v || null
      })
    })
    if (!mapCalled && mapReturn) {
      indexEntries.push({
        key: [charwise.encode(mapReturn), _id],
        value: null
      })
    }
  })
  return indexEntries
}
