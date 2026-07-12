import { parserClass } from './parserClass'
import { tagCollection, tagItem } from '../model/book/tag'

/** 将标签表格行解析为统一标签模型。 */
export function parseTagCollections(rows: parserClass[]): tagCollection[] {
  const collections: tagCollection[] = []

  for (const row of rows) {
    const collectionName = row.getElementBySelector(['td.tc']).text.replace(/:$/, '').trim()
    if (!collectionName) {
      continue
    }

    const collection = new tagCollection()
    collection.collection = collectionName

    for (const tagElement of row.getElementsBySelector(['td', 'div'])) {
      const name = tagElement.text.trim()
      if (!name) {
        continue
      }

      const tag = new tagItem()
      tag.name = name
      tag.official = tagElement
        .attribute('class')
        .split(/\s+/)
        .includes('gt')
      collection.items.push(tag)
    }

    if (collection.items.length > 0) {
      collections.push(collection)
    }
  }

  return collections
}
