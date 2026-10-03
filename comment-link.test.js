import assert from 'node:assert/strict'
import test from 'node:test'
import { createJiti } from 'jiti'

const { resolveCommentLink } = await createJiti(import.meta.url).import('./src/core/books/commentContent.ts')

test('source gallery links resolve to the same local gallery identifier', () => {
  for (const address of [
    'https://e-hentai.org/g/123/abcdef/',
    'http://exhentai.org/g/123/abcdef?p=2#comments',
    '//exhentai.org/g/123/abcdef/',
    '/g/123/abcdef/',
  ]) assert.equal(resolveCommentLink(address).bookId, '123/abcdef')
})

test('other pages and lookalike hosts remain copy-only links', () => {
  for (const address of [
    'https://e-hentai.org.evil.example/g/123/abcdef/',
    'https://example.org/g/123/abcdef/',
    'https://e-hentai.org:444/g/123/abcdef/',
    'https://e-hentai.org/s/abcdef/123-1',
    'https://e-hentai.org/g/123/abcdef/extra',
  ]) assert.equal(resolveCommentLink(address).bookId, undefined)
})

test('executable protocols and credential-bearing URLs are rejected', () => {
  for (const address of [
    'javascript:alert(1)',
    'data:text/html,hello',
    'file:///etc/passwd',
    'https://e-hentai.org@evil.example/g/123/abcdef/',
  ]) assert.equal(resolveCommentLink(address), undefined)
})
