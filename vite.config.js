import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

export default defineConfig({
  plugins: [
    crx({ manifest }),
    {
      // CRXJS emits a standalone IIFE for injection and an unused module entry.
      name: 'omit-duplicate-content-module',
      enforce: 'post',
      generateBundle(_, bundle) {
        for (const chunk of Object.values(bundle)) {
          if (chunk.type === 'chunk' && chunk.facadeModuleId?.endsWith('/src/content/index.js')) {
            delete bundle[chunk.fileName]
          }
        }
      },
    },
  ],
})
