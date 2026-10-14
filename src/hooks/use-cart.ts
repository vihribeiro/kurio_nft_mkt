import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addCartItem,
  applyCartCoupon,
  fetchCart,
  quoteCart,
  removeCartCoupon,
  removeCartItem,
  setCartItemQuantity,
} from '@/features/cart/api'
import { useSession } from '@/features/auth/session-context'
import { queryKeys } from '@/shared/api/query-keys'

/**
 * Carrinho com os mutadores já ligados à invalidação de cache.
 *
 * Todo usuário (inclusive visitante) tem um carrinho no servidor; a chave de
 * query carrega o `scope` da sessão, então o cache nunca mistura contas.
 */
export function useCart() {
  const { scope } = useSession()
  const queryClient = useQueryClient()

  const cartKey = queryKeys.cart(scope)

  const cartQuery = useQuery({
    queryKey: cartKey,
    queryFn: fetchCart,
  })

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: cartKey })
  }

  const addItem = useMutation({
    mutationFn: (nftId: string) => addCartItem(nftId),
    onSuccess: refresh,
  })

  const removeItem = useMutation({
    mutationFn: (nftId: string) => removeCartItem(nftId),
    onSuccess: refresh,
  })

  const setQuantity = useMutation({
    mutationFn: (input: { nftId: string; quantity: number }) =>
      setCartItemQuantity(input.nftId, input.quantity),
    onSuccess: refresh,
  })

  const quote = useMutation({
    mutationFn: quoteCart,
    onSuccess: refresh,
  })

  const applyCoupon = useMutation({
    mutationFn: (code: string) => applyCartCoupon(code),
    onSuccess: refresh,
  })

  const removeCoupon = useMutation({
    mutationFn: removeCartCoupon,
    onSuccess: refresh,
  })

  return {
    cart: cartQuery.data,
    isPending: cartQuery.isPending,
    isError: cartQuery.isError,
    error: cartQuery.error,
    itemCount: cartQuery.data?.itemCount ?? 0,
    addItem,
    removeItem,
    setQuantity,
    quote,
    applyCoupon,
    removeCoupon,
  }
}
