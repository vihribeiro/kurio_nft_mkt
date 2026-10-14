import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { MobileTopBar } from '@/components/mobile-top-bar'
import { SiteFooter } from '@/components/site-footer'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-context'
import { createOrder } from '@/features/orders/api'
import { checkoutCollectorSchema } from '@/shared/contracts/order'
import { useLiveNftUpdates } from '@/features/realtime/use-live-prices'
import { fetchWallets } from '@/features/wallets/api'
import { useCart } from '@/hooks/use-cart'
import { apiErrorCode, apiErrorMessage } from '@/shared/api/errors'
import { queryKeys } from '@/shared/api/query-keys'
import { formatEth } from '@/shared/lib/pricing'

/**
 * Pagamento.
 *
 * Os campos do perfil vêm da sessão e são somente-leitura aqui (a edição vive
 * na tela de perfil). O que o usuário ESCOLHE é a carteira de pagamento; o
 * total, porém, nunca é calculado no cliente — ele vem do `POST /orders`, que
 * responde com o pedido confirmado.
 *
 * Cotação viva: enquanto a tela está aberta, assinamos os preços das obras no
 * carrinho. Se algum mudar, a cotação exibida deixa de valer e o botão de
 * confirmar é bloqueado até o usuário recotar — cobrar um valor que ele não viu
 * seria o pior desfecho possível.
 */
