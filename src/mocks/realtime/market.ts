import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws } from 'msw'
import type { NftSnapshot } from '@/shared/contracts/nft'
import type { NftUpdatedPayload, OrderUpdatedPayload } from '@/shared/realtime/contracts'
import { marketSocketRootEndpoint } from '@/shared/realtime/endpoint'
import { onReservationExpired } from '../data/cart-store'
import { applyPriceTick, getNftSnapshot, setNftListed, setNftPrice } from '../data/market-state'
import { onOrderStatusChange } from '../data/order-store'
import { getUserIdByToken } from '../data/session-store'
import { pricesFrozen } from '../scenarios'

type DuplexIo = ReturnType<typeof toSocketIo>

/**
 * O handshake emitido pelo binding anuncia `pingInterval: 25_000` e
 * `pingTimeout: 5_000`, mas o próprio binding nunca envia ping do engine.io.
 * Sem um ping do lado "servidor", o cliente conclui que a conexão morreu ~30s
 * depois de abrir. Por isso o mock mantém um heartbeat explícito: no protocolo
 * engine.io v4 é o SERVIDOR que envia `2` (ping) e o cliente responde `3`.
 */
const PING_INTERVAL_MS = 15_000

/** Intervalo do "mercado": muda o preço e empurra o evento para quem assinou. */
const PRICE_TICK_MS = 5_000

interface ConnectionState {
  /** Usuário dono da conexão (via `session:authenticate`). `null` = visitante. */
  userId: string | null
  subscribedNftIds: Set<string>
}

const connections = new Map<DuplexIo, ConnectionState>()

let pingTimer: ReturnType<typeof setInterval> | undefined
let tickTimer: ReturnType<typeof setInterval> | undefined

let listenersBound = false

function buildNftUpdatedEvent(
  snapshot: NftSnapshot,
  previousPriceEth: string,
  previousListed: boolean,
): NftUpdatedPayload {
  return {
    // Determinístico por versão: dois eventos iguais são literalmente o mesmo
    // evento, o que dá ao cliente uma deduplicação trivial.
    eventId: `evt_${snapshot.id}_v${snapshot.version}`,
    occurredAt: snapshot.updatedAt,
    version: snapshot.version,
    nftId: snapshot.id,
    priceEth: snapshot.priceEth,
    previousPriceEth,
    listed: snapshot.listed,
    previousListed,
  }
}

function emitToUser(userId: string, event: string, payload: unknown): void {
  for (const [duplex, state] of connections) {
    // Isolamento: um evento de usuário só vai para conexões autenticadas como
    // aquele usuário. Nunca para visitantes, nunca para outra conta.
    if (state.userId === userId) duplex.client.emit(event, payload)
  }
}

function emitToSubscribers(event: NftUpdatedPayload): void {
  for (const [duplex, state] of connections) {
    if (state.subscribedNftIds.has(event.nftId)) duplex.client.emit('nft.updated', event)
  }
}

/**
 * Muda o preço no "backend" E empurra o evento para quem assinou.
 *
 * Usado pelo controle de teste (`/__mock__/set-price`): permite mudar um preço
 * de forma determinística no meio de um checkout, sem esperar o relógio do
 * mercado.
 */
export function publishPrice(nftId: string, priceEth: string): NftSnapshot | undefined {
  const before = getNftSnapshot(nftId)
  const snapshot = setNftPrice(nftId, priceEth)
  if (!snapshot || !before) return undefined

  emitToSubscribers(buildNftUpdatedEvent(snapshot, before.priceEth, before.listed))
  return snapshot
}

/** Altera a disponibilidade e publica o mesmo evento versionado do preço. */
export function publishListing(nftId: string, listed: boolean): NftSnapshot | undefined {
  const before = getNftSnapshot(nftId)
  const snapshot = setNftListed(nftId, listed)
  if (!snapshot || !before) return undefined

  emitToSubscribers(buildNftUpdatedEvent(snapshot, before.priceEth, before.listed))
  return snapshot
}

/**
 * Emite um evento de preço CRU, sem tocar no estado.
 *
 * É como o E2E injeta um evento duplicado ou fora de ordem (versão antiga) e
 * prova que a guarda de versão do cliente impede qualquer regressão.
 */
export function publishRawNftEvent(payload: NftUpdatedPayload): void {
  emitToSubscribers(payload)
}

/** Fecha os transports ativos para provar o fluxo real de reconnect do cliente. */
export function forceDisconnectClients(): number {
  const active = [...connections.values()].length
  for (const duplex of connections.keys()) duplex.rawClient.close(1012, 'reconnect test')
  return active
}

