import { Suspense } from 'react'
import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { ShoppingCart } from 'lucide-react'
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
                className="flex h-[35px] w-[100px] items-center justify-center gap-[7px] rounded-[6px] bg-brand text-xs font-medium text-canvas transition-colors hover:bg-brand-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <svg
                  aria-hidden="true"
                  viewBox="1230 32 18 18"
                  className="size-[18px] shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1247.16 41.1006H1237.13" />
                  <path d="M1244.72 38.6706L1247.16 41.1006L1244.72 43.5306" />
                  <path d="M1242.63 37.3583C1242.36 34.3749 1241.24 33.2916 1236.8 33.2916C1230.88 33.2916 1230.88 35.2166 1230.88 40.9999C1230.88 46.7833 1230.88 48.7083 1236.8 48.7083C1241.24 48.7083 1242.36 47.6249 1242.63 44.6416" />
                </svg>
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
        className="fixed inset-x-0 bottom-0 z-40 h-[95px] md:hidden"
      >
        <svg
          aria-hidden="true"
          viewBox="0 801 414 95"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 size-full text-surface"
          style={{ filter: 'drop-shadow(0 -10px 15px rgb(10 6 4 / 45%))' }}
        >
          <path
            fill="currentColor"
            d="M282.85 801C269.09 801 256.87 809.2 251.02 821.65C243.26 838.17 226.46 849.62 207 849.62C187.54 849.62 170.74 838.18 162.98 821.65C157.13 809.2 144.9 801 131.15 801H28.93C12.95 801 0 813.95 0 829.93V895.95H414V829.93C414 813.95 401.05 801 385.07 801H282.85Z"
          />
        </svg>

        <ul className="relative mx-auto h-full w-full max-w-page list-none p-0">
          <MobileNavItem
            to="/"
            glyph="home"
            label="Início"
            active={pathname === '/'}
            position="11.11%"
          />
          <MobileNavItem
            to="/favorites"
            glyph="favorites"
            label="Favoritos"
            active={pathname === '/favorites'}
            position="28.5%"
          />

          <li className="absolute left-1/2 top-[-31px] z-20 -translate-x-1/2">
            <Link
              to="/wallets"
              aria-label="Carteiras"
              aria-current={pathname === '/wallets' ? 'page' : undefined}
              className="flex size-[65px] items-center justify-center rounded-full transition-transform active:scale-95"
              style={{
                background: 'linear-gradient(180deg, rgb(210 138 76 / 40%) 0%, #d28a4c 100%)',
              }}
            >
              <MobileWalletTabIcon />
            </Link>
          </li>

          <MobileNavItem
            to="/cart"
            glyph="cart"
            label="Carrinho"
            active={/^\/(cart|checkout|order)\b/.test(pathname)}
            position="72.85%"
            itemCount={itemCount}
          />
          <MobileNavItem
            to="/profile"
            glyph="profile"
            label="Perfil"
            active={pathname === '/profile'}
            position="87.92%"
          />
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

/** Item da barra inferior do celular: posições e silhuetas do frame mobile. */
function MobileNavItem({
  to,
  glyph,
  label,
  active,
  position,
  itemCount = 0,
}: {
  to: '/favorites' | '/wallets' | '/profile' | '/' | '/cart'
  glyph: 'home' | 'favorites' | 'cart' | 'profile'
  label: string
  active: boolean
  position: string
  itemCount?: number
}) {
  return (
    <li
      className="absolute top-[53%] z-10 -translate-x-1/2 -translate-y-1/2"
      style={{ left: position }}
    >
      <Link
        to={to}
        aria-label={`${label}${itemCount > 0 ? `, ${itemCount} itens` : ''}`}
        aria-current={active ? 'page' : undefined}
        className={`relative flex size-10 items-center justify-center rounded-full transition-colors ${active ? 'text-brand-strong' : 'text-ink-muted'}`}
      >
        <MobileNavGlyph glyph={glyph} />
        {itemCount > 0 ? (
          <span className="absolute -right-1 -top-0.5 flex size-4 items-center justify-center rounded-full bg-brand text-[9px] font-bold text-primary-foreground">
            {itemCount}
          </span>
        ) : null}
      </Link>
    </li>
  )
}

