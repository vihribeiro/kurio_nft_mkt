import { z } from 'zod'
import type { QueryClient } from '@tanstack/react-query'
import { http } from '@/shared/api/http'
import { queryKeys, type CatalogFilters } from '@/shared/api/query-keys'
import {
  collectionSchema,
  nftListSchema,
  nftSchema,
  type Collection,
  type Nft,
  type NftList,
} from '@/shared/contracts/catalog'
import type { NftUpdatedPayload } from '@/shared/realtime/contracts'

export async function fetchCatalog(filters: CatalogFilters = {}): Promise<NftList> {
  const { data } = await http.get('/nfts', { params: filters })
  return nftListSchema.parse(data)
}

export async function fetchNft(nftId: string): Promise<Nft> {
  const { data } = await http.get(`/nfts/${nftId}`)
  return nftSchema.parse(data)
}

export async function fetchCollections(): Promise<Collection[]> {
  const { data } = await http.get('/collections')
  return z.array(collectionSchema).parse(data)
}

/**
 * Aplica um preço recebido por tempo real em TODO cache que contenha o NFT.
 *
 * É o coração da reconciliação REST -> tempo real: o evento não guarda estado
 * em `useState`, ele reescreve o cache do TanStack Query, e o React re-renderiza
 * porque a query mudou. A guarda de versão torna a operação idempotente.
 */
export function applyNftUpdateToCache(queryClient: QueryClient, payload: NftUpdatedPayload): void {
  const detailKey = queryKeys.catalog.detail(payload.nftId)
  const detail = queryClient.getQueryData<Nft>(detailKey)

  if (detail && payload.version > detail.version) {
    queryClient.setQueryData<Nft>(detailKey, {
      ...detail,
      priceEth: payload.priceEth,
      listed: payload.listed,
      version: payload.version,
      updatedAt: payload.occurredAt,
    })
  }

  queryClient.setQueriesData<NftList>({ queryKey: queryKeys.catalog.lists() }, (list) => {
    if (!list) return list

    let changed = false
    const items = list.items.map((item) => {
      if (item.id !== payload.nftId) return item
      if (payload.version <= item.version) return item

      changed = true
      return {
        ...item,
        priceEth: payload.priceEth,
        listed: payload.listed,
        version: payload.version,
        updatedAt: payload.occurredAt,
      }
    })

    return changed ? { ...list, items } : list
  })
}
