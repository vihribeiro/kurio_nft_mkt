import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)

/**
 * Liga a interceptação de rede (HTTP + WebSocket) no navegador.
 *
 * Precisa resolver ANTES de o app montar: se o socket conectasse primeiro, a
 * conexão escaparia para a rede real.
 */
export async function startMocking(): Promise<void> {
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
  })
}
