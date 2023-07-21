import { Database } from './database'
export class Fireproof {
  static storage(name: string): Database {
    return new Database(name)
  }
}
