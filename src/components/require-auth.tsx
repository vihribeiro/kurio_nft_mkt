import { useEffect, useRef, type ReactNode } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useSession } from '@/features/auth/session-context'
import { PageLoader } from './page-loader'

/**
 * Porteiro de telas privadas.
 *
 * Espera a sessão decidir (o token pode estar no navegador e o perfil ainda
 * estar sendo buscado) e, quando anônima, leva para o login guardando o
 * endereço atual — o login devolve o usuário para onde ele estava.
 *
 * O desvio acontece no máximo UMA vez por montagem (`redirectedRef`). Sem essa
 * trava, o efeito volta a rodar na renderização intermediária — em que a
 * localização já mudou para `/login` mas o componente ainda não desmontou — e
 * cada volta empilha mais um `?redirect=`, num laço sem fim.
 *
 * Enquanto a sessão não está confirmada, também não renderizamos `children`:
 * dado privado não deve aparecer nem por um quadro para quem não está logado.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectedRef = useRef(false)

  useEffect(() => {
    if (status !== 'anonymous' || redirectedRef.current) return

    redirectedRef.current = true
    const redirect = location.href
    void navigate({
      to: '/login',
      search: redirect.startsWith('/') ? { redirect } : {},
      replace: true,
    })
  }, [status, navigate, location.href])

  if (status === 'authenticated') return <>{children}</>

  return <PageLoader />
}
