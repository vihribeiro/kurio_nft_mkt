import { z } from 'zod'
import { addressSchema, ethAmountSchema, isoDateSchema } from './primitives'
import { cartItemSchema } from './cart'

export const orderStatusSchema = z.enum(['pending', 'settling', 'settled', 'failed'])

export const paymentMethodSchema = z.enum(['wallet', 'card'])

export const checkoutCollectorSchema = z.object({
  displayName: z.string().trim().min(2, 'Informe o nome do colecionador.'),
  email: z.string().trim().email('Informe um e-mail válido.'),
  ensName: z.string().trim().max(100).optional(),
})

/**
 * Pedido criado a partir do checkout.
 *
 * O `code` é o identificador curto exibido ao usuário (ex.: `0xA91F3B7CE82C`),
 * enquanto `id` é o identificador interno.
 */
export const orderSchema = z.object({
  id: z.string().min(1),
  code: z.string().regex(/^0x[a-fA-F0-9]{12}$/, 'Código de pedido inválido.'),
  status: orderStatusSchema,
  items: z.array(cartItemSchema),
  subtotalEth: ethAmountSchema,
  /** Desconto de cupom herdado do carrinho (positivo). */
  discountEth: ethAmountSchema,
  serviceFeeEth: ethAmountSchema,
  totalEth: ethAmountSchema,
  paymentMethod: paymentMethodSchema,
  walletAddress: addressSchema,
  network: z.string().trim().min(1, 'Selecione uma rede.'),
  collector: checkoutCollectorSchema,
  note: z.string().trim().max(500).optional(),
  createdAt: isoDateSchema,
})

/**
 * Corpo do `POST /orders`.
 *
 * `idempotencyKey` é gerada uma vez por intenção de checkout: repetir a
 * requisição (retry, duplo clique, refresh) devolve o MESMO pedido em vez de
 * criar outro.
 */
export const checkoutRequestSchema = z.object({
  idempotencyKey: z.string().min(8),
  paymentMethod: paymentMethodSchema,
  walletAddress: addressSchema,
  network: z.string().min(1),
  collector: checkoutCollectorSchema,
  note: z.string().trim().max(500).optional(),
})

export type OrderStatus = z.infer<typeof orderStatusSchema>
export type PaymentMethod = z.infer<typeof paymentMethodSchema>
export type Order = z.infer<typeof orderSchema>
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>
