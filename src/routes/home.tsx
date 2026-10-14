import { useEffect, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { Search, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { SiteFooter } from '@/components/site-footer'
import { NftCard } from '@/components/nft-card'
import { fetchCatalog, fetchCollections } from '@/features/catalog/api'
import {
  CATALOG_PAGE_SIZE,
  type CatalogSearch,
  type CatalogSort,
  type CatalogTab,
} from '@/features/catalog/search'
import { useMarketSubscription } from '@/features/realtime/realtime-context'
import { useIsDesktop, useMediaQuery } from '@/hooks/use-media-query'
import { queryKeys } from '@/shared/api/query-keys'
import { apiErrorMessage } from '@/shared/api/errors'
import { cn } from 'cn'

const routeApi = getRouteApi('/')

const SORT_OPTIONS: { value: CatalogSort; label: string }[] = [
  { value: 'recent', label: 'Listados recentemente' },
  { value: 'price-asc', label: 'Preço: do menor ao maior' },
  { value: 'price-desc', label: 'Preço: do maior ao menor' },
  { value: 'name', label: 'Nome (A–Z)' },
]

const TABS: { value: CatalogTab; label: string }[] = [
  { value: 'todos', label: 'Todos os NFTs' },
  { value: 'novos', label: 'Novos lançamentos' },
  { value: 'alta', label: 'Em alta' },
]

const MOBILE_HERO_SLIDES = [
  {
    primary: { image: '/art/art-2.webp', alt: 'Emerald Ape #042' },
    secondary: { image: '/art/art-1.webp', alt: 'Sage Nomad #009' },
  },
  {
    primary: { image: '/art/art-4.webp', alt: 'Neon Vessel #552' },
    secondary: { image: '/art/art-1.webp', alt: 'Cosmic Bloom #118' },
  },
  {
    primary: { image: '/art/art-3.webp', alt: 'Golden Beat #207' },
    secondary: { image: '/art/art-4.webp', alt: 'Ivory Baron #088' },
  },
] as const

const JOURNAL = [
  {
    image: '/art/art-1.webp',
    title: 'Como funciona a propriedade de NFT',
    excerpt: 'Entenda o que você realmente possui quando compra arte digital verificada.',
  },
  {
    image: '/art/art-2.webp',
    title: '10 artistas digitais para acompanhar',
    excerpt: 'Uma seleção de nomes que estão moldando a cultura digital na rede.',
  },
  {
    image: '/art/art-3.webp',
    title: 'Raridade, atributos e procedência',
    excerpt: 'Como ler os traços de um NFT antes de decidir colecionar.',
  },
  {
    image: '/art/art-4.webp',
    title: 'Como proteger sua carteira',
    excerpt: 'Práticas essenciais para guardar sua coleção com segurança.',
  },
] as const

/**
 * Início — vitrine.
 *
 * Todo o estado de navegação (busca, filtros, ordenação, paginação) vive na URL
 * (ver `features/catalog/search.ts`), então refresh e histórico preservam a
 * escolha. O catálogo e as coleções vêm do REST; os preços são reconciliados por
 * tempo real através do cache do TanStack Query.
 */
export function HomeScreen() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const isDesktop = useIsDesktop()
  const [filtersOpen, setFiltersOpen] = useState(false)

  const tab = search.aba ?? 'todos'
  const sort = search.ordem ?? 'recent'
  const page = search.pagina ?? 1

  const catalogQuery = useQuery({
    queryKey: queryKeys.catalog.list({
      collectionId: search.colecao,
      q: search.q,
      minPriceEth: search.min,
      maxPriceEth: search.max,
      sort,
      tab,
      page,
      pageSize: CATALOG_PAGE_SIZE,
    }),
    queryFn: () =>
      fetchCatalog({
        collectionId: search.colecao,
        q: search.q,
        minPriceEth: search.min,
        maxPriceEth: search.max,
        sort,
        tab,
        page,
        pageSize: CATALOG_PAGE_SIZE,
      }),
  })

  const collectionsQuery = useQuery({
    queryKey: queryKeys.catalog.collections,
    queryFn: fetchCollections,
  })

  const nfts = catalogQuery.data?.items ?? []
  useMarketSubscription(nfts.map((nft) => nft.id))

  const pageCount = Math.max(1, Math.ceil((catalogQuery.data?.total ?? 0) / CATALOG_PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageItems = nfts

  /** Escreve no estado da URL; filtros discretos criam entrada de histórico. */
  function patch(next: CatalogSearch, replace = false): void {
    void navigate({
      search: (prev) => ({ ...prev, ...next }),
      replace,
      resetScroll: false,
      hashScrollIntoView: false,
    })
  }

  /** Mudança de filtro/ordenação sempre volta para a página 1. */
  function patchFilter(next: CatalogSearch, replace = false): void {
    patch({ ...next, pagina: undefined }, replace)
  }

  useEffect(() => {
    if (!catalogQuery.data || page <= pageCount) return

    void navigate({
      search: (prev) => ({ ...prev, pagina: pageCount > 1 ? pageCount : undefined }),
      replace: true,
      resetScroll: false,
      hashScrollIntoView: false,
    })
  }, [catalogQuery.data, navigate, page, pageCount])

  const hasFilters =
    search.colecao !== undefined ||
    search.min !== undefined ||
    search.max !== undefined ||
    search.q !== undefined

  return (
    <div>
      <h1 className="sr-only">Explorar</h1>

      {!isDesktop ? (
        <MobileCatalogBar
          query={search.q ?? ''}
          onQuery={(value) => patchFilter({ q: value || undefined }, true)}
          filtersOpen={filtersOpen}
          onFiltersOpen={setFiltersOpen}
          hasFilters={hasFilters}
          sidebar={
            <CatalogSidebar
              collections={collectionsQuery.data ?? []}
              collectionId={search.colecao}
              onChangeCollection={(id) => patchFilter({ colecao: id })}
              minPrice={search.min}
              maxPrice={search.max}
              onApplyPriceRange={(min, max) => patchFilter({ min, max })}
            />
          }
        />
      ) : null}

      <HeroSection />

      <section id="catalogo" className="mx-auto w-full max-w-page scroll-mt-24 px-5 py-10">
        <div className={cn('flex flex-col gap-8', isDesktop && 'lg:flex-row')}>
          {isDesktop ? (
            <aside className="w-full shrink-0 lg:w-[310px]">
              <CatalogSidebar
                collections={collectionsQuery.data ?? []}
                collectionId={search.colecao}
                onChangeCollection={(id) => patchFilter({ colecao: id })}
                minPrice={search.min}
                maxPrice={search.max}
                onApplyPriceRange={(min, max) => patchFilter({ min, max })}
              />
            </aside>
          ) : null}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div
                className="grid w-full grid-cols-3 gap-2 md:flex md:w-auto"
                aria-label="Filtros rápidos"
              >
                {TABS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={tab === item.value}
                    onClick={() =>
                      patchFilter({ aba: item.value === 'todos' ? undefined : item.value })
                    }
                    className={cn(
                      'w-full whitespace-nowrap border-b-2 px-0 pb-1 text-center text-[11px] transition-colors md:w-auto md:rounded-md md:border-b-0 md:px-3 md:py-1.5 md:pb-1.5 md:text-sm',
                      tab === item.value
                        ? 'border-brand font-bold text-brand md:bg-surface-overlay md:text-ink'
                        : 'border-transparent text-ink-subtle hover:text-ink',
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {isDesktop ? (
                <div className="flex items-center gap-2">
                  <Search aria-hidden="true" className="size-4 text-ink-subtle" />
                  <input
                    id="catalog-search"
                    type="search"
                    aria-label="Buscar no catálogo"
                    placeholder="Explorar coleções"
                    value={search.q ?? ''}
                    onChange={(event) => patchFilter({ q: event.target.value || undefined }, true)}
                    className="h-9 w-56 rounded-md border border-field bg-surface-raised px-3 text-sm text-ink placeholder:text-ink-subtle"
                  />
                </div>
              ) : null}

              <label className="ml-auto flex items-center gap-2 text-xs text-ink-subtle">
                <span className="whitespace-nowrap">Ordenar por:</span>
                <select
                  aria-label="Ordenar por"
                  value={sort}
                  onChange={(event) =>
                    patchFilter({
                      ordem:
                        event.target.value === 'recent'
                          ? undefined
                          : (event.target.value as CatalogSort),
                    })
                  }
                  className="h-9 rounded-md border border-field bg-surface-raised px-2 text-sm text-ink"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-6">
              {catalogQuery.isPending ? (
                <CatalogSkeleton />
              ) : catalogQuery.isError ? (
                <CatalogError
                  message={apiErrorMessage(catalogQuery.error)}
                  onRetry={() => void catalogQuery.refetch()}
                />
              ) : pageItems.length === 0 ? (
                <p className="rounded-lg border border-line bg-surface p-8 text-center text-sm text-ink-subtle">
                  Nenhum NFT encontrado com esses filtros.
                </p>
              ) : (
                <ul data-testid="catalog-grid" className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  {pageItems.map((nft) => (
                    <li key={nft.id} className="even:mt-8 md:even:mt-0">
                      <NftCard nft={nft} priority />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {pageCount > 1 ? (
              <nav aria-label="Paginação" className="mt-8 flex items-center justify-end gap-2">
                {Array.from({ length: pageCount }, (_, index) => index + 1).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-current={value === currentPage ? 'page' : undefined}
                    onClick={() => patch({ pagina: value === 1 ? undefined : value })}
                    className={cn(
                      'size-9 rounded border text-sm transition-colors',
                      value === currentPage
                        ? 'border-brand bg-brand text-primary-foreground'
                        : 'border-field text-ink-subtle hover:text-ink',
                    )}
                  >
                    {value}
                  </button>
                ))}
              </nav>
            ) : null}
          </div>
        </div>
      </section>

      <PromoDuo />
      <section id="diario" className="scroll-mt-24">
        <Journal />
      </section>
      <SiteFooter />
    </div>
  )
}

/** Topo do catálogo no celular: busca + botão de filtros (drawer). */
function MobileCatalogBar({
  query,
  onQuery,
  filtersOpen,
  onFiltersOpen,
  hasFilters,
  sidebar,
}: {
  query: string
  onQuery: (value: string) => void
  filtersOpen: boolean
  onFiltersOpen: (open: boolean) => void
  hasFilters: boolean
  sidebar: ReactNode
}) {
  const [draft, setDraft] = useState(query)
  const [syncedQuery, setSyncedQuery] = useState(query)

  // Ajuste de estado durante o render (sem efeito): acompanha a URL quando ela
  // muda por fora (botão voltar, link), sem re-render em cascata.
  if (query !== syncedQuery) {
    setSyncedQuery(query)
    setDraft(query)
  }

  return (
    <div className="mx-auto w-full max-w-page px-5 pt-4 md:hidden">
      <div className="flex items-center gap-3">
        <div className="flex h-11 flex-1 items-center gap-2 rounded-xl bg-surface px-4">
          <Search aria-hidden="true" className="size-4 shrink-0 text-ink-subtle" />
          <input
            type="search"
            aria-label="Buscar no catálogo"
            placeholder="Explorar coleções"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              onQuery(event.target.value)
            }}
            className="h-full w-full bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
          />
        </div>

        <Drawer open={filtersOpen} onOpenChange={onFiltersOpen}>
          <DrawerTrigger asChild>
            <button
              type="button"
              aria-label="Filtros"
              className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand text-primary-foreground"
            >
              <SlidersHorizontal aria-hidden="true" className="size-5" />
              {hasFilters ? (
                <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-canvas ring-2 ring-brand" />
              ) : null}
            </button>
          </DrawerTrigger>
          <DrawerContent className="bg-surface">
            <DrawerHeader className="flex items-center justify-between text-left">
              <DrawerTitle className="text-base font-bold text-ink">Filtros</DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="sm" className="text-ink-subtle">
                  Fechar
                </Button>
              </DrawerClose>
            </DrawerHeader>
            <div className="max-h-[70dvh] overflow-y-auto px-4 pb-8">
              <div className="rounded-xl border border-line bg-canvas p-4">{sidebar}</div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </div>
  )
}

/** Faixa de abertura: no celular é um cartão; no desktop, texto + arte. */
function HeroSection() {
  const [activeSlide, setActiveSlide] = useState(0)
  const [paused, setPaused] = useState(false)
  const isDesktop = useIsDesktop()
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  useEffect(() => {
    if (isDesktop || paused || prefersReducedMotion) return

    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % MOBILE_HERO_SLIDES.length)
    }, 5_000)

    return () => window.clearInterval(timer)
  }, [isDesktop, paused, prefersReducedMotion])

  return (
    <>
      {/* Celular */}
      <section className="md:hidden">
        <div className="mx-auto w-full max-w-page px-5 pt-4">
          <div
            data-testid="mobile-hero"
            className="relative isolate overflow-hidden rounded-[28px] bg-surface p-[13px]"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={(event) => {
              const next = event.relatedTarget
              if (!(next instanceof Node) || !event.currentTarget.contains(next)) setPaused(false)
            }}
          >
            {/* Elipses 49/50 do Figma: ficam fixas no fundo, atrás dos slides. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -left-[80px] -top-[31px] size-[248px] rounded-full"
              style={{
                background: 'linear-gradient(160deg, rgb(221 154 95 / 43%), rgb(210 138 76 / 4%))',
              }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-[73px] -top-[10px] size-[248px] rounded-full"
              style={{
                background: 'linear-gradient(160deg, rgb(221 154 95 / 37%), rgb(210 138 76 / 0%))',
              }}
            />

            <div className="relative z-10 w-full min-w-0 overflow-x-clip overflow-y-visible">
              <div
                className="flex w-full min-w-0 transition-transform duration-500 ease-in-out motion-reduce:transition-none"
                style={{
                  transform: `translateX(-${activeSlide * 100}%)`,
                }}
              >
                {MOBILE_HERO_SLIDES.map((slide, index) => (
                  <div
                    key={slide.primary.alt}
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`${index + 1} de ${MOBILE_HERO_SLIDES.length}`}
                    aria-hidden={activeSlide !== index}
                    className="w-full shrink-0"
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)_138px] gap-3">
                      <div className="flex min-w-0 flex-col">
                        <p className="text-xs text-ink-subtle">Bem-vindo à Kurio</p>
                        <h2 className="mt-1 text-base font-bold uppercase leading-[1.15] text-ink">
                          Seja dono da cultura digital
                        </h2>
                        <p className="mt-1 text-[11px] leading-4 text-ink-subtle">
                          Descubra NFTs selecionados de criadores do mundo todo.
                        </p>
                        <a
                          href="#catalogo"
                          tabIndex={activeSlide === index ? 0 : -1}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-bold tracking-[0.2em] text-brand"
                        >
                          EXPLORAR <span aria-hidden="true">→</span>
                        </a>
                      </div>

                      <div className="relative shrink-0 self-start">
                        <img
                          src={slide.primary.image}
                          alt={slide.primary.alt}
                          width={1254}
                          height={1254}
                          className="size-[138px] rounded-2xl object-cover"
                        />
                        <img
                          src={slide.secondary.image}
                          alt={slide.secondary.alt}
                          width={1254}
                          height={1254}
                          className="absolute -bottom-4 -left-4 size-[58px] rounded-2xl object-cover ring-2 ring-surface"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              role="group"
              aria-label="Navegação dos destaques"
              className="relative z-10 mt-4 flex justify-center gap-0"
            >
              {MOBILE_HERO_SLIDES.map((item, index) => (
                <button
                  key={item.primary.alt}
                  type="button"
                  aria-label={`Mostrar destaque ${index + 1}: ${item.primary.alt} e ${item.secondary.alt}`}
                  aria-pressed={activeSlide === index}
                  onClick={() => setActiveSlide(index)}
                  className="flex size-6 items-center justify-center rounded-full"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'size-2 rounded-full transition-colors',
                      activeSlide === index ? 'bg-brand' : 'bg-ink-subtle/40 hover:bg-ink-subtle',
                    )}
                  />
                  <span className="sr-only">Destaque {index + 1}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Desktop */}
      <section className="hidden border-b border-line md:block">
        <div className="mx-auto grid w-full max-w-page items-center gap-10 px-5 py-12 lg:grid-cols-[1fr_auto] lg:py-16">
          <div className="max-w-2xl">
            <p className="text-sm text-ink-subtle">Bem-vindo à Kurio</p>
            <h2 className="mt-3 text-4xl font-bold uppercase leading-[1.1] tracking-tight text-ink sm:text-5xl">
              Seja dono do futuro da arte digital
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-ink-subtle">
              Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte
              digital rara, apoie artistas e tenha uma parte da cultura da internet.
            </p>
            <Button asChild className="mt-7 h-11 px-6 text-sm font-bold">
              <a href="#catalogo">Explorar</a>
            </Button>
          </div>

          <img
            src="/art/art-2.webp"
            alt="Obra em destaque da coleção"
            width={1254}
            height={1254}
            className="hidden size-[380px] rounded-3xl object-cover lg:block"
          />
        </div>
      </section>
    </>
  )
}

/** Coluna de filtros (desktop) + cartão "NFT em destaque". */
function CatalogSidebar({
  collections,
  collectionId,
  onChangeCollection,
  minPrice,
  maxPrice,
  onApplyPriceRange,
}: {
  collections: { id: string; name: string; itemCount: number }[]
  collectionId: string | undefined
  onChangeCollection: (id: string | undefined) => void
  minPrice: number | undefined
  maxPrice: number | undefined
  onApplyPriceRange: (min: number | undefined, max: number | undefined) => void
}) {
  const RANGE_MIN = 0.02
  const RANGE_MAX = 12.3
  const currentMin = Math.max(RANGE_MIN, Math.min(minPrice ?? RANGE_MIN, maxPrice ?? RANGE_MAX))
  const currentMax = Math.min(RANGE_MAX, Math.max(maxPrice ?? RANGE_MAX, currentMin))
  const left = ((currentMin - RANGE_MIN) / (RANGE_MAX - RANGE_MIN)) * 100
  const right = ((currentMax - RANGE_MIN) / (RANGE_MAX - RANGE_MIN)) * 100
  const display = (value: number) => value.toFixed(2).replace('.', ',')

  function updateMin(value: number): void {
    const next = Math.min(value, currentMax)
    onApplyPriceRange(next <= RANGE_MIN ? undefined : next, maxPrice)
  }

  function updateMax(value: number): void {
    const next = Math.max(value, currentMin)
    onApplyPriceRange(minPrice, next >= RANGE_MAX ? undefined : next)
  }

  return (
    <div>
      <div className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-base font-bold text-ink">Coleções</h2>
        <ul className="mt-4 space-y-1">
          <li>
            <button
              type="button"
              onClick={() => onChangeCollection(undefined)}
              className={cn(
                'flex w-full items-center justify-between rounded px-2 py-1.5 text-sm transition-colors',
                collectionId === undefined ? 'text-brand' : 'text-ink-subtle hover:text-ink',
              )}
            >
              <span>Todas</span>
            </button>
          </li>
          {collections.map((collection) => (
            <li key={collection.id}>
              <button
                type="button"
                onClick={() => onChangeCollection(collection.id)}
                className={cn(
                  'flex w-full items-center justify-between rounded px-2 py-1.5 text-sm transition-colors',
                  collectionId === collection.id ? 'text-brand' : 'text-ink-subtle hover:text-ink',
                )}
              >
                <span>{collection.name}</span>
                <span className="text-xs text-ink-subtle">({collection.itemCount})</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-6 border-t border-line pt-5">
          <h2 className="text-base font-bold text-ink">Faixa de preço</h2>
          <p className="mt-3 text-xs text-ink-subtle">
            Preço: {display(currentMin)} – {display(currentMax)} ETH
          </p>
          <div
            className="relative mt-3 h-6 touch-none"
            style={{
              background: `linear-gradient(to right, var(--kurio-line) ${left}%, var(--kurio-brand) ${left}%, var(--kurio-brand) ${right}%, var(--kurio-line) ${right}%)`,
              height: '4px',
              marginTop: '18px',
              borderRadius: '999px',
            }}
          >
            <input
              type="range"
              min={RANGE_MIN}
              max={RANGE_MAX}
              step={0.01}
              value={currentMin}
              aria-label="Preço mínimo em ETH"
              aria-valuetext={`${display(currentMin)} ETH`}
              onChange={(event) => updateMin(Number(event.currentTarget.value))}
              className="price-range-input absolute inset-x-0 -top-[10px] h-6 w-full"
              style={{ zIndex: currentMin > currentMax - 0.5 ? 4 : 3 }}
            />
            <input
              type="range"
              min={RANGE_MIN}
              max={RANGE_MAX}
              step={0.01}
              value={currentMax}
              aria-label="Preço máximo em ETH"
              aria-valuetext={`${display(currentMax)} ETH`}
              onChange={(event) => updateMax(Number(event.currentTarget.value))}
              className="price-range-input absolute inset-x-0 -top-[10px] h-6 w-full"
              style={{ zIndex: 2 }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-ink-subtle">
            <span>{display(RANGE_MIN)}</span>
            <span>{display(RANGE_MAX)} ETH</span>
          </div>
        </div>

        <div className="mt-6 border-t border-line pt-5">
          <h2 className="text-base font-bold text-ink">Rede</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-subtle">
            <li className="flex items-center justify-between">
              <span>Ethereum</span>
              <span className="text-xs">(119)</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Polygon</span>
              <span className="text-xs">(78)</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Solana</span>
              <span className="text-xs">(86)</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-line bg-surface p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-brand">NFT em destaque</p>
        <p className="mt-1 text-sm text-ink-subtle">Oferta limitada</p>
        <Link to="/" className="mt-4 block">
          <img
            src="/art/art-3.webp"
            alt="Peça em oferta limitada"
            width={1254}
            height={1254}
            className="w-full rounded-2xl object-cover"
          />
        </Link>
      </div>
    </div>
  )
}

const PROMOS = [
  {
    image: '/art/art-1.webp',
    title: 'Lançamentos gênesis',
    subtitle: 'de edição limitada',
    body: 'Acesso direto aos criadores antes da revelação pública.',
  },
  {
    image: '/art/art-4.webp',
    title: 'Arte digital selecionada',
    subtitle: 'e muito mais',
    body: 'Coleções verificadas e obras digitais que definem a cena.',
  },
] as const

function PromoDuo() {
  return (
    <section aria-label="Destaques" className="mx-auto w-full max-w-page px-5 pb-4 pt-10">
      <h2 className="sr-only">Destaques</h2>
      <div className="grid gap-6 md:grid-cols-2">
        {PROMOS.map((promo) => (
          <article
            key={promo.title}
            className="grid overflow-hidden rounded-xl border border-line bg-surface sm:grid-cols-2"
          >
            <img
              src={promo.image}
              alt=""
              aria-hidden="true"
              width={1254}
              height={1254}
              className="h-40 w-full object-cover sm:h-full"
            />
            <div className="flex flex-col justify-center gap-1 p-5">
              <h3 className="text-lg font-bold text-ink">{promo.title}</h3>
              <p className="text-sm text-brand">{promo.subtitle}</p>
              <p className="mt-2 text-sm text-ink-subtle">{promo.body}</p>
              <Link
                to="/"
                className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-brand transition-colors hover:text-brand-strong"
              >
                Explorar <span aria-hidden="true">→</span>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function Journal() {
  return (
    <section aria-labelledby="journal-title" className="mx-auto w-full max-w-page px-5 py-12">
      <div className="text-center">
        <h2 id="journal-title" className="text-2xl font-bold text-ink">
          Diário da Cunhagem
        </h2>
        <p className="mt-2 text-sm text-ink-subtle">
          Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.
        </p>
      </div>

      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {JOURNAL.map((article) => (
          <li
            key={article.title}
            className="overflow-hidden rounded-xl border border-line bg-surface"
          >
            <img
              src={article.image}
              alt=""
              aria-hidden="true"
              width={1254}
              height={1254}
              className="h-40 w-full object-cover"
            />
            <div className="p-4">
              <h3 className="text-sm font-bold text-ink">{article.title}</h3>
              <p className="mt-2 text-xs text-ink-subtle">{article.excerpt}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand">
                Ler mais <span aria-hidden="true">→</span>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function CatalogSkeleton() {
  return (
    <ul
      aria-busy="true"
      className="grid grid-cols-2 gap-4 md:grid-cols-3"
      data-testid="catalog-skeleton"
    >
      {Array.from({ length: CATALOG_PAGE_SIZE }, (_, index) => (
        <li key={index} className="even:mt-8 md:even:mt-0">
          <div className="aspect-square shimmer rounded-2xl" />
          <div className="mt-3 h-3.5 w-3/4 shimmer rounded" />
          <div className="mt-2 h-4 w-1/2 shimmer rounded" />
        </li>
      ))}
    </ul>
  )
}

function CatalogError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-danger/40 bg-surface p-8 text-center">
      <p className="text-sm text-ink">{message}</p>
      <Button type="button" variant="outline" onClick={onRetry} className="mt-4">
        Tentar de novo
      </Button>
    </div>
  )
}
