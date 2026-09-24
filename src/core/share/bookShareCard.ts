import QRCode from 'qrcode'
import type { bookInfoOutput } from '@/core/model/book/bookInfoOutput'
import { getCategoryDisplayName } from '@/core/common/category'
import { resolveTagDisplayInfos } from '@/core/common/tagTranslations'
import { eurlEnum } from '@/core/common/enum/eurlEnum'
import type { ShareQrSource } from '@/core/share/shareSettings'

export type { ShareQrSource } from '@/core/share/shareSettings'

export interface GeneratedShareCard {
  blob: Blob
  targetUrl: string
  filename: string
}

export function getBookShareTargetUrl(bookId: string, source: ShareQrSource): string {
  const normalizedBookId = bookId.trim().replace('-', '/')
  if (source === 'source') return `https://e-hentai.org/g/${normalizedBookId}`
  const siteUrl = new URL('/bookinfo', window.location.origin)
  siteUrl.searchParams.set('bookId', bookId)
  return siteUrl.toString()
}

interface ShareTag {
  text: string
  official: boolean
}

interface ShareCardData {
  title: string
  coverUrl: string
  imageCount: number
  category: string
  rating: string
  language: string
  favorited: number
  tags: ShareTag[]
  targetUrl: string
}

interface CoverDrawable {
  image: CanvasImageSource
  width: number
  height: number
  dispose: () => void
}

const CARD_WIDTH = 1280
const CARD_HEIGHT = 680
const CARD_FONT = '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif'
const CARD_PRIMARY = '#409eff'
const CARD_PRIMARY_DARK = '#337ecc'
const CARD_TEXT = '#2c3e50'
const CARD_MUTED = '#6b7280'
const CARD_LINE = '#d9e2ef'
const COVER_CACHE_NAME = 'eviewer-share-covers-v1'
const MAX_CACHED_COVERS = 60

export async function generateBookShareCard(
  book: bookInfoOutput,
  source: ShareQrSource,
  pageCover?: HTMLImageElement | null,
): Promise<GeneratedShareCard> {
  const data = await buildShareCardData(book, source)
  const qrCanvas = document.createElement('canvas')
  const [cover] = await Promise.all([
    loadCoverImage(data.coverUrl, pageCover),
    QRCode.toCanvas(qrCanvas, data.targetUrl, {
      width: 190,
      margin: 1,
      color: { dark: '#26384f', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }),
  ])

  try {
    const canvas = document.createElement('canvas')
    canvas.width = CARD_WIDTH
    canvas.height = CARD_HEIGHT
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('当前浏览器无法创建分享图片')
    }

    drawShareCard(context, data, cover, qrCanvas)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result)
        else reject(new Error('分享图片导出失败'))
      }, 'image/png')
    })

    return {
      blob,
      targetUrl: data.targetUrl,
      filename: `EViewer-${sanitizeFilename(data.title)}.png`,
    }
  } finally {
    cover?.dispose()
  }
}

async function buildShareCardData(
  book: bookInfoOutput,
  source: ShareQrSource,
): Promise<ShareCardData> {

  const tagInputs = book.tags.flatMap((collection) =>
    collection.items.map((tag) => ({ collection: collection.collection, tag })),
  )
  const translatedTags = await resolveTagDisplayInfos(tagInputs)
  const tags = tagInputs
    .map(({ tag }, index) => ({
      text: translatedTags[index]?.text ?? tag.name,
      official: tag.official,
    }))
    .sort((left, right) => Number(right.official) - Number(left.official))

  return {
    title: book.bookName || '未命名画册',
    coverUrl: book.coverImage,
    imageCount: book.imageCount,
    category: getCategoryDisplayName(book.category),
    rating: book.rating || '0.0',
    language: book.language || '未知',
    favorited: book.favorited,
    tags,
    targetUrl: getBookShareTargetUrl(book.bookId, source),
  }
}

