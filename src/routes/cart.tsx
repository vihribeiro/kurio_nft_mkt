import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronLeft, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Decimal } from 'decimal.js'
import { Breadcrumbs } from '@/components/breadcrumbs'
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
      <div className="mx-auto hidden w-full max-w-page px-5 pt-6 md:block xl:px-0">
        <Breadcrumbs
          items={[
            { label: 'Início', to: '/' },
            { label: 'Mercado', to: '/' },
            { label: 'Carrinho' },
          ]}
        />
      </div>

      <div className="relative flex h-[72px] items-center justify-center px-7 pt-2 md:hidden">
        <Link
          to="/"
          aria-label="Voltar"
          className="absolute left-7 top-8 flex size-9 items-center justify-center rounded-full border border-line bg-surface text-ink-muted"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </Link>
        <span className="translate-y-[15px] text-xl font-bold text-ink">Carrinho de NFTs</span>
      </div>
      <h1 className="sr-only">Carrinho de NFTs</h1>

      <section className="mx-auto grid w-full max-w-page grid-cols-1 gap-0 px-7 pb-[365px] pt-4 md:gap-8 md:px-5 md:py-6 lg:grid-cols-[minmax(0,1fr)_332px] xl:gap-[86px] xl:px-0">
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
            <table className="w-full border-separate text-left [border-spacing:0_6px] md:relative md:top-[-9px]">
              <caption className="sr-only">Itens no carrinho</caption>
              <colgroup>
                <col className="w-[40%]" />
                <col className="w-[17%]" />
                <col className="w-[18%]" />
                <col className="w-[18%]" />
                <col className="w-[7%]" />
              </colgroup>
              <thead>
                <tr className="text-xs uppercase tracking-wide text-ink-subtle">
                  <th scope="col" className="border-b border-line pb-3 font-medium">
                    NFTs
                  </th>
                  <th scope="col" className="border-b border-line pb-3 font-medium">
                    Preço
                  </th>
                  <th scope="col" className="border-b border-line pb-3 font-medium">
                    Edições
                  </th>
                  <th scope="col" className="border-b border-line pb-3 text-right font-medium">
                    Total
                  </th>
                  <th scope="col" className="border-b border-line pb-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.nftId}
                    data-testid={`cart-item-${item.nftId}`}
                    className="h-[70px] bg-surface"
                  >
                    <td className="p-0">
                      <div className="flex h-[70px] items-center gap-4">
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          width={1254}
                          height={1254}
                          className="size-[70px] rounded-[6px] object-cover"
                        />
                        <div className="min-w-0">
                          <Link
                            to="/nft/$nftId"
                            params={{ nftId: item.nftId }}
                            className="text-sm font-medium text-ink hover:text-brand"
                          >
                            <span className="block truncate">{item.name}</span>
                          </Link>
                          <p className="text-xs text-ink-subtle">
                            ID do token: {deriveTokenId(item.nftId)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="text-sm font-bold text-brand">
                      <span data-testid={`cart-price-${item.nftId}`}>
                        {formatEth(item.priceEth)} ETH
                      </span>
                    </td>
                    <td>
                      <QtyStepper
                        quantity={item.quantity}
                        disabled={setQuantity.isPending}
                        onChange={(next) => updateQuantity(item.nftId, next)}
                      />
                    </td>
                    <td className="text-right text-sm font-bold text-brand">
                      {lineTotal(item.priceEth, item.quantity)} ETH
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => remove(item.nftId, item.name)}
                        aria-label={`Remover ${item.name}`}
                        className="inline-flex size-8 items-center justify-center text-ink-muted transition-colors hover:text-danger"
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <ul className="space-y-5">
              {items.map((item) => (
                <li
                  key={item.nftId}
                  data-testid={`cart-item-${item.nftId}`}
                  className="group relative flex h-[100px] items-center gap-[7px] rounded-[14px] bg-surface pr-3"
                >
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    width={1254}
                    height={1254}
                    className="size-[100px] shrink-0 rounded-[14px] object-cover"
                  />
                  <div className="min-w-0 flex-1 self-stretch py-[12px] pr-[76px]">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to="/nft/$nftId"
                        params={{ nftId: item.nftId }}
                        className="truncate text-sm font-bold text-ink hover:text-brand"
                      >
                        {item.name}
                      </Link>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      Edição: {item.edition.replace(/\s+de\s+/i, '/')}
                    </p>
                    <p className="mt-[14px] text-base font-bold text-brand">
                      <span data-testid={`cart-price-${item.nftId}`}>
                        {formatEth(item.priceEth)} ETH
                      </span>
                    </p>
                  </div>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 md:right-[calc(7%+8px)]">
                    <QtyStepper
                      quantity={item.quantity}
                      disabled={setQuantity.isPending}
                      onChange={(next) => updateQuantity(item.nftId, next)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(item.nftId, item.name)}
                    aria-label={`Remover ${item.name}`}
                    className="absolute right-3 top-3 flex size-6 items-center justify-center text-ink-muted opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Resumo da carteira */}
        <aside
          aria-label="Resumo da carteira"
          className="fixed inset-x-0 bottom-0 z-30 self-start rounded-t-[40px] bg-surface px-6 pb-5 pt-6 shadow-[0_-12px_30px_rgb(10_6_4_/_30%)] md:static md:rounded-none md:bg-transparent md:p-0 md:shadow-none"
        >
          <div className="mx-auto max-w-page md:mx-0 md:max-w-none">
            <h2 className="hidden border-b border-line pb-2 text-base font-bold text-ink md:block">
              Resumo da carteira
            </h2>

            {isPending ? (
              <CartSummarySkeleton />
            ) : (
              <>
                <div className="mt-0 lg:mt-4">
                  <label htmlFor="promo-code" className="hidden text-sm text-ink-subtle md:block">
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
                      <div className="mt-0 flex h-[50px] gap-0 md:mt-2 md:h-10 md:gap-2">
                        <input
                          id="promo-code"
                          placeholder="Digite o código promocional"
                          value={promoCode}
                          onChange={(event) => setPromoCode(event.target.value)}
                          className="h-full min-w-0 flex-1 rounded-l-full border border-field bg-surface-raised px-3 text-xs text-ink placeholder:text-ink-subtle md:rounded-md md:text-sm"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => apply(promoCode)}
                          disabled={applyCoupon.isPending || promoCode.trim().length === 0}
                          className="h-full w-[97px] shrink-0 rounded-r-full border-0 bg-brand px-2 text-sm font-bold text-canvas hover:bg-brand-strong md:w-auto md:rounded-md md:border-field md:bg-transparent md:text-ink md:hover:bg-surface-raised"
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

                <dl className="mt-3 space-y-2 text-sm md:mt-6 md:space-y-3">
                  <div className="flex items-center justify-between">
                    <dt className="text-ink-subtle">Subtotal</dt>
                    <dd data-testid="cart-subtotal" className="text-ink">
                      {formatEth(cart?.subtotalEth ?? '0')} ETH
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-ink-subtle">Desconto do lançamento</dt>
                    <dd data-testid="cart-discount" className="text-ink-subtle">
                      {Number(cart?.discountEth ?? '0') > 0
                        ? `(-) ${formatEth(cart!.discountEth)} ETH`
                        : '(-) 0.00'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-ink-subtle">Taxa de rede</dt>
                    <dd className="flex flex-col items-end text-ink">
                      <span data-testid="cart-fee">
                        {formatEth(cart?.serviceFeeEth ?? '0')} ETH
                      </span>
                      <span className="text-[10px] text-brand">Taxa estimada</span>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between pt-0 text-base md:pt-[18px]">
                    <dt className="font-bold text-ink">Total</dt>
                    <dd data-testid="cart-total" className="font-bold text-brand">
                      {formatEth(cart?.totalEth ?? '0')} ETH
                    </dd>
                  </div>
                </dl>

                <div className="mt-6 space-y-3 md:mt-5 md:space-y-1">
                  {status === 'authenticated' ? (
                    <Button
                      asChild
                      className="h-[60px] w-full rounded-full font-bold md:h-10 md:rounded-[5px]"
                      disabled={items.length === 0}
                    >
                      <Link to="/checkout">Conectar e finalizar</Link>
                    </Button>
                  ) : (
                    <Button
                      asChild
                      className="h-[60px] w-full rounded-full font-bold md:h-10 md:rounded-[5px]"
                      disabled={items.length === 0}
                    >
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
                    className="hidden w-full text-ink-subtle hover:text-ink"
                  >
                    {quote.isPending ? 'Recotando…' : 'Recotar preços'}
                  </Button>

                  <Button
                    asChild
                    variant="ghost"
                    className="hidden w-full text-brand hover:text-brand-strong md:flex"
                  >
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
          className="mx-auto hidden w-full max-w-page px-5 pb-12 pt-[96px] lg:block"
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

      <div className="hidden md:block">
        <SiteFooter />
      </div>
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
