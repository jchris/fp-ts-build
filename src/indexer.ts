import { ClockHead, DocUpdate, MapFn, IndexUpdate, QueryOpts, DocFragment, IdxMeta } from './types'
import { IndexBlockstore } from './transaction'
import { bulkIndex, indexEntriesForChanges, byIdOpts, byKeyOpts, IndexTree, applyQuery, encodeRange, encodeKey, makeName, loadIndex } from './indexer-helpers'
import { CRDT } from './crdt'

export class Indexer {
  blocks: IndexBlockstore
  crdt: CRDT
  name: string | null = null
  mapFn: MapFn | null = null
  mapFnString: string = ''
  byKey = new IndexTree()
  byId = new IndexTree()
  indexHead: ClockHead = []
  includeDocsDefault: boolean = false

  constructor(blocks: IndexBlockstore, crdt: CRDT, name: string | null, mapFn: MapFn | string) {
    this.blocks = blocks
    this.crdt = crdt
    this.applyMapFn(mapFn, name)
  }

  applyMapFn(mapFn: MapFn | string, name: string | null) {
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
    await this._hydrateIndex()
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

  async _hydrateIndex() {
    if (this.byId.root && this.byKey.root) return
    if (!this.byId.cid || !this.byKey.cid) return
    this.byId.root = await loadIndex(this.blocks, this.byId.cid, byIdOpts)
    this.byKey.root = await loadIndex(this.blocks, this.byKey.cid, byKeyOpts)
  }

  async _updateIndex() {
    await this.crdt.ready
    console.log('update index', this.indexHead[0], this.crdt._head[0])
    if (!this.mapFn) throw new Error('No map function defined')
    const { result, head } = await this.crdt.changes(this.indexHead)
    console.log('result', result, head)
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

    const indexerMeta: Map<string, IdxMeta> = new Map()
    for (const [name, indexer] of this.crdt.indexers) {
      indexerMeta.set(name, { byId: indexer.byId.cid, byKey: indexer.byKey.cid, head: indexer.indexHead, map: indexer.mapFnString, name: indexer.name } as IdxMeta)
    }

    return await this.blocks.transaction(async (tblocks): Promise<IdxMeta> => {
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
    }, indexerMeta)
  }
}
