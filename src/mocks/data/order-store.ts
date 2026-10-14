import type { CartItem } from '@/shared/contracts/cart'
import {
  orderSchema,
  type CheckoutRequest,
  type Order,
  type OrderStatus,
} from '@/shared/contracts/order'
import type { CartTotals } from '@/shared/lib/pricing'

/**
 * Pedidos simulados.
 *
 * Duas características que a UI depende:
 *
 *  - **Idempotência**: repetir o checkout com a mesma `idempotencyKey` devolve
 *    o MESMO pedido. É o que protege o usuário de um duplo clique ou de um
 *    refresh no meio da requisição.
 *  - **Progressão de status**: o pedido nasce `pending`, vira `settling` e
 *    depois `settled` — empurrado por tempo real, não por polling do cliente.
 */

const STORAGE_KEY = 'kurio:mock-orders'
const ordersByUser = new Map<string, Order[]>()

/** Chave -> id do pedido e fingerprint do payload aceito. */
const idempotencyIndex = new Map<string, string>()
const idempotencyFingerprints = new Map<string, string>()
const settlementTimers = new Map<string, ReturnType<typeof setTimeout>[]>()

/** Base determinística: o primeiro pedido é `0xA91F3B7CE82C`. */
const ORDER_CODE_BASE = BigInt('0xA91F3B7CE82C')
let orderSequence = 0

export class IdempotencyConflictError extends Error {
  constructor() {
    super('A chave de idempotência já foi usada com outro conteúdo.')
    this.name = 'IdempotencyConflictError'
  }
}

interface PersistedOrders {
  ordersByUser: Record<string, Order[]>
  idempotencyIndex: Record<string, { orderId: string; fingerprint: string }>
  orderSequence: number
}

function persistOrders(): void {
  if (typeof localStorage === 'undefined') return

  const orders: Record<string, Order[]> = {}
  for (const [userId, userOrders] of ordersByUser) orders[userId] = userOrders

  const idempotency: PersistedOrders['idempotencyIndex'] = {}
  for (const [key, orderId] of idempotencyIndex) {
    idempotency[key] = { orderId, fingerprint: idempotencyFingerprints.get(key) ?? '' }
  }

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ordersByUser: orders, idempotencyIndex: idempotency, orderSequence }),
  )
}

function hydrateOrders(): void {
  if (typeof localStorage === 'undefined') return

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return

    const persistedState = JSON.parse(raw) as Partial<PersistedOrders>
    for (const [userId, candidates] of Object.entries(persistedState.ordersByUser ?? {})) {
      const parsed = candidates.map((candidate) => orderSchema.safeParse(candidate))
      if (parsed.some((candidate) => !candidate.success)) continue
      ordersByUser.set(
        userId,
        parsed.flatMap((candidate) => (candidate.success ? [candidate.data] : [])),
      )
    }
    for (const [key, entry] of Object.entries(persistedState.idempotencyIndex ?? {})) {
      if (entry && typeof entry.orderId === 'string' && typeof entry.fingerprint === 'string') {
        idempotencyIndex.set(key, entry.orderId)
        idempotencyFingerprints.set(key, entry.fingerprint)
      }
    }
    orderSequence =
      typeof persistedState.orderSequence === 'number' &&
      Number.isInteger(persistedState.orderSequence)
        ? persistedState.orderSequence
        : 0
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return
  }

  for (const [userId, orders] of ordersByUser) {
    for (const order of orders) resumeSettlement(userId, order)
  }
}

/** O dono acompanha o evento: o socket precisa saber para quem emitir. */
export type OrderStatusListener = (order: Order, userId: string) => void

const statusListeners = new Set<OrderStatusListener>()

export function onOrderStatusChange(listener: OrderStatusListener): () => void {
  statusListeners.add(listener)
  return () => statusListeners.delete(listener)
}

function nextOrderCode(): string {
  const value = ORDER_CODE_BASE + BigInt(orderSequence)
  orderSequence += 1
  return `0x${value.toString(16).toUpperCase().padStart(12, '0')}`
}

