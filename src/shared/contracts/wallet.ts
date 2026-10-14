import { z } from 'zod'
import { addressSchema, ethAmountSchema } from './primitives'

/** Carteira conectada pelo usuário. */
export const walletSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  address: addressSchema,
  chain: z.string().min(1),
  balanceEth: ethAmountSchema,
  isPrimary: z.boolean(),
})

export const walletListSchema = z.array(walletSchema)

/** Rascunho para conectar uma carteira nova. */
export const walletDraftSchema = z.object({
  label: z.string().trim().min(2, 'Dê um apelido à carteira.').max(40),
  address: addressSchema,
  chain: z.string().trim().min(1, 'Informe a rede.'),
})

/**
 * Edição de uma carteira existente: apelido e/ou promoção a principal.
 *
 * Pelo menos um campo precisa vir — um `PATCH` vazio é recusado no handler.
 */
export const walletUpdateSchema = z
  .object({
    label: z.string().trim().min(2, 'Dê um apelido à carteira.').max(40).optional(),
    isPrimary: z.boolean().optional(),
  })
  .refine((value) => value.label !== undefined || value.isPrimary !== undefined, {
    message: 'Nada para atualizar.',
  })

export type Wallet = z.infer<typeof walletSchema>
export type WalletDraft = z.infer<typeof walletDraftSchema>
export type WalletUpdate = z.infer<typeof walletUpdateSchema>
