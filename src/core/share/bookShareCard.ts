import QRCode from 'qrcode'
import type { bookInfoOutput } from '@/core/model/book/bookInfoOutput'
import { getCategoryDisplayName } from '@/core/common/category'
import { resolveTagDisplayInfos } from '@/core/common/tagTranslations'

export type ShareQrSource = 'site' | 'source'

export interface GeneratedShareCard {
  blob: Blob
  targetUrl: string
  filename: string
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
  qrLabel: string
}

const CARD_WIDTH = 1200
const CARD_HEIGHT = 680
const CARD_FONT = '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif'

export async function generateBookShareCard(
  book: bookInfoOutput,
  source: ShareQrSource,
): Promise<GeneratedShareCard> {
  const data = await buildShareCardData(book, source)
  const qrCanvas = document.createElement('canvas')
  const [cover] = await Promise.all([
    loadCoverImage(data.coverUrl),
    QRCode.toCanvas(qrCanvas, data.targetUrl, {
      width: 164,
      margin: 1,
      color: { dark: '#152f32', light: '#ffffff' },
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
    cover?.close()
  }
}

async function buildShareCardData(
  book: bookInfoOutput,
  source: ShareQrSource,
): Promise<ShareCardData> {
  const normalizedBookId = book.bookId.trim().replace('-', '/')
  const sourceUrl = `https://e-hentai.org/g/${normalizedBookId}`
  const siteUrl = new URL('/bookinfo', window.location.origin)
  siteUrl.searchParams.set('bookId', book.bookId)

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
    targetUrl: source === 'source' ? sourceUrl : siteUrl.toString(),
    qrLabel: source === 'source' ? '源站' : '本站',
  }
}

async function loadCoverImage(url: string): Promise<ImageBitmap | null> {
  if (!url) return null

  try {
    const response = await fetch(url, { credentials: 'same-origin' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const blob = await response.blob()
    if (!blob.type.startsWith('image/')) throw new Error('封面返回内容不是图片')
    return await createImageBitmap(blob)
  } catch (error) {
    console.warn('分享卡封面读取失败，将使用占位图:', error)
    return null
  }
}

function drawShareCard(
  context: CanvasRenderingContext2D,
  data: ShareCardData,
  cover: ImageBitmap | null,
  qrCanvas: HTMLCanvasElement,
) {
  context.fillStyle = '#dfe8e6'
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  context.save()
  context.shadowColor = 'rgba(22, 48, 50, 0.18)'
  context.shadowBlur = 22
  context.shadowOffsetY = 8
  roundedRect(context, 20, 20, 1160, 640, 18)
  context.fillStyle = '#fbfcfa'
  context.fill()
  context.restore()

  context.save()
  roundedRect(context, 42, 42, 350, 596, 10)
  context.clip()
  if (cover) {
    drawImageCover(context, cover, 42, 42, 350, 596)
  } else {
    context.fillStyle = '#d5e0de'
    context.fillRect(42, 42, 350, 596)
    context.fillStyle = '#6b8584'
    context.font = `600 28px ${CARD_FONT}`
    context.textAlign = 'center'
    context.fillText('EViewer', 217, 324)
    context.font = `18px ${CARD_FONT}`
    context.fillText('封面暂不可用', 217, 360)
  }
  context.restore()

  context.strokeStyle = '#b7c8c5'
  context.lineWidth = 2
  context.setLineDash([8, 10])
  context.beginPath()
  context.moveTo(426, 46)
  context.lineTo(426, 634)
  context.stroke()
  context.setLineDash([])
  for (let y = 64; y <= 616; y += 36) {
    context.beginPath()
    context.fillStyle = '#dfe8e6'
    context.arc(426, y, 4, 0, Math.PI * 2)
    context.fill()
  }

  context.fillStyle = '#147a76'
  context.font = `700 22px ${CARD_FONT}`
  context.textAlign = 'left'
  context.fillText('EVIEWER', 470, 76)
  context.fillStyle = '#75908d'
  context.font = `600 14px ${CARD_FONT}`
  context.fillText('GALLERY PASS', 584, 75)

  context.fillStyle = '#173436'
  context.font = `700 40px ${CARD_FONT}`
  drawWrappedText(context, data.title, 470, 120, 660, 50, 2)

  const metaY = 238
  const metadata = [
    `${data.imageCount.toLocaleString()} 张`,
    data.category || '未分类',
    `评分 ${data.rating}`,
  ]
  let metaX = 470
  context.font = `600 18px ${CARD_FONT}`
  for (const item of metadata) {
    const width = Math.min(context.measureText(item).width + 30, 190)
    roundedRect(context, metaX, metaY, width, 40, 7)
    context.fillStyle = '#e7f0ee'
    context.fill()
    context.fillStyle = '#345c5b'
    context.fillText(trimToWidth(context, item, width - 28), metaX + 15, metaY + 27)
    metaX += width + 12
  }

  context.fillStyle = '#6e8583'
  context.font = `600 15px ${CARD_FONT}`
  context.fillText('TAGS', 470, 316)
  const shownTags = data.tags.slice(0, data.tags.length > 6 ? 5 : 6)
  let tagX = 470
  let tagY = 334
  context.font = `500 17px ${CARD_FONT}`
  for (const tag of shownTags) {
    const maxTagWidth = 210
    const label = trimToWidth(context, tag.text, maxTagWidth - 28)
    const width = Math.min(context.measureText(label).width + 28, maxTagWidth)
    if (tagX + width > 930) {
      tagX = 470
      tagY += 48
    }
    roundedRect(context, tagX, tagY, width, 36, 6)
    context.fillStyle = tag.official ? '#dcefeb' : '#edf0ef'
    context.fill()
    context.strokeStyle = tag.official ? '#8ebfba' : '#cbd3d1'
    context.lineWidth = 1
    context.stroke()
    context.fillStyle = tag.official ? '#176d69' : '#586967'
    context.fillText(label, tagX + 14, tagY + 24)
    tagX += width + 10
  }
  const hiddenTagCount = Math.max(0, data.tags.length - shownTags.length)
  if (hiddenTagCount > 0) {
    const label = `+${hiddenTagCount}`
    const width = context.measureText(label).width + 26
    if (tagX + width > 930) {
      tagX = 470
      tagY += 48
    }
    roundedRect(context, tagX, tagY, width, 36, 6)
    context.fillStyle = '#edf0ef'
    context.fill()
    context.fillStyle = '#586967'
    context.fillText(label, tagX + 13, tagY + 24)
  }

  context.fillStyle = '#78908e'
  context.font = `500 15px ${CARD_FONT}`
  context.fillText('语言', 470, 528)
  context.fillText('收藏', 670, 528)
  context.fillStyle = '#173436'
  context.font = `600 20px ${CARD_FONT}`
  context.fillText(trimToWidth(context, data.language, 165), 470, 556)
  context.fillText(data.favorited.toLocaleString(), 670, 556)

  roundedRect(context, 966, 404, 184, 210, 8)
  context.fillStyle = '#ffffff'
  context.fill()
  context.strokeStyle = '#d6e1df'
  context.stroke()
  context.drawImage(qrCanvas, 976, 414, 164, 164)
  context.fillStyle = '#54706e'
  context.font = `600 14px ${CARD_FONT}`
  context.textAlign = 'center'
  context.fillText(`二维码 · ${data.qrLabel}`, 1058, 599)

  context.textAlign = 'left'
  context.fillStyle = '#78908e'
  context.font = `500 15px ${CARD_FONT}`
  context.fillText('Powered by EViewer · @JKRaks', 470, 615)
  context.fillStyle = '#147a76'
  context.fillRect(470, 630, 180, 4)

  context.fillStyle = '#dfe8e6'
  for (const y of [20, 660]) {
    context.beginPath()
    context.arc(426, y, 14, 0, Math.PI * 2)
    context.fill()
  }
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
  image: ImageBitmap,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.width, height / image.height)
  const sourceWidth = width / scale
  const sourceHeight = height / scale
  context.drawImage(
    image,
    (image.width - sourceWidth) / 2,
    (image.height - sourceHeight) / 2,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  )
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
