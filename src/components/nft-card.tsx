import { Link } from '@tanstack/react-router'
import { FavoriteButton } from '@/components/favorite-button'
import type { Nft } from '@/shared/contracts/catalog'
import { formatEth } from '@/shared/lib/pricing'

/**
 * Cartão de NFT do acervo.
 *
 * Fiel ao Figma: a arte em um quadro arredondado, com o selo e o coração
 * SOBREPOSTOS à imagem, e nome/preço logo abaixo — sem moldura em volta do
 * texto. O preço é a informação de destaque (cor de marca). Como o cartão lê o
 * preço do cache do TanStack Query, um evento de tempo real o atualiza sozinho.
 */
export function NftCard({
  nft,
  badge,
  priority = false,
}: {
  nft: Pick<Nft, 'id' | 'name' | 'imageUrl' | 'priceEth' | 'traits'>
  /** Selo sobreposto à arte (ex.: "RARO"). */
  badge?: string
  priority?: boolean
}) {
  const badgeLabel =
    badge ??
    (nft.traits.some(
      (trait) =>
        trait.name.trim().toLowerCase() === 'raridade' &&
        trait.value.trim().toLowerCase() === 'rara',
    )
      ? 'RARO'
      : undefined)

  return (
    <article className="group relative flex flex-col">
      {badgeLabel ? (
        <span className="absolute -left-1 top-0 z-10 flex h-8 w-[68px] items-center justify-center bg-brand text-xs font-bold uppercase tracking-wide text-canvas">
          {badgeLabel}
        </span>
      ) : null}

      <FavoriteButton
        nftId={nft.id}
        nftName={nft.name}
        variant="icon"
        className="absolute right-3 top-3 z-10"
      />

      <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="flex flex-col">
        <div className="overflow-hidden rounded-2xl bg-surface">
          <img
            src={nft.imageUrl}
            alt={nft.name}
            width={1254}
            height={1254}
            loading={priority ? 'eager' : 'lazy'}
            className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        </div>

        <p className="mt-3 text-sm leading-snug text-ink transition-colors group-hover:text-brand">
          {nft.name}
        </p>
        <p className="mt-0.5">
          <span data-testid={`nft-price-${nft.id}`} className="text-base font-bold text-brand">
            {formatEth(nft.priceEth)}{' '}
            <span className="text-xs font-normal text-ink-subtle">ETH</span>
          </span>
        </p>
      </Link>
    </article>
  )
}