export interface CreateOrderInput {
  userId: string
  request: CheckoutRequest
  items: CartItem[]
  totals: CartTotals
  initialStatus?: 'pending' | 'failed'
}

function fingerprintRequest(request: CheckoutRequest): string {
  return JSON.stringify({
    paymentMethod: request.paymentMethod,
    walletAddress: request.walletAddress.toLowerCase(),
    network: request.network,
    collector: request.collector,
    note: request.note,
  })
}

export function findIdempotentOrder(userId: string, request: CheckoutRequest): Order | undefined {
  const idempotencyKey = `${userId}:${request.idempotencyKey}`
  const existingId = idempotencyIndex.get(idempotencyKey)
  if (!existingId) return undefined

  if (idempotencyFingerprints.get(idempotencyKey) !== fingerprintRequest(request)) {
    throw new IdempotencyConflictError()
  }

  return getOrder(userId, existingId)
}

export function createOrder(input: CreateOrderInput): Order {
  const idempotencyKey = `${input.userId}:${input.request.idempotencyKey}`
  const fingerprint = fingerprintRequest(input.request)
  const existing = findIdempotentOrder(input.userId, input.request)

  if (existing) return existing

  const order: Order = {
    id: `order_${crypto.randomUUID()}`,
    code: nextOrderCode(),
    status: input.initialStatus ?? 'pending',
    items: input.items,
    subtotalEth: input.totals.subtotalEth,
    discountEth: input.totals.discountEth,
    serviceFeeEth: input.totals.serviceFeeEth,
    totalEth: input.totals.totalEth,
    paymentMethod: input.request.paymentMethod,
    walletAddress: input.request.walletAddress,
    network: input.request.network,
    collector: input.request.collector,
    note: input.request.note,
    createdAt: new Date().toISOString(),
  }

  const list = ordersByUser.get(input.userId) ?? []
  list.unshift(order)
  ordersByUser.set(input.userId, list)
  idempotencyIndex.set(idempotencyKey, order.id)
  idempotencyFingerprints.set(idempotencyKey, fingerprint)

  persistOrders()
  if (order.status === 'pending') resumeSettlement(input.userId, order)

  return order
}

/**
 * Faz o pedido "assentar": `pending -> settling -> settled`, avisando os
 * ouvintes. Os tempos são curtos para que a tela de confirmação mostre a
 * transição sem que o usuário espere de verdade.
 */
function resumeSettlement(userId: string, order: Order): void {
  if (order.status === 'settled' || order.status === 'failed') return

  const elapsed = Math.max(0, Date.now() - Date.parse(order.createdAt))
  const timers: ReturnType<typeof setTimeout>[] = []

  if (elapsed >= 4_000) {
    order.status = 'settled'
    persistOrders()
    return
  }

  if (order.status === 'pending' && elapsed < 1_500) {
    timers.push(setTimeout(() => transition(userId, order.id, 'settling'), 1_500 - elapsed))
  } else if (order.status === 'pending') {
    order.status = 'settling'
    persistOrders()
  }

  timers.push(setTimeout(() => transition(userId, order.id, 'settled'), 4_000 - elapsed))
  settlementTimers.set(order.id, timers)
}

function transition(userId: string, orderId: string, status: OrderStatus): void {
  const order = getOrder(userId, orderId)
  if (!order) return

  order.status = status
  persistOrders()
  for (const listener of statusListeners) listener({ ...order }, userId)
}

export function getOrder(userId: string, orderId: string): Order | undefined {
  return ordersByUser.get(userId)?.find((order) => order.id === orderId)
}

export function listOrders(userId: string): Order[] {
  return [...(ordersByUser.get(userId) ?? [])]
}

export function resetOrders(): void {
  for (const timers of settlementTimers.values()) {
    for (const timer of timers) clearTimeout(timer)
  }
  settlementTimers.clear()
  ordersByUser.clear()
  idempotencyIndex.clear()
  idempotencyFingerprints.clear()
  orderSequence = 0
  if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY)
}

hydrateOrders()
