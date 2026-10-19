import { fileURLToPath, URL } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  define: {
    __VUE_I18N_FULL_INSTALL__: false,
    __VUE_I18N_LEGACY_API__: false,
    __INTLIFY_PROD_DEVTOOLS__: false,
  },
  build: {
    sourcemap: false,
  },
  server: {
    sourcemapIgnoreList: false,
  },
  worker: {
    format: 'es',
  },
  plugins: [
    {
      name: 'nonblocking-launch-styles',
      apply: 'build',
      transformIndexHtml: {
        order: 'post',
        handler: (html) =>
          html.replace(
            /<link rel="stylesheet"([^>]+)>/g,
            '<link rel="preload" as="style"$1 data-launch-style onload="this.onload=null;this.rel=\'stylesheet\'" onerror="this.dataset.failed=\'true\';window.__eviewerLaunch?.fail()">',
          ),
      },
    },
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
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Register after the first page is revealed, so precaching cannot compete with it.
      injectRegister: null,
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'EViewer',
        short_name: 'EViewer',
        description: 'EViewer gallery reader',
        theme_color: '#fafafa',
        background_color: '#fafafa',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        sourcemap: false,
        // API/script navigations must reach the Worker, including after PWA installation.
        navigateFallbackDenylist: [
          /^\/auth(?:\/|$)/,
          /^\/(?:ehentai|exhentai)(?:\/|$)/,
          /^\/hentaiverse\//,
          /^\/(?:image-proxy|health)(?:\/|$)/,
        ],
        globPatterns: ['**/*.{js,css,html,svg,ico,png,webp,json}'],
        globIgnores: [
          'deployment.json',
          '**/tagTranslation.worker-*.js',
          '**/unofficialTagTranslations-*.js',
          '**/interface-fonts-*.css',
        ],
        runtimeCaching: [
          {
            urlPattern:
              /\/assets\/(?:(?:SmileySans-|AlibabaPuHuiTi3-)[^/]+\.woff2|interface-fonts-[^/]+\.css)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'interface-font',
              expiration: { maxEntries: 28, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
          },
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
