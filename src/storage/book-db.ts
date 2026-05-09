import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { EpubBook } from '../epub/load-epub'

type BookRecord = {
  id: string
  title: string
  updatedAt: number
  book: EpubBook
}

type LineFlashDb = DBSchema & {
  books: {
    key: string
    value: BookRecord
    indexes: {
      updatedAt: number
    }
  }
}

export class BookDb {
  private dbPromise: Promise<IDBPDatabase<LineFlashDb>> | null = null

  async saveBook(book: EpubBook): Promise<void> {
    const db = await this.open()
    await db.put('books', {
      id: book.id,
      title: book.title,
      updatedAt: Date.now(),
      book,
    })
  }

  async getBook(id: string): Promise<EpubBook | null> {
    const db = await this.open()
    const record = await db.get('books', id)
    return record?.book ?? null
  }

  async listBooks(): Promise<Array<{ id: string; title: string; updatedAt: number }>> {
    const db = await this.open()
    const records = await db.getAll('books')
    return records
      .map((record) => ({ id: record.id, title: record.title, updatedAt: record.updatedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async clear(): Promise<void> {
    const db = await this.open()
    await db.clear('books')
  }

  private open(): Promise<IDBPDatabase<LineFlashDb>> {
    this.dbPromise ??= openDB<LineFlashDb>('lineflash-reader', 1, {
      upgrade(db) {
        const store = db.createObjectStore('books', { keyPath: 'id' })
        store.createIndex('updatedAt', 'updatedAt')
      },
    })
    return this.dbPromise
  }
}
