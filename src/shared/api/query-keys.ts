/**
 * Chaves de query do TanStack Query, num só lugar.
 *
 * Estratégia de isolamento (ver ARCHITECTURE.md):
 *  - dados PÚBLICOS (catálogo, coleções) têm chave estável — não mudam por
 *    usuário e não precisam ser rebuscados no login;
 *  - dados do USUÁRIO (carrinho, pedidos, carteiras, perfil) carregam o
 *    `scope` (o id do usuário, ou `guest`) como prefixo. É isso que impede que
 *    o cache de uma conta seja lido por outra;
 *  - no logout o cache é limpo por inteiro, então nem uma janela de corrida
 *    deixa sobra.
 */

export interface CatalogFilters {
  collectionId?: string
  q?: string
  minPriceEth?: number
  maxPriceEth?: number
  sort?: 'recent' | 'price-asc' | 'price-desc' | 'name'
  tab?: 'todos' | 'novos' | 'alta'
  page?: number
  pageSize?: number
}

export const queryKeys = {
  session: ['session'] as const,

  catalog: {
    all: ['catalog'] as const,
    collections: ['catalog', 'collections'] as const,
    /** Prefixo de todas as listas — usado em `setQueriesData`. */
    lists: () => ['catalog', 'list'] as const,
    list: (filters: CatalogFilters) => ['catalog', 'list', filters] as const,
    detail: (nftId: string) => ['catalog', 'nft', nftId] as const,
  },

  cart: (scope: string) => ['cart', scope] as const,
  favorites: (scope: string) => ['favorites', scope] as const,
  orders: (scope: string) => ['orders', scope] as const,
  order: (scope: string, orderId: string) => ['orders', scope, orderId] as const,
  wallets: (scope: string) => ['wallets', scope] as const,
  profile: (scope: string) => ['profile', scope] as const,
} as const

/** Escopo de dados do usuário: o id da conta, ou `guest` para visitantes. */
export function sessionScope(userId: string | null | undefined): string {
  return userId ?? 'guest'
}
