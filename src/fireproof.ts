import { Database } from './database'

export class Fireproof {
  static databases: Map<string, Database> = new Map()

  static database(name: string): Database {
    if (!Fireproof.databases.has(name)) {
      Fireproof.databases.set(name, new Database(name))
    }
    return Fireproof.databases.get(name)!
  }

  static storage(name: string): Database {
    return new Database(name)
  }
}

export function database(name: string): Database {
  return Fireproof.database(name)
}