/**
 * Liga as fontes de evento do "backend" ao socket, UMA vez por worker.
 *
 * Estes ouvintes são globais (não por conexão); quem filtra por usuário é o
 * `emitToUser`.
 */
function bindDomainListeners(): void {
  if (listenersBound) return
  listenersBound = true

  onOrderStatusChange((order, userId) => {
    const statusVersion: Record<string, number> = { pending: 1, settling: 2, settled: 3, failed: 3 }
    const payload: OrderUpdatedPayload = {
      eventId: `evt_order_${order.id}_${order.status}`,
      occurredAt: new Date().toISOString(),
      version: statusVersion[order.status] ?? 1,
      orderId: order.id,
      status: order.status,
    }
    emitToUser(userId, 'order.updated', payload)
  })

  onReservationExpired(({ identity, nftIds }) => {
    if (identity === 'guest') return
    emitToUser(identity, 'cart:reservation-expired', {
      eventId: `evt_reservation_${Date.now()}`,
      occurredAt: new Date().toISOString(),
      version: Date.now(),
      reservationId: 'unknown',
      nftIds,
    })
  })
}

function collectSubscribedNftIds(): Set<string> {
  const nftIds = new Set<string>()
  for (const state of connections.values()) {
    for (const nftId of state.subscribedNftIds) nftIds.add(nftId)
  }
  return nftIds
}

function startTimers(): void {
  pingTimer ??= setInterval(() => {
    for (const duplex of connections.keys()) duplex.rawClient.send('2')
  }, PING_INTERVAL_MS)

  tickTimer ??= setInterval(() => {
    // Cenário `frozen-prices`: mantém o canal aberto, mas sem mexer nos preços
    // (usado pelo E2E para somas exatas).
    if (pricesFrozen()) return

    // Mexe em TODOS os NFTs assinados, de uma vez.
    //
    // A tentação é revezar (um por vez, para "parecer mais orgânico"), mas a
    // vitrine é justamente onde o tempo real tem de ser visível: nove cartões
    // da página atual mudando a cada 5s demonstram o canal. O revezamento
    // também tornaria o teste E2E lento e dependente da ordem de assinatura.
    for (const nftId of collectSubscribedNftIds()) {
      const tick = applyPriceTick(nftId)
      if (!tick) continue

      emitToSubscribers(
        buildNftUpdatedEvent(tick.snapshot, tick.previousPriceEth, tick.snapshot.listed),
      )
    }
  }, PRICE_TICK_MS)
}

function stopTimersWhenIdle(): void {
  if (connections.size > 0) return

  clearInterval(pingTimer)
  clearInterval(tickTimer)
  pingTimer = undefined
  tickTimer = undefined
}

/**
 * `ws.link(url).addEventListener('connection', ...)` devolve o HANDLER
 * (WebSocketHandler) que precisa ser registrado no `setupWorker`. O objeto
 * devolvido por `ws.link()` sozinho não é um handler.
 */
export const marketHandler = ws
  .link(marketSocketRootEndpoint())
  .addEventListener('connection', (connection) => {
    bindDomainListeners()

    const duplex = toSocketIo(connection)
    connections.set(duplex, { userId: null, subscribedNftIds: new Set() })
    startTimers()

    duplex.client.on(
      'session:authenticate',
      (_event, payload: { token?: string | null } | undefined) => {
        const state = connections.get(duplex)
        if (!state) return

        const token = payload?.token ?? null
        state.userId = token ? (getUserIdByToken(token) ?? null) : null
      },
    )

    duplex.client.on('market:subscribe', (_event, payload: { nftIds?: string[] } | undefined) => {
      const state = connections.get(duplex)
      if (!state) return

      for (const nftId of payload?.nftIds ?? []) {
        state.subscribedNftIds.add(nftId)

        // Envia o retrato atual para quem acabou de assinar. Se o cliente já
        // tem essa mesma versão, ele descarta o evento — sem trabalho extra.
        const snapshot = getNftSnapshot(nftId)
        if (snapshot) {
          duplex.client.emit(
            'nft.updated',
            buildNftUpdatedEvent(snapshot, snapshot.priceEth, snapshot.listed),
          )
        }
      }
    })

    duplex.client.on('market:unsubscribe', (_event, payload: { nftIds?: string[] } | undefined) => {
      const state = connections.get(duplex)
      if (!state) return
      for (const nftId of payload?.nftIds ?? []) state.subscribedNftIds.delete(nftId)
    })

    connection.client.addEventListener('close', () => {
      connections.delete(duplex)
      stopTimersWhenIdle()
    })
  })
