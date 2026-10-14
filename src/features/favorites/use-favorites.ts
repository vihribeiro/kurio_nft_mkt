import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/features/auth/session-context'
import { queryKeys } from '@/shared/api/query-keys'
import { addFavorite, fetchFavorites, removeFavorite } from './api'

/**
 * Favoritos com update otimista.
 *
 * O `toggle` assume o novo estado NA HORA (a lista é baratinha e o gesto do
 * usuário espera resposta imediata) e, se o servidor recusar, reverte para o
 * estado anterior. A invalidação no fim reconcilia com a verdade do mock.
 */
export function useFavorites() {
  const { scope, status } = useSession()
  const queryClient = useQueryClient()
  const key = queryKeys.favorites(scope)

  const query = useQuery({
    queryKey: key,
    queryFn: fetchFavorites,
    enabled: status === 'authenticated',
  })

  const ids = query.data ?? []
  const isFavorite = (nftId: string): boolean => ids.includes(nftId)

  const toggle = useMutation({
    mutationFn: (input: { nftId: string; save: boolean }) =>
      input.save ? addFavorite(input.nftId) : removeFavorite(input.nftId),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key })

      const previous = queryClient.getQueryData<string[]>(key) ?? []
      const next = input.save
        ? previous.includes(input.nftId)
          ? previous
          : [...previous, input.nftId]
        : previous.filter((id) => id !== input.nftId)
      queryClient.setQueryData(key, next)

      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key })
    },
  })

  return {
    favorites: ids,
    isFavorite,
    toggle,
  }
}
