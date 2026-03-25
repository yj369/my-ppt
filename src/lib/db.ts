import Dexie, { type Table } from 'dexie'
import type { Project } from '../types/editor'

export class TarotDatabase extends Dexie {
  projects!: Table<Project>

  constructor() {
    super('TarotDB')
    this.version(1).stores({
      projects: 'id, name, updatedAt, createdAt',
    })
  }
}

export const db = new TarotDatabase()
