import { createContext, useContext, useEffect } from 'react'
import type { RealtimeStatus } from '@/shared/realtime/contracts'
import type { MarketSocket } from '@/shared/realtime/socket'

/**
 * Contexto e hooks do canal de tempo real, separados do provedor (mesmo motivo
 * do contexto de sessão: um export por arquivo de componente).
 */

export interface RealtimeContextValue {
  socket: MarketSocket | null
  status: RealtimeStatus
}

export const RealtimeContext = createContext<RealtimeContextValue | null>(null)

export function useRealtime(): RealtimeContextValue {
  const value = useContext(RealtimeContext)
  if (!value) throw new Error('useRealtime precisa estar dentro de <RealtimeProvider>.')
  return value
}

/**
 * Assina os preços de um conjunto de NFTs enquanto o componente estiver vivo.
 *
 * A identidade do conjunto é o `key` (string estável). Comparar arrays por
 * referência faria o efeito rodar em todo render, gerando um vaivém de
 * `subscribe`/`unsubscribe` na rede.
 */
export function useMarketSubscription(nftIds: readonly string[]): void {
  const { socket } = useRealtime()
  const key = nftIds.join('|')

  useEffect(() => {
    if (!socket) return

    const ids = key.split('|').filter(Boolean)
    if (ids.length === 0) return

    const subscribe = (): void => {
      socket.emit('market:subscribe', { nftIds: ids })
    }
    socket.on('connect', subscribe)
    if (socket.connected) subscribe()

    return () => {
      socket.off('connect', subscribe)
      if (socket.connected) socket.emit('market:unsubscribe', { nftIds: ids })
    }
  }, [socket, key])
}
