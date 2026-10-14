import { z } from 'zod'
import { http } from '@/shared/api/http'
import { orderSchema, type CheckoutRequest, type Order } from '@/shared/contracts/order'

export async function createOrder(input: CheckoutRequest): Promise<Order> {
  const { data } = await http.post('/orders', input)
  return orderSchema.parse(data)
}

export async function fetchOrder(orderId: string): Promise<Order> {
  const { data } = await http.get(`/orders/${orderId}`)
  return orderSchema.parse(data)
}

export async function fetchOrders(): Promise<Order[]> {
  const { data } = await http.get('/orders')
  return z.array(orderSchema).parse(data)
}
