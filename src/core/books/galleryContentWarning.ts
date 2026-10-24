import { connectionSettings, galleryOrigin } from '../connector/connectionSettings'

const acceptedGalleries = new Set<string>()

function warningKey(bookId: string) {
  return `${connectionSettings.mode}:${connectionSettings.site}:${bookId.replace('-', '/').replace(/\/$/, '')}`
}

export function acceptGalleryWarning(bookId: string) {
  acceptedGalleries.add(warningKey(bookId))
}

export function hasAcceptedGalleryWarning(bookId: string) {
  return acceptedGalleries.has(warningKey(bookId))
}

/** Only recognize the source's warning with a continuation link to this same gallery. */
export function readGalleryContentWarning(
  body: Element | null,
  bookId: string,
): string[] | undefined {
  const heading = Array.from(body?.querySelectorAll('h1') || []).find(
    (node) => node.textContent?.trim().toLowerCase() === 'content warning',
  )
  const container = heading?.parentElement
  if (!container) return
  const target = new URL(`/g/${bookId.replace('-', '/').replace(/\/$/, '')}/`, galleryOrigin())
  const continuation = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href]')).some(
    (link) => {
      try {
        const url = new URL(link.getAttribute('href')!, target)
        return (
          url.origin === target.origin &&
          url.pathname.replace(/\/$/, '') === target.pathname.replace(/\/$/, '') &&
          url.searchParams.get('nw') === 'session'
        )
      } catch {
        return false
      }
    },
  )
  if (!continuation) return
  return Array.from(container.querySelectorAll('p'))
    .filter((node) => !node.querySelector('a'))
    .map((node) => node.textContent?.trim() || '')
    .filter(Boolean)
}
