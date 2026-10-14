import { z } from 'zod'
import { ethAmountSchema, isoDateSchema, quantitySchema } from './primitives'

/**
 * Item do carrinho.
 *
 * Guarda uma cópia do preço no momento em que entrou no carrinho. O preço
 * "vivo" continua vindo do tempo real; a cotação oficial, porém, é calculada
 * pelo servidor em `POST /cart/quote` — o cliente nunca decide quanto cobrar.
 */
export const cartItemSchema = z.object({
  nftId: z.string().min(1),
  name: z.string().min(1),
  collectionName: z.string().min(1),
  imageUrl: z.string().min(1),
  /** Edição da obra, exibida no cartão do carrinho. Defaults mantêm carts antigos compatíveis. */
  edition: z.string().min(1).optional().default('1 de 1'),
  priceEth: ethAmountSchema,
  quantity: quantitySchema,
  /** Versão do preço que originou este item — base da reconciliação. */
  version: z.number().int().nonnegative(),
})

/** Carrinho com totais já calculados pelo servidor. */
export const cartSchema = z.object({
  items: z.array(cartItemSchema),
  itemCount: quantitySchema,
  subtotalEth: ethAmountSchema,
  /** Desconto do cupom (positivo; a UI mostra como "(-)"). */
  discountEth: ethAmountSchema,
  /** Taxa de serviço da plataforma, já incluída no total. */
  serviceFeeEth: ethAmountSchema,
  totalEth: ethAmountSchema,
  /** Código do cupom aplicado, se houver. */
  couponCode: z.string().nullable(),
  /** Reserva do carrinho: expira e devolve os itens ao mercado. */
  reservationId: z.string().nullable(),
  expiresAt: isoDateSchema.nullable(),
  updatedAt: isoDateSchema,
})

export type CartItem = z.infer<typeof cartItemSchema>
export type Cart = z.infer<typeof cartSchema>