function MobileNavGlyph({ glyph }: { glyph: 'home' | 'favorites' | 'cart' | 'profile' }) {
  if (glyph === 'home') {
    return (
      <svg aria-hidden="true" viewBox="36 841 20 20" className="size-5">
        <path
          fill="currentColor"
          d="M43.6123 858.311V855.763C43.6123 855.112 44.1435 854.585 44.7987 854.585H47.1938C47.5085 854.585 47.8102 854.709 48.0327 854.93C48.2552 855.151 48.3802 855.45 48.3802 855.763V858.311C48.3782 858.581 48.4851 858.841 48.677 859.033C48.8689 859.225 49.13 859.333 49.4024 859.333H51.0365C51.7997 859.335 52.5323 859.036 53.0726 858.501C53.613 857.965 53.9167 857.239 53.9167 856.481V849.222C53.9166 848.61 53.6434 848.03 53.1705 847.637L47.6117 843.23C46.6447 842.457 45.2593 842.482 44.3212 843.289L38.8892 847.637C38.3939 848.018 38.098 848.6 38.0833 849.222V856.474C38.0833 858.053 39.3728 859.333 40.9635 859.333H42.5602C43.126 859.333 43.5858 858.88 43.5899 858.318L43.6123 858.311Z"
        />
      </svg>
    )
  }

  if (glyph === 'favorites') {
    return (
      <svg aria-hidden="true" viewBox="108 842 20 18" className="h-[18px] w-5">
        <path
          fill="currentColor"
          d="M126.413 843.741C125.378 842.618 123.957 842 122.413 842C121.259 842 120.201 842.365 119.27 843.085C118.801 843.448 118.375 843.893 118 844.411C117.625 843.893 117.199 843.448 116.729 843.085C115.799 842.365 114.741 842 113.587 842C112.043 842 110.622 842.618 109.586 843.741C108.564 844.851 108 846.367 108 848.011C108 849.702 108.63 851.25 109.984 852.883C111.194 854.344 112.934 855.827 114.949 857.544C115.637 858.13 116.417 858.795 117.227 859.503C117.441 859.69 117.715 859.794 118 859.794C118.285 859.794 118.559 859.69 118.773 859.503C119.583 858.795 120.363 858.13 121.051 857.544C123.066 855.827 124.806 854.344 126.017 852.883C127.37 851.25 128 849.702 128 848.01C128 846.367 127.436 844.851 126.413 843.741Z"
        />
      </svg>
    )
  }

  if (glyph === 'cart') {
    return (
      <svg aria-hidden="true" viewBox="292 842 20 18" className="h-[18px] w-5">
        <path
          fill="currentColor"
          d="M310.333 847.801L309.39 853.778C309.218 854.956 308.275 855.714 307.074 855.714H298.838C297.723 855.714 296.694 854.872 296.522 853.778L295.493 846.791L295.235 844.855C295.15 844.35 294.721 844.013 294.12 844.013H293.52C293.176 844.013 292.833 843.677 292.833 843.34C292.833 843.003 293.176 842.667 293.52 842.667H294.12C295.321 842.667 296.351 843.508 296.436 844.687L296.608 846.034H308.789C309.218 846.034 309.647 846.202 309.904 846.539C310.248 846.875 310.333 847.38 310.333 847.801Z"
        />
        <path
          fill="currentColor"
          d="M307.245 859.333C307.719 859.333 308.103 858.956 308.103 858.491C308.103 858.027 307.719 857.65 307.245 857.65C306.771 857.65 306.387 858.027 306.387 858.491C306.387 858.956 306.771 859.333 307.245 859.333Z"
        />
        <path
          fill="currentColor"
          d="M298.667 859.333C299.14 859.333 299.525 858.956 299.525 858.491C299.525 858.027 299.14 857.65 298.667 857.65C298.193 857.65 297.809 858.027 297.809 858.491C297.809 858.956 298.193 859.333 298.667 859.333Z"
        />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" viewBox="357 842 14 18" className="h-[18px] w-[14px]">
      <path
        fill="currentColor"
        d="M364 850.83C366.266 850.83 368.103 849.002 368.103 846.748C368.103 844.494 366.266 842.667 364 842.667C361.734 842.667 359.898 844.494 359.898 846.748C359.898 849.002 361.734 850.83 364 850.83Z"
      />
      <path
        fill="currentColor"
        d="M366.137 852.531H361.863C359.385 852.531 357.333 854.571 357.333 857.037C357.333 857.633 357.59 858.143 358.103 858.398C358.872 858.823 360.581 859.333 364 859.333C367.419 859.333 369.128 858.823 369.898 858.398C370.325 858.143 370.667 857.633 370.667 857.037C370.667 854.486 368.615 852.531 366.137 852.531Z"
      />
    </svg>
  )
}

function MobileWalletTabIcon() {
  return (
    <svg aria-hidden="true" viewBox="190 788 35 31" className="h-[31px] w-[35px] text-ink">
      <path
        fill="currentColor"
        d="M207.382 803.891C203.285 803.891 199.188 803.891 195.091 803.891C194.961 803.891 194.827 803.894 194.702 803.867C194.254 803.768 193.952 803.337 194.006 802.893C194.061 802.448 194.44 802.111 194.913 802.109C195.984 802.103 197.055 802.106 198.126 802.106C205.323 802.106 212.521 802.107 219.719 802.108C219.858 802.108 220.001 802.105 220.135 802.136C220.574 802.24 220.864 802.655 220.818 803.092C220.77 803.539 220.395 803.887 219.925 803.889C218.714 803.897 217.504 803.893 216.293 803.893C213.323 803.893 210.352 803.893 207.383 803.893C207.382 803.893 207.382 803.892 207.382 803.891Z"
      />
      <path
        fill="currentColor"
        d="M204.555 815C203.205 814.798 201.82 814.722 200.511 814.365C197.765 813.617 196.195 811.724 195.744 808.927C195.578 807.893 195.475 806.847 195.356 805.806C195.283 805.176 195.584 804.763 196.132 804.696C196.677 804.629 197.076 804.982 197.136 805.528C197.266 806.708 197.356 807.898 197.579 809.062C197.981 811.163 199.702 812.629 201.837 812.817C202.846 812.905 203.854 813.018 204.861 813.134C205.595 813.219 205.934 814.035 205.495 814.631C205.305 814.89 205.081 814.964 204.555 815Z"
      />
      <path
        fill="currentColor"
        d="M219.446 800.398C219.431 800.535 219.432 800.678 219.395 800.809C219.308 801.119 219.002 801.378 218.742 801.383C218.3 801.392 217.8 801.064 217.698 800.65C217.625 800.356 217.622 800.044 217.582 799.741C217.457 798.784 217.397 797.814 217.188 796.876C216.76 794.956 215.533 793.738 213.614 793.323C212.474 793.076 211.297 793 210.136 792.847C210.007 792.83 209.876 792.824 209.75 792.792C209.331 792.686 209.058 792.287 209.111 791.871C209.17 791.408 209.527 791.054 209.973 791.086C211.504 791.196 213.043 791.307 214.512 791.777C216.863 792.53 218.345 794.158 218.905 796.54C219.201 797.799 219.302 799.103 219.49 800.387C219.476 800.391 219.461 800.394 219.446 800.398Z"
      />
      <path
        fill="currentColor"
        d="M219.422 805.881C219.299 807.167 219.209 808.581 218.817 809.944C218.078 812.514 215.896 814.289 213.237 814.549C212.155 814.655 211.078 814.811 209.999 814.944C209.617 814.992 209.201 814.623 209.121 814.165C209.04 813.706 209.329 813.255 209.783 813.194C210.326 813.12 210.878 813.106 211.421 813.033C212.322 812.913 213.257 812.88 214.113 812.608C215.97 812.02 217.007 810.664 217.279 808.745C217.424 807.725 217.531 806.7 217.634 805.675C217.693 805.082 218.08 804.668 218.601 804.698C219.104 804.727 219.452 805.174 219.422 805.881Z"
      />
      <path
        fill="currentColor"
        d="M195.329 800.275C195.528 798.955 195.621 797.608 195.945 796.319C196.601 793.711 198.349 792.118 200.959 791.533C202.134 791.269 203.348 791.178 204.545 791.017C204.727 790.993 204.923 790.991 205.098 791.033C205.512 791.131 205.755 791.51 205.715 791.94C205.674 792.391 205.368 792.691 204.929 792.74C203.847 792.861 202.764 792.971 201.687 793.123C199.411 793.443 197.834 795.023 197.524 797.285C197.375 798.369 197.257 799.459 197.13 800.546C197.078 800.984 196.702 801.312 196.242 801.306C195.796 801.3 195.415 800.945 195.391 800.508C195.386 800.435 195.39 800.36 195.39 800.286C195.37 800.282 195.35 800.279 195.329 800.275Z"
      />
    </svg>
  )
}
