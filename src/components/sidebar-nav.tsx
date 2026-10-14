import { Link } from '@tanstack/react-router'
import { useSession } from '@/features/auth/session-context'

export type SidebarSection = 'perfil' | 'carteiras'

/**
 * Menu lateral do "Minha conta" (perfil e carteiras), fiel à estrutura do
 * Figma. Itens sem rota própria são apresentados como rótulos da conta — o
 * foco de navegação fica onde o app tem funcionalidade de verdade.
 */
export function SidebarNav({ active }: { active: SidebarSection }) {
  const { signOut } = useSession()

  const itemClass = (isActive: boolean): string =>
    isActive
      ? 'flex w-full items-center gap-3 rounded-md bg-surface-overlay px-3 py-2 text-left text-sm font-medium text-ink'
      : 'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-ink-subtle transition-colors hover:bg-surface-raised hover:text-ink'

  const staticItem = 'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-ink-subtle'

  return (
    <nav aria-label="Minha conta" className="flex flex-col gap-1">
      <p className="px-3 pb-1 pt-2 text-sm font-bold text-ink">Meu perfil</p>

      {active === 'perfil' ? (
        <span className={itemClass(true)} aria-current="page">
          Dados do perfil
        </span>
      ) : (
        <span className={staticItem}>Dados do perfil</span>
      )}

      <Link to="/wallets" className={itemClass(active === 'carteiras')}>
        Carteiras
      </Link>

      <span className={staticItem}>Atividade</span>
      <span className={staticItem}>Lista de interesse</span>
      <span className={staticItem}>@ Ofertas</span>
      <span className={staticItem}>Arquivos baixados</span>
      <span className={staticItem}>Suporte</span>

      <span className="my-2 h-px bg-line" aria-hidden="true" />

      <button
        type="button"
        data-testid="logout"
        onClick={() => void signOut()}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-danger transition-colors hover:bg-surface-raised"
      >
        Sair
      </button>
    </nav>
  )
}
