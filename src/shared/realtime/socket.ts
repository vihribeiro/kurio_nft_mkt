import type { Socket } from 'socket.io-client'
import { env } from '@/shared/config/env'
import type { ClientToServerEvents, RealtimeStatus, ServerToClientEvents } from './contracts'

/**
 * Tipagem do socket: o primeiro parâmetro genérico são os eventos que o
 * cliente ESCUTA, o segundo os que ele EMITE.
 */
export type MarketSocket = Socket<ServerToClientEvents, ClientToServerEvents>

let pending: Promise<MarketSocket> | null = null

/**
 * Cria a conexão Socket.IO.
 *
 * A importação de `socket.io-client` é DINÂMICA e acontece somente aqui, já
 * com o MSW ativo. Motivo: o engine.io-client captura o construtor de
 * WebSocket no momento da avaliação do módulo
 * (`const WebSocketCtor = globalThis.WebSocket`). Se esse módulo fosse
 * avaliado antes de o MSW patchear `globalThis.WebSocket`, a conexão usaria o
 * construtor original e escaparia para a rede real — o mock nunca a veria.
 *
 * `transports: ['websocket']` é obrigatório: o binding de tempo real do MSW
 * intercepta apenas frames de WebSocket.
 */
export function createMarketSocket(): Promise<MarketSocket> {
  return import('socket.io-client').then(({ io }) =>
    io({
      path: env.socketPath,
      transports: ['websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3_000,
      timeout: 8_000,
    }),
  )
}

/** Socket compartilhado pelo app inteiro (singleton assíncrono). */
export function getMarketSocket(): Promise<MarketSocket> {
  pending ??= createMarketSocket().then((socket) => {
    if (import.meta.env.DEV) {
      // Exposição deliberada apenas para depuração via console do devtools.
      ;(window as Window & { __KURIO_SOCKET_DEBUG__?: MarketSocket }).__KURIO_SOCKET_DEBUG__ =
        socket
    }
    return socket
  })
  return pending
}

/**
 * Derruba o socket e zera o singleton.
 *
 * Chamado no logout / troca de usuário: nenhum dado do usuário anterior pode
 * sobreviver a uma troca de sessão.
 */
export async function disposeMarketSocket(): Promise<void> {
  if (!pending) return
  const socket = await pending.catch(() => undefined)
  pending = null
  if (!socket) return
  socket.removeAllListeners()
  socket.io.removeAllListeners()
  socket.disconnect()
}

/** Traduz os eventos crus do socket em um status de UI. */
export function subscribeToStatus(
  socket: MarketSocket,
  listener: (status: RealtimeStatus) => void,
): () => void {
  const onConnect = () => listener('connected')
  const onDisconnect = () => listener('disconnected')
  const onConnectError = () => listener('error')
  const onReconnectAttempt = () => listener('connecting')

  socket.on('connect', onConnect)
  socket.on('disconnect', onDisconnect)
  socket.on('connect_error', onConnectError)
  socket.io.on('reconnect_attempt', onReconnectAttempt)

  listener(socket.connected ? 'connected' : 'connecting')

  return () => {
    socket.off('connect', onConnect)
    socket.off('disconnect', onDisconnect)
    socket.off('connect_error', onConnectError)
    socket.io.off('reconnect_attempt', onReconnectAttempt)
  }
}
