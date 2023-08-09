import { ClockHead, DocUpdate, MapFn, IndexUpdate, QueryOpts, DocFragment, IdxMeta, IdxCarHeader, IndexerResult, IdxMetaCar } from './types'
import { IndexBlockstore as Blockstore } from './transaction'
import { bulkIndex, indexEntriesForChanges, byIdOpts, byKeyOpts, IndexTree, applyQuery, encodeRange, encodeKey, makeName } from './indexer-helpers'
import { CRDT } from './crdt'

export class Indexer {
  blocks: Blockstore
  crdt: CRDT
  name: string | null = null
  mapFn: MapFn | null = null
  mapFnString: string = ''
  byKey = new IndexTree()
  byId = new IndexTree()
  indexHead: ClockHead = []
  includeDocsDefault: boolean = false

  constructor(blocks: Blockstore, crdt: CRDT, name: string, mapFn: MapFn) {
    this.blocks = blocks
    this.crdt = crdt
    this.applyMapFn(mapFn, name)
  }

  applyMapFn(mapFn: MapFn, name?: string) {
    if (typeof mapFn === 'string') {
      this.mapFnString = mapFn
      const regex = /^[a-zA-Z0-9 ]+$/
      if (regex.test(mapFn)) {
        this.mapFn = (doc) => {
          if (doc[mapFn]) return doc[mapFn] as DocFragment
        }
        this.includeDocsDefault = true
      }
    } else {
      this.mapFn = mapFn
      this.mapFnString = mapFn.toString()
    }
    const matches = /=>\s*(.*)/.exec(this.mapFnString)
    this.includeDocsDefault = this.includeDocsDefault || !!(matches && matches.length > 0)
    this.name = name || makeName(this.mapFnString)
  }

  async query(opts: QueryOpts = {}) {
    await this._updateIndex()
    if (!this.byKey.root) return await applyQuery(this.crdt, { result: [] }, opts)
    if (this.includeDocsDefault && opts.includeDocs === undefined) opts.includeDocs = true
    if (opts.range) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      const { result, ...all } = await this.byKey.root.range(...encodeRange(opts.range))
      console.log('range', opts.range, result)
      return await applyQuery(this.crdt, { result, ...all }, opts)
    }
    if (opts.key) {
      const encodedKey = encodeKey(opts.key)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      return await applyQuery(this.crdt, await this.byKey.root.get(encodedKey), opts)
    }
    if (opts.prefix) {
      // ensure prefix is an array
      if (!Array.isArray(opts.prefix)) opts.prefix = [opts.prefix]
      const start = [...opts.prefix, NaN]
      const end = [...opts.prefix, Infinity]
      const encodedR = encodeRange([start, end])
      return await applyQuery(this.crdt, await this.byKey.root.range(...encodedR), opts)
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const { result, ...all } = await this.byKey.root.getAllEntries() // funky return type
    return await applyQuery(this.crdt, {
      result: result.map(({ key: [k, id], value }) =>
        ({ key: k, id, value })),
      ...all
    }, opts)
  }

  async _updateIndex() {
    if (!this.mapFn) throw new Error('No map function defined')
    const { result, head } = await this.crdt.changes(this.indexHead)
    if (result.length === 0) {
      this.indexHead = head
      return { byId: this.byId, byKey: this.byKey }
    }
    let staleKeyIndexEntries: IndexUpdate[] = []
    let removeIdIndexEntries: IndexUpdate[] = []
    if (this.byId.root) {
      const removeIds = result.map(({ key }) => key)
      const { result: oldChangeEntries } = await this.byId.root.getMany(removeIds) as { result: Array<[string, string] | string> }
      staleKeyIndexEntries = oldChangeEntries.map(key => ({ key, del: true }))
      removeIdIndexEntries = oldChangeEntries.map((key) => ({ key: key[1], del: true }))
    }
    const indexEntries = indexEntriesForChanges(result, this.mapFn) // use a getter to translate from string
    const byIdIndexEntries: DocUpdate[] = indexEntries.map(({ key }) => ({ key: key[1], value: key }))
    // const tResult: IdxMetaCar =
    await this.blocks.transaction(async (tblocks): Promise<IdxMeta> => {
      this.byId = await bulkIndex(
        tblocks,
        this.byId,
        removeIdIndexEntries.concat(byIdIndexEntries),
        byIdOpts
      )
      this.byKey = await bulkIndex(tblocks, this.byKey, staleKeyIndexEntries.concat(indexEntries), byKeyOpts)
      this.indexHead = head
      if (!this.name) throw new Error('No name defined')
      return { byId: this.byId.cid, byKey: this.byKey.cid, head, map: this.mapFnString, name: this.name } as IdxMeta
    })
    // add ref to other indexes
    // tResult.indexes
    // const indexerMap = this.crdt.indexers

    // indexerMap.set(this.name, tResult)

    // return { indexes }
  }
}
