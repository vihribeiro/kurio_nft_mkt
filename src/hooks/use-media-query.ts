import { useCallback, useSyncExternalStore } from 'react'

/**
 * Observa uma media query do CSS e devolve se ela casou ou não.
 *
 * Usada para decidir entre o diálogo (desktop) e a página de autenticação
 * (celular), e para adaptar o layout onde o Tailwind não cobre o caso.
 *
 * Implementado com `useSyncExternalStore` — e não com `useState` + efeito — para
 * ler a media query como uma fonte externa de verdade: sem o `setState` dentro
 * do efeito, não há render em cascata na montagem.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mediaQuery = window.matchMedia(query)
      mediaQuery.addEventListener('change', onStoreChange)
      return () => mediaQuery.removeEventListener('change', onStoreChange)
    },
    [query],
  )

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query])

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

/** Atalho para o breakpoint de desktop do app (>= 768px). */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 768px)')
}
