/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Indexer } from '../dist/indexer.esm.js'
import { Fireproof } from '../dist/fireproof.esm.js'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { assert, matches, equals, resetDirectory, notEquals } from './helpers.js'

import { defaultConfig } from '../dist/store-fs.esm.js'

describe('basic Indexer', function () {
  let db, indexer, didMap
  beforeEach(async function () {
    await resetDirectory(defaultConfig.dataDir, 'test-indexer')

    db = Fireproof.storage('test-indexer')
    await db.put({ title: 'amazing' })
    await db.put({ title: 'creative' })
    await db.put({ title: 'bazillas' })
    indexer = new Indexer(db._crdt._blocks, db._crdt, 'hello', (doc) => {
      didMap = true
      return doc.title
    })
  })
  it('should have properties', function () {
    equals(indexer.crdt, db._crdt)
    equals(indexer.name, 'hello')
    assert(indexer.mapFn)
  })
  it('should call the map function on first query', async function () {
    didMap = false
    await indexer.query()
    assert(didMap)
  })
  it('should not call the map function on second query', async function () {
    await indexer.query()
    didMap = false
    await indexer.query()
    assert(!didMap)
  })
  it('should get results', async function () {
    const result = await indexer.query()
    assert(result)
    assert(result.rows)
    equals(result.rows.length, 3)
  })
  it('should be in order', async function () {
    const { rows } = await indexer.query()
    equals(rows[0].key, 'amazing')
  })
  it('should work with limit', async function () {
    const { rows } = await indexer.query({ limit: 1 })
    equals(rows.length, 1)
  })
  it('should work with descending', async function () {
    const { rows } = await indexer.query({ descending: true })
    equals(rows[0].key, 'creative')
  })
  it('should range query all', async function () {
    const { rows } = await indexer.query({ range: ['a', 'z'] })
    equals(rows[0].key, 'amazing')
    equals(rows.length, 3)
  })
  it('should range query', async function () {
    const { rows } = await indexer.query({ range: ['b', 'd'] })
    equals(rows[0].key, 'bazillas')
  })
  it('should key query', async function () {
    const { rows } = await indexer.query({ key: 'bazillas' })
    equals(rows.length, 1)
  })
})
