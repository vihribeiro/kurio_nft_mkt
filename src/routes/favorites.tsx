import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { MobileTopBar } from '@/components/mobile-top-bar'
import { NftCard } from '@/components/nft-card'
import { Button } from '@/components/ui/button'
import { fetchCatalog } from '@/features/catalog/api'
import { useFavorites } from '@/features/favorites/use-favorites'
import { queryKeys } from '@/shared/api/query-keys'

/**
 * Favoritos do colecionador.
 *
 * Lista as obras salvas. A consulta do catálogo é a mesma do resto do app (a
 * chave começa com `['catalog', 'list']`), então um evento de tempo real também
 * atualiza o preço aqui. Exige sessão (rota protegida).
 */
export function FavoritesScreen() {
  const { favorites } = useFavorites()
  const catalogQuery = useQuery({
    queryKey: queryKeys.catalog.list({ page: 1, pageSize: 50 }),
    queryFn: () => fetchCatalog({ page: 1, pageSize: 50 }),
  })

  const items = (catalogQuery.data?.items ?? []).filter((nft) => favorites.includes(nft.id))

  return (
    <div className="mx-auto w-full max-w-page px-5 pb-8">
      <MobileTopBar title="Favoritos" />

      <div className="mt-2 hidden items-center gap-2 md:flex">
        <Heart aria-hidden="true" className="size-5 text-brand" />
        <h1 className="text-2xl font-bold text-ink">Favoritos</h1>
      </div>

      {catalogQuery.isPending ? (
        <ul aria-busy="true" className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <li key={index} className="aspect-[3/4] shimmer rounded-xl" />
          ))}
        </ul>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-line bg-surface p-10 text-center">
          <p className="text-sm text-ink">Você ainda não salvou nenhuma obra.</p>
          <p className="mt-1 text-sm text-ink-subtle">
            Toque no coração de um NFT para guardá-lo aqui.
          </p>
          <Button asChild className="mt-5">
            <Link to="/">Explorar o catálogo</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((nft) => (
            <li key={nft.id}>
              <NftCard nft={nft} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
