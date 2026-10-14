import { cartSchema, type Cart, type CartItem } from '@/shared/contracts/cart'
import { computeSubtotal, computeTotals } from '@/shared/lib/pricing'
import { getCatalogNft } from './catalog'
import { computeCouponDiscount, findCoupon, isExpired, type Coupon } from './coupons'

/**
 * Carrinho simulado.
 *
 * Duas decisões importantes:
 *
 *  1. O carrinho é do SERVIDOR simulado, indexado por identidade. Visitante tem
 *     um carrinho `guest`; ao entrar, ele é adotado pela conta. O mock persiste
 *     o snapshot no `localStorage` para sobreviver a refresh; a chave inclui a
 *     identidade, então os dados seguem isolados por usuário.
 *  2. Cada mudança abre/renova uma RESERVA com prazo. Quando expira, os itens
 *     voltam ao mercado e o servidor avisa por tempo real.
 */

/** Prazo da reserva. Pode ser encurtado por cenário de teste. */
let reservationTtlMs = 15 * 60_000

const GUEST_KEY = 'guest'
const STORAGE_KEY = 'kurio:mock-carts'

export type CartIdentity = string

export const guestCartKey: CartIdentity = GUEST_KEY

const carts = new Map<CartIdentity, Cart>()

/** Cupom aplicado por carrinho (o desconto em si é recalculado a cada commit). */
const couponsByCart = new Map<CartIdentity, Coupon>()

const reservationTimers = new Map<CartIdentity, ReturnType<typeof setTimeout>>()

interface PersistedCarts {
  carts: Record<string, unknown>
  coupons: Record<string, string>
}

/** Reidrata os carrinhos no boot do MSW para sobreviver a refresh. */
function hydrateCarts(): void {
  if (typeof localStorage === 'undefined') return

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return

    const persisted = JSON.parse(raw) as Partial<PersistedCarts>
    for (const [identity, rawCart] of Object.entries(persisted.carts ?? {})) {
      const parsed = cartSchema.safeParse(rawCart)
      if (!parsed.success || parsed.data.items.length === 0) continue

      const expiresAt = parsed.data.expiresAt ? Date.parse(parsed.data.expiresAt) : 0
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) continue

      carts.set(identity, parsed.data)
      scheduleExpiry(identity)

      const couponCode = persisted.coupons?.[identity]
      const coupon = couponCode ? findCoupon(couponCode) : undefined
      if (coupon && !isExpired(coupon)) couponsByCart.set(identity, coupon)
    }
  } catch {
    // Dados corrompidos não devem impedir o boot da aplicação.
    localStorage.removeItem(STORAGE_KEY)
  }
}

function persistCarts(): void {
  if (typeof localStorage === 'undefined') return

  const persisted: PersistedCarts = { carts: {}, coupons: {} }
  for (const [identity, cart] of carts) persisted.carts[identity] = cart
  for (const [identity, coupon] of couponsByCart) persisted.coupons[identity] = coupon.code
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
}

/** Limpa tudo — Reset/Handlers. */
export function resetCarts(): void {
  for (const timer of reservationTimers.values()) clearTimeout(timer)
  reservationTimers.clear()
  carts.clear()
  couponsByCart.clear()
  if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY)
}

export function configureCartReservation(ttlMs: number): void {
  reservationTtlMs = ttlMs
}

function emptyCart(): Cart {
  return {
    items: [],
    itemCount: 0,
    subtotalEth: '0',
    discountEth: '0',
    serviceFeeEth: '0',
    totalEth: '0',
    couponCode: null,
    reservationId: null,
    expiresAt: null,
    updatedAt: new Date().toISOString(),
  }
}

