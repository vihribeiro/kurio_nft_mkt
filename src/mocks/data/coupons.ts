import Decimal from 'decimal.js'

/**
 * Cupons promocionais do mock.
 *
 * Determinísticos e em memória: o conjunto é fixo, para que o E2E saiba de
 * antemão o desconto esperado. O desconto é sempre recalculado pelo servidor a
 * partir do subtotal corrente — o cliente só exibe.
 */
export interface Coupon {
  code: string
  description: string
  kind: 'percent' | 'fixed'
  /** Percentual (ex.: `"10"` = 10%) ou valor fixo em ETH. */
  value: string
  /** ISO 8601; `null` = sem validade. */
  expiresAt: string | null
}

export const coupons: Coupon[] = [
  {
    code: 'KURIO10',
    description: '10% de desconto',
    kind: 'percent',
    value: '10',
    expiresAt: null,
  },
  {
    code: 'JUNGLE25',
    description: '25% de desconto',
    kind: 'percent',
    value: '25',
    expiresAt: null,
  },
  {
    code: 'EXPIROU',
    description: 'Cupom de lançamento (expirado)',
    kind: 'percent',
    value: '50',
    expiresAt: '2024-01-01T00:00:00.000Z',
  },
]

/** Busca por código, sem diferenciar maiúsculas/minúsculas. */
export function findCoupon(code: string): Coupon | undefined {
  const normalized = code.trim().toUpperCase()
  return coupons.find((coupon) => coupon.code === normalized)
}

export function isExpired(coupon: Coupon, now = Date.now()): boolean {
  return coupon.expiresAt !== null && new Date(coupon.expiresAt).getTime() < now
}

/**
 * Desconto do cupom sobre um subtotal, em ETH com 3 casas.
 *
 * Nunca passa do subtotal (um cupom não deixa o carrinho negativo).
 */
export function computeCouponDiscount(subtotalEth: string, coupon: Coupon): string {
  const subtotal = new Decimal(subtotalEth)

  const raw =
    coupon.kind === 'percent'
      ? subtotal.times(coupon.value).dividedBy(100)
      : new Decimal(coupon.value)

  return Decimal.min(raw, subtotal).toFixed(3)
}
