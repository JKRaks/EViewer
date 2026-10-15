import { fileURLToPath, URL } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// https://vite.dev/config/
export default defineConfig({
  build: {
    sourcemap: true,
  },
  server: {
    sourcemapIgnoreList: false,
  },
  worker: {
    format: 'es',
  },
  plugins: [
    {
      name: 'deployment-revision',
      apply: 'build',
      async generateBundle() {
        let revision = 'unknown'
        try {
          const result = await promisify(execFile)('git', ['rev-parse', 'HEAD'], {
            cwd: fileURLToPath(new URL('.', import.meta.url)),
            encoding: 'utf8',
          })
          revision = result.stdout.trim()
        } catch {
          // ZIP checkouts can still build; publishing requires a Git revision.
        }
        this.emitFile({
          type: 'asset',
          fileName: 'deployment.json',
          source: JSON.stringify({ revision }),
        })
      },
    },
    vue(),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'EViewer',
        short_name: 'EViewer',
        description: 'EH Photo Viewer',
        theme_color: '#2b5ca8',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/pwa-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico,png,webp,json}'],
        globIgnores: [
          'deployment.json',
          '**/tagTranslation.worker-*.js',
          '**/unofficialTagTranslations-*.js',
        ],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/(?:tagTranslation\.worker|unofficialTagTranslations)-[^/]+\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tag-translation-data',
              expiration: {
                maxEntries: 4,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