function buildCart(items: CartItem[], discountEth: string, couponCode: string | null): Cart {
  if (items.length === 0) return emptyCart()

  const totals = computeTotals(items, discountEth)
  const now = Date.now()

  return {
    items,
    itemCount: items.reduce((count, item) => count + item.quantity, 0),
    ...totals,
    couponCode,
    reservationId: `res_${crypto.randomUUID()}`,
    expiresAt: new Date(now + reservationTtlMs).toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export function getCart(identity: CartIdentity): Cart {
  return carts.get(identity) ?? emptyCart()
}

/** Atualiza um carrinho ativo quando preço ou disponibilidade muda no mercado. */
export function reconcileCart(identity: CartIdentity): Cart {
  const current = getCart(identity)
  const needsRefresh = current.items.some((item) => {
    const nft = getCatalogNft(item.nftId)
    return !nft || !nft.listed || nft.version > item.version || nft.priceEth !== item.priceEth
  })

  return needsRefresh ? commit(identity, current.items) : current
}

export function cartItemFromNft(nftId: string): CartItem | undefined {
  const nft = getCatalogNft(nftId)
  if (!nft || !nft.listed) return undefined

  return {
    nftId: nft.id,
    name: nft.name,
    collectionName: nft.collectionName,
    imageUrl: nft.imageUrl,
    priceEth: nft.priceEth,
    quantity: 1,
    version: nft.version,
  }
}

/**
 * Adiciona um NFT ao carrinho. Como cada item é 1 de 1, adicionar de novo o
 * mesmo NFT não duplica: apenas atualiza o preço para o valor corrente. A
 * quantidade de um item é alterada por `setItemQuantity` — é ela que permite
 * ao usuário comprar mais de um exemplar da mesma obra.
 */
export function addItem(identity: CartIdentity, nftId: string): Cart {
  const current = getCart(identity)
  const item = cartItemFromNft(nftId)
  if (!item) return current

  const existing = current.items.find((candidate) => candidate.nftId === nftId)
  const items = existing
    ? current.items.map((candidate) => (candidate.nftId === nftId ? item : candidate))
    : [...current.items, item]

  return commit(identity, items)
}

/** Limite de exemplares de um mesmo item no carrinho. */
export const MAX_ITEM_QUANTITY = 20

/**
 * Define a quantidade de um item já no carrinho (1..MAX_ITEM_QUANTITY).
 * Quantidade inválida preserva o valor atual; o preço é sempre relido do
 * mercado corrente pelo `commit`.
 */
export function setItemQuantity(identity: CartIdentity, nftId: string, quantity: number): Cart {
  const current = getCart(identity)
  const normalized = Math.max(1, Math.min(MAX_ITEM_QUANTITY, Math.floor(quantity)))
  if (!current.items.some((item) => item.nftId === nftId)) return current

  const items = current.items.map((item) =>
    item.nftId === nftId ? { ...item, quantity: normalized } : item,
  )
  return commit(identity, items)
}

export function removeItem(identity: CartIdentity, nftId: string): Cart {
  const current = getCart(identity)
  return commit(
    identity,
    current.items.filter((item) => item.nftId !== nftId),
  )
}

/** Mescla o carrinho de visitante na conta que acabou de entrar. */
export function adoptGuestCart(identity: CartIdentity): void {
  if (identity === GUEST_KEY) return

  const guest = carts.get(GUEST_KEY)
  const guestCoupon = couponsByCart.get(GUEST_KEY) ?? null

  if (guestCoupon && !couponsByCart.has(identity)) couponsByCart.set(identity, guestCoupon)
  couponsByCart.delete(GUEST_KEY)

  if (!guest || guest.items.length === 0) {
    persistCarts()
    return
  }

  const target = getCart(identity)
  const merged = [...target.items]

  for (const item of guest.items) {
    if (!merged.some((candidate) => candidate.nftId === item.nftId)) merged.push(item)
  }

  commit(identity, merged)
  carts.delete(GUEST_KEY)
  const timer = reservationTimers.get(GUEST_KEY)
  if (timer) {
    clearTimeout(timer)
    reservationTimers.delete(GUEST_KEY)
  }
  persistCarts()
}

/** Recalcula o carrinho (preços vivos), reaplica o cupom e renova a reserva. */
function commit(identity: CartIdentity, rawItems: CartItem[]): Cart {
  // Relê o preço de cada item: o carrinho nunca exibe um preço obsoleto.
  // A quantidade comprada é preservada do carrinho anterior.
  const items = rawItems
    .map((item) => {
      const fresh = cartItemFromNft(item.nftId)
      if (!fresh) return undefined
      return { ...fresh, quantity: item.quantity }
    })
    .filter((item): item is CartItem => item !== undefined)

  // O desconto depende do subtotal corrente: por isso é recalculado aqui, e não
  // guardado em algum lugar que pudesse ficar defasado.
  const coupon = couponsByCart.get(identity) ?? null
  const discountEth = coupon ? computeCouponDiscount(computeSubtotal(items), coupon) : '0'

  const cart = buildCart(items, discountEth, coupon?.code ?? null)
  carts.set(identity, cart)
  persistCarts()
  scheduleExpiry(identity)

  return cart
}

export type ApplyCouponResult =
  { ok: true; cart: Cart } | { ok: false; reason: 'invalid' | 'expired' }

/** Aplica um cupom ao carrinho e devolve o carrinho recalculado. */
export function applyCoupon(identity: CartIdentity, code: string): ApplyCouponResult {
  const coupon = findCoupon(code)
  if (!coupon) return { ok: false, reason: 'invalid' }
  if (isExpired(coupon)) return { ok: false, reason: 'expired' }

  couponsByCart.set(identity, coupon)
  return { ok: true, cart: commit(identity, getCart(identity).items) }
}

/** Remove o cupom; os totais voltam ao valor cheio. */
export function removeCoupon(identity: CartIdentity): Cart {
  couponsByCart.delete(identity)
  return commit(identity, getCart(identity).items)
}

/**
 * Cotação oficial: relê os preços correntes e emite uma reserva nova.
 *
 * É o que o checkout usa — o cliente nunca soma preços por conta própria para
 * decidir quanto cobrar.
 */
export function quoteCart(identity: CartIdentity): Cart {
  const current = getCart(identity)
  return commit(identity, current.items)
}

export function clearCart(identity: CartIdentity): void {
  carts.delete(identity)
  couponsByCart.delete(identity)
  const timer = reservationTimers.get(identity)
  if (timer) {
    clearTimeout(timer)
    reservationTimers.delete(identity)
  }
  persistCarts()
}

export type ReservationExpiredListener = (payload: {
  identity: CartIdentity
  nftIds: string[]
}) => void

const reservationListeners = new Set<ReservationExpiredListener>()

export function onReservationExpired(listener: ReservationExpiredListener): () => void {
  reservationListeners.add(listener)
  return () => reservationListeners.delete(listener)
}

function scheduleExpiry(identity: CartIdentity): void {
  const existing = reservationTimers.get(identity)
  if (existing) clearTimeout(existing)

  const expiresAt = carts.get(identity)?.expiresAt
  const waitMs = expiresAt ? Math.max(0, Date.parse(expiresAt) - Date.now()) : reservationTtlMs

  const timer = setTimeout(() => {
    const cart = carts.get(identity)
    if (!cart || cart.items.length === 0) return

    const nftIds = cart.items.map((item) => item.nftId)
    carts.delete(identity)
    couponsByCart.delete(identity)
    reservationTimers.delete(identity)
    persistCarts()

    for (const listener of reservationListeners) listener({ identity, nftIds })
  }, waitMs)

  reservationTimers.set(identity, timer)
}

hydrateCarts()
