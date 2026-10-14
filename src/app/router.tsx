import { lazy, type ComponentType } from 'react'
import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { RequireAuth } from '@/components/require-auth'
import { parseCatalogSearch } from '@/features/catalog/search'
import { RootLayout } from '@/routes/root-layout'
import { NotFoundScreen } from '@/routes/not-found'
import { queryClient } from './query-client'

/**
 * Rotas em código (e não por arquivos).
 *
 * Cada tela é carregada sob demanda (`React.lazy`): o chunk inicial fica
 * pequeno e as rotas raras (pagar, carteiras, 404) só baixam quando entram. O
 * `RootLayout` envolve o `<Outlet />` em Suspense, então a troca de tela mostra
 * o esqueleto em vez de uma tela em branco.
 *
 * As rotas privadas passam pelo mesmo porteiro (`RequireAuth`): espera a sessão
 * decidir e, se anônima, leva ao login guardando o endereço de volta.
 *
 * Todas as rotas são endereçáveis e sobrevivem a um refresh (o host precisa
 * devolver o `index.html` para rotas desconhecidas; na Vercel isso é um
 * rewrite de SPA — ver `vercel.json`).
 */

/** Envolve a tela no porteiro de sessão. */
function guarded(Component: ComponentType) {
  return function GuardedRoute() {
    return (
      <RequireAuth>
        <Component />
      </RequireAuth>
    )
  }
}

/** `?redirect=` é compartilhado por login e cadastro. */
function authSearch(search: Record<string, unknown>): { redirect?: string } {
  return { redirect: typeof search.redirect === 'string' ? search.redirect : undefined }
}

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundScreen,
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: parseCatalogSearch,
  component: lazy(() => import('@/routes/home').then((m) => ({ default: m.HomeScreen }))),
})

const nftDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nft/$nftId',
  component: lazy(() =>
    import('@/routes/nft-detail').then((m) => ({ default: m.NftDetailScreen })),
  ),
})

const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cart',
  component: lazy(() => import('@/routes/cart').then((m) => ({ default: m.CartScreen }))),
})

const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/checkout',
  component: lazy(async () => {
    const { CheckoutScreen } = await import('@/routes/checkout')
    return { default: guarded(CheckoutScreen) }
  }),
})

const orderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/order/$orderId',
  component: lazy(async () => {
    const { OrderConfirmationScreen } = await import('@/routes/order-confirmation')
    return { default: guarded(OrderConfirmationScreen) }
  }),
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: authSearch,
  component: lazy(() => import('@/routes/login').then((m) => ({ default: m.LoginScreen }))),
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  validateSearch: authSearch,
  component: lazy(() => import('@/routes/register').then((m) => ({ default: m.RegisterScreen }))),
})

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: lazy(async () => {
    const { ProfileScreen } = await import('@/routes/profile')
    return { default: guarded(ProfileScreen) }
  }),
})

const walletsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/wallets',
  component: lazy(async () => {
    const { WalletsScreen } = await import('@/routes/wallets')
    return { default: guarded(WalletsScreen) }
  }),
})

const favoritesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/favorites',
  component: lazy(async () => {
    const { FavoritesScreen } = await import('@/routes/favorites')
    return { default: guarded(FavoritesScreen) }
  }),
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  nftDetailRoute,
  cartRoute,
  checkoutRoute,
  orderRoute,
  loginRoute,
  registerRoute,
  profileRoute,
  walletsRoute,
  favoritesRoute,
])

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  scrollRestoration: true,
})

/** Registra o roteador para que `Link`/`useParams` sejam tipados no app inteiro. */
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
