import { z } from 'zod'
import { ethAmountSchema, isoDateSchema } from './primitives'

/**
 * Retrato de um NFT usado na camada de TEMPO REAL.
 *
 * É deliberadamente menor que o NFT do catálogo (REST): contém apenas o que os
 * eventos precisam para reconciliar preço, disponibilidade e versão. O REST
 * continua sendo a fonte de verdade para tudo o mais.
 *
 * `version` é monotônica por NFT: é o que permite ao cliente descartar eventos
 * de tempo real mais antigos do que o estado que ele já tem em cache.
 */
export const nftSnapshotSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  collection: z.string().min(1),
  priceEth: ethAmountSchema,
  listed: z.boolean(),
  version: z.number().int().nonnegative(),
  updatedAt: isoDateSchema,
})

export type NftSnapshot = z.infer<typeof nftSnapshotSchema>