export function CheckoutScreen() {
  const { user, scope } = useSession()
  const { cart, quote } = useCart()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [note, setNote] = useState('')
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null)
  const [walletConnected, setWalletConnected] = useState(true)
  const [network, setNetwork] = useState('Ethereum')
  const [collectorName, setCollectorName] = useState(user?.displayName ?? '')
  const [collectorEmail, setCollectorEmail] = useState(user?.email ?? '')
  const [ensName, setEnsName] = useState('')
  const [collectorErrors, setCollectorErrors] = useState<{
    displayName?: string
    email?: string
    ensName?: string
  }>({})
  const [serverStale, setServerStale] = useState(false)
  const [serverUnavailable, setServerUnavailable] = useState(false)

  const walletsQuery = useQuery({
    queryKey: queryKeys.wallets(scope),
    queryFn: fetchWallets,
  })

  const wallets = walletsQuery.data ?? []
  const selectedWallet =
    wallets.find((wallet) => wallet.id === selectedWalletId) ??
    wallets.find((wallet) => wallet.isPrimary) ??
    wallets[0]

  const createOrderMutation = useMutation({
    mutationFn: createOrder,
    onSuccess: (order) => {
      // O servidor já esvaziou o carrinho; aqui o cache local acompanha, para
      // que o contador do cabeçalho e a tela do carrinho não fiquem defasados.
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart(scope) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders(scope) })
      return order
    },
  })

  const items = cart?.items ?? []

  // Assina os preços das obras do carrinho e detecta cotação obsoleta. Evento
  // mais novo que a versão cotada = a tela mostra um preço que já mudou.
  const liveUpdates = useLiveNftUpdates(items.map((item) => item.nftId))
  const hasStaleItems = items.some(
    (item) => (liveUpdates[item.nftId]?.version ?? item.version) > item.version,
  )
  const isStale = hasStaleItems || serverStale
  const hasUnavailableItems = items.some((item) => liveUpdates[item.nftId]?.listed === false)
  const isUnavailable = hasUnavailableItems || serverUnavailable

  async function requote(): Promise<void> {
    try {
      await quote.mutateAsync()
      setServerStale(false)
      setServerUnavailable(false)
      toast.success('Carrinho atualizado com o servidor.')
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  async function confirmPurchase(): Promise<void> {
    if (!selectedWallet) {
      toast.error('Selecione uma carteira para pagar.')
      return
    }
    if (!walletConnected) {
      toast.error('Conecte a carteira antes de confirmar o pagamento.')
      return
    }
    const collectorResult = checkoutCollectorSchema.safeParse({
      displayName: collectorName,
      email: collectorEmail,
      ensName,
    })
    if (!collectorResult.success) {
      const errors: { displayName?: string; email?: string; ensName?: string } = {}
      for (const issue of collectorResult.error.issues) {
        const field = issue.path[0]
        if (
          (field === 'displayName' || field === 'email' || field === 'ensName') &&
          !errors[field]
        ) {
          errors[field] = issue.message
        }
      }
      setCollectorErrors(errors)
      toast.error('Confira os campos destacados do colecionador.')
      return
    }
    setCollectorErrors({})

    try {
      const order = await createOrderMutation.mutateAsync({
        idempotencyKey,
        paymentMethod: 'wallet',
        walletAddress: selectedWallet.address,
        network,
        collector: collectorResult.data,
        note: note.trim() || undefined,
      })
      if (order.status === 'failed') toast.error('Pagamento recusado pela carteira.')
      else toast.success('Pedido criado. Aguardando confirmação da carteira.')
      await navigate({ to: '/order/$orderId', params: { orderId: order.id } })
    } catch (error) {
      // O servidor pode recusar por cotação velha mesmo que o cliente não tenha
      // percebido (ex.: a mudança chegou enquanto o pedido ia). Tratamos igual.
      if (apiErrorCode(error) === 'stale_quote') {
        setServerStale(true)
        toast.error(apiErrorMessage(error, 'Os preços mudaram. Recote para continuar.'))
        return
      }
      if (apiErrorCode(error) === 'nft_not_listed') {
        setServerUnavailable(true)
        toast.error(apiErrorMessage(error, 'Uma obra do carrinho não está mais à venda.'))
        return
      }
      if (apiErrorCode(error) === 'wallet_disconnected') {
        setWalletConnected(false)
        toast.error(apiErrorMessage(error, 'A carteira foi desconectada.'))
        return
      }
      if (apiErrorCode(error) === 'idempotency_conflict') {
        toast.error('Esta tentativa já foi usada com outros dados. Inicie um novo checkout.')
        return
      }
      toast.error(apiErrorMessage(error, 'Não foi possível confirmar a compra.'))
    }
  }

  return (
    <div>
      <MobileTopBar title="Pagamento com carteira" />
      <div className="mx-auto hidden w-full max-w-page px-5 pt-6 md:block">
        <Breadcrumbs
          items={[
            { label: 'Início', to: '/' },
            { label: 'Mercado', to: '/' },
            { label: 'Pagamento' },
          ]}
        />
      </div>

      <section className="mx-auto grid w-full max-w-page gap-10 px-5 py-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* Dados revisáveis do colecionador */}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink">Perfil do colecionador</h1>
          <p className="mt-2 text-sm text-ink-subtle">
            Confira os dados que serão associados a este pedido antes de pagar.
          </p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <EditableField
              id="displayName"
              label="Nome de exibição *"
              value={collectorName}
              onChange={(value) => {
                setCollectorName(value)
                setCollectorErrors((previous) => ({ ...previous, displayName: undefined }))
              }}
              error={collectorErrors.displayName}
              required
            />
            <ReadOnlyField id="handle" label="Nome de usuário *" value={user?.handle ?? ''} />
            <label htmlFor="network" className="block text-sm text-ink-subtle">
              Rede *
              <select
                id="network"
                aria-label="Rede"
                value={network}
                onChange={(event) => setNetwork(event.target.value)}
                className="mt-2 h-10 w-full rounded-md border border-field bg-canvas px-3 text-sm text-ink"
              >
                {[
                  ...new Set([selectedWallet?.chain ?? 'Ethereum', 'Ethereum', 'Polygon', 'Base']),
                ].map((chain) => (
                  <option key={chain} value={chain}>
                    {chain}
                  </option>
                ))}
              </select>
            </label>
            <ReadOnlyField
              id="profileName"
              label="Nome do perfil *"
              value={user?.displayName ?? ''}
            />
            <ReadOnlyField
              id="walletAddress"
              label="Endereço da carteira *"
              value={selectedWallet?.address ?? user?.walletAddress ?? ''}
            />
            <EditableField
              id="ens"
              label="ENS (opcional)"
              value={ensName}
              onChange={(value) => {
                setEnsName(value)
                setCollectorErrors((previous) => ({ ...previous, ensName: undefined }))
              }}
              placeholder="nome.eth"
              error={collectorErrors.ensName}
              maxLength={100}
            />
            <ReadOnlyField id="walletType" label="Tipo de carteira *" value="Carteira externa" />
            <ReadOnlyField id="referral" label="Código de indicação *" value="KURIO" />
            <EditableField
              id="email"
              label="E-mail *"
              type="email"
              value={collectorEmail}
              onChange={(value) => {
                setCollectorEmail(value)
                setCollectorErrors((previous) => ({ ...previous, email: undefined }))
              }}
              error={collectorErrors.email}
              required
            />
            <ReadOnlyField
              id="ensName"
              label="Perfil ENS vinculado"
              value={user?.handle ? `${user.handle}.eth` : 'Não vinculado'}
            />
          </div>

          <div className="mt-6">
            <label htmlFor="checkout-note" className="text-sm text-ink-subtle">
              Observação do colecionador (opcional)
            </label>
            <textarea
              id="checkout-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Alguma observação para este pedido?"
              className="mt-2 w-full rounded-md border border-field bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink-subtle"
            />
            <p className="mt-1 text-xs text-ink-subtle">
              A observação será salva no snapshot deste pedido.
            </p>
          </div>
        </div>

        {/* Seus NFTs + pagamento */}
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="p-6">
            <h2 className="text-base font-bold text-ink">Seus NFTs</h2>

            <ul className="mt-4 space-y-3">
              {items.map((item) => (
                <li key={item.nftId} className="flex items-center gap-3 bg-surface">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    width={1254}
                    height={1254}
                    className="size-12 rounded-md object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">
                      {item.name} <span className="text-ink-subtle">(× {item.quantity})</span>
                    </p>
                    <p className="text-xs text-ink-subtle">
                      ID do token: {deriveTokenId(item.nftId)}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-ink">{formatEth(item.priceEth)} ETH</span>
                </li>
              ))}
              {items.length === 0 ? (
                <li className="text-sm text-ink-subtle">
                  Seu carrinho está vazio.{' '}
                  <Link to="/" className="text-brand hover:text-brand-strong">
                    Explorar NFTs
                  </Link>
                </li>
              ) : null}
            </ul>

            <Link
              to="/cart"
              className="mt-4 inline-block text-xs text-brand underline-offset-2 hover:text-brand-strong hover:underline"
            >
              Tem um código promocional? Aplique no carrinho
            </Link>

            <dl className="mt-5 space-y-3 border-t border-line pt-5 text-sm">
              <Row label="Subtotal" value={`${formatEth(cart?.subtotalEth ?? '0')} ETH`} />
              {Number(cart?.discountEth ?? '0') > 0 ? (
                <Row label="Desconto" value={`(-) ${formatEth(cart!.discountEth)} ETH`} muted />
              ) : (
                <Row label="Desconto do lançamento" value="(-) 0.00" muted />
              )}
              <Row label="Taxa de rede" value={`${formatEth(cart?.serviceFeeEth ?? '0')} ETH`} />
              <div className="flex items-center justify-between border-t border-line pt-3 text-base">
                <dt className="font-bold text-ink">Total</dt>
                <dd data-testid="checkout-total" className="font-bold text-ink">
                  {formatEth(cart?.totalEth ?? '0')} ETH
                </dd>
              </div>
            </dl>

            {/* Carteira de pagamento */}
            <fieldset className="-mx-4 mt-6 w-[calc(100%+32px)]">
              <legend className="w-full text-left text-sm font-bold text-ink md:text-center">
                Carteira e rede
              </legend>
              <div className="mt-3 space-y-4">
                {walletsQuery.isPending ? (
                  <div className="h-16 shimmer rounded-[15px] md:h-11 md:rounded-[3px]" />
                ) : wallets.length === 0 ? (
                  <p className="text-sm text-ink-subtle">Nenhuma carteira conectada.</p>
                ) : (
                  wallets.map((wallet) => (
                    <label
                      key={wallet.id}
                      className={`flex h-[65px] cursor-pointer items-center gap-3 rounded-[15px] border border-transparent bg-surface px-3.5 transition-colors md:h-11 md:rounded-[3px] md:bg-transparent md:px-3 ${
                        selectedWallet?.id === wallet.id ? 'md:border-brand' : 'md:border-field'
                      }`}
                    >
                      <input
                        type="radio"
                        name="wallet"
                        value={wallet.id}
                        aria-label={wallet.label}
                        checked={selectedWallet?.id === wallet.id}
                        onChange={() => {
                          setSelectedWalletId(wallet.id)
                          setWalletConnected(true)
                        }}
                        className="order-3 ml-auto size-4 shrink-0 accent-brand md:order-1 md:ml-0"
                      />
                      <WalletOptionMark label={wallet.label} />
                      <span className="min-w-0 flex-1 md:order-2">
                        <span className="block truncate text-sm text-ink md:hidden">
                          {wallet.label}
                        </span>
                        {isWalletConnect(wallet.label) ? (
                          <span className="hidden h-[25px] items-center gap-2 rounded-[5px] bg-surface-overlay px-2 text-[9px] font-bold tracking-wide text-brand md:inline-flex">
                            <span>METAMASK</span>
                            <span aria-hidden="true">·</span>
                            <span>WALLETCONNECT</span>
                            <span aria-hidden="true">·</span>
                            <span>COINBASE</span>
                          </span>
                        ) : (
                          <span className="hidden truncate text-sm text-ink md:block">
                            {wallet.label}
                          </span>
                        )}
                      </span>
                    </label>
                  ))
                )}
              </div>
              {selectedWallet && walletConnected ? (
                <p role="status" className="sr-only">
                  Carteira conectada
                </p>
              ) : null}
              {selectedWallet && !walletConnected ? (
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p role="status" className="text-xs text-ink-subtle">
                    Carteira desconectada
                  </p>
                  <button
                    type="button"
                    onClick={() => setWalletConnected(true)}
                    className="text-xs font-medium text-brand underline-offset-2 hover:underline"
                  >
                    Reconectar carteira
                  </button>
                </div>
              ) : null}
            </fieldset>

            {isStale ? (
              <div
                role="alert"
                data-testid="stale-quote-alert"
                className="mt-6 rounded-md border border-danger/40 bg-danger/5 p-4 text-sm"
              >
                <p className="font-bold text-ink">Os preços mudaram.</p>
                <p className="mt-1 text-ink-subtle">
                  A cotação exibida ficou desatualizada. Recote para ver os valores atuais antes de
                  confirmar.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void requote()}
                  disabled={quote.isPending}
                  className="mt-3 border-field bg-transparent text-ink hover:bg-surface-raised"
                >
                  {quote.isPending ? 'Recotando…' : 'Recotar preços'}
                </Button>
              </div>
            ) : null}

            {isUnavailable ? (
              <div
                role="alert"
                className="mt-4 rounded-md border border-danger/40 bg-danger/5 p-4 text-sm"
              >
                <p>
                  Uma obra do carrinho não está mais disponível. Recote o carrinho para atualizar os
                  itens antes de continuar.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void requote()}
                  disabled={quote.isPending}
                  className="mt-3 block border-field bg-transparent text-ink hover:bg-surface-raised"
                >
                  {quote.isPending ? 'Atualizando…' : 'Atualizar carrinho'}
                </Button>
              </div>
            ) : null}

            <Button
              type="button"
              onClick={() => void confirmPurchase()}
              disabled={
                createOrderMutation.isPending ||
                items.length === 0 ||
                !selectedWallet ||
                !walletConnected ||
                isStale ||
                isUnavailable
              }
              className="-mx-4 mt-6 h-[60px] w-[calc(100%+32px)] rounded-[30px] font-bold md:h-[45px] md:rounded-[8px]"
            >
              {createOrderMutation.isPending ? 'Confirmando…' : 'Confirmar compra'}
            </Button>
          </div>
        </aside>
      </section>

      <SiteFooter />
    </div>
  )
}

