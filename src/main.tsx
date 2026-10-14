import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/providers'
import { env } from '@/shared/config/env'
import './index.css'

const rootElement = document.getElementById('root')

function getRootElement(): HTMLElement {
  if (!rootElement) {
    throw new Error('Elemento #root não encontrado no HTML.')
  }
  return rootElement
}

/**
 * Ordem importa: os mocks precisam estar interceptando a rede ANTES de o app
 * montar. Caso contrário o primeiro fetch e a primeira conexão de WebSocket
 * escapariam para a rede real.
 *
 * O `socket.io-client` também é importado só depois (dinamicamente, dentro de
 * `getMarketSocket`), porque o engine.io captura o construtor de `WebSocket` no
 * momento em que o módulo é avaliado.
 */
async function bootstrap(): Promise<void> {
  if (env.mocksEnabled) {
    const { startMocking } = await import('@/mocks/browser')
    await startMocking()
  }

  createRoot(getRootElement()).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
