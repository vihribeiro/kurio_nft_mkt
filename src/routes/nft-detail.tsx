import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { FavoriteButton } from '@/components/favorite-button'
import { NftCard } from '@/components/nft-card'
import { SiteFooter } from '@/components/site-footer'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fetchCatalog, fetchNft } from '@/features/catalog/api'
import { useMarketSubscription } from '@/features/realtime/realtime-context'
import { useCart } from '@/hooks/use-cart'
import { apiErrorMessage } from '@/shared/api/errors'
import { queryKeys } from '@/shared/api/query-keys'
import { formatEth } from '@/shared/lib/pricing'

/** Detalhes do NFT: arte, ficha técnica, atributos e a ação de compra. */
export function NftDetailScreen() {
  const { nftId } = useParams({ from: '/nft/$nftId' })
  const navigate = useNavigate()
  const { addItem } = useCart()

  const nftQuery = useQuery({
    queryKey: queryKeys.catalog.detail(nftId),
    queryFn: () => fetchNft(nftId),
  })

  const nft = nftQuery.data

  const relatedQuery = useQuery({
    queryKey: queryKeys.catalog.list({ collectionId: nft?.collectionId }),
    queryFn: () => fetchCatalog({ collectionId: nft?.collectionId }),
    enabled: Boolean(nft?.collectionId),
  })

  useMarketSubscription(
    nft ? [nft.id, ...(relatedQuery.data?.items ?? []).slice(0, 4).map((item) => item.id)] : [],
  )

  if (nftQuery.isPending) return <DetailSkeleton />

  if (nftQuery.isError || !nft) {
    return (
      <section className="mx-auto w-full max-w-page px-5 py-20 text-center">
        <h1 className="text-2xl font-bold text-ink">NFT não encontrado</h1>
        <p className="mt-3 text-sm text-ink-subtle">{apiErrorMessage(nftQuery.error)}</p>
        <Button asChild className="mt-6">
          <Link to="/">Voltar ao catálogo</Link>
        </Button>
      </section>
    )
  }

  const related = (relatedQuery.data?.items ?? []).filter((item) => item.id !== nft.id)
  const tokenId = deriveTokenId(nft.id)
  const contract = shortAddress(nft.creatorAddress)

  async function handleBuy(): Promise<void> {
    if (!nft) return
    try {
      await addItem.mutateAsync(nft.id)
      toast.success(`${nft.name} foi para o carrinho.`)
      await navigate({ to: '/cart' })
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Não foi possível adicionar ao carrinho.'))
    }
  }

  return (
    <div>
      <div className="mx-auto hidden w-full max-w-page px-5 pt-6 md:block">
        <Breadcrumbs
          items={[
            { label: 'Início', to: '/' },
            { label: 'Mercado', to: '/' },
          ]}
        />
      </div>

      <section className="mx-auto grid w-full max-w-page gap-8 px-5 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Arte principal + outras obras da coleção */}
        <div className="flex gap-4">
          <ul className="hidden w-[100px] shrink-0 space-y-4 sm:block">
            {related.slice(0, 4).map((item) => (
              <li key={item.id}>
                <Link
                  to="/nft/$nftId"
                  params={{ nftId: item.id }}
                  aria-label={`Ver ${item.name}`}
                  className="block overflow-hidden rounded-lg border border-line transition-colors hover:border-brand"
                >
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    width={1254}
                    height={1254}
                    className="aspect-square w-full object-cover"
                  />
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex-1 overflow-hidden rounded-2xl bg-surface md:rounded-xl md:border md:border-line md:p-3">
            <img
              src={nft.imageUrl}
              alt={`Arte de ${nft.name}`}
              width={1254}
              height={1254}
              className="aspect-square w-full rounded-2xl object-cover"
            />
          </div>
        </div>

        {/* Ficha e ação */}
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold text-ink">{nft.name}</h1>
            <span className="whitespace-nowrap text-xs text-ink-subtle">
              ★ {ratingFor(nft.id)} avaliações
            </span>
          </div>

          <p className="mt-2 flex items-baseline gap-2">
            <span data-testid="nft-detail-price" className="text-2xl font-bold text-ink">
              {formatEth(nft.priceEth)} ETH
            </span>
          </p>

          <div className="mt-6">
            <h2 className="text-sm font-bold text-ink">Sobre este NFT:</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-subtle">{nft.description}</p>
          </div>

          <div className="mt-6">
            <h2 className="text-sm font-bold text-ink">Edição:</h2>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-brand px-4 py-1.5 text-sm text-ink">
                {nft.edition}
              </span>
              <span className="rounded-full bg-brand px-4 py-1.5 text-xs font-bold tracking-wide text-primary-foreground">
                {nft.listed ? 'ABERTA' : 'ENCERRADA'}
              </span>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              onClick={() => void handleBuy()}
              disabled={addItem.isPending || !nft.listed}
              className="h-11 px-8 font-bold"
            >
              {addItem.isPending ? 'Adicionando…' : 'COMPRAR'}
            </Button>
            <FavoriteButton nftId={nft.id} nftName={nft.name} />
          </div>

          <dl className="mt-8 space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-ink-subtle">ID do token:</dt>
              <dd className="text-ink">{tokenId}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-ink-subtle">Coleção:</dt>
              <dd className="text-ink">{nft.collectionName}</dd>
            </div>
            <div className="flex flex-wrap gap-2">
              <dt className="text-ink-subtle">Atributos:</dt>
              <dd className="text-ink">
                {nft.traits.map((trait) => `${trait.name}: ${trait.value}`).join(' · ')}
              </dd>
            </div>
          </dl>

          <ShareRow nftName={nft.name} />
        </div>
      </section>

      {/* Detalhes e avaliações */}
      <section className="mx-auto w-full max-w-page px-5 py-8">
        <Tabs defaultValue="detalhes">
          <TabsList variant="line" className="w-full justify-start gap-6 border-b border-line pb-2">
            <TabsTrigger value="detalhes" className="flex-none px-0 text-base">
              Detalhes do NFT
            </TabsTrigger>
            <TabsTrigger value="avaliacoes" className="flex-none px-0 text-base">
              Avaliações de colecionadores ({ratingFor(nft.id)})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="detalhes" className="pt-6">
            <div className="max-w-3xl space-y-5 text-sm leading-relaxed text-ink-subtle">
              <p>{nft.description}</p>
              <div>
                <p className="font-bold text-ink">Rede:</p>
                <p>Cunhado na Ethereum com procedência imutável e metadados no IPFS.</p>
              </div>
              <div>
                <p className="font-bold text-ink">Contrato:</p>
                <p>{contract} · Contrato inteligente ERC-721 verificado.</p>
              </div>
              <div>
                <p className="font-bold text-ink">Direitos autorais:</p>
                <p>
                  {nft.creatorName} recebe 5% nas vendas secundárias, pagos automaticamente pelos
                  mercados compatíveis.
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="avaliacoes" className="pt-6">
            <ul className="max-w-3xl space-y-4">
              {REVIEWS.map((review) => (
                <li key={review.author} className="rounded-lg border border-line bg-surface p-4">
                  <p className="text-sm font-bold text-ink">{review.author}</p>
                  <p className="mt-1 text-sm text-ink-subtle">{review.comment}</p>
                  <p className="mt-2 text-xs text-brand-strong">{'★'.repeat(review.stars)}</p>
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
      </section>

      {related.length > 0 ? (
        <section aria-labelledby="related-title" className="mx-auto w-full max-w-page px-5 pb-12">
          <h2 id="related-title" className="text-lg font-bold text-ink">
            Mais desta coleção
          </h2>
          <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {related.slice(0, 5).map((item) => (
              <li key={item.id}>
                <NftCard nft={item} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <SiteFooter />
    </div>
  )
}

function ShareRow({ nftName }: { nftName: string }) {
  const shareUrl = encodeURIComponent(window.location.href)

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <span className="text-sm font-bold text-ink">Compartilhar este NFT:</span>
      <nav aria-label={`Compartilhar ${nftName}`} className="flex items-center gap-2">
        <a
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Compartilhar ${nftName} no LinkedIn`}
          title="LinkedIn"
          className="flex size-5 items-center justify-center text-[13px] font-bold leading-none text-ink-subtle transition-colors hover:text-brand focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
          in
        </a>
        <a
          href={`mailto:?subject=${encodeURIComponent(nftName)}&body=${shareUrl}`}
          aria-label={`Compartilhar ${nftName} por e-mail`}
          title="E-mail"
          className="flex size-5 items-center justify-center text-ink-subtle transition-colors hover:text-brand focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none">
            <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
            <path
              d="m4 7 8 6 8-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
        <a
          href={`https://twitter.com/intent/tweet?url=${shareUrl}&text=${encodeURIComponent(nftName)}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Compartilhar ${nftName} no Twitter`}
          title="Twitter"
          className="flex size-5 items-center justify-center text-ink-subtle transition-colors hover:text-brand focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="currentColor">
            <path d="M22 5.9a8 8 0 0 1-2.36.65 4.1 4.1 0 0 0 1.8-2.27 8.2 8.2 0 0 1-2.6.99 4.08 4.08 0 0 0-7.05 2.79c0 .32.04.64.11.94a11.58 11.58 0 0 1-8.4-4.26 4.08 4.08 0 0 0 1.26 5.45 4.05 4.05 0 0 1-1.85-.51v.05a4.08 4.08 0 0 0 3.27 4 4.1 4.1 0 0 1-1.84.07 4.09 4.09 0 0 0 3.82 2.83A8.2 8.2 0 0 1 2.1 18.3c-.33 0-.66-.02-.98-.06a11.55 11.55 0 0 0 6.26 1.84c7.51 0 11.62-6.22 11.62-11.62l-.01-.53A8.3 8.3 0 0 0 22 5.9Z" />
          </svg>
        </a>
      </nav>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div
      aria-busy="true"
      data-testid="nft-detail-skeleton"
      className="mx-auto w-full max-w-page px-5 py-10"
    >
      <div className="h-3 w-40 shimmer rounded" />
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="flex gap-4">
          <div className="hidden w-[100px] space-y-4 sm:block">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="aspect-square shimmer rounded-lg" />
            ))}
          </div>
          <div className="aspect-square flex-1 shimmer rounded-2xl" />
        </div>
        <div className="space-y-4">
          <div className="h-7 w-2/3 shimmer rounded" />
          <div className="h-7 w-32 shimmer rounded" />
          <div className="h-20 w-full shimmer rounded" />
          <div className="h-11 w-40 shimmer rounded" />
        </div>
      </div>
      <p className="sr-only">Carregando detalhes do NFT…</p>
    </div>
  )
}

const REVIEWS = [
  {
    author: 'Marina T.',
    stars: 5,
    comment: 'A arte é ainda melhor ao vivo. Compra rápida e o token caiu na carteira na hora.',
  },
  {
    author: 'Diego R.',
    stars: 4,
    comment: 'Procedência clara e atributos bem documentados. Recomendo a coleção.',
  },
  {
    author: 'Bianca M.',
    stars: 5,
    comment: 'Um dos meus primeiros NFTs e a experiência foi impecável.',
  },
]

/** `emerald-ape-042` -> `#0042` (o número do token vem do fim do id). */
function deriveTokenId(nftId: string): string {
  const match = nftId.match(/(\d+)$/)
  return match ? `#${match[1].padStart(4, '0')}` : '#0000'
}

/** Endereço curto no estilo do print: `0x7A42…19E8`. */
function shortAddress(address: string): string {
  if (address.length < 12) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/** Número de avaliações determinístico por NFT (o mock não guarda reviews). */
function ratingFor(nftId: string): number {
  let hash = 0
  for (const char of nftId) hash = (hash * 31 + char.charCodeAt(0)) % 40
  return 8 + hash
}
