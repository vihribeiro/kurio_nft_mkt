import { env } from '@/shared/config/env'

/**
 * Origem raiz (esquema + host) para o padrão do handler de WebSocket.
 *
 * O cliente Socket.IO conecta em `/socket.io` na MESMA origem (`io({ path })`).
 * O MSW, porém, remove o prefixo `/socket.io/` da URL do cliente ANTES de casar
 * o handler (ver `WebSocketHandler.parse`): a URL efetiva vira `ws(s)://<host>/`.
 * Por isso o handler usa o padrão de raiz — e não `ws(s)://<host>/socket.io`,
 * que nunca casaria.
 */
export function marketSocketRootEndpoint(): string {
  const origin =
    typeof window !== 'undefined'
      ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
      : 'ws://localhost'

  return `${origin}/`
}

/** Só para leitura/registro: caminho do endpoint usado pelo cliente. */
export function marketSocketClientPath(): string {
  return env.socketPath
}
