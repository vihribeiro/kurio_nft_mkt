import { z } from 'zod'

/**
 * Escalares compartilhados por todos os contratos.
 *
 * A regra central: **valores em ETH são strings decimais, nunca `number`**.
 * Ponto flutuante não representa 0.1 exatamente, e preço é dinheiro. A mesma
 * regra vale para o REST, para os eventos de tempo real e para os mocks.
 */

/** Valor em ETH com até 18 casas decimais, como string. Ex.: `"1.19"`. */
export const ethAmountSchema = z
  .string()
  .regex(/^\d+(\.\d{1,18})?$/, 'Informe um valor em ETH com até 18 casas decimais.')

/** Quantidades (itens, estoque, contadores) são sempre inteiros. */
export const quantitySchema = z.number().int().nonnegative()

/** Endereço de carteira no formato EVM (`0x` + 40 dígitos hexadecimais). */
export const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Endereço de carteira inválido.')

/** Instante em ISO 8601. Ex.: `"2026-10-13T14:02:46.019Z"`. */
export const isoDateSchema = z.string().min(1)

export type EthAmount = z.infer<typeof ethAmountSchema>
