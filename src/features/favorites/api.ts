import { http } from '@/shared/api/http'
import { favoritesSchema } from '@/shared/contracts/favorite'

/**
 * Favoritos têm endpoints próprios e exigem sessão. Todas as respostas são a
 * lista de IDs (o contrato que o hook precisa para pintar o estado do card).
 */
export async function fetchFavorites(): Promise<string[]> {
  const { data } = await http.get('/favorites')
  return favoritesSchema.parse(data).nftIds
}

export async function addFavorite(nftId: string): Promise<string[]> {
  const { data } = await http.post('/favorites', { nftId })
  return favoritesSchema.parse(data).nftIds
}

export async function removeFavorite(nftId: string): Promise<string[]> {
  const { data } = await http.delete(`/favorites/${nftId}`)
  return favoritesSchema.parse(data).nftIds
}
