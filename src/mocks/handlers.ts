import { delay, http, HttpResponse } from 'msw'
import { z } from 'zod'
import Decimal from 'decimal.js'
import { env } from '@/shared/config/env'
import {
  credentialsSchema,
  passwordChangeSchema,
  profileUpdateSchema,
  registrationSchema,
  sessionSchema,
} from '@/shared/contracts/auth'
import {
  CATALOG_PAGE_SIZE,
  collectionSchema,
  nftListSchema,
  nftSchema,
} from '@/shared/contracts/catalog'
import { cartSchema } from '@/shared/contracts/cart'
import { favoritesSchema } from '@/shared/contracts/favorite'
import { checkoutRequestSchema, orderSchema } from '@/shared/contracts/order'
import { walletDraftSchema, walletListSchema, walletUpdateSchema } from '@/shared/contracts/wallet'
import { getCatalogNft, listCatalog } from './data/catalog'
import {
  addItem,
  adoptGuestCart,
  applyCoupon,
  clearCart,
  getCart,
  guestCartKey,
  quoteCart,
  reconcileCart,
  removeCoupon,
  removeItem,
  resetCarts,
  setItemQuantity,
} from './data/cart-store'
import { addFavorite, getFavorites, removeFavorite, resetFavorites } from './data/favorites-store'
import { collections, nftSeeds } from './data/fixtures'
import { getNftSnapshot, resetMarketState } from './data/market-state'
import {
  createOrder,
  findIdempotentOrder,
  getOrder,
  IdempotencyConflictError,
  listOrders,
  resetOrders,
} from './data/order-store'
import {
  authenticate,
  changePassword,
  createUser,
  destroySession,
  findUserByEmail,
  findUserById,
  getUserIdByToken,
  issueToken,
  listUsers,
  resetSessions,
  revokeToken,
  updateProfile,
} from './data/session-store'
import {
  addWallet,
  listWallets,
  removeWallet,
  resetWallets,
  updateWallet,
} from './data/wallets-store'
import {
  forceDisconnectClients,
  marketHandler,
  publishListing,
  publishPrice,
  publishRawNftEvent,
} from './realtime/market'
import { getScenario, isScenario, scenarioDelayMs, SCENARIOS, setScenario } from './scenarios'

/**
 * Handlers REST simulados.
 *
 * Cada resposta é validada com o MESMO schema zod que o cliente usa para ler.
 * Se o contrato quebrar, quebra dos dois lados — não existe "o mock passou, o
 * cliente quebrou".
 */

const api = (path: string) => `${env.apiUrl}${path}`
const listingOrder = new Map(nftSeeds.map((nft, index) => [nft.id, index]))

function errorResponse(status: number, code: string, message: string) {
  return HttpResponse.json({ code, message }, { status })
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null

  const token = header.slice('Bearer '.length).trim()
  return token.length > 0 ? token : null
}

function currentUserId(request: Request): string | null {
  const token = bearerToken(request)
  return token ? (getUserIdByToken(token) ?? null) : null
}

/** Identidade do carrinho: o usuário logado ou o visitante. */
function cartIdentity(request: Request): string {
  return currentUserId(request) ?? guestCartKey
}

async function maybeDelay(): Promise<void> {
  const ms = scenarioDelayMs()
  if (ms > 0) await delay(ms)
}

/**
 * Atraso de uma única vez no `POST /orders`.
 *
 * Injetado pelo controle de teste (`/__mock__/arm-checkout-timeout`). Serve
 * para provar idempotência: a primeira tentativa ESTOURA o tempo do cliente
 * (10s) mas o servidor ainda a processa; a segunda, com a MESMA chave de
 * idempotência, devolve o mesmo pedido em vez de criar outro.
 */
let checkoutTimeoutArmed = false
const CHECKOUT_TIMEOUT_MS = 11_000

