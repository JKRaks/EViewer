import { bookItem } from '@/core/model/book/bookOutput'

const storageKey = 'eviewer:gallery-list-session:v1'

export interface GalleryListSession {
  key: string
  books: bookItem[]
  requestCursor?: number
  nextCursor?: number
  previousCursor?: number
  totalCount?: number
  moreError: string
  scrollTop: number
  anchor?: { bookId: string; offset: number }
}

/** Keep one complete search in this tab; never restore a cursor without its preceding items. */
export function saveGalleryListSession(session: GalleryListSession) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(session))
  } catch {
    // A full/disabled session store must not affect the in-memory list or restore an older cursor.
    clearGalleryListSession()
  }
}

export function readGalleryListSession(key: string): GalleryListSession | undefined {
  try {
    const stored = sessionStorage.getItem(storageKey)
    if (!stored) return
    const session = JSON.parse(stored) as GalleryListSession
    if (session.key !== key) return
    if (
      !Array.isArray(session.books) ||
      !session.books.every(
        (book) => book && typeof book.bookId === 'string' && Array.isArray(book.tags),
      ) ||
      ![
        session.requestCursor,
        session.nextCursor,
        session.previousCursor,
        session.totalCount,
      ].every((value) => value === undefined || (Number.isSafeInteger(value) && value >= 0)) ||
      !Number.isFinite(session.scrollTop) ||
      session.scrollTop < 0 ||
      typeof session.moreError !== 'string' ||
      (session.anchor &&
        (typeof session.anchor.bookId !== 'string' || !Number.isFinite(session.anchor.offset)))
    )
      return
    session.books = session.books.map((book) =>
      Object.assign(new bookItem(), book, {
        publishDate: book.publishDate ? new Date(book.publishDate) : undefined,
      }),
    )
    return session
  } catch {
    clearGalleryListSession()
  }
}

export function clearGalleryListSession() {
  try {
    sessionStorage.removeItem(storageKey)
  } catch {
    // Optional tab storage.
  }
}