async function loadCoverImage(
  url: string,
  pageCover?: HTMLImageElement | null,
): Promise<CoverDrawable | null> {
  if (!url) return null

  const pageImageBlob = await extractPageCoverBlob(pageCover)
  if (pageImageBlob) {
    void cacheCoverBlob(url, pageImageBlob)
    return await createCoverDrawable(pageImageBlob)
  }

  try {
    if ('caches' in globalThis) {
      const cache = await caches.open(COVER_CACHE_NAME)
      const cachedResponse = await cache.match(url)
      if (cachedResponse) {
        const cachedCover = await createCoverDrawable(await cachedResponse.blob())
        if (cachedCover) return cachedCover
      }
    }
  } catch (error) {
    console.debug('浏览器缓存中没有可复用的封面 Blob:', error)
  }

  try {
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      cache: 'force-cache',
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const blob = await response.blob()
    const cover = await createCoverDrawable(blob)
    if (cover) {
      void cacheCoverBlob(url, blob)
      return cover
    }
  } catch (error) {
    console.debug(`封面跨域读取失败: ${url}`, error)
  }

  try {
    const proxyOrigin = new URL(eurlEnum.EH, window.location.origin).origin
    const proxyUrl = new URL('/image-proxy', proxyOrigin)
    proxyUrl.searchParams.set('url', url)
    const response = await fetch(proxyUrl, {
      credentials: 'omit',
      cache: 'force-cache',
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const blob = await response.blob()
    const cover = await createCoverDrawable(blob)
    if (cover) {
      void cacheCoverBlob(url, blob)
      return cover
    }
  } catch (error) {
    console.debug(`封面代理读取失败: ${url}`, error)
  }

  console.warn('分享卡无法读取封面，将使用占位图:', url)
  return null
}

async function extractPageCoverBlob(pageCover?: HTMLImageElement | null): Promise<Blob | null> {
  if (!pageCover?.complete || !pageCover.naturalWidth || !pageCover.naturalHeight) return null

  try {
    const maxWidth = 1200
    const scale = Math.min(1, maxWidth / pageCover.naturalWidth)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(pageCover.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(pageCover.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(pageCover, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result)
        else reject(new Error('页面封面 Blob 提取失败'))
      }, 'image/png')
    })
    return blob
  } catch (error) {
    console.debug('页面封面受跨域保护，改用网络 Blob:', error)
    return null
  }
}

async function cacheCoverBlob(url: string, blob: Blob) {
  if (!('caches' in globalThis) || !/^https?:/i.test(url)) return

  try {
    const cache = await caches.open(COVER_CACHE_NAME)
    await cache.put(
      url,
      new Response(blob, {
        headers: { 'Content-Type': blob.type || 'image/jpeg' },
      }),
    )
    const keys = await cache.keys()
    const excessKeys = keys.slice(0, Math.max(0, keys.length - MAX_CACHED_COVERS))
    await Promise.all(excessKeys.map((key) => cache.delete(key)))
  } catch (error) {
    console.debug('写入前端封面缓存失败:', error)
  }
}

async function createCoverDrawable(blob: Blob): Promise<CoverDrawable | null> {
  if (!blob.type.startsWith('image/')) return null

  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob)
    return {
      image: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      dispose: () => bitmap.close(),
    }
  }

  const objectUrl = URL.createObjectURL(blob)
  const image = new Image()
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('封面 Blob 解码失败'))
      image.src = objectUrl
    })
    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      dispose: () => URL.revokeObjectURL(objectUrl),
    }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }
}

