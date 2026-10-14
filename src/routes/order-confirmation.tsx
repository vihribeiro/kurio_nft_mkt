import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-context'
import { fetchOrder } from '@/features/orders/api'
import { fetchWallets } from '@/features/wallets/api'
import { useIsDesktop } from '@/hooks/use-media-query'
import { apiErrorMessage } from '@/shared/api/errors'
import { queryKeys } from '@/shared/api/query-keys'
import { formatEth } from '@/shared/lib/pricing'
import type { Order } from '@/shared/contracts/order'

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/**
 * Confirmação do pedido.
 *
 * É uma ROTA endereçável, e não um modal em memória: atualizar a página ou
 * compartilhar o link continua mostrando o mesmo pedido. Em telas largas se
 * desenha como diálogo sobre o conteúdo; no celular, como página.
 */
export function OrderConfirmationScreen() {
  const { orderId } = useParams({ from: '/order/$orderId' })
  const { scope } = useSession()
  const isDesktop = useIsDesktop()
  const navigate = useNavigate()

  const orderQuery = useQuery({
    queryKey: queryKeys.order(scope, orderId),
    queryFn: () => fetchOrder(orderId),
    refetchInterval: (query) =>
      query.state.data?.status === 'pending' || query.state.data?.status === 'settling'
        ? 1_000
        : false,
  })

  const walletsQuery = useQuery({
    queryKey: queryKeys.wallets(scope),
    queryFn: fetchWallets,
  })

  const close = (): void => {
    void navigate({ to: '/' })
  }

  if (orderQuery.isPending) {
    return (
      <section className="mx-auto w-full max-w-[578px] px-5 py-16" aria-busy="true">
        <p className="sr-only">Carregando pedido…</p>
        <div className="h-6 w-64 shimmer rounded" />
        <div className="mt-6 h-40 w-full shimmer rounded-xl" />
      </section>
    )
  }

  if (orderQuery.isError || !orderQuery.data) {
    return (
      <section className="mx-auto w-full max-w-[578px] px-5 py-16 text-center">
        <h1 className="text-xl font-bold text-ink">Pedido não encontrado</h1>
        <p className="mt-3 text-sm text-ink-subtle">{apiErrorMessage(orderQuery.error)}</p>
        <Button asChild className="mt-6">
          <Link to="/">Voltar ao catálogo</Link>
        </Button>
      </section>
    )
  }

  const order = orderQuery.data

  if (order.status === 'pending' || order.status === 'settling') {
    const message = (
      <>
        <div className="mx-auto size-10 animate-spin rounded-full border-4 border-line border-t-brand" />
        <p className="mt-3 text-sm text-ink-subtle">
          Estamos aguardando a confirmação da carteira. Seu pedido é {order.code}.
        </p>
      </>
    )

    if (isDesktop) {
      return (
        <Dialog open onOpenChange={(open) => !open && close()}>
          <DialogContent className="w-full border-line bg-surface p-8 text-center sm:max-w-[578px]">
            <DialogTitle className="text-xl font-bold text-ink">
              Pagamento em processamento
            </DialogTitle>
            <DialogDescription className="sr-only">
              Aguardando confirmação do pedido {order.code}.
            </DialogDescription>
            {message}
          </DialogContent>
        </Dialog>
      )
    }

    return (
      <section
        className="mx-auto w-full max-w-[578px] px-5 py-16 text-center"
        aria-live="polite"
        aria-busy="true"
      >
        <h1 className="mt-6 text-xl font-bold text-ink">Pagamento em processamento</h1>
        {message}
      </section>
    )
  }

  if (order.status === 'failed') {
    const message = (
      <>
        <p className="mt-3 text-sm text-ink-subtle">
          O pedido {order.code} não foi liquidado. Revise a forma de pagamento e tente novamente.
        </p>
        <Button asChild className="mt-6">
          <Link to="/cart">Voltar ao carrinho</Link>
        </Button>
      </>
    )

    if (isDesktop) {
      return (
        <Dialog open onOpenChange={(open) => !open && close()}>
          <DialogContent className="w-full border-line bg-surface p-8 text-center sm:max-w-[578px]">
            <DialogTitle className="text-xl font-bold text-ink">
              Pagamento não confirmado
            </DialogTitle>
            <DialogDescription className="sr-only">
              O pagamento do pedido {order.code} foi recusado.
            </DialogDescription>
            {message}
          </DialogContent>
        </Dialog>
      )
    }

    return (
      <section className="mx-auto w-full max-w-[578px] px-5 py-16 text-center" role="alert">
        <h1 className="text-xl font-bold text-ink">Pagamento não confirmado</h1>
        {message}
      </section>
    )
  }

  const walletLabel = walletsQuery.data?.find(
    (wallet) => wallet.address === order.walletAddress,
  )?.label
  const receipt = <OrderReceipt order={order} walletLabel={walletLabel} onClose={close} />

  if (isDesktop) {
    return (
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) close()
        }}
      >
        <DialogContent className="max-h-[90dvh] w-full gap-0 overflow-y-auto border-line bg-surface p-8 sm:max-w-[578px]">
          <DialogTitle className="sr-only">Pedido confirmado</DialogTitle>
          <DialogDescription className="sr-only">Resumo do pedido {order.code}.</DialogDescription>
          {receipt}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <section className="mx-auto w-full max-w-[578px] px-5 py-10">
      <h1 className="sr-only">Pedido confirmado</h1>
      {receipt}
    </section>
  )
}

