import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createJiti } from 'jiti'

const jiti = createJiti(import.meta.url, {
  alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
})
const { galleryFavoriteUpdateInput } = await jiti.import('./src/core/model/book/favoriteInput.ts')

test('gallery favorite submissions include the source form update flag', () => {
  for (const category of ['0', '9', 'favdel']) {
    const input = new galleryFavoriteUpdateInput('123/example', category, 'A&B', 'Apply Changes')
    const form = new URLSearchParams(input.getRequestData())
    assert.equal(input.getMethod(), 'POST')
    assert.equal(form.get('update'), '1')
    assert.equal(form.get('favcat'), category)
    assert.equal(form.get('favnote'), 'A&B')
  }
})
