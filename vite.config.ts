import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Formato mínimo de um chunk do bundle (evita depender dos tipos do bundler). */
interface BundleChunk {
  fileName: string
  facadeModuleId?: string | null
  imports: string[]
}

/**
 * Otimizações de carregamento no build.
 *
 * 1. **Inline do CSS.** O build emite um único CSS atrás de um `<link>`
 *    render-blocking (~450 ms em 4G simulado). Embutir no HTML elimina a
 *    ida-e-volta sem risco de FOUC.
 *
 * 2. **Preload do chunk do backend simulado.** O app só pode buscar dados
 *    depois que o MSW está ativo, e isso cria uma corrente SERIAL:
 *    bundle principal → chunk do MSW (~170 kB gzip) → dados. Um
 *    `<link rel="modulepreload">` dispara o download do chunk em PARALELO com
 *    o bundle principal, tirando esse peso do caminho crítico.
 */
function loadOptimizations(): Plugin {
  /** Coleta um chunk e todas as suas dependências estáticas. */
  function withImports(
    bundle: Record<string, BundleChunk | undefined>,
    chunk: BundleChunk,
  ): BundleChunk[] {
    const seen = new Set<string>()
    const out: BundleChunk[] = []

    const walk = (current: BundleChunk): void => {
      if (seen.has(current.fileName)) return
      seen.add(current.fileName)
      out.push(current)
      for (const imported of current.imports) {
        const next = bundle[imported]
        if (next) walk(next)
      }
    }

    walk(chunk)
    return out
  }

  return {
    name: 'kurio-load-optimizations',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle
        if (!bundle) return html

        const chunks: Record<string, BundleChunk | undefined> = {}

        for (const [fileName, output] of Object.entries(bundle)) {
          if (output.type === 'asset') {
            if (!fileName.endsWith('.css')) continue

            const css =
              typeof output.source === 'string'
                ? output.source
                : new TextDecoder().decode(output.source)
            const file = path.basename(fileName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            html = html.replace(new RegExp(`<link[^>]*${file}[^>]*>`, 'g'), `<style>${css}</style>`)
            continue
          }

          chunks[fileName] = {
            fileName: output.fileName,
            facadeModuleId: output.facadeModuleId,
            imports: output.imports,
          }
        }

        // 2) Preload do backend simulado (MSW) e suas dependências.
        const mockEntry = Object.values(chunks).find((chunk) =>
          chunk?.facadeModuleId?.includes('/mocks/browser'),
        )

        if (mockEntry) {
          const existing = new Set(
            [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]),
          )
          const links = withImports(chunks, mockEntry)
            .filter((chunk) => !existing.has(`/${chunk.fileName}`))
            .map((chunk) => `<link rel="modulepreload" crossorigin href="/${chunk.fileName}">`)
            .join('')
          html = html.replace('</head>', `${links}</head>`)
        }

        return html
      },
    },
  } satisfies Plugin
}

export default defineConfig({
  plugins: [react(), tailwindcss(), loadOptimizations()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
  },
})
