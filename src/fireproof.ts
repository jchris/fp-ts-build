import { Database } from './database'

export class Fireproof {
  private static databases: Map<string, Database> = new Map()

  static database(name: string): Database {
    // Check if the database instance already exists for the given name
    if (Fireproof.databases.has(name)) {
      return Fireproof.databases.get(name)! // Return the existing instance
    }

    // Create a new instance if not found and store it in the map
    const db = new Database(name)
    Fireproof.databases.set(name, db)
    return db
  }

  static storage(name: string): Database {
    return new Database(name)
  }
}
