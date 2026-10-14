import { z } from 'zod'

/**
 * Favoritos do colecionador.
 *
 * A resposta é a lista de IDs — é o suficiente para a UI pintar o estado de
 * qualquer cartão sem precisar juntar com o catálogo. Os endpoints exigem
 * sessão; o estado é sempre por usuário.
 */
export const favoritesSchema = z.object({
  nftIds: z.array(z.string().min(1)),
})

export type Favorites = z.infer<typeof favoritesSchema>