function drawShareCard(
  context: CanvasRenderingContext2D,
  data: ShareCardData,
  cover: CoverDrawable | null,
  qrCanvas: HTMLCanvasElement,
) {
  context.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  context.save()
  context.shadowColor = 'rgba(64, 158, 255, 0.18)'
  context.shadowBlur = 20
  context.shadowOffsetY = 8
  roundedRect(context, 20, 20, 1240, 640, 18)
  context.fillStyle = '#ffffff'
  context.fill()
  context.restore()

  context.save()
  roundedRect(context, 42, 42, 420, 596, 10)
  context.clip()
  if (cover) {
    drawImageCover(context, cover, 42, 42, 420, 596)
  } else {
    context.fillStyle = '#eef3f9'
    context.fillRect(42, 42, 420, 596)
    context.fillStyle = CARD_PRIMARY
    context.font = `600 28px ${CARD_FONT}`
    context.textAlign = 'center'
    context.fillText('EViewer', 252, 324)
    context.font = `18px ${CARD_FONT}`
    context.fillText('封面暂不可用', 252, 360)
  }
  context.restore()

  context.save()
  context.globalCompositeOperation = 'destination-out'
  for (let y = 64; y <= 616; y += 36) {
    context.beginPath()
    context.arc(490, y, 2.5, 0, Math.PI * 2)
    context.fill()
  }
  for (const y of [20, 660]) {
    context.beginPath()
    context.arc(490, y, 12, 0, Math.PI * 2)
    context.fill()
  }
  context.restore()

  context.strokeStyle = CARD_LINE
  context.lineWidth = 1
  context.setLineDash([3, 7])
  context.beginPath()
  context.moveTo(490, 46)
  context.lineTo(490, 634)
  context.stroke()
  context.setLineDash([])

  context.fillStyle = CARD_PRIMARY
  context.font = `700 22px ${CARD_FONT}`
  context.textAlign = 'left'
  context.fillText('EVIEWER', 530, 76)
  context.fillStyle = CARD_MUTED
  context.font = `600 14px ${CARD_FONT}`
  context.fillText('GALLERY PASS', 644, 75)

  context.fillStyle = CARD_TEXT
  context.font = `700 40px ${CARD_FONT}`
  drawWrappedText(context, data.title, 530, 120, 690, 50, 2)

  const metaY = 238
  const metadata = [
    `${data.imageCount.toLocaleString()} 张`,
    data.category || '未分类',
    `评分 ${data.rating}`,
  ]
  let metaX = 530
  context.font = `600 18px ${CARD_FONT}`
  for (const item of metadata) {
    const width = Math.min(context.measureText(item).width + 30, 190)
    roundedRect(context, metaX, metaY, width, 40, 7)
    context.fillStyle = '#edf3fb'
    context.fill()
    context.fillStyle = CARD_PRIMARY_DARK
    context.fillText(trimToWidth(context, item, width - 28), metaX + 15, metaY + 27)
    metaX += width + 12
  }

  context.fillStyle = CARD_MUTED
  context.font = `600 15px ${CARD_FONT}`
  context.fillText('TAGS', 530, 316)
  const shownTags = data.tags.slice(0, data.tags.length > 6 ? 5 : 6)
  let tagX = 530
  let tagY = 334
  context.font = `500 17px ${CARD_FONT}`
  for (const tag of shownTags) {
    const maxTagWidth = 220
    const label = trimToWidth(context, tag.text, maxTagWidth - 28)
    const width = Math.min(context.measureText(label).width + 28, maxTagWidth)
    if (tagX + width > 1000) {
      tagX = 530
      tagY += 48
    }
    roundedRect(context, tagX, tagY, width, 36, 6)
    context.fillStyle = tag.official ? '#eaf1fb' : '#f2f4f7'
    context.fill()
    context.strokeStyle = tag.official ? '#9db9df' : '#d5dae1'
    context.lineWidth = 1
    context.stroke()
    context.fillStyle = tag.official ? CARD_PRIMARY : '#596579'
    context.fillText(label, tagX + 14, tagY + 24)
    tagX += width + 10
  }
  const hiddenTagCount = Math.max(0, data.tags.length - shownTags.length)
  if (hiddenTagCount > 0) {
    const label = `+${hiddenTagCount}`
    const width = context.measureText(label).width + 26
    if (tagX + width > 1000) {
      tagX = 530
      tagY += 48
    }
    roundedRect(context, tagX, tagY, width, 36, 6)
    context.fillStyle = '#f2f4f7'
    context.fill()
    context.fillStyle = '#596579'
    context.fillText(label, tagX + 13, tagY + 24)
  }

  context.fillStyle = CARD_MUTED
  context.font = `500 15px ${CARD_FONT}`
  context.fillText('语言', 530, 528)
  context.fillText('收藏', 760, 528)
  context.fillStyle = CARD_TEXT
  context.font = `600 20px ${CARD_FONT}`
  context.fillText(trimToWidth(context, data.language, 190), 530, 556)
  context.fillText(data.favorited.toLocaleString(), 760, 556)

  context.drawImage(qrCanvas, 1040, 394, 190, 190)

  context.strokeStyle = CARD_LINE
  context.lineWidth = 1
  context.beginPath()
  context.moveTo(530, 602)
  context.lineTo(1230, 602)
  context.stroke()
  context.textAlign = 'left'
  context.fillStyle = CARD_MUTED
  context.font = `500 14px ${CARD_FONT}`
  context.fillText('Powered By EViewer · @JKRaks', 530, 630)
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const lines: string[] = []
  let current = ''
  let truncated = false
  for (const character of text) {
    const candidate = current + character
    if (current && context.measureText(candidate).width > maxWidth) {
      if (lines.length === maxLines - 1) {
        truncated = true
        break
      }
      lines.push(current)
      current = character
    } else {
      current = candidate
    }
  }
  if (current && lines.length < maxLines) lines.push(current)

  const consumedLength = lines.join('').length
  if ((truncated || consumedLength < text.length) && lines.length) {
    lines[lines.length - 1] = trimToWidth(context, `${lines.at(-1)}…`, maxWidth)
  }
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight))
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  cover: CoverDrawable,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = width / cover.width
  const renderedHeight = cover.height * scale
  if (renderedHeight >= height) {
    const sourceHeight = height / scale
    context.drawImage(
      cover.image,
      0,
      (cover.height - sourceHeight) / 2,
      cover.width,
      sourceHeight,
      x,
      y,
      width,
      height,
    )
    return
  }

  context.fillStyle = '#eef3f9'
  context.fillRect(x, y, width, height)
  context.drawImage(cover.image, x, y + (height - renderedHeight) / 2, width, renderedHeight)
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + safeRadius, y)
  context.lineTo(x + width - safeRadius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius)
  context.lineTo(x + width, y + height - safeRadius)
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height)
  context.lineTo(x + safeRadius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius)
  context.lineTo(x, y + safeRadius)
  context.quadraticCurveTo(x, y, x + safeRadius, y)
  context.closePath()
}

function trimToWidth(context: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (context.measureText(text).width <= maxWidth) return text
  let result = text
  while (result && context.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1)
  }
  return `${result}…`
}

function sanitizeFilename(title: string): string {
  const safe = title
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  return (safe || 'gallery').slice(0, 80)
}
