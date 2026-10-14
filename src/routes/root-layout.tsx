import { Suspense } from 'react'
import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { Home, Heart, ShoppingBag, ShoppingCart, User, Wallet } from 'lucide-react'
import { DesktopSearch } from '@/components/desktop-search'
import { Logo } from '@/components/logo'
import { PageLoader } from '@/components/page-loader'
import { useCart } from '@/hooks/use-cart'
import { useSession } from '@/features/auth/session-context'
import { useRealtime } from '@/features/realtime/realtime-context'
import { cn } from 'cn'

/**
 * Casca do app.
 *
 * Duas cascas, uma por tamanho de tela — fiel ao Figma, que desenha o desktop e
 * o celular como composições diferentes:
 *
 *  - **Desktop (≥768px):** cabeçalho com a marca, a navegação editorial
 *    (Início/Mercado/Criadores/Aprenda, com âncoras na home) e a conta.
 *  - **Celular (<768px):** SEM cabeçalho global. Cada tela monta a própria
 *    barra do topo (busca, título, voltar). A navegação vive na barra inferior,
 *    com ícones e um botão central de carrinho em destaque.
 *
 * A navegação está sempre no DOM e é operável por teclado; no celular ela só
 * muda de forma. O link "pular para o conteúdo" é o primeiro focável.
 */
export function RootLayout() {
  const { status, user, signOut } = useSession()
  const { status: realtimeStatus } = useRealtime()
  const { itemCount } = useCart()
  const { pathname, hash } = useLocation()
  const navigate = useNavigate()
  const activeSection = hash.replace(/^#/, '')

  /** "Mercado" cobre o fluxo de compra; "Início" é só a home. */
  const mercadoActive = /^\/(cart|checkout|order|nft)\b/.test(pathname)

  function goToHomeSection(section?: string): void {
    void navigate({
      to: '/',
      hash: section,
      search: (previous) => previous,
      resetScroll: false,
      hashScrollIntoView: false,
    }).then(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const target = section ? document.getElementById(section) : null
          if (target) target.scrollIntoView({ block: 'start', behavior: 'auto' })
          else window.scrollTo({ top: 0, behavior: 'auto' })
        })
      })
    })
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <a
        href="#conteudo"
        className="sr-only-focusable absolute left-4 top-3 z-50 rounded-md bg-brand px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Pular para o conteúdo
      </a>

      <span className="sr-only" data-testid="realtime-status" aria-live="polite">
        Tempo real {realtimeStatus}
      </span>

      <header className="sticky top-0 z-40 hidden h-[68px] border-b border-line bg-canvas md:block">
        <div className="relative mx-auto flex h-full w-full max-w-page items-center px-5">
          <Logo />

          <nav
            aria-label="Principal"
            className="absolute left-1/2 flex -translate-x-1/2 items-center gap-4 lg:gap-6"
          >
            <HeaderNavLink
              to="/"
              hash={undefined}
              active={pathname === '/' && !activeSection}
              onActivate={() => goToHomeSection()}
            >
              Início
            </HeaderNavLink>
            <HeaderNavLink
              to="/"
              hash="catalogo"
              active={mercadoActive || (pathname === '/' && activeSection === 'catalogo')}
              onActivate={() => goToHomeSection('catalogo')}
            >
              Mercado
            </HeaderNavLink>
            <HeaderNavLink
              to="/"
              hash="criadores"
              active={pathname === '/' && activeSection === 'criadores'}
              onActivate={() => goToHomeSection('criadores')}
            >
              Criadores
            </HeaderNavLink>
            <HeaderNavLink
              to="/"
              hash="diario"
              active={pathname === '/' && activeSection === 'diario'}
              onActivate={() => goToHomeSection('diario')}
            >
              Aprenda
            </HeaderNavLink>
          </nav>

          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            <DesktopSearch />

            <Link
              to="/cart"
              aria-label={`Carrinho${itemCount > 0 ? `, ${itemCount} itens` : ''}`}
              title="Carrinho"
              className="relative flex size-9 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface hover:text-brand"
            >
              <ShoppingCart aria-hidden="true" className="size-5" />
              {itemCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-brand text-[9px] font-bold text-primary-foreground">
                  {itemCount}
                </span>
              ) : null}
            </Link>

            {status === 'authenticated' && user ? (
              <div className="flex items-center gap-4">
                <Link
                  to="/profile"
                  className="hidden text-sm text-ink-muted transition-colors hover:text-ink lg:inline"
                >
                  {user.displayName}
                </Link>
                <button
                  type="button"
                  data-testid="logout"
                  onClick={() => void signOut()}
                  className="text-sm text-ink-subtle underline-offset-4 transition-colors hover:text-ink hover:underline"
                >
                  Sair
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="rounded-md bg-brand px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-brand-strong"
              >
                Entrar
              </Link>
            )}
          </div>
        </div>
      </header>

      <main id="conteudo" className="flex-1 pb-24 md:pb-0">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>

      <nav
        aria-label="Principal (celular)"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface md:hidden"
      >
        <ul className="mx-auto flex max-w-page items-stretch justify-around px-2">
          <MobileNavItem to="/" icon={Home} label="Início" active={pathname === '/'} />
          <MobileNavItem to="/favorites" icon={Heart} label="Favoritos" />
          <li className="flex flex-1 items-center justify-center">
            <Link
              to="/cart"
              aria-label={`Carrinho${itemCount > 0 ? `, ${itemCount} itens` : ''}`}
              className="relative -mt-6 flex size-14 items-center justify-center rounded-full bg-brand text-primary-foreground shadow-lg shadow-brand/30 transition-transform active:scale-95"
            >
              <ShoppingBag aria-hidden="true" className="size-6" />
              {itemCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-canvas text-[10px] font-bold text-ink ring-2 ring-brand">
                  {itemCount}
                </span>
              ) : null}
            </Link>
          </li>
          <MobileNavItem to="/wallets" icon={Wallet} label="Carteiras" />
          <MobileNavItem to="/profile" icon={User} label="Perfil" />
        </ul>
      </nav>
    </div>
  )
}

