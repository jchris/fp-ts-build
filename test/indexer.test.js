/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Indexer } from '../dist/indexer.esm.js'
import { Fireproof } from '../dist/fireproof.esm.js'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { assert, matches, equals, resetDirectory, notEquals, equalsJSON } from './helpers.js'

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
  it('should include docs', async function () {
    const { rows } = await indexer.query({ includeDocs: true })
    assert(rows[0].doc)
    equals(rows[0].doc._id, rows[0].id)
  })
})

// eslint-disable-next-line mocha/max-top-level-suites
describe('Indexer query with compound key', function () {
  let db, indexer
  beforeEach(async function () {
    await resetDirectory(defaultConfig.dataDir, 'test-indexer')
    db = Fireproof.storage('test-indexer')
    await db.put({ title: 'amazing', score: 1 })
    await db.put({ title: 'creative', score: 2 })
    await db.put({ title: 'creative', score: 20 })
    await db.put({ title: 'bazillas', score: 3 })
    indexer = new Indexer(db._crdt._blocks, db._crdt, 'hello', (doc) => {
      return [doc.title, doc.score]
    })
  })
  it('should prefix query', async function () {
    const { rows } = await indexer.query({ prefix: 'creative' })
    equals(rows.length, 2)
    equalsJSON(rows[0].key, ['creative', 2])
    equalsJSON(rows[1].key, ['creative', 20])
  })
})

describe('basic Indexer with map fun', function () {
  let db, indexer
  beforeEach(async function () {
    await resetDirectory(defaultConfig.dataDir, 'test-indexer')

    db = Fireproof.storage('test-indexer')
    await db.put({ title: 'amazing' })
    await db.put({ title: 'creative' })
    await db.put({ title: 'bazillas' })
    indexer = new Indexer(db._crdt._blocks, db._crdt, 'hello', (doc, map) => {
      map(doc.title)
    })
  })
  it('should get results', async function () {
    const result = await indexer.query()
    assert(result)
    assert(result.rows)
    equals(result.rows.length, 3)
  })
})

describe('basic Indexer with string fun', function () {
  let db, indexer
  beforeEach(async function () {
    await resetDirectory(defaultConfig.dataDir, 'test-indexer')

    db = Fireproof.storage('test-indexer')
    await db.put({ title: 'amazing' })
    await db.put({ title: 'creative' })
    await db.put({ title: 'bazillas' })
    indexer = new Indexer(db._crdt._blocks, db._crdt, 'hello', 'title')
  })
  it('should get results', async function () {
    const result = await indexer.query()
    assert(result)
    assert(result.rows)
    equals(result.rows.length, 3)
  })
  it('should include docs', async function () {
    const { rows } = await indexer.query()
    assert(rows[0].doc)
  })
})
