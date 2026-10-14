import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { MobileTopBar } from '@/components/mobile-top-bar'
import { SidebarNav } from '@/components/sidebar-nav'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-context'
import { useWallets } from '@/features/wallets/use-wallets'
import { apiErrorMessage } from '@/shared/api/errors'
import {
  walletDraftSchema,
  type Wallet,
  type WalletDraft,
  type WalletUpdate,
} from '@/shared/contracts/wallet'
import { formatEth } from '@/shared/lib/pricing'
import { shortAddress } from '@/shared/lib/address'

/**
 * Carteiras.
 *
 * Tela de conta, autenticada. As carteiras vêm de `GET /wallets` e são
 * gerenciadas por `POST /wallets` (conectar), `PATCH /wallets/:id` (renomear e
 * definir a principal) e `DELETE /wallets/:id` (remover). A carteira principal
 * é a usada no pagamento.
 */
export function WalletsScreen() {
  const { user } = useSession()
  const { wallets, isPending, connect, disconnect, promote, rename } = useWallets()

  const [formOpen, setFormOpen] = useState(false)

  const primary = wallets.find((wallet) => wallet.isPrimary) ?? wallets[0]
  const secondary = wallets.filter((wallet) => wallet.id !== primary?.id)
  const balance = wallets.reduce((total, wallet) => total + Number(wallet.balanceEth), 0).toFixed(3)

  return (
    <div className="pb-6 md:py-6">
      <MobileTopBar title="Carteiras" />
      <div className="mx-auto w-full max-w-page px-5">
        <div className="hidden md:block">
          <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Carteiras' }]} />
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-[310px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-line bg-surface p-4">
            <SidebarNav active="carteiras" />
          </aside>

          <section className="min-w-0">
            <h1 className="hidden text-2xl font-bold text-ink md:block">Carteiras</h1>

            <div className="mt-6 rounded-xl border border-line bg-surface p-6">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-bold text-ink">Carteira principal</h2>
                <Button
                  type="button"
                  variant="outline"
                  aria-expanded={formOpen}
                  aria-controls="wallet-form"
                  onClick={() => setFormOpen((open) => !open)}
                  className="border-field bg-transparent text-ink hover:bg-surface-raised"
                >
                  Adicionar
                </Button>
              </div>
              <p className="mt-2 text-sm text-ink-subtle">
                Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.
              </p>

              {formOpen ? (
                <WalletForm
                  onConnect={(input) => connect.mutateAsync(input)}
                  onClose={() => setFormOpen(false)}
                />
              ) : null}

              {isPending ? (
                <div aria-busy="true" className="mt-6 grid gap-5 sm:grid-cols-2">
                  {Array.from({ length: 6 }, (_, index) => (
                    <div key={index} className="h-16 shimmer rounded-md" />
                  ))}
                </div>
              ) : wallets.length === 0 ? (
                <p className="mt-6 text-sm text-ink-subtle">Nenhuma carteira conectada ainda.</p>
              ) : (
                <>
                  <dl className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-line bg-surface-raised p-4">
                      <dt className="text-xs text-ink-subtle">Saldo total</dt>
                      <dd className="mt-1 text-lg font-bold text-ink">{formatEth(balance)} ETH</dd>
                    </div>
                    <div className="rounded-lg border border-line bg-surface-raised p-4">
                      <dt className="text-xs text-ink-subtle">Rede principal</dt>
                      <dd className="mt-1 text-lg font-bold text-ink">{primary?.chain ?? '—'}</dd>
                    </div>
                  </dl>

                  <div className="mt-8 grid gap-5 sm:grid-cols-2">
                    <ReadOnlyField
                      id="wallet-displayName"
                      label="Nome de exibição *"
                      value={user?.displayName ?? ''}
                    />
                    <ReadOnlyField
                      id="wallet-nickname"
                      label="Apelido da carteira *"
                      value={primary?.label ?? ''}
                    />
                    <ReadOnlyField
                      id="wallet-network"
                      label="Rede *"
                      value={primary?.chain ?? ''}
                    />
                    <ReadOnlyField
                      id="wallet-address"
                      label="Endereço da carteira *"
                      value={primary?.address ?? ''}
                    />
                    <ReadOnlyField id="wallet-email" label="E-mail *" value={user?.email ?? ''} />
                    <ReadOnlyField id="wallet-ensName" label="Nome ENS *" value="kurio.eth" />
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 rounded-xl border border-line bg-surface p-6">
              <h2 className="text-lg font-bold text-ink">Carteira secundária</h2>

              {secondary.length === 0 ? (
                <p className="mt-2 text-sm text-ink-subtle">
                  Você ainda não adicionou uma carteira secundária.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {secondary.map((wallet) => (
                    <WalletRow
                      key={wallet.id}
                      wallet={wallet}
                      busy={promote.isPending || disconnect.isPending || rename.isPending}
                      onPromote={() =>
                        promote.mutate(wallet.id, {
                          onSuccess: () => toast.success('Carteira principal atualizada.'),
                          onError: (error) =>
                            toast.error(apiErrorMessage(error, 'Não foi possível atualizar.')),
                        })
                      }
                      onRemove={() =>
                        disconnect.mutate(wallet.id, {
                          onSuccess: () => toast.success('Carteira removida.'),
                          onError: (error) =>
                            toast.error(apiErrorMessage(error, 'Não foi possível remover.')),
                        })
                      }
                      onRename={(input) => rename.mutateAsync({ walletId: wallet.id, input })}
                    />
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function WalletRow({
  wallet,
  busy,
  onPromote,
  onRemove,
  onRename,
}: {
  wallet: Wallet
  busy: boolean
  onPromote: () => void
  onRemove: () => void
  onRename: (input: WalletUpdate) => Promise<Wallet[]>
}) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(wallet.label)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault()
    setError(null)

    if (label.trim().length < 2) {
      setError('Dê um apelido à carteira.')
      return
    }

    setSaving(true)
    try {
      await onRename({ label: label.trim() })
      setEditing(false)
      toast.success('Carteira atualizada.')
    } catch (saveError) {
      setError(apiErrorMessage(saveError, 'Não foi possível salvar.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <li
      data-testid={`wallet-${wallet.id}`}
      className="rounded-md border border-line bg-surface-raised px-4 py-3"
    >
      {editing ? (
        <form onSubmit={save} noValidate className="flex w-full flex-wrap items-center gap-3">
          <label htmlFor={`wallet-label-${wallet.id}`} className="sr-only">
            Novo apelido
          </label>
          <input
            id={`wallet-label-${wallet.id}`}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className="h-10 min-w-0 flex-1 rounded-md border border-field bg-surface px-3 text-sm text-ink"
          />
          <Button type="submit" disabled={saving} className="h-10 px-4 font-bold">
            {saving ? 'Salvando…' : 'Salvar apelido'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setEditing(false)
              setLabel(wallet.label)
              setError(null)
            }}
            className="h-10 text-ink-subtle hover:text-ink"
          >
            Cancelar
          </Button>
          {error ? (
            <p role="alert" data-testid="wallet-edit-error" className="w-full text-sm text-danger">
              {error}
            </p>
          ) : null}
        </form>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="min-w-0">
            <span className="block text-sm text-ink">{wallet.label}</span>
            <span className="block truncate text-xs text-ink-subtle">
              {wallet.chain} · {shortAddress(wallet.address)}
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <span className="whitespace-nowrap text-sm text-ink-subtle">
              {formatEth(wallet.balanceEth)} ETH
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              aria-label={`Editar ${wallet.label}`}
              onClick={() => setEditing(true)}
              className="border-field bg-transparent text-ink hover:bg-surface"
            >
              Editar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={onPromote}
              className="border-field bg-transparent text-ink hover:bg-surface"
            >
              Tornar principal
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Remover ${wallet.label}`}
              disabled={busy}
              onClick={onRemove}
              className="text-ink-subtle hover:text-danger"
            >
              Remover
            </Button>
          </span>
        </div>
      )}
    </li>
  )
}

function WalletForm({
  onConnect,
  onClose,
}: {
  onConnect: (input: WalletDraft) => Promise<Wallet[]>
  onClose: () => void
}) {
  const [label, setLabel] = useState('')
  const [address, setAddress] = useState('')
  const [chain, setChain] = useState('Ethereum')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    setError(null)

    const parsed = walletDraftSchema.safeParse({
      label: label.trim(),
      address: address.trim(),
      chain: chain.trim(),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revise os dados da carteira.')
      return
    }

    setSaving(true)
    try {
      await onConnect(parsed.data)
      toast.success('Carteira conectada.')
      onClose()
    } catch (connectError) {
      setError(apiErrorMessage(connectError, 'Não foi possível conectar a carteira.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      id="wallet-form"
      onSubmit={submit}
      noValidate
      className="mt-5 rounded-lg border border-line bg-surface-raised p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="wallet-label" className="text-sm text-ink-subtle">
            Apelido *
          </label>
          <input
            id="wallet-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Minha Ledger"
            className="mt-2 h-10 w-full rounded-md border border-field bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle"
          />
        </div>
        <div>
          <label htmlFor="wallet-chain" className="text-sm text-ink-subtle">
            Rede *
          </label>
          <input
            id="wallet-chain"
            value={chain}
            onChange={(event) => setChain(event.target.value)}
            className="mt-2 h-10 w-full rounded-md border border-field bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle"
          />
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="wallet-address-input" className="text-sm text-ink-subtle">
          Endereço *
        </label>
        <input
          id="wallet-address-input"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="0x…"
          className="mt-2 h-10 w-full rounded-md border border-field bg-surface px-3 font-mono text-sm text-ink placeholder:text-ink-subtle"
        />
      </div>

      {error ? (
        <p role="alert" data-testid="wallet-error" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex gap-3">
        <Button type="submit" disabled={saving} className="h-10 px-6 font-bold">
          {saving ? 'Conectando…' : 'Conectar carteira'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          className="h-10 text-ink-subtle hover:text-ink"
        >
          Cancelar
        </Button>
      </div>
    </form>
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
        className="mt-2 h-10 w-full cursor-not-allowed rounded-md border border-field bg-surface-raised px-3 text-sm text-ink-subtle placeholder:text-ink-subtle"
      />
    </div>
  )
}
