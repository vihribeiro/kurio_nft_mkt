import { http } from '@/shared/api/http'
import { cartSchema, type Cart } from '@/shared/contracts/cart'

export async function fetchCart(): Promise<Cart> {
  const { data } = await http.get('/cart')
  return cartSchema.parse(data)
}

export async function addCartItem(nftId: string): Promise<Cart> {
  const { data } = await http.post('/cart/items', { nftId })
  return cartSchema.parse(data)
}

export async function removeCartItem(nftId: string): Promise<Cart> {
  const { data } = await http.delete(`/cart/items/${nftId}`)
  return cartSchema.parse(data)
}

/** Define a quantidade de um item (a remoção fica com `removeCartItem`). */
export async function setCartItemQuantity(nftId: string, quantity: number): Promise<Cart> {
  const { data } = await http.patch(`/cart/items/${nftId}`, { quantity })
  return cartSchema.parse(data)
}

/** Cotação oficial do servidor (preços correntes + reserva nova). */
export async function quoteCart(): Promise<Cart> {
  const { data } = await http.post('/cart/quote')
  return cartSchema.parse(data)
}

/** Aplica um código promocional ao carrinho e devolve os totais recalculados. */
export async function applyCartCoupon(code: string): Promise<Cart> {
  const { data } = await http.post('/cart/coupon', { code })
  return cartSchema.parse(data)
}

/** Remove o cupom; os totais voltam ao valor cheio. */
export async function removeCartCoupon(): Promise<Cart> {
  const { data } = await http.delete('/cart/coupon')
  return cartSchema.parse(data)
}

export async function clearCart(): Promise<void> {
  await http.delete('/cart')
}
