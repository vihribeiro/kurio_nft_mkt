import Decimal from 'decimal.js'
import type { NftSnapshot } from '@/shared/contracts/nft'
import { nftSeeds } from './fixtures'

/**
 * Estado do "mercado" simulado.
 *
 * É a fonte de verdade compartilhada entre o handler REST e o handler de tempo
 * real — os dois leem e escrevem aqui, exatamente como um backend faria. A
 * parte ESTÁTICA do catálogo vem de `fixtures`; aqui vivem preço,
 * disponibilidade e versão.
 */

/**
 * Sequência FIXA de variações de preço.
 *
 * Deliberadamente determinística: sem `Math.random()`, os testes E2E conseguem
 * prever o próximo preço e afirmar sobre ele.
 */
const PRICE_DELTAS = ['0.03', '-0.02', '0.05', '-0.04', '0.02', '-0.01'] as const

/** Piso de preço: nenhum NFT fica abaixo disto. */
const PRICE_FLOOR_ETH = '0.01'

const records = new Map<string, NftSnapshot>()

/**
 * Cursor de variação POR NFT (não global).
 *
 * Com um cursor global, a sequência que um NFT recebe dependeria da ordem em
 * que os outros foram atualizados — e o teste deixaria de ser determinístico.
 */
const deltaCursors = new Map<string, number>()

function seed(): void {
  records.clear()
  deltaCursors.clear()

  for (const nft of nftSeeds) {
    records.set(nft.id, {
      id: nft.id,
      name: nft.name,
      collection: nft.collectionName,
      priceEth: nft.priceEth,
      listed: nft.listed,
      version: nft.version,
      updatedAt: new Date().toISOString(),
    })
    deltaCursors.set(nft.id, 0)
  }
}

seed()

export function getNftSnapshot(nftId: string): NftSnapshot | undefined {
  return records.get(nftId)
}

export function listNftSnapshots(): NftSnapshot[] {
  return [...records.values()]
}

export interface PriceTick {
  snapshot: NftSnapshot
  previousPriceEth: string
}

/**
 * Aplica a próxima variação determinística de preço e incrementa a versão.
 * Retorna `undefined` para NFTs desconhecidos.
 */
export function applyPriceTick(nftId: string): PriceTick | undefined {
  const current = records.get(nftId)
  if (!current) return undefined

  const cursor = deltaCursors.get(nftId) ?? 0
  const delta = PRICE_DELTAS[cursor % PRICE_DELTAS.length] ?? '0'
  deltaCursors.set(nftId, cursor + 1)

  const nextPrice = Decimal.max(new Decimal(current.priceEth).plus(delta), PRICE_FLOOR_ETH).toFixed(
    2,
  )

  const next: NftSnapshot = {
    ...current,
    priceEth: nextPrice,
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
  }

  records.set(nftId, next)

  return { snapshot: next, previousPriceEth: current.priceEth }
}

/** Força um preço específico — usado pelas variações de cenário nos testes. */
export function setNftPrice(nftId: string, priceEth: string): NftSnapshot | undefined {
  const current = records.get(nftId)
  if (!current) return undefined

  const next: NftSnapshot = {
    ...current,
    priceEth,
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
  }

  records.set(nftId, next)

  return next
}

/** Altera disponibilidade e incrementa a mesma versão monotônica do NFT. */
export function setNftListed(nftId: string, listed: boolean): NftSnapshot | undefined {
  const current = records.get(nftId)
  if (!current || current.listed === listed) return current

  const next: NftSnapshot = {
    ...current,
    listed,
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
  }
  records.set(nftId, next)
  return next
}

/** Reset entre testes/cenários. */
export function resetMarketState(): void {
  seed()
}
