import type { Nft } from '@/shared/contracts/catalog'
import { nftSeeds } from './fixtures'
import { getNftSnapshot } from './market-state'

/**
 * Catálogo: junta a parte ESTÁTICA (fixtures) com a parte VIVA (market-state).
 *
 * É o que um backend faria ao ler uma linha do banco e sobrescrever preço e
 * versão com os valores atuais. O REST e o tempo real enxergam o mesmo NFT.
 */

const baseById = new Map(nftSeeds.map((nft) => [nft.id, nft]))

function withLivePrice(base: Nft): Nft {
  const snapshot = getNftSnapshot(base.id)
  if (!snapshot) return base

  return {
    ...base,
    priceEth: snapshot.priceEth,
    listed: snapshot.listed,
    version: snapshot.version,
    updatedAt: snapshot.updatedAt,
  }
}

export function getCatalogNft(nftId: string): Nft | undefined {
  const base = baseById.get(nftId)
  return base ? withLivePrice(base) : undefined
}

export function listCatalog(): Nft[] {
  return nftSeeds.map(withLivePrice)
}
