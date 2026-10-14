import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Search, X } from 'lucide-react'
import { fetchCatalog } from '@/features/catalog/api'
import { queryKeys } from '@/shared/api/query-keys'
import { formatEth } from '@/shared/lib/pricing'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

interface PanelPosition {
  top: number
  left: number
  width: number
  caretLeft: number
}

interface TriggerPosition {
  top: number
  left: number
  width: number
  height: number
}

/** Busca global do desktop, ancorada abaixo da lupa do cabeçalho. */
export function DesktopSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [position, setPosition] = useState<PanelPosition>({
    top: 76,
    left: 16,
    width: 440,
    caretLeft: 24,
  })
  const [triggerPosition, setTriggerPosition] = useState<TriggerPosition | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const normalizedQuery = query.trim()
  const resultsQuery = useQuery({
    queryKey: queryKeys.catalog.list({ q: normalizedQuery }),
    queryFn: () => fetchCatalog({ q: normalizedQuery }),
    enabled: open && normalizedQuery.length > 0,
  })
  const results = resultsQuery.data?.items.slice(0, 6) ?? []

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  function showSearch(event: MouseEvent<HTMLButtonElement>): void {
    const rect = event.currentTarget.getBoundingClientRect()
    const width = Math.min(440, window.innerWidth - 32)
    const left = Math.max(16, Math.min(rect.right - width, window.innerWidth - width - 16))

    setPosition({
      top: Math.max(rect.bottom + 10, 76),
      left,
      width,
      caretLeft: Math.max(20, Math.min(rect.left + rect.width / 2 - left, width - 20)),
    })
    setTriggerPosition({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    })

    setQuery('')
    setOpen(true)
  }

  function closeSearch(): void {
    setOpen(false)
    setQuery('')
    setTriggerPosition(null)
  }

  return (
    <>
      <button
        type="button"
        data-testid="desktop-search-trigger"
        aria-label="Buscar NFTs"
        title="Buscar"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={showSearch}
        className={`flex size-9 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface hover:text-brand ${open ? 'opacity-0' : ''}`}
      >
        <Search aria-hidden="true" className="size-5" />
      </button>

      <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : closeSearch())}>
        <DialogContent
          showCloseButton={false}
          overlayClassName="bg-canvas/55 backdrop-blur-md"
          className="relative block gap-0 overflow-visible border-0 bg-transparent p-0 shadow-none"
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            width: position.width,
            maxWidth: 'none',
            transform: 'none',
            translate: 'none',
          }}
        >
          <DialogTitle className="sr-only">Buscar NFTs</DialogTitle>
          <DialogDescription className="sr-only">
            Digite o nome de uma obra ou coleção para ver resultados.
          </DialogDescription>

          <div className="relative overflow-visible rounded-xl border border-line bg-surface shadow-2xl">
            <div
              aria-hidden="true"
              data-testid="desktop-search-caret"
              className="absolute -top-2 size-4 rotate-45 border-l border-t border-line bg-surface"
              style={{ left: position.caretLeft - 8 }}
            />
            <div className="flex h-14 items-center gap-3 rounded-t-xl border-b border-line bg-surface px-4">
              <Search aria-hidden="true" className="size-5 shrink-0 text-brand" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Buscar NFTs"
                placeholder="Buscar NFTs ou coleções..."
                autoComplete="off"
                className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
              />
              <button
                type="button"
                aria-label="Fechar busca"
                onClick={closeSearch}
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-raised hover:text-ink"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>

            <div className="max-h-[min(60vh,480px)] overflow-y-auto rounded-b-xl bg-surface p-2">
              {!normalizedQuery ? (
                <p className="px-3 py-5 text-sm text-ink-subtle">
                  Comece a digitar para buscar no catálogo.
                </p>
              ) : resultsQuery.isPending ? (
                <p role="status" className="px-3 py-5 text-sm text-ink-subtle">
                  Buscando…
                </p>
              ) : resultsQuery.isError ? (
                <p role="alert" className="px-3 py-5 text-sm text-danger">
                  Não foi possível buscar agora. Tente novamente.
                </p>
              ) : results.length === 0 ? (
                <p role="status" className="px-3 py-5 text-sm text-ink-subtle">
                  Nenhum NFT encontrado para “{normalizedQuery}”.
                </p>
              ) : (
                <ul aria-label="Resultados da busca" aria-live="polite" className="space-y-1">
                  {results.map((nft) => (
                    <li key={nft.id}>
                      <Link
                        to="/nft/$nftId"
                        params={{ nftId: nft.id }}
                        onClick={closeSearch}
                        className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface-raised focus-visible:bg-surface-raised"
                      >
                        <img
                          src={nft.imageUrl}
                          alt=""
                          width={48}
                          height={48}
                          className="size-12 shrink-0 rounded-md object-cover"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm text-ink">{nft.name}</span>
                        <span className="shrink-0 text-sm font-bold text-brand">
                          {formatEth(nft.priceEth)} ETH
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {open && triggerPosition
        ? createPortal(
            <span
              aria-hidden="true"
              data-testid="desktop-search-anchor"
              className="pointer-events-none fixed z-[60] flex items-center justify-center text-ink-muted"
              style={{
                top: triggerPosition.top,
                left: triggerPosition.left,
                width: triggerPosition.width,
                height: triggerPosition.height,
              }}
            >
              <Search className="size-5" />
            </span>,
            document.body,
          )
        : null}
    </>
  )
}