export const handlers = [
  http.all(`${env.apiUrl}/*`, ({ request }) => {
    const url = new URL(request.url)
    if (isScenario('network-offline') && !url.pathname.startsWith('/__mock__/')) {
      return HttpResponse.error()
    }
    return undefined
  }),

  // ── Catálogo ────────────────────────────────────────────────────────────
  http.get(api('/collections'), async () => {
    await maybeDelay()
    return HttpResponse.json(collections.map((collection) => collectionSchema.parse(collection)))
  }),

  http.get(api('/nfts'), async ({ request }) => {
    await maybeDelay()

    if (isScenario('empty-catalog')) {
      return HttpResponse.json(nftListSchema.parse({ items: [], total: 0 }))
    }

    const url = new URL(request.url)
    const collectionId = url.searchParams.get('collectionId')
    const term = url.searchParams.get('q')?.trim().toLowerCase()
    const minPriceRaw = url.searchParams.get('minPriceEth')
    const maxPriceRaw = url.searchParams.get('maxPriceEth')
    let minPriceEth: Decimal | undefined
    let maxPriceEth: Decimal | undefined
    try {
      if (minPriceRaw !== null) minPriceEth = new Decimal(minPriceRaw)
      if (maxPriceRaw !== null) maxPriceEth = new Decimal(maxPriceRaw)
    } catch {
      return errorResponse(422, 'invalid_filter', 'Informe uma faixa de preço válida.')
    }
    if (minPriceEth && (!minPriceEth.isFinite() || minPriceEth.isNegative())) {
      return errorResponse(422, 'invalid_filter', 'Preço mínimo inválido.')
    }
    if (maxPriceEth && (!maxPriceEth.isFinite() || maxPriceEth.isNegative())) {
      return errorResponse(422, 'invalid_filter', 'Preço máximo inválido.')
    }
    if (minPriceEth && maxPriceEth && minPriceEth.greaterThan(maxPriceEth)) {
      return errorResponse(422, 'invalid_filter', 'O preço mínimo não pode superar o máximo.')
    }
    const sort = url.searchParams.get('sort')
    const tab = url.searchParams.get('tab')
    const requestedPage = Number(url.searchParams.get('page') ?? 1)
    const requestedPageSize = Number(url.searchParams.get('pageSize') ?? CATALOG_PAGE_SIZE)
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
    const pageSize =
      Number.isInteger(requestedPageSize) && requestedPageSize > 0
        ? Math.min(requestedPageSize, 50)
        : CATALOG_PAGE_SIZE

    let items = listCatalog()
    items = items.filter((nft) => nft.listed)
    if (collectionId) items = items.filter((nft) => nft.collectionId === collectionId)
    if (term) {
      items = items.filter(
        (nft) =>
          nft.name.toLowerCase().includes(term) ||
          nft.collectionName.toLowerCase().includes(term) ||
          nft.description.toLowerCase().includes(term),
      )
    }

    if (minPriceEth !== undefined) {
      items = items.filter((nft) => new Decimal(nft.priceEth).greaterThanOrEqualTo(minPriceEth))
    }
    if (maxPriceEth !== undefined) {
      items = items.filter((nft) => new Decimal(nft.priceEth).lessThanOrEqualTo(maxPriceEth))
    }

    if (tab === 'novos') {
      items.sort(
        (a, b) =>
          b.version - a.version || (listingOrder.get(a.id) ?? 0) - (listingOrder.get(b.id) ?? 0),
      )
    } else if (tab === 'alta' || sort === 'price-desc') {
      items.sort(
        (a, b) => new Decimal(b.priceEth).comparedTo(a.priceEth) || a.name.localeCompare(b.name),
      )
    } else if (sort === 'price-asc') {
      items.sort(
        (a, b) => new Decimal(a.priceEth).comparedTo(b.priceEth) || a.name.localeCompare(b.name),
      )
    } else if (sort === 'name') {
      items.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    } else if (sort === 'recent') {
      // Fixtures são declaradas em ordem de listagem decrescente; a sequência é
      // o equivalente determinístico do `listedAt` de um backend real.
      items.sort((a, b) => (listingOrder.get(a.id) ?? 0) - (listingOrder.get(b.id) ?? 0))
    }

    const total = items.length
    const start = (page - 1) * pageSize
    items = items.slice(start, start + pageSize)

    return HttpResponse.json(nftListSchema.parse({ items, total }))
  }),

  http.get(api('/nfts/:nftId'), async ({ params }) => {
    await maybeDelay()

    const nft = getCatalogNft(String(params.nftId))
    if (!nft) return errorResponse(404, 'nft_not_found', 'NFT não encontrado.')

    return HttpResponse.json(nftSchema.parse(nft))
  }),

  // ── Sessão ──────────────────────────────────────────────────────────────
  http.post(api('/auth/login'), async ({ request }) => {
    await maybeDelay()

    const parsed = credentialsSchema.safeParse(await request.json())
    if (!parsed.success) return errorResponse(422, 'invalid_payload', 'Dados de acesso inválidos.')

    const user = await authenticate(parsed.data.email, parsed.data.password)
    if (!user) return errorResponse(401, 'invalid_credentials', 'E-mail ou senha incorretos.')

    adoptGuestCart(user.id)
    return HttpResponse.json(sessionSchema.parse({ token: issueToken(user.id), user }))
  }),

  http.post(api('/auth/register'), async ({ request }) => {
    await maybeDelay()

    const parsed = registrationSchema.safeParse(await request.json())
    if (!parsed.success)
      return errorResponse(422, 'invalid_payload', 'Dados de cadastro inválidos.')

    if (findUserByEmail(parsed.data.email)) {
      return errorResponse(409, 'email_in_use', 'Já existe uma conta com este e-mail.')
    }

    const user = await createUser(parsed.data)
    adoptGuestCart(user.id)

    return HttpResponse.json(sessionSchema.parse({ token: issueToken(user.id), user }), {
      status: 201,
    })
  }),

  http.get(api('/session'), async ({ request }) => {
    await maybeDelay()

    const token = bearerToken(request)
    const userId = token ? getUserIdByToken(token) : null
    const user = userId ? findUserById(userId) : undefined

    if (!token || !user) {
      return errorResponse(401, 'unauthenticated', 'Sessão inválida ou expirada.')
    }

    return HttpResponse.json(sessionSchema.parse({ token, user }))
  }),

  http.delete(api('/session'), ({ request }) => {
    const token = bearerToken(request)
    if (token) destroySession(token)
    return new HttpResponse(null, { status: 204 })
  }),

  // ── Perfil ──────────────────────────────────────────────────────────────
  http.get(api('/users/me'), async ({ request }) => {
    await maybeDelay()

    const userId = currentUserId(request)
    const user = userId ? findUserById(userId) : undefined
    if (!user) return errorResponse(401, 'unauthenticated', 'Entre para ver seu perfil.')

    return HttpResponse.json(user)
  }),

  http.get(api('/users/:handle'), async ({ params }) => {
    await maybeDelay()

    const handle = String(params.handle).toLowerCase()
    const user = listUsers().find((candidate) => candidate.handle.toLowerCase() === handle)
    if (!user) return errorResponse(404, 'user_not_found', 'Colecionador não encontrado.')

    return HttpResponse.json(user)
  }),

  http.patch(api('/users/me'), async ({ request }) => {
    await maybeDelay()

    const userId = currentUserId(request)
    if (!userId) return errorResponse(401, 'unauthenticated', 'Entre para editar seu perfil.')

    const parsed = profileUpdateSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return errorResponse(422, 'invalid_payload', 'Revise os campos do perfil.')
    }

    if (Object.keys(parsed.data).length === 0) {
      return errorResponse(422, 'invalid_payload', 'Nada para atualizar.')
    }

    const result = updateProfile(userId, parsed.data)
    if (!result.ok) {
      return errorResponse(409, 'handle_taken', 'Este nome de usuário já está em uso.')
    }

    return HttpResponse.json(result.user)
  }),

  http.post(api('/users/me/password'), async ({ request }) => {
    await maybeDelay()

    const userId = currentUserId(request)
    if (!userId) return errorResponse(401, 'unauthenticated', 'Entre para trocar a senha.')

    const parsed = passwordChangeSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return errorResponse(
        422,
        'invalid_payload',
        parsed.error.issues[0]?.message ?? 'Senha inválida.',
      )
    }

    const ok = await changePassword(userId, parsed.data.currentPassword, parsed.data.newPassword)
    if (!ok) return errorResponse(403, 'wrong_password', 'A senha atual está incorreta.')

    return new HttpResponse(null, { status: 204 })
  }),

  // ── Carteiras ───────────────────────────────────────────────────────────
  http.get(api('/wallets'), async ({ request }) => {
    await maybeDelay()

    const userId = currentUserId(request)
    if (!userId) return errorResponse(401, 'unauthenticated', 'Entre para ver suas carteiras.')

    return HttpResponse.json(walletListSchema.parse(listWallets(userId)))
  }),

  http.post(api('/wallets'), async ({ request }) => {
    await maybeDelay()

    const userId = currentUserId(request)
    if (!userId) return errorResponse(401, 'unauthenticated', 'Entre para conectar uma carteira.')

    const parsed = walletDraftSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return errorResponse(422, 'invalid_payload', 'Revise os dados da carteira.')
    }

    addWallet(userId, parsed.data)
    return HttpResponse.json(walletListSchema.parse(listWallets(userId)), { status: 201 })
  }),

  http.delete(api('/wallets/:walletId'), async ({ request, params }) => {
    await maybeDelay()

    const userId = currentUserId(request)
    if (!userId) return errorResponse(401, 'unauthenticated', 'Entre para remover uma carteira.')

    return HttpResponse.json(walletListSchema.parse(removeWallet(userId, String(params.walletId))))
  }),

  http.patch(api('/wallets/:walletId'), async ({ request, params }) => {
    await maybeDelay()

    const userId = currentUserId(request)
    if (!userId) return errorResponse(401, 'unauthenticated', 'Entre para editar uma carteira.')

    const parsed = walletUpdateSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return errorResponse(
        422,
        'invalid_payload',
        parsed.error.issues[0]?.message ?? 'Dados inválidos.',
      )
    }

    return HttpResponse.json(
      walletListSchema.parse(updateWallet(userId, String(params.walletId), parsed.data)),
    )
  }),

  // ── Carrinho ────────────────────────────────────────────────────────────
  http.get(api('/cart'), async ({ request }) => {
    await maybeDelay()
    return HttpResponse.json(cartSchema.parse(reconcileCart(cartIdentity(request))))
  }),

  http.post(api('/cart/items'), async ({ request }) => {
    await maybeDelay()

    const body = (await request.json().catch(() => ({}))) as { nftId?: string }
    if (!body.nftId) return errorResponse(422, 'invalid_payload', 'Informe o NFT.')

    const nft = getCatalogNft(body.nftId)
    if (!nft) return errorResponse(404, 'nft_not_found', 'NFT não encontrado.')
    if (!nft.listed) return errorResponse(409, 'nft_not_listed', 'Este NFT não está mais à venda.')

    const cart = addItem(cartIdentity(request), body.nftId)
    return HttpResponse.json(cartSchema.parse(cart), { status: 201 })
  }),

  http.delete(api('/cart/items/:nftId'), async ({ request, params }) => {
    await maybeDelay()
    const cart = removeItem(cartIdentity(request), String(params.nftId))
    return HttpResponse.json(cartSchema.parse(cart))
  }),

  http.patch(api('/cart/items/:nftId'), async ({ request, params }) => {
    await maybeDelay()

    const body = (await request.json().catch(() => ({}))) as { quantity?: unknown }
    const quantity = z.object({ quantity: z.number().int().min(1).max(20) }).safeParse(body)
    if (!quantity.success) return errorResponse(422, 'invalid_quantity', 'Quantidade inválida.')

    const cart = setItemQuantity(
      cartIdentity(request),
      String(params.nftId),
      quantity.data.quantity,
    )
    return HttpResponse.json(cartSchema.parse(cart))
  }),

  http.post(api('/cart/quote'), async ({ request }) => {
    await maybeDelay()
    return HttpResponse.json(cartSchema.parse(quoteCart(cartIdentity(request))))
  }),

  http.post(api('/cart/coupon'), async ({ request }) => {
    await maybeDelay()

    const body = (await request.json().catch(() => ({}))) as { code?: string }
    const code = String(body.code ?? '').trim()
    if (!code) return errorResponse(422, 'invalid_payload', 'Informe o código promocional.')

    const identity = cartIdentity(request)
    if (getCart(identity).items.length === 0) {
      return errorResponse(409, 'empty_cart', 'Adicione itens antes de aplicar um cupom.')
    }

    const result = applyCoupon(identity, code)
    if (!result.ok) {
      if (result.reason === 'expired') {
        return errorResponse(410, 'coupon_expired', 'Este cupom expirou.')
      }
      return errorResponse(404, 'coupon_invalid', 'Cupom promocional inválido.')
    }

    return HttpResponse.json(cartSchema.parse(result.cart))
  }),

  http.delete(api('/cart/coupon'), async ({ request }) => {
    await maybeDelay()
    return HttpResponse.json(cartSchema.parse(removeCoupon(cartIdentity(request))))
  }),

  http.delete(api('/cart'), async ({ request }) => {
    await maybeDelay()
    clearCart(cartIdentity(request))
    return new HttpResponse(null, { status: 204 })
  }),

  // ── Favoritos ───────────────────────────────────────────────────────────
  http.get(api('/favorites'), async ({ request }) => {
    await maybeDelay()

    const userId = currentUserId(request)
    if (!userId) return errorResponse(401, 'unauthenticated', 'Entre para ver seus favoritos.')

    return HttpResponse.json(favoritesSchema.parse({ nftIds: getFavorites(userId) }))
  }),

  http.post(api('/favorites'), async ({ request }) => {
    await maybeDelay()

    const userId = currentUserId(request)
    if (!userId) return errorResponse(401, 'unauthenticated', 'Entre para salvar favoritos.')

    if (isScenario('favorites-error')) {
      // Demora em propósito: o teste observa o estado otimista antes de reverter.
      await delay(700)
      return errorResponse(500, 'favorites_unavailable', 'Não foi possível salvar o favorito.')
    }

    const body = (await request.json().catch(() => ({}))) as { nftId?: string }
    if (!body.nftId || !getCatalogNft(body.nftId)) {
      return errorResponse(422, 'invalid_payload', 'NFT inválido.')
    }

    return HttpResponse.json(favoritesSchema.parse({ nftIds: addFavorite(userId, body.nftId) }), {
      status: 201,
    })
  }),

  http.delete(api('/favorites/:nftId'), async ({ request, params }) => {
    await maybeDelay()

    const userId = currentUserId(request)
    if (!userId) return errorResponse(401, 'unauthenticated', 'Entre para gerenciar favoritos.')

    if (isScenario('favorites-error')) {
      await delay(700)
      return errorResponse(500, 'favorites_unavailable', 'Não foi possível remover o favorito.')
    }

    return HttpResponse.json(
      favoritesSchema.parse({ nftIds: removeFavorite(userId, String(params.nftId)) }),
    )
  }),

  // ── Pedidos ─────────────────────────────────────────────────────────────
  http.post(api('/orders'), async ({ request }) => {
    await maybeDelay()

    const userId = currentUserId(request)
    if (!userId) return errorResponse(401, 'unauthenticated', 'Entre para finalizar a compra.')

    // Timeout de teste: só na PRIMEIRA tentativa armada. O cliente desiste em
    // 10s (timeout do Axios); o servidor, porém, segue e cria o pedido.
    if (checkoutTimeoutArmed) {
      checkoutTimeoutArmed = false
      await delay(CHECKOUT_TIMEOUT_MS)
    }

    const parsed = checkoutRequestSchema.safeParse(await request.json())
    if (!parsed.success)
      return errorResponse(422, 'invalid_payload', 'Dados de pagamento inválidos.')

    try {
      const existing = findIdempotentOrder(userId, parsed.data)
      if (existing) return HttpResponse.json(orderSchema.parse(existing))
    } catch (error) {
      if (error instanceof IdempotencyConflictError) {
        return errorResponse(409, 'idempotency_conflict', error.message)
      }
      throw error
    }

    if (isScenario('checkout-error')) {
      return errorResponse(502, 'settlement_failed', 'Não foi possível processar o pagamento.')
    }

    if (isScenario('wallet-disconnected')) {
      return errorResponse(409, 'wallet_disconnected', 'A carteira foi desconectada.')
    }

    const cart = getCart(userId)
    if (cart.items.length === 0) return errorResponse(409, 'empty_cart', 'Seu carrinho está vazio.')

    // Cotação desatualizada: alguma obra do carrinho mudou de preço desde a
    // última cotação. Confirmar aqui seria cobrar um valor que o usuário não
    // viu — então recusamos e a UI pede uma recotação.
    const unavailable = cart.items.some((item) => !getNftSnapshot(item.nftId)?.listed)
    if (unavailable) {
      return errorResponse(
        409,
        'nft_not_listed',
        'Uma obra do carrinho não está mais disponível no mercado.',
      )
    }

    const stale = cart.items.some((item) => {
      const live = getNftSnapshot(item.nftId)
      return !live || live.version > item.version
    })
    if (stale) {
      return errorResponse(
        409,
        'stale_quote',
        'Os preços mudaram. Recote o carrinho para continuar.',
      )
    }

    let order: ReturnType<typeof createOrder>
    try {
      order = createOrder({
        userId,
        request: parsed.data,
        initialStatus: isScenario('payment-declined') ? 'failed' : 'pending',
        items: cart.items,
        totals: {
          subtotalEth: cart.subtotalEth,
          discountEth: cart.discountEth,
          serviceFeeEth: cart.serviceFeeEth,
          totalEth: cart.totalEth,
        },
      })
    } catch (error) {
      if (error instanceof IdempotencyConflictError) {
        return errorResponse(409, 'idempotency_conflict', error.message)
      }
      throw error
    }

    if (order.status === 'settled' || order.status === 'pending') clearCart(userId)

    return HttpResponse.json(orderSchema.parse(order), { status: 201 })
  }),

  http.get(api('/orders'), async ({ request }) => {
    await maybeDelay()

    const userId = currentUserId(request)
    if (!userId) return errorResponse(401, 'unauthenticated', 'Entre para ver seus pedidos.')

    return HttpResponse.json(listOrders(userId).map((order) => orderSchema.parse(order)))
  }),

  http.get(api('/orders/:orderId'), async ({ request, params }) => {
    await maybeDelay()

    const userId = currentUserId(request)
    if (!userId) return errorResponse(401, 'unauthenticated', 'Entre para ver o pedido.')

    const order = getOrder(userId, String(params.orderId))
    if (!order) return errorResponse(404, 'order_not_found', 'Pedido não encontrado.')

    return HttpResponse.json(orderSchema.parse(order))
  }),

  // ── Controle do mock (cenários / reset) ─────────────────────────────────
  http.get(api('/__mock__/state'), () =>
    HttpResponse.json({
      scenario: getScenario(),
      scenarios: SCENARIOS,
      users: listUsers().map((user) => ({ email: user.email, displayName: user.displayName })),
    }),
  ),

  http.post(api('/__mock__/scenario'), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { name?: string }
    return HttpResponse.json({ scenario: setScenario(body.name ?? 'happy-path') })
  }),

  /**
   * Revoga o token informado — simula a expiração da sessão.
   *
   * O token vem no corpo (e não do cabeçalho) porque o próprio E2E o lê do
   * `localStorage` e o entrega. Assim o mock revoga exatamente o token do
   * navegador, mesmo sem tê-lo visto antes (ele é reidratável).
   */
  http.post(api('/__mock__/expire-session'), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { token?: string }
    if (body.token) revokeToken(body.token)
    return HttpResponse.json({ ok: true })
  }),

  /** Arma o timeout de uma única vez no próximo `POST /orders`. */
  http.post(api('/__mock__/arm-checkout-timeout'), () => {
    checkoutTimeoutArmed = true
    return HttpResponse.json({ ok: true })
  }),

  /** Muda um preço "de verdade" e empurra o evento de tempo real. */
  http.post(api('/__mock__/set-price'), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { nftId?: string; priceEth?: string }
    if (!body.nftId || !body.priceEth)
      return errorResponse(422, 'invalid_payload', 'Informe nftId e priceEth.')

    const snapshot = publishPrice(body.nftId, body.priceEth)
    if (!snapshot) return errorResponse(404, 'nft_not_found', 'NFT não encontrado.')
    return HttpResponse.json(snapshot)
  }),

  http.post(api('/__mock__/set-listing'), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      nftId?: string
      listed?: boolean
    }
    if (!body.nftId || typeof body.listed !== 'boolean') {
      return errorResponse(422, 'invalid_payload', 'Informe nftId e listed.')
    }

    const snapshot = publishListing(body.nftId, body.listed)
    if (!snapshot) return errorResponse(404, 'nft_not_found', 'NFT não encontrado.')
    return HttpResponse.json(snapshot)
  }),

  http.post(api('/__mock__/disconnect-sockets'), () => {
    return HttpResponse.json({ disconnected: forceDisconnectClients() })
  }),

  /**
   * Emite um evento de preço cru (sem tocar no estado do mercado).
   *
   * É como o E2E injeta um evento repetido/velho e verifica que a guarda de
   * versão do cliente descarta.
   */
  http.post(api('/__mock__/emit-price'), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      nftId?: string
      priceEth?: string
      version?: number
    }
    if (!body.nftId || !body.priceEth || typeof body.version !== 'number')
      return errorResponse(422, 'invalid_payload', 'Informe nftId, priceEth e version.')

    const snapshot = getNftSnapshot(body.nftId)
    publishRawNftEvent({
      eventId: `evt_manual_${body.nftId}_${body.version}`,
      occurredAt: new Date().toISOString(),
      version: body.version,
      nftId: body.nftId,
      priceEth: body.priceEth,
      previousPriceEth: body.priceEth,
      listed: snapshot?.listed ?? true,
      previousListed: snapshot?.listed ?? true,
    })
    return HttpResponse.json({ ok: true })
  }),

  http.post(api('/__mock__/reset'), () => {
    resetMarketState()
    resetCarts()
    resetOrders()
    resetSessions()
    resetFavorites()
    resetWallets()
    checkoutTimeoutArmed = false
    return HttpResponse.json({ ok: true, scenario: setScenario('happy-path') })
  }),

  // O handler de tempo real precisa vir por último: é um WebSocket, não REST.
  marketHandler,
]
