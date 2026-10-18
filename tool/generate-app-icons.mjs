import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = new URL('../', import.meta.url)
const source = await readFile(new URL('src/assets/brand/app-icon.svg', root), 'utf8')
// Regular icons use a closer crop; adaptive icons keep the complete safe area.
const regular = source.replace('viewBox="0 0 512 512"', 'viewBox="42 42 428 428"')
await mkdir(new URL('public/icons/', root), { recursive: true })
await writeFile(new URL('public/favicon.svg', root), regular)

for (const size of [192, 512]) {
  // Keep the former SVG URLs consistent for existing installations as well.
  await writeFile(
    new URL(`public/pwa-${size}.svg`, root),
    regular.replace('width="512" height="512"', `width="${size}" height="${size}"`),
  )
}
for (const [path, size, svg] of [
  ['public/icons/icon-192.png', 192, regular],
  ['public/icons/icon-512.png', 512, regular],
  ['public/icons/icon-maskable-512.png', 512, source],
  ['public/apple-touch-icon.png', 180, regular],
]) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(fileURLToPath(new URL(path, root)))
}

// ICO contains real small raster sizes, rather than stretching one large bitmap.
const sizes = [16, 32, 48, 64]
const images = await Promise.all(
  sizes.map((size) => sharp(Buffer.from(regular)).resize(size, size).png().toBuffer()),
)
const directory = Buffer.alloc(6 + sizes.length * 16)
directory.writeUInt16LE(1, 2)
directory.writeUInt16LE(sizes.length, 4)
let offset = directory.length
for (const [index, png] of images.entries()) {
  const entry = 6 + index * 16
  directory[entry] = sizes[index]
  directory[entry + 1] = sizes[index]
  directory.writeUInt16LE(1, entry + 4)
  directory.writeUInt16LE(32, entry + 6)
  directory.writeUInt32LE(png.length, entry + 8)
  directory.writeUInt32LE(offset, entry + 12)
  offset += png.length
}
await writeFile(new URL('public/favicon.ico', root), Buffer.concat([directory, ...images]))
console.log('EViewer SVG, ICO, PNG, Apple touch and maskable icons generated.')