function OrderReceipt({
  order,
  walletLabel,
  onClose,
}: {
  order: Order
  walletLabel?: string
  onClose: () => void
}) {
  return (
    <div>
      <h2 className="text-xl font-bold text-ink">Seus NFTs agora estão na sua carteira</h2>
      <p data-testid="order-collector" className="mt-2 text-sm text-ink-subtle">
        {order.collector.displayName} · {order.collector.email}
      </p>
      {order.note ? (
        <p data-testid="order-note" className="mt-2 text-sm text-ink-subtle">
          Observação: {order.note}
        </p>
      ) : null}

      <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-ink-subtle">ID da transação</dt>
          <dd data-testid="order-code" className="mt-1 font-medium text-ink">
            {order.code}
          </dd>
        </div>
        <div>
          <dt className="text-ink-subtle">Data</dt>
          <dd className="mt-1 text-ink">{formatOrderDate(order.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-ink-subtle">Total</dt>
          <dd className="mt-1 text-ink">{formatEth(order.totalEth)} ETH</dd>
        </div>
        <div>
          <dt className="text-ink-subtle">Carteira</dt>
          <dd className="mt-1 text-ink">{walletLabel ?? shortAddress(order.walletAddress)}</dd>
        </div>
        <div>
          <dt className="text-ink-subtle">Rede</dt>
          <dd data-testid="order-network" className="mt-1 text-ink">
            {order.network}
          </dd>
        </div>
      </dl>

      <div className="mt-6 border-t border-line pt-6">
        <h3 className="text-sm font-bold text-ink">Detalhes da transação</h3>

        <div className="mt-4 hidden grid-cols-[1fr_auto_auto] gap-4 text-xs uppercase tracking-wide text-ink-subtle sm:grid">
          <span>NFTs</span>
          <span>Edições</span>
          <span className="text-right">Subtotal</span>
        </div>

        <ul className="mt-2 divide-y divide-line">
          {order.items.map((item) => (
            <li
              key={item.nftId}
              className="grid grid-cols-1 gap-1 py-3 text-sm sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-4"
            >
              <div className="flex items-center gap-3">
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  width={1254}
                  height={1254}
                  className="size-10 rounded-md object-cover"
                />
                <div>
                  <p className="text-ink">{item.name}</p>
                  <p className="text-xs text-ink-subtle">
                    ID do token: {deriveTokenId(item.nftId)}
                  </p>
                </div>
              </div>
              <span className="text-ink-subtle">(× {item.quantity})</span>
              <span className="font-medium text-ink sm:text-right">
                {lineTotal(item.priceEth, item.quantity)} ETH
              </span>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
          {Number(order.discountEth) > 0 ? (
            <div className="flex items-center justify-between">
              <dt className="text-ink-subtle">Desconto</dt>
              <dd data-testid="order-discount" className="text-ink-subtle">
                (-) {formatEth(order.discountEth)} ETH
              </dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <dt className="text-ink-subtle">Taxa de rede</dt>
            <dd className="text-ink">{formatEth(order.serviceFeeEth)} ETH</dd>
          </div>
          <div className="flex items-center justify-between text-base">
            <dt className="font-bold text-ink">Total</dt>
            <dd data-testid="order-total" className="font-bold text-ink">
              {formatEth(order.totalEth)} ETH
            </dd>
          </div>
        </dl>
      </div>

      <p className="mt-6 text-sm leading-relaxed text-ink-subtle">
        Transação confirmada na Ethereum. A propriedade foi transferida para sua carteira conectada
        e registrada na rede.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <a
          href={`https://etherscan.io/tx/${order.code}`}
          target="_blank"
          rel="noreferrer noopener"
          className="text-sm font-bold text-brand underline-offset-4 hover:text-brand-strong hover:underline"
        >
          Ver no Etherscan
        </a>
        <Button onClick={onClose} className="font-bold sm:ml-auto">
          Continuar explorando
        </Button>
      </div>
    </div>
  )
}

function formatOrderDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}, ${date.getUTCFullYear()}`
}

function lineTotal(priceEth: string, quantity: number): string {
  return formatEth((Number(priceEth) * quantity).toFixed(3))
}

function shortAddress(address: string): string {
  if (address.length < 12) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function deriveTokenId(nftId: string): string {
  const match = nftId.match(/(\d+)$/)
  return match ? `#${match[1].padStart(4, '0')}` : '#0000'
}