/** Link da navegação editorial do desktop (âncoras da home). */
function HeaderNavLink({
  to,
  hash,
  active,
  onActivate,
  children,
}: {
  to: '/'
  hash: string | undefined
  active: boolean
  onActivate: () => void
  children: string
}) {
  return (
    <Link
      to={to}
      hash={hash}
      activeOptions={{ exact: true, includeHash: true }}
      resetScroll={false}
      hashScrollIntoView={false}
      aria-current={active ? 'page' : undefined}
      onClick={(event) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return
        }
        event.preventDefault()
        onActivate()
      }}
      className={cn(
        'relative py-1 text-sm transition-colors hover:text-ink',
        active
          ? 'font-bold text-brand after:absolute after:-bottom-1 after:left-0 after:h-1 after:w-full after:rounded-full after:bg-brand'
          : 'text-ink-subtle',
      )}
    >
      {children}
    </Link>
  )
}

/** Item da barra inferior do celular (ícone + rótulo acessível). */
function MobileNavItem({
  to,
  icon: Icon,
  label,
  active,
}: {
  to: '/favorites' | '/wallets' | '/profile' | '/'
  icon: typeof Home
  label: string
  active?: boolean
}) {
  return (
    <li className="flex-1">
      <Link
        to={to}
        aria-label={label}
        activeOptions={{ exact: to === '/' }}
        className="flex h-16 flex-col items-center justify-center gap-1 text-ink-subtle transition-colors [&.active]:text-brand"
      >
        {({ isActive }) => (
          <Icon aria-hidden="true" className={cn('size-5', (active ?? isActive) && 'text-brand')} />
        )}
      </Link>
    </li>
  )
}
