import { z } from 'zod'
import { addressSchema, ethAmountSchema, isoDateSchema, quantitySchema } from './primitives'

/** Quantidade de resultados por página para listagens do catálogo. */
export const CATALOG_PAGE_SIZE = 9

/** Um atributo do NFT (raridade), exibido na tela de detalhes. */
export const traitSchema = z.object({
  name: z.string().min(1),
  value: z.string().min(1),
})

/** Coleção à qual um NFT pertence. */
export const collectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  coverUrl: z.string().min(1),
  itemCount: quantitySchema,
  floorPriceEth: ethAmountSchema,
  volumeEth: ethAmountSchema,
})

/**
 * NFT completo — o modelo que as telas de início e de detalhes consomem.
 *
 * `version` é monotônica por NFT e é o que permite reconciliar o REST com os
 * eventos de tempo real (um evento com versão menor é descartado).
 */
export const nftSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  imageUrl: z.string().min(1),
  collectionId: z.string().min(1),
  collectionName: z.string().min(1),
  priceEth: ethAmountSchema,
  listed: z.boolean(),
  edition: z.string().min(1),
  ownerAddress: addressSchema,
  ownerName: z.string().min(1),
  creatorAddress: addressSchema,
  creatorName: z.string().min(1),
  traits: z.array(traitSchema),
  version: z.number().int().nonnegative(),
  updatedAt: isoDateSchema,
})

/** Resposta paginada de listagem do catálogo. */
export const nftListSchema = z.object({
  items: z.array(nftSchema),
  total: quantitySchema,
})

export type Trait = z.infer<typeof traitSchema>
export type Collection = z.infer<typeof collectionSchema>
export type Nft = z.infer<typeof nftSchema>
export type NftList = z.infer<typeof nftListSchema>
