import { useSearch } from '@tanstack/react-router'
import { AuthPanel } from '@/components/auth-panel'

/**
 * Entrar.
 *
 * Em telas largas a rota se desenha como DIÁLOGO (com scrim e foco preso); no
 * celular, como página inteira. O conteúdo é o mesmo — muda só o invólucro,
 * decidido pela largura.
 */
export function LoginScreen() {
  const { redirect } = useSearch({ from: '/login' })
  return <AuthPanel mode="login" redirect={redirect} />
}
