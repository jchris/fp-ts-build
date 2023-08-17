/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { useEffect, useState, useCallback, createContext } from 'react'

import { Database, database as obtainDb } from './database'
// Log the entire module to see its structure

import type { Doc, DocFragment } from './types'
import { Index, index as obtainIdx } from './index'
console.log('Database', Database, obtainDb)

export interface FireproofCtxValue {
  database: Database;
  useLiveQuery: (mapFn: (doc: Doc, map: (key: string, value: DocFragment) => void) => DocFragment | string, query: object, initialRows: any[]) => { docs: Doc[], rows: any[] };
  useDocument: (initialDoc: Doc) => [Doc, (newDoc: Doc) => void, () => Promise<void>]
  ready: boolean;
}

export const FireproofCtx = createContext<FireproofCtxValue>({} as FireproofCtxValue)

/**
 * Top level hook to initialize a Fireproof database and a query for it.
 * Uses default db name 'useFireproof'.
 */
// @ts-ignore
const topLevelUseLiveQuery = (...args) => {
  const { useLiveQuery, database } = useFireproof()
  // @ts-ignore
  topLevelUseLiveQuery.database = database
  // @ts-ignore
  return useLiveQuery(...args)
}

export const useLiveQuery = topLevelUseLiveQuery

/**
 * Top level hook to initialize a Fireproof database and a document for it.
 * Uses default db name 'useFireproof'.
 */
// @ts-ignore
const topLevelUseLiveDocument = (...args) => {
  const { useDocument, database } = useFireproof()
  // @ts-ignore
  topLevelUseLiveQuery.database = database
  // @ts-ignore
  return useDocument(...args)
}

export const useDocument = topLevelUseLiveDocument

export function useFireproof(
  name = 'useFireproof',
  setupDatabaseFn: null | ((db: Database) => Promise<void>) = null,
  config = {}
): FireproofCtxValue {
  console.log('useFireproof', name, setupDatabaseFn)

  const testDb = obtainDb('test')
  console.log('testDb', testDb)

  const [ready, setReady] = useState(false)
  const database = obtainDb(name, config)

  useEffect(() => {
    const doSetup = async () => {
      if (ready) return
      setReady(true)
      if (setupDatabaseFn) {
        const chs = await database.changes([])
        if (chs.rows.length === 0) {
          await setupDatabaseFn(database)
        }
      }
    }
    void doSetup()
  }, [name])

  function useDocument(initialDoc: Doc): [Doc, (newDoc: Doc) => void, () => Promise<void>] {
    const id = initialDoc._id
    const [doc, setDoc] = useState(initialDoc)

    const saveDoc = useCallback(
      async () => {
        const putDoc = id ? { ...doc, _id: id } : doc
        await database.put(putDoc)
      },
      [id, doc]
    )

    const refreshDoc = useCallback(async () => {
      // todo add option for mvcc checks
      if (id) { setDoc(await database.get(id).catch(() => initialDoc)) }
    }, [id, initialDoc])

    useEffect(
      <React.EffectCallback>(() =>
        database.subscribe((docs: Doc[]) => {
          console.log('docs', docs)
          const found = docs.find((c) => c._id === id)
          if (found) {
            setDoc(found)
          }
        })),
      [id, refreshDoc]
    )

    useEffect(() => {
      refreshDoc()
    }, [])

    return [
      doc,
      (newDoc: Doc) => {
        if (newDoc) {
          return setDoc((d: Doc) => {
            return ({ ...d, ...newDoc } as Doc)
          })
        } else return setDoc(initialDoc)
      },
      saveDoc
    ]
  }

  function useLiveQuery(mapFn: (doc: Doc, map: (key: string, value: DocFragment) => void) => DocFragment | string, query = {}, initialRows: any[] = []) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const [result, setResult] = useState({
      rows: initialRows,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      docs: initialRows.map((r) => r.doc as Doc)
    })
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const [index, setIndex] = useState<Index | null>(null)

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const refreshRows = useCallback(async () => {
      if (index) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const res = await index.query(query)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        setResult({ ...res, docs: res.rows.map((r) => r.doc as Doc) })
      }
    }, [index, JSON.stringify(query)])

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    useEffect(
      <React.EffectCallback>(() =>
        database.subscribe(() => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          refreshRows()
        })),
      [database, refreshRows]
    )

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    useEffect(() => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      refreshRows()
    }, [index])

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    useEffect(() => {
      if (typeof mapFn === 'string') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        setIndex(obtainIdx(database, mapFn))
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        setIndex(obtainIdx(database, makeName(mapFn.toString()), mapFn))
      }
    }, [mapFn.toString()])

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return result
  }

  return {
    useLiveQuery,
    // useLiveDocument : useDocument,
    useDocument,
    database,
    ready
  }
}

function makeName(fnString: string) {
  const regex = /\(([^,()]+,\s*[^,()]+|\[[^\]]+\],\s*[^,()]+)\)/g
  let found: RegExpExecArray | null = null
  const matches = Array.from(fnString.matchAll(regex), match => match[1].trim())
  if (matches.length === 0) {
    found = /=>\s*(.*)/.exec(fnString)
  }
  if (!found) {
    return fnString
  } else {
    // it's a consise arrow function, match everythign after the arrow
    return found[1]
  }
}
