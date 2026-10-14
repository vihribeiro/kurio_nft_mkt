import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys, type CatalogFilters } from '@/shared/api/query-keys'
import type {
  CartReservationExpiredPayload,
  NftUpdatedPayload,
  OrderUpdatedPayload,
  RealtimeStatus,
} from '@/shared/realtime/contracts'
import { getMarketSocket, subscribeToStatus, type MarketSocket } from '@/shared/realtime/socket'
import { applyNftUpdateToCache } from '@/features/catalog/api'
import { useSession } from '@/features/auth/session-context'
import type { Order } from '@/shared/contracts/order'
import { RealtimeContext, type RealtimeContextValue } from './realtime-context'
/**
 * Canal de tempo real do app.
 *
 * Uma única conexão serve todo mundo. O que muda por usuário é a
 * AUTENTICAÇÃO da conexão (`session:authenticate`) — é isso que permite ao
 * servidor saber para quem emitir evento de pedido/carrinho.
 *
 * O feed de preços é público: funciona também para visitante, então o socket
 * sobe mesmo sem login.
 *
 * Princípio central: **evento de tempo real nunca é estado local**. Ele escreve
 * no cache do TanStack Query. Assim existe um lugar só onde o dado vive, e o
 * React re-renderiza porque a query mudou — não porque sincronizamos `useState`
 * na mão (que é como surgem os bugs de "dado velho na tela").
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { token, user, scope } = useSession()
  const userId = user?.id

  const [socket, setSocket] = useState<MarketSocket | null>(null)
  const [status, setStatus] = useState<RealtimeStatus>('connecting')
  const orderVersions = useRef(new Map<string, number>())

  /**
   * (Re)estabelece a conexão quando a identidade muda.
   *
   * Depende de `token` de propósito: o logout derruba o socket, e ao detectar a
   * nova identidade este efeito cria uma conexão nova e a autentica como
   * visitante. No login, reaproveita a conexão que já existe e apenas reautentica.
   */
  useEffect(() => {
    let cancelled = false
    let activeSocket: MarketSocket | null = null
    let authenticateAndReconcile: (() => void) | null = null

    getMarketSocket().then((nextSocket) => {
      if (cancelled) return

      activeSocket = nextSocket
      setSocket(nextSocket)

      const onConnect = (): void => {
        // Socket.IO não repete eventos fire-and-forget perdidos durante a
        // desconexão: autentique novamente e busque snapshots REST atuais.
        nextSocket.emit('session:authenticate', { token })
        void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.all })
        void queryClient.invalidateQueries({ queryKey: queryKeys.cart(scope) })
        if (userId) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.orders(userId) })
          void queryClient.invalidateQueries({ queryKey: queryKeys.wallets(userId) })
          void queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) })
        }
      }

      authenticateAndReconcile = onConnect
      nextSocket.on('connect', onConnect)
      if (nextSocket.connected) onConnect()
      else nextSocket.connect()
    })

    return () => {
      cancelled = true
      if (activeSocket && authenticateAndReconcile) {
        activeSocket.off('connect', authenticateAndReconcile)
      }
    }
  }, [queryClient, scope, token, userId])

  const handleNftUpdated = useCallback(
    (payload: NftUpdatedPayload) => {
      applyNftUpdateToCache(queryClient, payload)

      const listingChanged = payload.listed !== payload.previousListed
      const listQueries = queryClient
        .getQueryCache()
        .findAll({ queryKey: queryKeys.catalog.lists() })

      for (const query of listQueries) {
        const filters = query.queryKey[2] as CatalogFilters | undefined
        const marketAffectsResults =
          listingChanged ||
          filters?.minPriceEth !== undefined ||
          filters?.maxPriceEth !== undefined ||
          filters?.sort === 'price-asc' ||
          filters?.sort === 'price-desc' ||
          filters?.tab === 'alta' ||
          filters?.tab === 'novos'
        if (marketAffectsResults) {
          void queryClient.invalidateQueries({ queryKey: query.queryKey, exact: true })
        }
      }
    },
    [queryClient],
  )

  const handleOrderUpdated = useCallback(
    (payload: OrderUpdatedPayload) => {
      if (!user) return
      const key = `${user.id}:${payload.orderId}`
      const cached = queryClient.getQueryData<Order>(queryKeys.order(user.id, payload.orderId))
      const cachedVersion =
        cached?.status === 'pending' ? 1 : cached?.status === 'settling' ? 2 : cached ? 3 : 0
      const newestVersion = Math.max(orderVersions.current.get(key) ?? 0, cachedVersion)
      if (payload.version <= newestVersion) return
      orderVersions.current.set(key, payload.version)

      void queryClient.invalidateQueries({ queryKey: queryKeys.order(user.id, payload.orderId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders(user.id) })
    },
    [queryClient, user],
  )

  const handleReservationExpired = useCallback(
    (_payload: CartReservationExpiredPayload) => {
      // O carrinho esvaziou no servidor: relê o carrinho do escopo atual.
      void queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
    [queryClient],
  )

  /**
   * Liga/desliga os ouvintes junto com a conexão.
   *
   * Registramos sempre com as MESMAS referências que usamos no `off`: é o que
   * impede o bug clássico de ouvintes duplicados (e de eventos processados N
   * vezes) depois de um re-render ou de uma reconexão.
   */
  useEffect(() => {
    if (!socket) return

    socket.on('nft.updated', handleNftUpdated)
    socket.on('order.updated', handleOrderUpdated)
    socket.on('cart:reservation-expired', handleReservationExpired)

    return () => {
      socket.off('nft.updated', handleNftUpdated)
      socket.off('order.updated', handleOrderUpdated)
      socket.off('cart:reservation-expired', handleReservationExpired)
    }
  }, [socket, handleNftUpdated, handleOrderUpdated, handleReservationExpired])

  useEffect(() => {
    if (!socket) return
    return subscribeToStatus(socket, setStatus)
  }, [socket])

  const value = useMemo<RealtimeContextValue>(() => ({ socket, status }), [socket, status])

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}
