import { QueryClient } from '@tanstack/react-query'

/**
 * Cliente único do TanStack Query.
 *
 * Estratégia de cache (detalhada em ARCHITECTURE.md):
 *  - `staleTime` curto: a fonte de verdade de preço é o REST + eventos.
 *  - `gcTime` curto: ao trocar de usuário/sair, os dados não podem sobreviver.
 *  - sem `refetchOnWindowFocus` agressivo: o tempo real já empurra mudanças.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})