function ReadOnlyField({
  id,
  label,
  value,
  placeholder,
}: {
  id: string
  label: string
  value: string
  placeholder?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm text-ink-subtle">
        {label}
      </label>
      <input
        id={id}
        value={value}
        readOnly
        placeholder={placeholder}
        className="mt-2 h-10 w-full rounded-md border border-field bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle"
      />
    </div>
  )
}

function isWalletConnect(label: string): boolean {
  return label
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .includes('walletconnect')
}

function WalletOptionMark({ label }: { label: string }) {
  const normalized = label.toLowerCase()

  return (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface-raised text-xs font-bold text-brand md:hidden"
    >
      {normalized.includes('coinbase') ? (
        <svg
          viewBox="0 0 24 24"
          className="size-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3.5" y="6" width="17" height="13" rx="3" />
          <path d="M3.5 10h17" />
          <path d="M16 14h.01" />
        </svg>
      ) : normalized.includes('metamask') ? (
        'M'
      ) : normalized.includes('walletconnect') ? (
        'W'
      ) : (
        label.trim().charAt(0).toUpperCase()
      )}
    </span>
  )
}

function EditableField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = false,
  error,
  maxLength,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'email'
  placeholder?: string
  required?: boolean
  error?: string
  maxLength?: number
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm text-ink-subtle">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        aria-required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`mt-2 h-10 w-full rounded-md border bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle ${error ? 'border-danger' : 'border-field'}`}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function Row({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-subtle">{label}</dt>
      <dd className={muted ? 'text-ink-subtle' : 'text-ink'}>{value}</dd>
    </div>
  )
}

function deriveTokenId(nftId: string): string {
  const match = nftId.match(/(\d+)$/)
  return match ? `#${match[1].padStart(4, '0')}` : '#0000'
}
