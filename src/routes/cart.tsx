import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Decimal } from 'decimal.js'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { MobileTopBar } from '@/components/mobile-top-bar'
import { NftCard } from '@/components/nft-card'
import { QtyStepper } from '@/components/qty-stepper'
import { SiteFooter } from '@/components/site-footer'
import { Button } from '@/components/ui/button'
import { fetchCatalog } from '@/features/catalog/api'
import { useSession } from '@/features/auth/session-context'
import { useCart } from '@/hooks/use-cart'
import { useMarketSubscription } from '@/features/realtime/realtime-context'
import { useRealtime } from '@/features/realtime/realtime-context'
import { useIsDesktop } from '@/hooks/use-media-query'
import { apiErrorMessage } from '@/shared/api/errors'
import { queryKeys } from '@/shared/api/query-keys'
import type { NftUpdatedPayload } from '@/shared/realtime/contracts'
import { formatEth } from '@/shared/lib/pricing'

/** Carrinho: itens reservados, cotação oficial e o resumo antes do pagamento. */
export function CartScreen() {
  const { status, scope } = useSession()
  const queryClient = useQueryClient()
  const { socket } = useRealtime()
  const {
    cart,
    isPending,
    isError,
    error,
    quote,
    removeItem,
    setQuantity,
    applyCoupon,
    removeCoupon,
  } = useCart()

  const [promoCode, setPromoCode] = useState('')
  const [couponError, setCouponError] = useState<string | null>(null)
  const isDesktop = useIsDesktop()

  function apply(code: string): void {
    const trimmed = code.trim()
    if (trimmed.length === 0) return

    setCouponError(null)
    applyCoupon.mutate(trimmed, {
      onSuccess: () => {
        setPromoCode('')
        toast.success('Cupom aplicado.')
      },
      onError: (mutationError) => setCouponError(apiErrorMessage(mutationError)),
    })
  }

  function clearCoupon(): void {
    setCouponError(null)
    removeCoupon.mutate(undefined, {
      onSuccess: () => toast.success('Cupom removido.'),
      onError: (mutationError) => toast.error(apiErrorMessage(mutationError)),
    })
  }

  const catalogQuery = useQuery({
    queryKey: queryKeys.catalog.list({}),
    queryFn: () => fetchCatalog({}),
  })

  const items = useMemo(() => cart?.items ?? [], [cart?.items])
  useMarketSubscription(items.map((item) => item.nftId))

  useEffect(() => {
    if (!socket) return

    const handleMarketUpdate = (payload: NftUpdatedPayload): void => {
      const quoteIsStale = items.some(
        (item) => item.nftId === payload.nftId && payload.version > item.version,
      )
      if (quoteIsStale) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.cart(scope) })
      }
    }

    socket.on('nft.updated', handleMarketUpdate)
    return () => {
      socket.off('nft.updated', handleMarketUpdate)
    }
  }, [items, queryClient, scope, socket])
  const cartIds = new Set(items.map((item) => item.nftId))
  const suggestions = (catalogQuery.data?.items ?? [])
    .filter((nft) => !cartIds.has(nft.id))
    .slice(0, 5)

  function updateQuantity(nftId: string, quantity: number): void {
    if (quantity < 1) return
    setQuantity.mutate(
      { nftId, quantity },
      { onError: (mutationError) => toast.error(apiErrorMessage(mutationError)) },
    )
  }

  function remove(nftId: string, name: string): void {
    removeItem.mutate(nftId, {
      onSuccess: () => toast.success(`${name} saiu do carrinho.`),
      onError: (mutationError) => toast.error(apiErrorMessage(mutationError)),
    })
  }

  return (
    <div>
      <div className="mx-auto w-full max-w-page px-5 pt-6">
        <Breadcrumbs
          items={[
            { label: 'Início', to: '/' },
            { label: 'Mercado', to: '/' },
            { label: 'Carrinho' },
          ]}
        />
      </div>

      <MobileTopBar title="Carrinho de NFTs" />
      <h1 className="mx-auto hidden w-full max-w-page px-5 pt-4 text-2xl font-bold text-ink md:block">
        Carrinho
      </h1>

      <section className="mx-auto grid w-full max-w-page gap-8 px-5 py-6 lg:grid-cols-[minmax(0,1fr)_332px]">
        <div className="min-w-0">
          {isPending ? (
            <CartSkeleton />
          ) : isError ? (
            <p
              role="alert"
              className="rounded-lg border border-danger/40 bg-surface p-6 text-sm text-ink"
            >
              {apiErrorMessage(error)}
            </p>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-line bg-surface p-10 text-center">
              <p className="text-sm text-ink-subtle">Seu carrinho está vazio.</p>
              <Button asChild className="mt-5">
                <Link to="/">Continuar explorando</Link>
              </Button>
            </div>
          ) : isDesktop ? (
            <table className="w-full text-left">
              <caption className="sr-only">Itens no carrinho</caption>
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-subtle">
                  <th scope="col" className="pb-3 font-medium">
                    NFTs
                  </th>
                  <th scope="col" className="pb-3 font-medium">
                    Preço
                  </th>
                  <th scope="col" className="pb-3 font-medium">
                    Edições
                  </th>
                  <th scope="col" className="pb-3 text-right font-medium">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.nftId}
                    data-testid={`cart-item-${item.nftId}`}
                    className="border-b border-line align-middle"
                  >
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          width={1254}
                          height={1254}
                          className="size-16 rounded-md object-cover"
                        />
                        <div>
                          <Link
                            to="/nft/$nftId"
                            params={{ nftId: item.nftId }}
                            className="text-sm font-medium text-ink hover:text-brand"
                          >
                            {item.name}
                          </Link>
                          <p className="mt-1 text-xs text-ink-subtle">
                            ID do token: {deriveTokenId(item.nftId)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 text-sm text-ink">
                      <span data-testid={`cart-price-${item.nftId}`}>
                        {formatEth(item.priceEth)} ETH
                      </span>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <QtyStepper
                          quantity={item.quantity}
                          disabled={setQuantity.isPending}
                          onChange={(next) => updateQuantity(item.nftId, next)}
                        />
                        <button
                          type="button"
                          onClick={() => remove(item.nftId, item.name)}
                          className="text-xs text-ink-subtle underline-offset-2 hover:text-danger hover:underline"
                        >
                          Remover
                        </button>
                      </div>
                    </td>
                    <td className="py-4 text-right text-sm font-bold text-ink">
                      {lineTotal(item.priceEth, item.quantity)} ETH
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={item.nftId}
                  data-testid={`cart-item-${item.nftId}`}
                  className="flex items-center gap-3 rounded-2xl bg-surface p-3"
                >
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    width={1254}
                    height={1254}
                    className="size-20 shrink-0 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to="/nft/$nftId"
                        params={{ nftId: item.nftId }}
                        className="truncate text-sm font-medium text-ink hover:text-brand"
                      >
                        {item.name}
                      </Link>
                      <span className="shrink-0 text-sm font-bold text-ink">
                        {lineTotal(item.priceEth, item.quantity)} ETH
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-subtle">
                      Edição: {item.quantity} ·{' '}
                      <span data-testid={`cart-price-${item.nftId}`}>
                        {formatEth(item.priceEth)} ETH
                      </span>
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <QtyStepper
                        quantity={item.quantity}
                        disabled={setQuantity.isPending}
                        onChange={(next) => updateQuantity(item.nftId, next)}
                      />
                      <button
                        type="button"
                        onClick={() => remove(item.nftId, item.name)}
                        className="text-xs text-ink-subtle underline-offset-2 hover:text-danger hover:underline"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Resumo da carteira */}
        <aside aria-label="Resumo da carteira" className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-line bg-surface p-6">
            <h2 className="text-base font-bold text-ink">Resumo da carteira</h2>

            {isPending ? (
              <CartSummarySkeleton />
            ) : (
              <>
                <div className="mt-4">
                  <label htmlFor="promo-code" className="text-sm text-ink-subtle">
                    Código promocional
                  </label>

                  {cart?.couponCode ? (
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-brand/40 bg-brand/5 px-3 py-2">
                      <p className="min-w-0 text-sm text-ink">
                        <span className="font-bold">{cart.couponCode}</span>
                        <span className="text-ink-subtle"> aplicado</span>
                      </p>
                      <button
                        type="button"
                        onClick={clearCoupon}
                        disabled={removeCoupon.isPending}
                        aria-label="Remover cupom"
                        className="shrink-0 text-xs text-ink-subtle underline-offset-2 hover:text-ink hover:underline"
                      >
                        Remover
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="mt-2 flex gap-2">
                        <input
                          id="promo-code"
                          placeholder="Digite o código promocional"
                          value={promoCode}
                          onChange={(event) => setPromoCode(event.target.value)}
                          className="h-10 min-w-0 flex-1 rounded-md border border-field bg-surface-raised px-3 text-sm text-ink placeholder:text-ink-subtle"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => apply(promoCode)}
                          disabled={applyCoupon.isPending || promoCode.trim().length === 0}
                          className="h-10 border-field bg-transparent text-ink hover:bg-surface-raised"
                        >
                          {applyCoupon.isPending ? 'Aplicando…' : 'Aplicar'}
                        </Button>
                      </div>
                      {couponError ? (
                        <p
                          role="alert"
                          data-testid="coupon-error"
                          className="mt-2 text-xs text-danger"
                        >
                          {couponError}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>

                <dl className="mt-6 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-ink-subtle">Subtotal</dt>
                    <dd data-testid="cart-subtotal" className="text-ink">
                      {formatEth(cart?.subtotalEth ?? '0')} ETH
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-ink-subtle">Desconto</dt>
                    <dd data-testid="cart-discount" className="text-ink-subtle">
                      {Number(cart?.discountEth ?? '0') > 0
                        ? `(-) ${formatEth(cart!.discountEth)} ETH`
                        : '(-) 0.00'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-ink-subtle">Taxa de rede (estimada)</dt>
                    <dd data-testid="cart-fee" className="text-ink">
                      {formatEth(cart?.serviceFeeEth ?? '0')} ETH
                    </dd>
                  </div>
                  <div className="flex items-center justify-between border-t border-line pt-3 text-base">
                    <dt className="font-bold text-ink">Total</dt>
                    <dd data-testid="cart-total" className="font-bold text-ink">
                      {formatEth(cart?.totalEth ?? '0')} ETH
                    </dd>
                  </div>
                </dl>

                <div className="mt-6 space-y-3">
                  {status === 'authenticated' ? (
                    <Button asChild className="h-11 w-full font-bold" disabled={items.length === 0}>
                      <Link to="/checkout">Conectar e finalizar</Link>
                    </Button>
                  ) : (
                    <Button asChild className="h-11 w-full font-bold" disabled={items.length === 0}>
                      <Link to="/login" search={{ redirect: '/checkout' }}>
                        Conectar e finalizar
                      </Link>
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      quote.mutate(undefined, {
                        onSuccess: () => toast.success('Preços recotados com o servidor.'),
                        onError: (mutationError) => toast.error(apiErrorMessage(mutationError)),
                      })
                    }
                    disabled={quote.isPending || items.length === 0}
                    className="w-full text-ink-subtle hover:text-ink"
                  >
                    {quote.isPending ? 'Recotando…' : 'Recotar preços'}
                  </Button>

                  <Button asChild variant="ghost" className="w-full text-ink-subtle hover:text-ink">
                    <Link to="/">Continuar explorando</Link>
                  </Button>
                </div>
              </>
            )}
          </div>
        </aside>
      </section>

      {suggestions.length > 0 ? (
        <section
          aria-labelledby="cart-suggestions"
          className="mx-auto w-full max-w-page px-5 pb-12"
        >
          <h2 id="cart-suggestions" className="text-lg font-bold text-ink">
            Colecionadores também viram
          </h2>
          <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {suggestions.map((nft) => (
              <li key={nft.id}>
                <NftCard nft={nft} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <SiteFooter />
    </div>
  )
}

function CartSkeleton() {
  return (
    <div aria-busy="true" className="space-y-4">
      <p className="sr-only">Carregando carrinho…</p>
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex items-center gap-4 border-b border-line pb-4">
          <div className="size-16 shimmer rounded-md" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 shimmer rounded" />
            <div className="h-3 w-24 shimmer rounded" />
          </div>
          <div className="h-8 w-24 shimmer rounded" />
        </div>
      ))}
    </div>
  )
}

/**
 * Esqueleto do resumo da carteira.
 *
 * Repete as dimensões do resumo real (campo de cupom, quatro linhas de totais
 * e os botões) para não haver salto de layout quando os números chegam.
 */
function CartSummarySkeleton() {
  return (
    <div aria-busy="true" data-testid="cart-summary-skeleton" className="mt-4 space-y-6">
      <p className="sr-only">Carregando resumo do carrinho…</p>

      <div>
        <div className="h-4 w-40 shimmer rounded" />
        <div className="mt-2 h-10 w-full shimmer rounded-md" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="h-4 w-28 shimmer rounded" />
            <div className="h-4 w-16 shimmer rounded" />
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="h-11 w-full shimmer rounded-md" />
        <div className="h-10 w-full shimmer rounded-md" />
      </div>
    </div>
  )
}

/** Total da linha: preço vivo × quantidade, sem erro de ponto flutuante. */
function lineTotal(priceEth: string, quantity: number): string {
  return formatEth(new Decimal(priceEth).mul(quantity).toFixed(3))
}

/** `emerald-ape-042` -> `#0042`. */
function deriveTokenId(nftId: string): string {
  const match = nftId.match(/(\d+)$/)
  return match ? `#${match[1].padStart(4, '0')}` : '#0000'
}
