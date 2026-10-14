import Decimal from 'decimal.js'

/**
 * Regras de preço do carrinho.
 *
 * Ficam num módulo compartilhado porque o mock (que calcula a cotação oficial)
 * e a UI (que exibe) precisam concordar. Ainda assim, o cliente NUNCA decide
 * quanto cobrar: ele mostra o que `POST /cart/quote` respondeu.
 *
 * A taxa de serviço reproduz o print de referência:
 *   26,83 (subtotal) + 0,016 (taxa) = 26,846 (total)
 * Ou seja: 0,06% da base, arredondado a 3 casas, com piso de 0,001 ETH.
 */
export const SERVICE_FEE_RATE = new Decimal('0.0006')
export const SERVICE_FEE_MIN_ETH = '0.001'

/** Item mínimo necessário para calcular totais. */
export interface PricedItem {
  priceEth: string
  quantity: number
}

/** Soma dos itens, sem taxa. Ex.: `|26.83`. */
export function computeSubtotal(items: PricedItem[]): string {
  return items
    .reduce(
      (total, item) => total.plus(new Decimal(item.priceEth).times(item.quantity)),
      new Decimal(0),
    )
    .toString()
}

/** Taxa de serviço da plataforma, já arredondada para exibição. */
export function computeServiceFee(baseEth: string): string {
  const fee = Decimal.max(new Decimal(baseEth).times(SERVICE_FEE_RATE), SERVICE_FEE_MIN_ETH)
  return fee.toFixed(3)
}

export interface CartTotals {
  subtotalEth: string
  /** Desconto de cupom como valor POSITIVO (a UI é quem mostra "(-)"). */
  discountEth: string
  serviceFeeEth: string
  totalEth: string
}

/**
 * Totais do carrinho, com desconto opcional.
 *
 * O desconto entra ANTES da taxa: a taxa incide sobre o líquido, não sobre o
 * valor cheio. `discountEth` é sempre não-negativo, porque o esquema de ETH não
 * aceita sinal — o "(-)" é apresentação.
 */
export function computeTotals(items: PricedItem[], discountEth = '0'): CartTotals {
  const subtotalEth = computeSubtotal(items)
  const net = Decimal.max(new Decimal(subtotalEth).minus(discountEth), 0)
  const serviceFeeEth = computeServiceFee(net.toString())
  const totalEth = net.plus(serviceFeeEth).toString()

  return { subtotalEth, discountEth, serviceFeeEth, totalEth }
}

/** Formata um valor em ETH para exibição, seguindo a convenção de cripto. */
export function formatEth(value: string, maximumFractionDigits = 3): string {
  const amount = Number(value)

  if (!Number.isFinite(amount)) return value

  // Ponto como separador decimal (como nos prints: "1.19 ETH", "26.846").
  const formatted = amount.toFixed(maximumFractionDigits).replace(/\.?0+$/, '')

  // Zero vira "0" e não "" (o regex acima consumiria o ".000" inteiro).
  return formatted === '' ? '0' : formatted
}
